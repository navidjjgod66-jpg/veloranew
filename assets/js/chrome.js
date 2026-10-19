/* ═══ VELORA · 11 — Chrome: header, dock, clocks, status, countdown, atmosphere ═══ */
import {
  $,
  $$,
  anyDialogOpen,
  byId,
  faNum,
  frameOnce,
  openDialog,
  SCROLL_TLS,
  scrollProgress,
  scrollToY,
  toast,
} from './core.js';
import { CATALOG } from './data.js';

/* Total unreserved capacity, shown in the header strip and the dock. */
const OPEN_SLOTS = Object.values(CATALOG).reduce((sum, p) => sum + (p.max - p.held), 0);

const SECTION_IDS = ['editions', 'work', 'studio', 'journal', 'contact'];

/* ─── Tehran atmosphere (time-of-day ambient) ───
   The page subtly shifts its ambient wash according to the real hour in
   Tehran. Dawn / day / dusk / night each carry a different emotional
   temperature — the site feels placed, not generic. */
function atmosphereInit() {
  const root = document.documentElement;
  let last = '';

  const paint = () => {
    try {
      const hour = Number(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Tehran',
          hour: 'numeric',
          hour12: false,
        }).format(new Date())
      );
      const phase =
        hour >= 5 && hour < 9
          ? 'dawn'
          : hour >= 9 && hour < 17
            ? 'day'
            : hour >= 17 && hour < 21
              ? 'dusk'
              : 'night';
      if (phase === last) return;
      last = phase;
      root.dataset.atmosphere = phase;
    } catch {
      root.dataset.atmosphere = 'night';
    }
  };

  paint();
  setInterval(paint, 5 * 60 * 1000); // re-evaluate every 5 minutes
}

/* Calls `onEnter(section)` whenever one of the sections crosses the viewport
   band described by `rootMargin`. Shared by the header nav and the dock. */
function watchSections(sections, rootMargin, onEnter) {
  if (!('IntersectionObserver' in window) || !sections.length) return;
  const io = new IntersectionObserver(
    entries => {
      for (const en of entries) if (en.isIntersecting) onEnter(en.target);
    },
    { rootMargin }
  );
  for (const section of sections) io.observe(section);
}

/* ─── Header ─── */

/* Hides the header on scroll-down and restores it on scroll-up. */
function headerInit() {
  const head = $('#siteHead');
  let scrolled = false,
    hidden = false,
    lastY = 0;

  /* One rAF-coalesced pass per scroll burst. No layout reads: the progress bar
     measures scrollable height separately and only when the layout changes. */
  const onScroll = frameOnce(() => {
    const y = scrollY;
    const nowScrolled = y > 24;
    if (nowScrolled !== scrolled) {
      scrolled = nowScrolled;
      head.classList.toggle('is-scrolled', scrolled);
    }

    const goingDown = y > lastY + 6;
    const goingUp = y < lastY - 6;
    if (goingDown && y > 320 && !anyDialogOpen()) {
      if (!hidden) {
        hidden = true;
        head.classList.add('is-hidden');
      }
    } else if (goingUp && hidden) {
      hidden = false;
      head.classList.remove('is-hidden');
    }
    lastY = y;
  });
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (!SCROLL_TLS) scrollProgress($('#readBar'));

  $('#menuBtn').addEventListener('click', () => openDialog($('#menuDialog')));
}

/* Highlights whichever section owns the middle of the viewport. */
function navHighlightInit() {
  const navLinks = $$('.nav a');
  if (!navLinks.length) return;

  const sections = SECTION_IDS.map(byId).filter(Boolean);
  watchSections(sections, '-40% 0px -50% 0px', section => {
    for (const link of navLinks) {
      if (link.getAttribute('href') === '#' + section.id)
        link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  });
}

/* The Tehran clock shown in the header, footer and menu. */
function clockInit() {
  let tehran = null;
  try {
    tehran = new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {}

  const clockTargets = ['lisClock', 'lisClock2', 'lisClock3', 'menuClock']
    .map(byId)
    .filter(Boolean);
  const paintClock = () => {
    const now = tehran ? tehran.format(new Date()) : '—:—';
    for (const el of clockTargets) el.textContent = now;
  };
  paintClock();
  setInterval(paintClock, 30000);
}

/* Footer year, availability strip and back-to-top. */
function footerInit() {
  $('#yr').textContent = faNum(new Date().getFullYear());

  const statusText = 'پشتیبانی از طریق فرم پیام';
  for (const id of ['studioStatus', 'studioStatus2', 'studioStatus3']) {
    const el = byId(id);
    if (el) el.textContent = statusText;
  }

  $('#toTop').addEventListener('click', () => scrollToY(0));
}

/* Time left until the end of the current quarter. */
function quarterCountdownInit() {
  const q4 = $('#q4Count');
  if (!q4) return;

  const paintQuarter = () => {
    try {
      const now = new Date();
      const quarterEnd = new Date(
        Date.UTC(now.getUTCFullYear(), (Math.floor(now.getUTCMonth() / 3) + 1) * 3, 1)
      );
      let ms = quarterEnd - now.getTime();
      const days = Math.floor(ms / 864e5);
      ms -= days * 864e5;
      const hours = Math.floor(ms / 36e5);
      q4.textContent = `${faNum(days)} روز و ${faNum(String(hours).padStart(2, '0'))} ساعت`;
    } catch {
      q4.textContent = 'چارک چهارم';
    }
  };
  paintQuarter();
  setInterval(paintQuarter, 60000);
}

function navInit() {
  headerInit();
  navHighlightInit();
  clockInit();
  footerInit();
  quarterCountdownInit();

  addEventListener('offline', () =>
    toast('به نظر آفلاین هستید. بریف شما روی همین دستگاه می‌ماند.')
  );
  addEventListener('online', () => toast('دوباره آنلاین شدید.'));
}

/* ─── Dock ─── */
/* A status rail plus one pinned action. It deliberately has no tabs of its own:
   the header nav covers desktop and the menu sheet covers small screens, so a
   second tab set with a sliding indicator was navigation theatre. */
function dockInit() {
  const dock = $('#dock');
  const hero = $('.hero');
  const contact = $('#contact');
  if (!dock || !contact) return;

  const status = $('#dockStatus');
  if (status) status.textContent = `چارک ۴ · ${faNum(OPEN_SLOTS)} ظرفیت`;

  /* Layout reads happen on resize, not on every scroll frame. */
  const heroGate = () => (hero ? hero.offsetHeight * 0.62 : 640);
  let gate = heroGate();

  let contactVisible = false,
    shown = false;
  function paint() {
    const next = scrollY > gate && !contactVisible && !anyDialogOpen();
    if (next === shown) return;
    shown = next;
    dock.classList.toggle('is-on', next);
    dock.setAttribute('aria-hidden', String(!next));
    document.body.classList.toggle('dock-visible', next);
  }
  const schedule = frameOnce(paint);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      entries => {
        contactVisible = entries[0].isIntersecting;
        schedule();
      },
      { threshold: 0.08 }
    ).observe(contact);
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener(
    'resize',
    () => {
      gate = heroGate();
      schedule();
    },
    { passive: true }
  );
  paint();

  if (!SCROLL_TLS) scrollProgress($('#dockProgress'));
}

export function chromeInit() {
  atmosphereInit();
  navInit();
  dockInit();
}
