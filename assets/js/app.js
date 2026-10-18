/* ═══ VELORA · 14 — Orchestration & boot ═══ */
import {
  $,
  $$,
  accentInit,
  byId,
  closeDialog,
  dialogInit,
  goHash,
  initScroll,
  paintTheme,
  themeInit,
} from './core.js';
import {
  renderEditions,
  renderJournal,
  renderShop,
  renderWork,
  journalInit,
  railInit,
  shopInit,
} from './render.js';
import { openCase, openEssay, openProduct, readerInit, shareProduct } from './reader.js';
import {
  addToCart,
  cartInit,
  renderWishlist,
  syncWishlistButtons,
  toggleWishlist,
} from './cart.js';
import { CATALOG, getProductRouteId } from './data.js';
import { paletteInit } from './palette.js';
import { chromeInit } from './chrome.js';
import { beginBrief, formInit } from './form.js';
import { showcaseInit } from './showcase.js';
import { authInit } from './auth.js';
import * as fx from './fx.js';

/* Dynamic content is wired by delegation, so the document itself stays the
   single source of truth no matter which renderer produced the markup.
   Each entry is [attribute, handler]; when an element carries several of these
   attributes the first entry wins. */
const ACTIONS = [
  [
    'data-add',
    el => {
      if (!el.disabled) {
        const variant =
          el.dataset.size || el.dataset.color
            ? { size: el.dataset.size || null, color: el.dataset.color || null }
            : null;
        addToCart(el.dataset.add, variant);
      }
    },
  ],
  [
    'data-wishlist',
    (el, e) => {
      e.preventDefault();
      toggleWishlist(el.dataset.wishlist);
      syncWishlistButtons(document);
      renderWishlist();
    },
  ],
  ['data-qv', el => openProduct(el.dataset.qv)],
  ['data-share-product', el => shareProduct(el.dataset.shareProduct)],
  ['data-case', el => openCase(Number(el.dataset.case))],
  [
    'data-essay',
    (el, e) => {
      e.preventDefault();
      openEssay(el.dataset.essay);
    },
  ],
  ['data-next-case', el => openCase(Number(el.dataset.nextCase))],
  ['data-next-essay', el => openEssay(el.dataset.nextEssay)],
  [
    'data-enquire',
    el => {
      const id = el.dataset.enquire;
      closeDialog($('#readerDialog'), () => beginBrief([id]));
    },
  ],
];
const ACTION_SELECTOR = ACTIONS.map(([attr]) => `[${attr}]`).join(',');

document.addEventListener('click', e => {
  const el = e.target instanceof Element ? e.target : null;
  if (!el) return;

  const action = el.closest(ACTION_SELECTOR);
  if (action) {
    const [, run] = ACTIONS.find(([attr]) => action.hasAttribute(attr));
    run(action, e);
    return;
  }

  /* Same-page anchors are smooth-scrolled, and out of the menu first. */
  const anchor = el.closest('a[href^="#"]');
  if (!anchor) return;
  const id = anchor.getAttribute('href').slice(1);
  if (!id || !byId(id)) return;
  e.preventDefault();
  if ($('#menuDialog').open) closeDialog($('#menuDialog'), () => goHash(id));
  else goHash(id);
});

/* ─── Boot ─── */
paintTheme();
initScroll();
themeInit();
accentInit();
dialogInit();

/* Render before wiring so every listener sees the final DOM. */
renderEditions();
renderShop();
renderWork();
renderJournal();

cartInit();
railInit();
shopInit();
journalInit();
paletteInit();
chromeInit();
formInit();
readerInit();
authInit();
showcaseInit();
syncWishlistButtons(document);
renderWishlist();

fx.veilInit();
fx.revealInit();

/* Cosmetic effects load off the critical path. */
const idle = fn =>
  'requestIdleCallback' in window
    ? requestIdleCallback(() => fn(), { timeout: 900 })
    : setTimeout(fn, 140);

for (const init of [fx.shaderInit, fx.cursorInit, fx.specularInit, fx.countersInit]) idle(init);

const syncProductHashRoute = () => {
  const id = getProductRouteId(window.location.hash || window.location.href);
  if (!id || !Object.hasOwn(CATALOG, id)) return;
  openProduct(id);
};

window.addEventListener('hashchange', () => {
  const id = getProductRouteId(window.location.hash || window.location.href);
  if (id && Object.hasOwn(CATALOG, id)) openProduct(id);
});

requestAnimationFrame(() => {
  document.body.classList.add('ready');
  for (const el of $$('.hero .rv')) el.classList.add('in');
  syncProductHashRoute();
});
