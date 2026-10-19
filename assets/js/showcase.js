/* ═══ VELORA · 15 — Showcase: kinetic manifesto, compare slider ═══
   Every piece is progressive enhancement. Without this module the manifesto is
   plain text and the compare slider still works as a native range input
   (see showcase.css). */
import { $, byId, clamp, faNum, frameOnce, hasPremiumMotion, onFirstVisible } from './core.js';

/* Reduced motion, coarse pointers and lower-end mobile hardware keep the
   static layout. The premium feel stays intact without paying for a full
   motion system on compact devices. */
const canAnimate = () => hasPremiumMotion();

/* ─── Kinetic manifesto ───
   Words light up in reading order as the block scrolls through the viewport. */
function manifestoInit() {
  const el = $('.manifesto-text');
  if (!el || !canAnimate()) return;

  const words = [];
  const wrap = node => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        wrap(child);
        continue;
      }
      if (child.nodeType !== Node.TEXT_NODE) continue;
      const frag = document.createDocumentFragment();
      for (const part of child.textContent.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          frag.append(part);
          continue;
        }
        const span = document.createElement('span');
        span.className = 'sw';
        span.textContent = part;
        words.push(span);
        frag.append(span);
      }
      child.replaceWith(frag);
    }
  };
  wrap(el);
  el.classList.add('is-scrub');

  let lit = 0;
  /* Only the class flips are batched. The rect read stays on the scroll
     callback itself so `paint` always reports the position of the frame that
     triggered it — deferring the read to rAF would lag one frame behind and
     jitter the threshold where words light up. */
  const apply = frameOnce(() => {
    const next = pendingNext;
    pendingNext = -1;
    if (next < 0 || next === lit) return;
    if (next > lit) for (let i = lit; i < next; i++) words[i].classList.add('is-lit');
    else for (let i = lit - 1; i >= next; i--) words[i].classList.remove('is-lit');
    lit = next;
  });
  let pendingNext = -1;
  const paint = () => {
    const box = el.getBoundingClientRect();
    /* Starts when the block's top reaches 85% of the viewport and finishes when
       its bottom reaches 55%, so the last word is lit while still on screen. */
    const progress = clamp((innerHeight * 0.85 - box.top) / (innerHeight * 0.3 + box.height), 0, 1);
    pendingNext = Math.round(progress * words.length);
    apply();
  };
  addEventListener('scroll', paint, { passive: true });
  addEventListener('resize', paint, { passive: true });
  paint();
}

/* ─── Compare: one page, two crafts ─── */
const easeOutCubic = k => 1 - Math.pow(1 - k, 3);

/* Where the divider rests: far enough right that the headline is split between
   the two crafts, so one sentence shows both at once. */
const DIFF_REST = 72;

function compareInit() {
  const stage = byId('diffStage');
  const range = byId('diffRange');
  if (!stage || !range) return;

  const describe = v =>
    v <= 3
      ? 'فقط قالب آماده'
      : v >= 97
        ? 'فقط کار لومینا'
        : `${faNum(Math.round(v))} درصد از صفحه کار لومینا`;
  const set = v => {
    stage.style.setProperty('--split', v + '%');
    range.setAttribute('aria-valuetext', describe(v));
  };

  let touched = false;
  range.addEventListener('input', () => {
    touched = true;
    set(Number(range.value));
  });

  /* The slider opens on the template. One sweep carries the divider across the
     whole page so every part of the new craft is seen once, then settles where
     the two sides meet mid-headline. Any touch ends it. */
  if (!canAnimate()) {
    range.value = String(DIFF_REST);
    set(DIFF_REST);
    return;
  }
  const LEGS = [
    {
      from: 6,
      to: 94,
      ms: 1500,
      ease: k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
    },
    { from: 94, to: DIFF_REST, ms: 900, ease: easeOutCubic },
  ];
  range.value = String(LEGS[0].from);
  set(LEGS[0].from);
  onFirstVisible(
    stage,
    () => {
      if (touched) return;
      let leg = 0,
        started = performance.now();
      const step = now => {
        if (touched) return;
        const { from, to, ms, ease } = LEGS[leg];
        const k = clamp((now - started) / ms, 0, 1);
        const v = from + (to - from) * ease(k);
        range.value = String(v);
        set(v);
        if (k < 1) {
          requestAnimationFrame(step);
          return;
        }
        if (++leg < LEGS.length) {
          started = now;
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    },
    0.5
  );
}

export function showcaseInit() {
  manifestoInit();
  compareInit();
}
