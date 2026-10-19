/* ═══ VELORA · 9 — Cart, wishlist & checkout flow ═══ */
import {
  $,
  $$,
  closeDialog,
  esc,
  faNum,
  goHash,
  haptic,
  icon,
  ls,
  money,
  openDialog,
  toast,
} from './core.js';
import { CATALOG, isProduct } from './data.js';
import { apiRequest, bootstrap, currentUser } from './api.js';
import { openAuth } from './auth.js';

const STORAGE_KEY = 'lm-cart';
const WISHLIST_KEY = 'lm-wishlist';
const VARIANT_KEY = 'lm-product-variants';
const REVIEW_KEY = 'lm-product-reviews';

const starterReviews = {};

const knownIds = raw =>
  Array.isArray(raw) ? [...new Set(raw.filter(id => typeof id === 'string' && isProduct(id)))] : [];

let cart = [];
let variants = {};
let wishlist = [];
const memory = {};

const readJson = (key, fallback) => {
  try {
    const value = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (value === null) {
      if (Object.hasOwn(memory, key)) return memory[key];
      return fallback;
    }
    const parsed = JSON.parse(value);
    memory[key] = parsed;
    return parsed;
  } catch {
    if (!Object.hasOwn(memory, key)) memory[key] = fallback;
    return memory[key];
  }
};

const writeJson = (key, value) => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  memory[key] = value;
};

export const inCart = id => cart.includes(id);
export const getVariant = id => variants[id] || null;
export const getWishlist = () => [...wishlist];
export const isWishlisted = id => wishlist.includes(id);

export const getVerifiedPurchases = () => [];
export const isVerifiedPurchase = () => false;
export const markVerifiedPurchase = () => false;

export function getProductReviews(id) {
  if (!isProduct(id)) return [];
  const raw = readJson(REVIEW_KEY, {});
  const reviews = Array.isArray(raw[id]) ? raw[id] : [];
  const validReviews = reviews.filter(value => value && typeof value === 'object');
  if (validReviews.length) return validReviews.map(review => ({ ...review, verified: false }));

  const seed = Array.isArray(starterReviews[id]) ? starterReviews[id] : [];
  return seed.map(review => ({
    author: String(review.author || 'خریدار').trim() || 'خریدار',
    rating: Number(review.rating) || 5,
    text: String(review.text || '').trim() || 'محصول باکیفیت و حرفه‌ای است.',
    createdAt: Number(review.createdAt) || Date.now(),
    verified: Boolean(review.verified),
  }));
}

export function addProductReview(id, review = {}) {
  if (!isProduct(id) || !isVerifiedPurchase(id)) return false;
  const text = String(review.text || '').trim();
  const rating = Number(review.rating);
  if (!text || !Number.isFinite(rating) || rating < 1 || rating > 5) return false;

  const payload = {
    author: String(review.author || 'خریدار تأییدشده').trim() || 'خریدار تأییدشده',
    rating: Math.round(rating),
    text,
    createdAt: Date.now(),
    verified: true,
  };

  const raw = readJson(REVIEW_KEY, {});
  const reviews = Array.isArray(raw[id]) ? raw[id] : [];
  reviews.push(payload);
  raw[id] = reviews.slice(-20);
  writeJson(REVIEW_KEY, raw);
  return true;
}

export function getReviewSummary(id) {
  const reviews = getProductReviews(id);
  const count = reviews.length;
  const average = count
    ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / count
    : 0;
  return { reviews, count, average: Number(average.toFixed(1)) };
}

function load() {
  return knownIds(ls.json(STORAGE_KEY, []));
}

function loadWishlist() {
  return knownIds(ls.json(WISHLIST_KEY, []));
}

const save = () => ls.setJson(STORAGE_KEY, cart);
const saveWishlist = () => ls.setJson(WISHLIST_KEY, wishlist);
const saveVariants = () => ls.setJson(VARIANT_KEY, variants);
const loadVariants = () => {
  const raw = ls.json(VARIANT_KEY, {});
  return raw && typeof raw === 'object' ? raw : {};
};

export function setVariant(id, variant) {
  if (!isProduct(id)) return false;
  if (!variant || (!variant.size && !variant.color)) {
    delete variants[id];
    saveVariants();
    return false;
  }
  variants[id] = variant;
  saveVariants();
  return true;
}

export function syncWishlistButtons(root = typeof document === 'undefined' ? null : document) {
  if (!root || !root.querySelectorAll) return;
  const buttons = root.querySelectorAll('[data-wishlist]');
  for (const btn of buttons) {
    const active = isWishlisted(btn.dataset.wishlist);
    btn.classList.toggle('is-wishlisted', active);
    btn.setAttribute('aria-pressed', String(active));
    btn.setAttribute('aria-label', active ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها');
  }
}

export function getCheckoutSummary(ids = cart) {
  const selected = [...new Set((ids || []).filter(isProduct))];
  const items = selected.map(id => {
    const product = CATALOG[id];
    const variant = getVariant(id);
    return {
      id,
      no: product.no,
      name: product.name,
      price: product.price,
      variant,
      lineTotal: product.price,
    };
  });
  const hasPrices = items.every(item => Number.isSafeInteger(item.price) && item.price >= 1000);
  const subtotal = hasPrices ? items.reduce((sum, item) => sum + item.lineTotal, 0) : null;
  const total = subtotal;

  return { items, subtotal, shipping: null, tax: null, total };
}

export function renderWishlist() {
  const body = $('#wishlistBody');
  if (!body) return;

  const count = $('#wishlistCount');
  if (count) {
    count.textContent = faNum(wishlist.length);
    count.hidden = wishlist.length === 0;
  }

  const menuWishlistQuickCount = $('#menuWishlistQuickCount');
  if (menuWishlistQuickCount) menuWishlistQuickCount.textContent = faNum(wishlist.length);

  if (!wishlist.length) {
    body.innerHTML = `
      <div class="wishlist-empty">
        <span class="wishlist-mark">${icon('i-star')}</span>
        <h3>هنوز علاقه‌مندی‌ای ندارید.</h3>
        <p>محصول‌های دلخواه را با کلیک روی دکمه ستاره ذخیره کنید.</p>
      </div>
    `;
    return;
  }

  body.innerHTML = wishlist
    .map(id => {
      const p = CATALOG[id];
      return `
        <div class="wishlist-item">
          <span class="cart-swatch" aria-hidden="true" style="--pa:${p.pal[0]};--pb:${p.pal[1]}"></span>
          <div class="wishlist-copy">
            <span class="mono">${p.no}</span>
            <h3>${esc(p.name)}</h3>
            <small>${esc(p.kind)} · ${money(p.price)}</small>
          </div>
          <div class="wishlist-actions">
            <button class="btn btn-solid btn-sm" type="button" data-add="${id}" data-label="افزودن"><span class="btn-label">افزودن</span>${icon('i-arrow', 'arr')}</button>
            <button class="icon-btn" type="button" data-wishlist-remove="${id}" aria-label="حذف ${esc(p.name)}">${icon('i-close')}</button>
          </div>
        </div>
      `;
    })
    .join('');

  syncWishlistButtons(document);
}

export function toggleWishlist(id) {
  if (!isProduct(id)) return false;
  const exists = wishlist.includes(id);
  wishlist = exists ? wishlist.filter(value => value !== id) : [id, ...wishlist];
  saveWishlist();
  if (typeof document !== 'undefined') {
    renderWishlist();
  }
  const menuWishlistQuickCount = $('#menuWishlistQuickCount');
  if (menuWishlistQuickCount) menuWishlistQuickCount.textContent = faNum(wishlist.length);
  return !exists;
}

function paintCart() {
  const count = cart.length;
  const badge = $('#cartCount');
  if (badge) {
    badge.textContent = faNum(count);
    badge.hidden = count === 0;
  }
  const cartBtn = $('#cartBtn');
  if (cartBtn) cartBtn.setAttribute('aria-label', `سبد خرید، ${faNum(count)} مورد`);

  const menuCartQuickCount = $('#menuCartQuickCount');
  if (menuCartQuickCount) menuCartQuickCount.textContent = faNum(count);

  const dockCartBadge = $('#dockCartBadge');
  if (dockCartBadge) dockCartBadge.textContent = faNum(count);

  for (const btn of $$('[data-add]')) {
    const held = cart.includes(btn.dataset.add);
    btn.disabled = held;
    btn.classList.toggle('is-added', held);
    const label = $('.btn-label', btn);
    if (label) label.textContent = held ? 'در سبد خرید است' : btn.dataset.label || 'افزودن به سبد';
  }

  const body = $('#cartBody');
  const footer = $('#cartFooter');
  if (!count) {
    if (footer) footer.hidden = true;
    if (body) {
      body.innerHTML = `<div class="cart-empty">${icon('i-bag')}<h3>سبد خرید شما خالی است.</h3><p>برای شروع، یک مدل کفش را به سبد اضافه کنید.</p><button class="btn btn-solid" type="button" data-browse>مشاهدهٔ محصولات</button></div>`;
    }
    return;
  }

  if (footer) footer.hidden = false;
  body.innerHTML = cart
    .map(id => {
      const p = CATALOG[id];
      const variant = getVariant(id);
      const variantText =
        variant && (variant.size || variant.color)
          ? `<small class="mono">${variant.size ? `سایز ${variant.size}` : ''}${variant.size && variant.color ? ' · ' : ''}${variant.color ? `رنگ ${variant.color}` : ''}</small>`
          : '';
      return `<div class="cart-line"><span class="cart-swatch" aria-hidden="true" style="--pa:${p.pal[0]};--pb:${p.pal[1]}"></span><div><span class="mono">${p.no}</span><h3>${esc(p.name)}</h3>${variantText}</div><button class="cart-remove" type="button" data-remove="${id}" aria-label="حذف ${esc(p.name)}">${icon('i-close')}</button></div>`;
    })
    .join('');

  const hasPrices = cart.every(id => Number.isSafeInteger(CATALOG[id].price) && CATALOG[id].price >= 1000);
  const subtotal = hasPrices ? cart.reduce((sum, id) => sum + CATALOG[id].price, 0) : null;
  const totals = $('#cartTotals');
  if (totals) {
    totals.innerHTML = `<div class="total"><span>جمع اقلام</span><b>${hasPrices ? money(subtotal) : 'پس از تنظیم قیمت قطعی'}</b></div>`;
  }
}

export function addToCart(id, variant = null) {
  if (!isProduct(id)) return;
  if (cart.includes(id)) {
    if (variant) setVariant(id, variant);
    toast('این مدل از قبل در سبد خرید شماست.', 'دیدن سبد', openCart);
    return;
  }
  cart.push(id);
  if (variant) setVariant(id, variant);
  save();
  paintCart();
  haptic(10);
  const suffix =
    variant && (variant.size || variant.color)
      ? ` · ${variant.size || ''}${variant.size && variant.color ? ' / ' : ''}${variant.color || ''}`
      : '';
  toast(`${CATALOG[id].no}${suffix} به سبد خرید اضافه شد.`, 'دیدن سبد', openCart);
}

function removeFromCart(id) {
  cart = cart.filter(x => x !== id);
  delete variants[id];
  save();
  saveVariants();
  paintCart();
  toast(`${CATALOG[id].no} حذف شد.`);
}

export function openCart() {
  paintCart();
  openDialog($('#cartDialog'));
}

const checkoutItemsPayload = () =>
  cart.map(id => ({
    id,
    size: variants[id] && variants[id].size ? String(variants[id].size) : '',
    color: variants[id] && variants[id].color ? String(variants[id].color) : '',
  }));

let checkoutQuote = null;

export async function openCheckout() {
  if (!cart.length) return;
  const body = $('#checkoutBody');
  const dialog = $('#checkoutDialog');
  const placeOrder = $('#placeOrder');
  if (!body || !dialog || !placeOrder) return;

  checkoutQuote = null;
  placeOrder.disabled = true;
  placeOrder.textContent = 'بررسی اتصال امن…';
  body.innerHTML =
    '<div class="checkout-panel"><p class="checkout-notice" role="status">در حال بررسی نشست، قیمت نهایی و اتصال امن فروشگاه…</p></div>';
  openDialog(dialog);

  try {
    const state = await bootstrap(true);
    if (!state.user) {
      closeDialog(dialog, openAuth);
      toast('برای ثبت سفارش ابتدا با پیامک وارد حساب خود شوید.');
      return;
    }
    if (!state.checkoutReady) {
      body.innerHTML =
        '<div class="checkout-panel"><p class="eyebrow">پرداخت امن</p><h3 class="reader-title">پیکربندی فروشگاه کامل نیست.</h3><p class="checkout-notice" role="status">قیمت‌های قطعی، سیاست ارسال/مالیات، پایگاه داده و شناسهٔ درگاه باید در تنظیمات خصوصی سرور ثبت شوند. تا آن زمان اطلاعات نشانی جمع‌آوری نمی‌شود و هیچ پرداختی آغاز نخواهد شد.</p></div>';
      placeOrder.disabled = true;
      placeOrder.textContent = 'پرداخت فعلاً غیرفعال است';
      return;
    }

    const result = await apiRequest('quote', { body: { items: checkoutItemsPayload() } });
    checkoutQuote = result.quote;
    const user = currentUser();
    body.innerHTML = `
      <div class="checkout-layout">
        <form id="checkoutForm" class="checkout-panel commerce-form" novalidate>
          <div class="checkout-section">
            <p class="eyebrow">تحویل سفارش</p>
            <h3 class="reader-title" style="margin:0">جزئیات ارسال</h3>
            <p class="checkout-notice">شمارهٔ همراه پس از تأیید پیامکی ثبت شده است؛ قیمت نهایی و مبلغ ارسالی از سرور محاسبه می‌شود.</p>
            <p class="commerce-verified">شمارهٔ تأییدشده: <b class="mono" dir="ltr">${esc(user ? user.mobile : '')}</b></p>
          </div>
          <div class="field field--full">
            <label for="shippingName">نام و نام خانوادگی گیرنده</label>
            <input class="control" id="shippingName" name="name" autocomplete="name" maxlength="120" minlength="2" required />
          </div>
          <div class="field field--full">
            <label for="shippingPostalCode">کد پستی ده‌رقمی</label>
            <input class="control" id="shippingPostalCode" name="postal_code" inputmode="numeric" autocomplete="postal-code" pattern="[0-9۰-۹]{10}" minlength="10" maxlength="10" required />
          </div>
          <div class="field field--full">
            <label for="shippingAddress">نشانی کامل</label>
            <textarea class="control" id="shippingAddress" name="address" autocomplete="street-address" minlength="15" maxlength="1000" rows="4" required></textarea>
          </div>
          <p class="checkout-notice">با ادامه، سفارش در سرور ثبت می‌شود و برای پرداخت به درگاه رسمی زرین‌پال منتقل می‌شوید. ثبت سفارش نهایی فقط پس از تأیید سروری تراکنش انجام می‌شود.</p>
          <p class="commerce-message" id="checkoutStatus" role="status" aria-live="polite"></p>
        </form>
        <aside class="checkout-summary" aria-label="خلاصه سفارش">
          <p class="eyebrow">خلاصهٔ نهایی از سرور</p>
          <div class="summary-items">
            ${checkoutQuote.items.map(item => `
              <div class="summary-item">
                <div><strong>${esc(item.name)}</strong><span>${esc(item.no)}${item.size ? ' · سایز ' + esc(item.size) : ''}${item.color ? ' · رنگ ' + esc(item.color) : ''}</span></div>
                <b>${money(item.price_toman)}</b>
              </div>
            `).join('')}
          </div>
          <div class="summary-line"><span>جمع اقلام</span><b>${money(checkoutQuote.subtotal_toman)}</b></div>
          <div class="summary-line"><span>ارسال</span><b>${money(checkoutQuote.shipping_toman)}</b></div>
          <div class="summary-line"><span>مالیات</span><b>${money(checkoutQuote.tax_toman)}</b></div>
          <div class="summary-line total"><span>مبلغ قابل پرداخت</span><b>${money(checkoutQuote.total_toman)}</b></div>
        </aside>
      </div>
    `;
    placeOrder.disabled = false;
    placeOrder.innerHTML = '<span>پرداخت امن با زرین‌پال</span>' + icon('i-arrow', 'arr');
    const firstField = $('#shippingName');
    if (firstField) firstField.focus({ preventScroll: true });
  } catch (error) {
    body.innerHTML =
      '<div class="checkout-panel"><p class="eyebrow">پرداخت امن</p><h3 class="reader-title">اتصال سرور در دسترس نیست.</h3><p class="checkout-notice" role="status">${esc(error.message || 'اتصال به بک‌اند برقرار نشد.')}</p><p>اطلاعات ارسال ذخیره نشده و پرداخت آغاز نشده است.</p></div>';
    placeOrder.disabled = true;
    placeOrder.textContent = 'درگاه در دسترس نیست';
  }
}

async function beginSecurePayment() {
  const form = $('#checkoutForm');
  const placeOrder = $('#placeOrder');
  const status = $('#checkoutStatus');
  if (!form || !placeOrder || !checkoutQuote || !form.reportValidity()) return;

  const values = new FormData(form);
  const shipping = {
    name: String(values.get('name') || '').trim(),
    postal_code: String(values.get('postal_code') || '').trim(),
    address: String(values.get('address') || '').trim(),
  };
  placeOrder.disabled = true;
  placeOrder.setAttribute('aria-busy', 'true');
  placeOrder.textContent = 'در حال ایجاد پرداخت امن…';
  if (status) status.textContent = '';
  try {
    const result = await apiRequest('start-payment', {
      body: { items: checkoutItemsPayload(), shipping },
    });
    const destination = new URL(result.redirect_url);
    const permittedHosts = ['www.zarinpal.com', 'sandbox.zarinpal.com'];
    if (
      destination.protocol !== 'https:' ||
      !permittedHosts.includes(destination.hostname) ||
      !destination.pathname.startsWith('/pg/StartPay/')
    ) {
      throw new Error('نشانی بازگشت درگاه معتبر نیست؛ پرداخت برای امنیت شما متوقف شد.');
    }
    try {
      sessionStorage.setItem('velora-pending-order', result.order_number);
    } catch {}
    window.location.assign(destination.href);
  } catch (error) {
    if (status) status.textContent = error.message || 'ایجاد پرداخت ناموفق بود.';
    toast(error.message || 'ایجاد پرداخت ناموفق بود.');
    placeOrder.disabled = false;
    placeOrder.innerHTML = '<span>تلاش دوباره برای پرداخت</span>' + icon('i-arrow', 'arr');
    placeOrder.removeAttribute('aria-busy');
  }
}

async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const outcome = params.get('payment');
  if (!outcome) return;

  try {
    if (outcome === 'failed') {
      toast('بازگشت از درگاه موفق نبود؛ هیچ پرداخت تأییدشده‌ای ثبت نشد.');
    } else if (outcome === 'return') {
      const orderNumber = params.get('order') || '';
      if (!orderNumber) {
        toast('شمارهٔ سفارش برای بررسی وضعیت پرداخت در دسترس نیست.');
      } else {
        const result = await apiRequest('payment-status', {
          method: 'GET',
          query: { order: orderNumber },
        });
        if (result.order.paid) {
          cart = [];
          variants = {};
          save();
          saveVariants();
          paintCart();
          toast('پرداخت سفارش ' + result.order.number + ' توسط سرور تأیید شد.');
        } else if (['payment_cancelled', 'payment_failed'].includes(result.order.status)) {
          toast('پرداخت نهایی نشد؛ پیش از تلاش دوباره وضعیت سفارش را بررسی کنید.');
        } else {
          toast('وضعیت پرداخت هنوز نهایی نشده است؛ برای جلوگیری از پرداخت تکراری، دوباره پرداخت نکنید.');
        }
      }
    }
  } catch {
    toast('وضعیت پرداخت قابل بررسی نیست؛ رسید درگاه را نگه دارید و پیش از پرداخت مجدد پیگیری کنید.');
  } finally {
    params.delete('payment');
    params.delete('order');
    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      window.location.pathname + (query ? '?' + query : '') + window.location.hash
    );
  }
}

export function cartInit() {
  cart = load();
  wishlist = loadWishlist();
  variants = loadVariants();
  paintCart();
  if (typeof document !== 'undefined') {
    renderWishlist();
    syncWishlistButtons(document);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('velora:prices-updated', () => {
      paintCart();
      renderWishlist();
    });
  }

  const cartBtn = $('#cartBtn');
  if (cartBtn) cartBtn.addEventListener('click', openCart);

  const dockCart = document.querySelector('[data-dock="cart"]');
  if (dockCart) dockCart.addEventListener('click', openCart);
  const dockHome = document.querySelector('[data-dock="home"]');
  if (dockHome) dockHome.addEventListener('click', () => goHash('top'));
  const dockShop = document.querySelector('[data-dock="shop"]');
  if (dockShop) dockShop.addEventListener('click', () => goHash('editions'));
  const dockWishlist = document.querySelector('[data-dock="wishlist"]');
  if (dockWishlist) {
    dockWishlist.addEventListener('click', () => {
      renderWishlist();
      openDialog($('#wishlistDialog'));
    });
  }
  const dockProfile = document.querySelector('[data-dock="profile"]');
  if (dockProfile) dockProfile.addEventListener('click', () => openDialog($('#authDialog')));

  const menuCartQuick = $('#menuCartQuick');
  if (menuCartQuick) menuCartQuick.addEventListener('click', openCart);

  const menuWishlistQuick = $('#menuWishlistQuick');
  if (menuWishlistQuick) {
    menuWishlistQuick.addEventListener('click', () => {
      renderWishlist();
      openDialog($('#wishlistDialog'));
    });
  }

  const cartBody = $('#cartBody');
  if (cartBody) {
    cartBody.addEventListener('click', e => {
      const remove = e.target.closest('[data-remove]');
      if (remove) {
        removeFromCart(remove.dataset.remove);
        return;
      }
      if (e.target.closest('[data-browse]'))
        closeDialog($('#cartDialog'), () => goHash('editions'));
    });
  }

  const requestReservation = $('#requestReservation');
  if (requestReservation) {
    requestReservation.addEventListener('click', () => {
      if (!cart.length) return;
      closeDialog($('#cartDialog'), openCheckout);
    });
  }

  const placeOrder = $('#placeOrder');
  if (placeOrder) placeOrder.addEventListener('click', beginSecurePayment);

  handlePaymentReturn();

  const wishlistBtn = $('#wishlistBtn');
  if (wishlistBtn) {
    wishlistBtn.addEventListener('click', () => {
      renderWishlist();
      openDialog($('#wishlistDialog'));
    });
  }

  const wishlistBody = $('#wishlistBody');
  if (wishlistBody) {
    wishlistBody.addEventListener('click', e => {
      const remove = e.target.closest('[data-wishlist-remove]');
      if (remove) {
        toggleWishlist(remove.dataset.wishlistRemove);
        return;
      }
      const add = e.target.closest('[data-add]');
      if (add) {
        const variant =
          add.dataset.size || add.dataset.color
            ? { size: add.dataset.size || null, color: add.dataset.color || null }
            : null;
        addToCart(add.dataset.add, variant);
      }
    });
  }
}
