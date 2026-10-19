/* ═══ VELORA · 6 — Core: DOM, environment, frame loop, scroll, theme, accent, dialogs, toast ═══ */

/* ─── DOM ─── */
/**
 * Get the first element matching `sel` within `root` (defaults to `document`).
 * @param {string} sel - CSS selector
 * @param {Element|Document} [root=document] - scope
 * @returns {Element|null}
 */
export const $ = (sel, root = document) => root.querySelector(sel);

/**
 * Get all elements matching `sel` within `root` as a real Array.
 * @param {string} sel - CSS selector
 * @param {Element|Document} [root=document] - scope
 * @returns {Element[]}
 */
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * Element by id — the single accessor for id lookups.
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export const byId = id => document.getElementById(id);

/* ─── Environment ─── */
const hasWindow = typeof window !== 'undefined';
const hasDocument = typeof document !== 'undefined';
const safeMatchMedia = query => {
  if (!hasWindow || typeof window.matchMedia !== 'function') {
    return { matches: false, addEventListener() {}, removeEventListener() {} };
  }
  return window.matchMedia(query);
};
const safeCSSSupports = (property, value) => {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
  return CSS.supports(property, value);
};

export const motion = safeMatchMedia('(prefers-reduced-motion: reduce)');
export const fine = safeMatchMedia('(hover: hover) and (pointer: fine)');
export const coarsePointer = safeMatchMedia('(pointer: coarse)');
export const systemDark = safeMatchMedia('(prefers-color-scheme: dark)');
export const TIER =
  hasDocument && document.documentElement ? Number(document.documentElement.dataset.tier || 0) : 0;

export const hasPremiumMotion = () =>
  !motion.matches && TIER < 3 && !coarsePointer.matches && innerWidth >= 760;
/* Single source of truth for "respect the user's motion preference" in any
   scroll API (`scrollTo`, `scrollIntoView`): instant when reduced motion is on. */
export const scrollBehavior = () => (motion.matches ? 'auto' : 'smooth');
export const SCROLL_TLS = safeCSSSupports('animation-timeline', 'scroll()');
export const VIEW_TLS = safeCSSSupports('animation-timeline', 'view()');
export const VT = hasDocument && 'startViewTransition' in document;

/* ─── Formatting ─── */
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
/**
 * Convert Western digits to Persian/Arabic-Indic digits for UI display.
 * @param {number|string} n
 * @returns {string}
 */
/* Fast path: one native regex pass replaces the old per-character loop that
   rebuilt the string through thousands of concatenations. Strings without any
   digit short-circuit on the probe test and return untouched. */
const ASCII_DIGIT_G = /[0-9]/g;
const PERSIAN_DIGIT_G = /[۰-۹]/g;
const ARABIC_DIGIT_G = /[٠-٩]/g;
const UNICODE_DIGIT_PROBE = /[۰-۹٠-٩]/;
/* Global twin of the probe — drives faNum's fold pass. A /g regex carries
   `lastIndex` state between calls, so it must never be the one used with
   `.test()` above. */
const UNICODE_DIGIT_G = /[۰-۹٠-٩]/g;
const DIGIT_INDEX = new Map([
  ...[...PERSIAN_DIGITS].map((d, i) => [d, i]),
  ...[...ARABIC_DIGITS].map((d, i) => [d, i]),
]);
/* Precomputed Persian forms of the small integers that dominate call sites
   (counts, badges, star loops) — a lookup beats format+fold every time. */
const FA_NUM_SMALL = Array.from({ length: 100 }, (_, n) =>
  String(n).replace(ASCII_DIGIT_G, d => PERSIAN_DIGITS[d.charCodeAt(0) - 48])
);
/**
 * Convert Western digits to Persian/Arabic-Indic digits for UI display.
 * @param {number|string} n
 * @returns {string}
 */
export const faNum = n => {
  if (Number.isInteger(n) && n >= 0 && n < 100) return FA_NUM_SMALL[n];
  const s = typeof n === 'string' ? n : String(n);
  /* The formatter output and most UI copy are plain ASCII: fold those with a
     single digit-class replace and skip the Unicode probe entirely. */
  if (ASCII_DIGIT_G.test(s))
    return s.replace(ASCII_DIGIT_G, d => PERSIAN_DIGITS[d.charCodeAt(0) - 48]);
  if (!UNICODE_DIGIT_PROBE.test(s)) return s;
  return s.replace(UNICODE_DIGIT_G, d => PERSIAN_DIGITS[DIGIT_INDEX.get(d)]);
};

/**
 * Fold Persian and Arabic-Indic digits back to Western ASCII digits, e.g. for
 * normalising phone numbers or OTP codes typed on either keyboard layout.
 * @param {any} value
 * @returns {string}
 */
export const latinDigits = value =>
  String(value ?? '')
    .replace(PERSIAN_DIGIT_G, char => String(DIGIT_INDEX.get(char)))
    .replace(ARABIC_DIGIT_G, char => String(DIGIT_INDEX.get(char)));

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/* Non-global probe used for the fast path; the /g regex below drives replace.
   A global regex carries `lastIndex` state between calls, so it must never be
   the one used with `.test()` here. */
const UNSAFE_PROBE = /[&<>"']/;
const UNSAFE_G = /[&<>"']/g;
/**
 * Escape HTML-sensitive characters. Returns the string unchanged when it
 * contains nothing to escape — the common case for catalog copy — skipping
 * the regex replace entirely.
 * @param {any} s
 * @returns {string}
 */
export const esc = s => {
  const str = typeof s === 'string' ? s : String(s);
  if (!UNSAFE_PROBE.test(str)) return str;
  return str.replace(UNSAFE_G, c => ENTITIES[c]);
};

const moneyFormatter = new Intl.NumberFormat('fa-IR', {
  useGrouping: true,
  maximumFractionDigits: 0,
});
/* Prices repeat across cards, cart lines and summaries; grouping output is
   pure, so one Map lookup replaces format+fold on every hit. The bound keeps
   a long session from growing it without limit. */
const MONEY_CACHE_MAX = 256;
const moneyCache = new Map();
/**
 * Format a price in Iranian Toman with Persian digits.
 * @param {number|null|undefined} n
 * @returns {string}
 */
export const money = n => {
  if (n === null || n === undefined || n === '') return 'قیمت اعلام نشده';
  const numeric = Number(n);
  if (!Number.isFinite(numeric) || numeric < 0) return 'قیمت اعلام نشده';
  let hit = moneyCache.get(numeric);
  if (hit === undefined) {
    hit = `${faNum(moneyFormatter.format(numeric))} تومان`;
    if (moneyCache.size >= MONEY_CACHE_MAX) moneyCache.clear();
    moneyCache.set(numeric, hit);
  }
  return hit;
};
const iconCache = new Map();

/**
 * Return a cached `<svg><use>` symbol. Catalog copy renders the same handful of
 * icons hundreds of times; caching the markup avoids re-templating on every
 * paint.
 * @param {string} id - symbol id
 * @param {string} [cls=''] - extra class
 * @returns {string}
 */
export const icon = (id, cls = '') => {
  const key = id + '\0' + cls;
  let hit = iconCache.get(key);
  if (hit === undefined) {
    hit = `<svg class="icon ${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
    iconCache.set(key, hit);
  }
  return hit;
};
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const haptic = pattern => {
  try {
    if ('vibrate' in navigator && !motion.matches) navigator.vibrate(pattern);
  } catch {}
};

/* Search key — folds Arabic letter variants, tatweel/zero-width marks and
   Persian digits so a query still matches regardless of the keyboard layout
   or whether the content was typed with Arabic or Persian codepoints.
   Built as char-code → replacement pairs so every entry (including the
   invisible ones) is reviewable by number instead of by lookalike glyph. */
const FOLD = new Map([
  [0x0643, 'ک'], // kaf → Persian keheh
  [0x064a, 'ی'],
  [0x0649, 'ی'],
  [0x0626, 'ی'], // ya / alef maqsura / hamza-on-ya
  [0x0623, 'ا'],
  [0x0625, 'ا'],
  [0x0622, 'ا'],
  [0x0671, 'ا'], // hamza + madda alefs
  [0x0624, 'و'], // waw-hamza → waw
  [0x0629, 'ه'],
  [0x06c0, 'ه'], // teh marbuta / heh-doachashmee → heh
  [0x066b, '.'],
  [0x066c, ','], // Arabic decimal / group marks
  [0x0640, ''], // tatweel
  [0x200c, ''],
  [0x200d, ''], // ZWNJ / ZWJ
  [0x00a0, ' '], // nbsp
  ...Array.from({ length: 10 }, (_, i) => [0x06f0 + i, String(i)]), // Persian digits
  ...Array.from({ length: 10 }, (_, i) => [0x0660 + i, String(i)]), // Arabic-Indic digits
]);
const FOLDABLE = new RegExp(
  `[${[...FOLD.keys()].map(cp => '\\u' + cp.toString(16).padStart(4, '0')).join('')}]`,
  'g'
);
const DIACRITICS = /[\u0300-\u036f\u064b-\u065f\u0670\u06d6-\u06ed]/g;
/* Three regex passes plus an NFD normalization cost ~0.8µs per call, and the
   search field folds the same handful of queries and catalog strings over and
   over. Memoizing keeps the steady-state cost at one Map lookup; the cache is
   bounded so a free-typed query stream cannot grow it without limit. */
const NORM_MAX = 200;
const normCache = new Map();
export const norm = s => {
  const str = typeof s === 'string' ? s : String(s);
  let hit = normCache.get(str);
  if (hit !== undefined) return hit;
  hit = str
    .toLowerCase()
    .replace(FOLDABLE, c => FOLD.get(c.codePointAt(0)))
    .normalize('NFD')
    .replace(DIACRITICS, '');
  if (normCache.size >= NORM_MAX) normCache.clear();
  normCache.set(str, hit);
  return hit;
};

/* ─── Persistence ─── */
const MEMORY_STORAGE = new Map();
const parseJsonSafe = (raw, fallback) => {
  if (raw === null || raw === undefined || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};
const storage = (() => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
})();

export const ls = {
  text(key, fallback) {
    if (storage) {
      try {
        const v = storage.getItem(key);
        return v === null ? fallback : v;
      } catch {
        return fallback;
      }
    }
    return MEMORY_STORAGE.has(key) ? MEMORY_STORAGE.get(key) : fallback;
  },
  json(key, fallback) {
    if (storage) {
      try {
        const v = storage.getItem(key);
        return parseJsonSafe(v, fallback);
      } catch {
        return fallback;
      }
    }
    if (!MEMORY_STORAGE.has(key)) return fallback;
    return parseJsonSafe(MEMORY_STORAGE.get(key), fallback);
  },
  setText(key, value) {
    if (storage) {
      try {
        storage.setItem(key, value);
        return;
      } catch {}
    }
    MEMORY_STORAGE.set(key, String(value));
  },
  setJson(key, value) {
    if (storage) {
      try {
        storage.setItem(key, JSON.stringify(value));
        return;
      } catch {}
    }
    MEMORY_STORAGE.set(key, JSON.stringify(value));
  },
  remove(key) {
    if (storage) {
      try {
        storage.removeItem(key);
        return;
      } catch {}
    }
    MEMORY_STORAGE.delete(key);
  },
};

const CUSTOM_FOOT_SIZE_KEY = 'velora.custom-foot-size';
export function normalizeCustomFootSize(value) {
  if (!value || typeof value !== 'object') return null;
  const length = Number(value.length_cm ?? value.length ?? value.lengthInCm);
  const width = Number(value.width_cm ?? value.width ?? value.widthInCm);
  if (!Number.isFinite(length) || !Number.isFinite(width)) return null;
  const normalizedLength = Number(length.toFixed(1));
  const normalizedWidth = Number(width.toFixed(1));
  if (
    normalizedLength < 10 ||
    normalizedLength > 45 ||
    normalizedWidth < 5 ||
    normalizedWidth > 30
  ) {
    return null;
  }
  return {
    length_cm: normalizedLength,
    width_cm: normalizedWidth,
  };
}

export function getCustomFootSize() {
  const stored = ls.json(CUSTOM_FOOT_SIZE_KEY, null);
  return normalizeCustomFootSize(stored);
}

export function setCustomFootSize(value) {
  const normalized = normalizeCustomFootSize(value);
  if (!normalized) return null;
  ls.setJson(CUSTOM_FOOT_SIZE_KEY, normalized);
  return normalized;
}

export function clearCustomFootSize() {
  ls.remove(CUSTOM_FOOT_SIZE_KEY);
}

/* ─── Shared frame loop ───
   Every animation on the page runs off one rAF chain instead of each effect
   owning a loop. Work pauses while the tab is hidden, and subscribers stop
   themselves by unsubscribing — no running flags, no per-effect listeners. */
/* Subscriber storage uses the Map-as-set idiom: deleting from the map while
   iterating its live `values()` view is safe per spec, so mid-frame
   unsubscribes take effect immediately without copying the set every frame. */
const frameTasks = new Map();
let frameId = 0,
  lastFrame = 0;

/* The chain is considered live while a rAF is queued (frameId) or a task is
   mid-flight inside runFrame (running). Any subscriber added during that
   in-flight window is picked up by the next scheduled frame. */
let running = false;

function pump() {
  if (!frameId && !running && frameTasks.size && !document.hidden) {
    frameId = requestAnimationFrame(runFrame);
  }
}

function runFrame(now) {
  frameId = 0;
  const dt = lastFrame ? Math.min(now - lastFrame, 50) : 16.7;
  lastFrame = now;
  running = true;
  try {
    /* Iterate the live view: entries deleted before they are reached are
       skipped, and a throwing task is dropped instead of poisoning the loop. */
    for (const [task] of frameTasks) {
      try {
        task(dt, now);
      } catch (error) {
        frameTasks.delete(task);
        console.error('[VELORA] Animation subscriber disabled after an error:', error);
      }
    }
  } finally {
    running = false;
    pump();
  }
}

export function onFrame(fn) {
  frameTasks.set(fn, true);
  pump();
  return () => frameTasks.delete(fn);
}

function pauseFrames() {
  if (frameId) cancelAnimationFrame(frameId);
  frameId = 0;
  lastFrame = 0;
}
/* Pausing the loop does not unsubscribe anyone, so the chain has to be
   restarted by hand when the tab comes back — otherwise the effects that stay
   subscribed would never draw again. */
if (hasDocument) {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseFrames();
    else pump();
  });
}

/* Coalesces bursts of calls (scroll, resize, observer callbacks) into a single
   run of `fn` on the next animation frame. `schedule.cancel()` drops a pending
   run, for teardown. */
export function frameOnce(fn) {
  let id = 0;
  const schedule = () => {
    if (id) return;
    id = requestAnimationFrame(() => {
      id = 0;
      fn();
    });
  };
  schedule.cancel = () => {
    if (id) cancelAnimationFrame(id);
    id = 0;
  };
  return schedule;
}

/* Runs start/stop while the element is on screen and the tab is visible —
   replaces the per-effect IntersectionObserver + visibilitychange pair.
   `start` may return a teardown function, which is called before `stop`. */
export function runWhileOnscreen(el, start, stop) {
  let onScreen = false,
    visible = !document.hidden,
    running = false,
    teardown = null;

  const sync = () => {
    const want = onScreen && visible;
    if (want === running) return;
    running = want;
    if (want) {
      teardown = start() || null;
    } else {
      if (teardown) teardown();
      teardown = null;
      if (stop) stop();
    }
  };

  const io = new IntersectionObserver(entries => {
    onScreen = entries[0].isIntersecting;
    sync();
  });
  io.observe(el);

  const onVisibility = () => {
    visible = !document.hidden;
    sync();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    if (running) {
      if (teardown) teardown();
      if (stop) stop();
    }
  };
}

/* Run a callback the first time an element enters view.
   Returning a disposer lets callers stop observing during teardown. */
export function onFirstVisible(el, callback, threshold = 0.5) {
  if (!el || typeof callback !== 'function') return () => {};

  if (!('IntersectionObserver' in window)) {
    callback();
    return () => {};
  }

  let active = true;
  const io = new IntersectionObserver(
    entries => {
      if (!active || !entries.some(entry => entry.isIntersecting)) return;
      active = false;
      io.disconnect();
      callback();
    },
    { threshold }
  );
  io.observe(el);

  return () => {
    active = false;
    io.disconnect();
  };
}

/* Reveal helper shared by motion modules. */
export function revealOnScreen(el, threshold = 0.5) {
  if (!el) return () => {};
  return onFirstVisible(el, () => el.classList.add('in'), threshold);
}

/* ─── Palette change broadcast ───
   Effects that bake accent/theme colours into a canvas subscribe here instead
   of being poked through window globals. */
const paletteHooks = new Set();
export const onPaletteChange = fn => {
  paletteHooks.add(fn);
  return () => paletteHooks.delete(fn);
};
function emitPaletteChange() {
  for (const fn of paletteHooks) fn();
}

/* ─── View transitions ───
   A superseded transition never runs its update callback, which would silently
   drop a theme change or a dialog swap. While one is in flight the update is
   applied directly instead, so the DOM change always lands. */
let transitioning = false;
export function transition(update) {
  if (motion.matches || !VT || transitioning) {
    update();
    return;
  }
  transitioning = true;
  try {
    document
      .startViewTransition(update)
      .finished.catch(() => {})
      .finally(() => {
        transitioning = false;
      });
  } catch {
    transitioning = false;
    update();
  }
}

/* ─── Smooth scroll — Lenis on the shared ticker, native fallback ───
   Lenis used to be pumped by GSAP's ticker. GSAP is gone: it contributed
   115KB across two origins to animate scroll positions that the browser now
   does natively, and ScrollTrigger had zero animations registered — it was
   only ever handed `ScrollTrigger.update`. Lenis is now driven by the same
   `onFrame` loop as every other effect, so smooth scrolling costs no extra
   requestAnimationFrame chain and no extra dependency. */
const HEAD_OFFSET = 80; // sticky header height kept clear when jumping to a section
let lenis = null;
export function initScroll() {
  if (motion.matches || typeof Lenis === 'undefined') return;
  lenis = new Lenis({
    duration: 1.2,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 2,
  });
  /* The shared loop passes (dt, now) and already pauses on tab-hide, which is
     exactly the contract Lenis wants — one frame in, one frame out. */
  onFrame((_dt, now) => lenis.raf(now));
  document.documentElement.classList.add('lenis');
}
export function scrollToY(y) {
  const top = Math.max(0, y);
  if (lenis) lenis.scrollTo(top, { duration: 1.2 });
  else scrollTo({ top, behavior: scrollBehavior() });
}
export function goHash(id, push = true) {
  const el = byId(String(id).replace('#', ''));
  if (!el) return;
  /* Distance from the top of the document to the element, in current pixels. */
  scrollToY(el.getBoundingClientRect().top + scrollY - HEAD_OFFSET);
  if (push) {
    try {
      history.replaceState(null, '', '#' + id);
    } catch {}
  }
}

/* Shared "re-measure on layout change" wiring: window resize plus a
   ResizeObserver on the given element where the browser has one.
   Returns a teardown for the observers it created. */
export function onLayoutChange(remeasure, el) {
  addEventListener('resize', remeasure, { passive: true });
  let observer = null;
  if (el && 'ResizeObserver' in window) {
    observer = new ResizeObserver(remeasure);
    observer.observe(el);
  }
  return () => {
    removeEventListener('resize', remeasure);
    observer?.disconnect();
  };
}

/* Drives a scaleX progress bar from page scroll.
   Scrollable height is measured once per layout change instead of per frame. */
export function scrollProgress(bar) {
  if (!bar) return () => {};
  let max = 0;

  const measure = () => {
    max = document.documentElement.scrollHeight - innerHeight;
  };
  const paint = () => {
    bar.style.transform = `scaleX(${max > 0 ? clamp(scrollY / max, 0, 1) : 0})`;
  };
  const schedule = frameOnce(paint);
  const remeasure = () => {
    measure();
    schedule();
  };

  measure();
  paint();
  addEventListener('scroll', schedule, { passive: true });
  const stopLayout = onLayoutChange(remeasure, document.body);

  return () => {
    removeEventListener('scroll', schedule);
    stopLayout();
    schedule.cancel();
  };
}

/* ─── Toast ─── */
let toastTimer = 0;
let toastAction = null;

function hideToast() {
  clearTimeout(toastTimer);
  $('#toast')?.classList.remove('show');
}

/* The action lives in module state and one document-level listener is wired
   once, so re-rendering the toast markup never stacks up click handlers. */
export function toast(message, actionLabel, action) {
  const el = $('#toast');
  if (!el) return;
  clearTimeout(toastTimer);
  toastAction = actionLabel && action ? action : null;
  el.innerHTML = `${icon('i-check')}<span>${esc(message)}</span>${actionLabel ? `<button type="button" id="toastAction">${esc(actionLabel)}</button>` : ''}`;
  el.classList.add('show');
  toastTimer = setTimeout(hideToast, 4600);
}

if (hasDocument) {
  document.addEventListener('click', e => {
    if (!e.target.closest('#toastAction')) return;
    const run = toastAction;
    hideToast();
    if (run) run();
  });
}

/* ─── Theme ─── */
const THEMES = ['auto', 'light', 'dark'];
const THEME_LABEL = { auto: 'خودکار', light: 'روشن', dark: 'تیره' };
const THEME_ICON = { auto: 'i-auto', light: 'i-sun', dark: 'i-moon' };
let theme = ls.text('lm-theme', 'dark');
if (!THEMES.includes(theme)) theme = 'dark';

export const resolvedTheme = () =>
  theme === 'auto' ? (systemDark.matches ? 'dark' : 'light') : theme;

export function paintTheme() {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.dataset.theme = theme;
  $('#themeIcon')?.setAttribute('href', '#' + THEME_ICON[theme]);
  $('#themeBtn')?.setAttribute('aria-label', `پوستهٔ رنگی: ${THEME_LABEL[theme]}.`);
  emitPaletteChange();
}

function transitionTheme(update, x, y) {
  if (motion.matches || !VT) {
    update();
    return;
  }
  const root = document.documentElement;
  root.style.setProperty('--vt-x', `${x}px`);
  root.style.setProperty('--vt-y', `${y}px`);
  root.style.setProperty(
    '--vt-r',
    `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`
  );
  transition(update);
}

export function themeInit() {
  $('#themeBtn')?.addEventListener('click', e => {
    const b = e.currentTarget.getBoundingClientRect();
    haptic(6);
    transitionTheme(
      () => {
        theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
        ls.setText('lm-theme', theme);
        paintTheme();
        toast(`پوسته · ${THEME_LABEL[theme]}`);
      },
      b.left + b.width / 2,
      b.top + b.height / 2
    );
  });
  if (systemDark.addEventListener)
    systemDark.addEventListener('change', () => {
      if (theme === 'auto') paintTheme();
    });
}

/* ─── Accent ─── */
const ACCENTS = {
  gold: 'شامپاینی',
  platinum: 'پلاتین',
  rose: 'کوارتز صورتی',
  emerald: 'وردیگریس',
  sapphire: 'آبی فرازمینی',
};

export function accentInit() {
  const swatches = $$('.ad');
  let current = ls.text('lm-accent', 'gold');
  if (!ACCENTS[current]) current = 'gold';

  const apply = (accent, announce) => {
    document.documentElement.dataset.accent = accent;
    ls.setText('lm-accent', accent);
    for (const swatch of swatches)
      swatch.setAttribute('aria-pressed', String(swatch.dataset.accent === accent));
    emitPaletteChange();
    if (announce) toast(`رنگ تأکیدی · ${ACCENTS[accent]}`);
  };

  apply(current, false);
  for (const swatch of swatches)
    swatch.addEventListener('click', () => apply(swatch.dataset.accent, true));
}

/* ─── Dialogs ─── */
let openCount = 0;
export const anyDialogOpen = () => openCount > 0;

/* Return-focus targets live in a WeakMap keyed by the dialog instead of on an
   ad-hoc expando property, so the DOM elements stay untouched. */
const returnFocus = new WeakMap();

function releaseScrollLock() {
  if (!openCount) document.documentElement.classList.remove('modal-open');
}

export function openDialog(d) {
  if (!d || d.open) return;
  /* Each dialog owns its own return target. This preserves focus when a
     secondary dialog closes back into an already-open dialog. */
  returnFocus.set(d, document.activeElement);
  transition(() => {
    d.showModal();
    openCount++;
    document.documentElement.classList.add('modal-open');
    document.documentElement.classList.toggle('dialog-open', openCount > 0);
  });
}

export function closeDialog(d, after) {
  if (!d || !d.open) {
    if (after) after();
    return;
  }
  const finish = () => {
    d.close();
    releaseScrollLock();
    const back = returnFocus.get(d);
    returnFocus.delete(d);
    if (back && document.contains(back)) back.focus({ preventScroll: true });
    if (after) after();
  };
  if (motion.matches || !VT) {
    finish();
    return;
  }
  d.classList.add('is-closing');
  transition(() => {
    d.classList.remove('is-closing');
    finish();
  });
}

export function dialogInit() {
  for (const d of $$('dialog')) {
    const sheet = d.querySelector('.sheet-shell, .reader-shell');
    if (sheet) {
      let startY = 0;
      let active = false;
      let delta = 0;

      const resetSheet = () => {
        active = false;
        startY = 0;
        delta = 0;
        sheet.style.transform = 'translateY(0)';
        sheet.style.transition = 'transform 0.25s var(--e-out)';
      };

      sheet.addEventListener(
        'pointerdown',
        e => {
          if (window.innerWidth > 759 || !d.open || sheet.scrollTop > 0) return;
          if (e.target.closest('button, input, textarea, select, a')) return;
          active = true;
          startY = e.clientY;
          delta = 0;
          sheet.style.transition = 'none';
          sheet.setPointerCapture?.(e.pointerId);
        },
        { passive: true }
      );

      sheet.addEventListener(
        'pointermove',
        e => {
          if (!active) return;
          delta = Math.max(0, e.clientY - startY);
          if (delta > 0) sheet.style.transform = `translateY(${delta}px)`;
        },
        { passive: true }
      );

      sheet.addEventListener('pointerup', () => {
        if (!active) return;
        if (delta > 120) closeDialog(d);
        resetSheet();
      });

      sheet.addEventListener('pointercancel', resetSheet);
    }

    d.addEventListener('close', () => {
      openCount = Math.max(0, openCount - 1);
      document.documentElement.classList.toggle('dialog-open', openCount > 0);
      releaseScrollLock();
    });
    d.addEventListener('cancel', e => {
      e.preventDefault();
      closeDialog(d);
    });
    /* Backdrop press: pointerdown fires before a drag that starts on the
       backdrop can turn into something else, so dismissal stays reliable. */
    d.addEventListener('pointerdown', e => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        closeDialog(d);
    });
  }
  if (hasDocument) {
    document.addEventListener('click', e => {
      const trigger = e.target.closest('[data-close]');
      if (!trigger) return;
      const d = byId(trigger.dataset.close);
      if (d) closeDialog(d);
    });
  }
}
