/* ═══ VELORA · 14 — Orchestration & boot ═══ */
import {
  $,
  $$,
  accentInit,
  byId,
  closeDialog,
  dialogInit,
  getCustomFootSize,
  goHash,
  initScroll,
  normalizeCustomFootSize,
  openDialog,
  paintTheme,
  scrollBehavior,
  setCustomFootSize,
  themeInit,
  toast,
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
import { currentUser, saveCustomFootSize } from './api.js';
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
        const productDialog = el.closest('#readerContent');
        if (!el.dataset.size) {
          if (!productDialog) {
            openProduct(el.dataset.add);
            return;
          }
          const sizePicker = productDialog.querySelector('.pdp-sizes');
          if (sizePicker) {
            sizePicker.classList.remove('is-required');
            void sizePicker.offsetWidth;
            sizePicker.classList.add('is-required');
            sizePicker.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
          }
          toast('برای افزودن این مدل، ابتدا سایز را انتخاب کن.');
          return;
        }
        const variant = {
          size: el.dataset.size,
          color: el.dataset.color || null,
        };
        addToCart(el.dataset.add, variant);
        if (productDialog) {
          el.disabled = true;
          el.classList.add('is-added');
          const label = el.querySelector('.btn-label');
          if (label) label.textContent = 'سایز در سبد ثبت شد';
        }
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

/* ─── Size guide (3-step foot-measurement wizard) ─── */
function initSizeGuide() {
  const trigger = $('#sizeGuideTrigger');
  const dialog = $('#sizeGuideDialog');
  const steps = $$('[data-size-guide-step]');
  const lengthInput = $('#sizeGuideLength');
  const widthInput = $('#sizeGuideWidth');
  const lengthValue = $('#sizeGuideSummaryLength');
  const widthValue = $('#sizeGuideSummaryWidth');
  const nextButtons = $$('[data-size-guide-next]');
  const saveButton = $('#sizeGuideSaveBtn');
  const progressStates = $$('.size-guide-progress span');
  if (!trigger || !dialog || !steps.length || !lengthInput || !widthInput || !saveButton) return;

  const showStep = step => {
    for (const item of steps) {
      const isActive = Number(item.dataset.sizeGuideStep) === step;
      item.hidden = !isActive;
      item.classList.toggle('is-active', isActive);
    }
    progressStates.forEach((chip, index) => {
      chip.classList.toggle('is-active', index + 1 === step);
    });
  };

  /* Show a live centimetre read-out in the summary chip for one axis. */
  const paintSummary = (el, value) => {
    if (el) el.textContent = Number.isFinite(value) ? `${value.toFixed(1)} cm` : '—';
  };
  const readAxis = input => Number(input.value);

  const prefill = () => {
    const saved = getCustomFootSize();
    if (!saved) return;
    lengthInput.value = String(saved.length_cm);
    widthInput.value = String(saved.width_cm);
    if (lengthValue) lengthValue.textContent = `${saved.length_cm} cm`;
    if (widthValue) widthValue.textContent = `${saved.width_cm} cm`;
  };

  const currentFootInputs = () => ({
    length_cm: lengthInput.value,
    width_cm: widthInput.value,
  });

  const validateAndContinue = (nextStep, fieldName) => {
    const value = readAxis(fieldName === 'length' ? lengthInput : widthInput);
    if (!Number.isFinite(value) || value <= 0) {
      toast(
        fieldName === 'length'
          ? 'لطفاً طول پای خود را به سانتیمتر وارد کنید.'
          : 'لطفاً عرض پای خود را به سانتیمتر وارد کنید.'
      );
      return;
    }
    paintSummary(fieldName === 'length' ? lengthValue : widthValue, value);
    showStep(nextStep);
  };

  const saveFootSize = async () => {
    const normalized = normalizeCustomFootSize(currentFootInputs());
    if (!normalized) {
      toast('لطفاً طول و عرض پا را به‌صورت عددی و معتبر وارد کنید.');
      return;
    }
    const saved = setCustomFootSize(normalized);
    if (!saved) {
      toast('ثبت سایز سفارشی انجام نشد.');
      return;
    }
    if (currentUser()) {
      try {
        await saveCustomFootSize(saved);
        toast('سایز سفارشی شما در حساب کاربری ثبت شد.');
      } catch (error) {
        toast(error.message || 'ثبت سایز سفارشی روی سرور انجام نشد، اما روی دستگاه ذخیره شد.');
      }
    } else {
      toast('سایز سفارشی روی این دستگاه ذخیره شد و بعد از ورود به حساب، به سرور منتقل می‌شود.');
    }
    closeDialog(dialog);
  };

  trigger.addEventListener('click', () => {
    prefill();
    showStep(1);
    openDialog(dialog);
  });

  for (const button of nextButtons) {
    button.addEventListener('click', () => {
      if (button.dataset.sizeGuideNext === 'first') {
        validateAndContinue(2, 'length');
        return;
      }
      if (button.dataset.sizeGuideNext === 'second') {
        const normalized = normalizeCustomFootSize(currentFootInputs());
        if (!normalized) {
          toast('مقادیر واردشده برای طول و عرض پا معتبر نیستند.');
          return;
        }
        if (widthValue) widthValue.textContent = `${normalized.width_cm} cm`;
        showStep(3);
      }
    });
  }

  saveButton.addEventListener('click', () => {
    saveFootSize();
  });

  lengthInput.addEventListener('input', () => paintSummary(lengthValue, readAxis(lengthInput)));
  widthInput.addEventListener('input', () => paintSummary(widthValue, readAxis(widthInput)));

  showStep(1);
}

document.addEventListener('click', e => {
  const el = e.target instanceof Element ? e.target : null;
  if (!el) return;

  const storeAction = el.closest('[data-store-action]');
  if (storeAction) {
    const targets = {
      search: 'searchBtn',
      size: 'sizeGuideTrigger',
      wishlist: 'wishlistBtn',
      cart: 'cartBtn',
    };
    const target = byId(targets[storeAction.dataset.storeAction] || '');
    if (target) target.click();
    return;
  }

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

function mobileDockInit() {
  if (!byId('mobileShopDock')) return;

  const badges = [
    ['mobileCartCount', 'cartCount'],
    ['mobileWishlistCount', 'wishlistCount'],
  ];
  for (const [targetId, sourceId] of badges) {
    const target = byId(targetId);
    const source = byId(sourceId);
    if (!target || !source) continue;
    const sync = () => {
      target.textContent = source.textContent.trim();
      target.hidden = source.hidden || !source.textContent.trim();
    };
    sync();
    if ('MutationObserver' in window) {
      new MutationObserver(sync).observe(source, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
  }
}

/* ─── Boot ─── */
paintTheme();
initScroll();
themeInit();
accentInit();
dialogInit();

window.addEventListener('velora:prices-updated', () => {
  renderEditions();
  renderShop();
  renderWork();
  syncWishlistButtons(document);
});

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
initSizeGuide();
showcaseInit();
syncWishlistButtons(document);
renderWishlist();
mobileDockInit();

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
