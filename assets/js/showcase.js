/* ═══ VELORA · 15 — Showcase: kinetic manifesto, compare slider ═══
   Every piece is progressive enhancement. Without this module the manifesto is
   plain text and the compare slider still works as a native range input
   (see showcase.css). */
import { $, clamp, frameOnce, hasPremiumMotion } from './core.js';

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

export function showcaseInit() {
  manifestoInit();
}
