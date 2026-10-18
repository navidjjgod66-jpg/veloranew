/* ═══ VELORA · 15 — Showcase: compare, craft lab, scroll journey ═══
   Every piece is progressive enhancement. Without this module the manifesto is
   plain text, the compare slider still works as a native range input, the lab
   tiles are static and the journey is an ordinary list (see showcase.css). */
import {
  $,
  $$,
  byId,
  clamp,
  faNum,
  fine,
  frameOnce,
  hasPremiumMotion,
  onFirstVisible,
} from './core.js';

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
  const paint = frameOnce(() => {
    const box = el.getBoundingClientRect();
    /* Starts when the block's top reaches 85% of the viewport and finishes when
       its bottom reaches 55%, so the last word is lit while still on screen. */
    const progress = clamp((innerHeight * 0.85 - box.top) / (innerHeight * 0.3 + box.height), 0, 1);
    const next = Math.round(progress * words.length);
    for (let i = lit; i < next; i++) words[i].classList.add('is-lit');
    for (let i = lit - 1; i >= next; i--) words[i].classList.remove('is-lit');
    lit = next;
  });
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

/* ─── Craft lab ─── */

/* Cubic-bezier evaluator, so the lab can both draw a curve and animate along
   it with the same maths the browser uses for `cubic-bezier()`. */
function bezier([x1, y1, x2, y2]) {
  const cx = 3 * x1,
    bx = 3 * (x2 - x1) - cx,
    ax = 1 - cx - bx;
  const cy = 3 * y1,
    by = 3 * (y2 - y1) - cy,
    ay = 1 - cy - by;
  const X = t => ((ax * t + bx) * t + cx) * t;
  const Y = t => ((ay * t + by) * t + cy) * t;
  const dX = t => (3 * ax * t + 2 * bx) * t + cx;

  const solve = x => {
    let t = x;
    for (let i = 0; i < 6; i++) {
      const err = X(t) - x;
      if (Math.abs(err) < 1e-5) return t;
      const d = dX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0,
      hi = 1;
    t = x;
    while (hi - lo > 1e-5) {
      const v = X(t);
      if (Math.abs(v - x) < 1e-5) return t;
      if (x > v) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  return { at: x => (x <= 0 ? 0 : x >= 1 ? 1 : Y(solve(x))), point: t => [X(t), Y(t)] };
}

const EASES = {
  linear: { label: 'خطی', curve: [0, 0, 1, 1] },
  out: { label: 'نرم', curve: [0.22, 1, 0.36, 1] },
  luxe: { label: 'لوکس', curve: [0.16, 1, 0.3, 1] },
  spring: { label: 'فنری', curve: [0.2, 0.9, 0.25, 1.15] },
};
/* Plot box inside the 200×110 viewBox: x 10→190, y 95 (value 0) → 15 (value 1). */
const PLOT = { x0: 10, w: 180, y0: 95, h: 80 };

function easingLab() {
  const tile = byId('easeTile');
  const curveEl = byId('easeCurve');
  const dot = byId('easeDot');
  const ball = byId('easeBall');
  const plot = tile && $('.ease-plot', tile);
  if (!tile || !curveEl || !dot || !ball) return;

  const chips = $$('[data-ease]', tile);
  let current = 'luxe',
    raf = 0;

  const place = (u, f) => {
    dot.setAttribute('cx', (PLOT.x0 + PLOT.w * u).toFixed(2));
    dot.setAttribute('cy', (PLOT.y0 - PLOT.h * f).toFixed(2));
    ball.style.setProperty('--v', f.toFixed(4));
  };

  const play = () => {
    cancelAnimationFrame(raf);
    const ease = bezier(EASES[current].curve);
    if (!canAnimate()) {
      place(1, 1);
      return;
    }
    const DURATION = 1100,
      started = performance.now();
    const step = now => {
      const u = clamp((now - started) / DURATION, 0, 1);
      place(u, ease.at(u));
      if (u < 1) raf = requestAnimationFrame(step);
    };
    place(0, 0);
    raf = requestAnimationFrame(step);
  };

  const select = key => {
    current = key;
    const ease = bezier(EASES[key].curve);
    let d = '';
    for (let i = 0; i <= 48; i++) {
      const [x, y] = ease.point(i / 48);
      d += `${i ? 'L' : 'M'}${(PLOT.x0 + PLOT.w * x).toFixed(2)} ${(PLOT.y0 - PLOT.h * y).toFixed(2)}`;
    }
    curveEl.setAttribute('d', d);
    for (const chip of chips) chip.setAttribute('aria-pressed', String(chip.dataset.ease === key));
    plot?.setAttribute('aria-label', `نمودار منحنی شتاب «${EASES[key].label}»`);
    play();
  };

  for (const chip of chips) chip.addEventListener('click', () => select(chip.dataset.ease));
  select(current);
}

export function showcaseInit() {
  manifestoInit();
  compareInit();
}
