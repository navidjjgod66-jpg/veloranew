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

const STORAGE_KEY = 'lm-cart';
const WISHLIST_KEY = 'lm-wishlist';
const VARIANT_KEY = 'lm-product-variants';
const VERIFIED_KEY = 'lm-verified-purchases';
const REVIEW_KEY = 'lm-product-reviews';

const starterReviews = {
  aster: [
    {
      author: 'آزاده ن.',
      rating: 5,
      text: 'خیلی نرم و راحت برای پیاده‌روی روزمره؛ فرمش دقیق و ظاهرش خیلی شیک است.',
      verified: true,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 12,
    },
    {
      author: 'مهدی ک.',
      rating: 4,
      text: 'برای رفت‌وآمد شهری کاملاً خوبه؛ قوس کفش احساس حمایت خوبی می‌دهد.',
      verified: true,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 9,
    },
    {
      author: 'لیلا س.',
      rating: 5,
      text: 'باکیفیت‌تر از قیمتش است و حس لوکس بودن هم دارد؛ از نظر راحتی هم عالی است.',
      verified: true,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 4,
    },
  ],
  noir: [
    {
      author: 'سارا ج.',
      rating: 5,
      text: 'برای مهمانی و جلسات رسمی حسابی جذاب و درجه یک است. ظاهر آن‌قدر شیک است که توجه می‌کشد.',
      verified: true,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 15,
    },
    {
      author: 'پارسا د.',
      rating: 4,
      text: 'در طراحی و جزئیات خیلی حرفه‌ای است، و با پیراهن رسمی یا استایل مینیمال خیلی خوب دیده می‌شود.',
      verified: true,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 11,
    },
    {
      author: 'حسنا م.',
      rating: 5,
      text: 'دقیق، تمیز و کاملاً باکیفیت؛ برای استایل عصرگاهی انتخاب عالی‌ای است.',
      verified: true,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    },
  ],
  sol: [
    {
      author: 'یاسمن ر.',
      rating: 5,
      text: 'برای روزهای پرتحرک و پیاده‌روی طولانی خیلی نرم و سبک است، بدون اینکه حس سنگینی بدهد.',
      verified: true,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 18,
    },
    {
      author: 'میلاد ش.',
      rating: 4,
      text: 'حس تعادل خوبی دارد و به‌خوبی با استایل روزمره و اسپرت هماهنگ می‌شود.',
      verified: true,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    },
    {
      author: 'نیلوفر ب.',
      rating: 5,
      text: 'از نظر فرم و راحتی کاملاً حرفه‌ای است؛ برای استفاده روزانه انتخاب بسیار خوبیه.',
      verified: true,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    },
  ],
};

const knownIds = raw =>
  Array.isArray(raw) ? [...new Set(raw.filter(id => typeof id === 'string' && isProduct(id)))] : [];

let cart = [];
let variants = {};
let wishlist = [];
let verifiedPurchases = [];
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

export const getVerifiedPurchases = () => [...new Set(verifiedPurchases.filter(Boolean))];
export const isVerifiedPurchase = id => isProduct(id) && getVerifiedPurchases().includes(id);
export const markVerifiedPurchase = id => {
  if (!isProduct(id)) return false;
  verifiedPurchases = [...new Set([...verifiedPurchases, id])];
  writeJson(VERIFIED_KEY, verifiedPurchases);
  return true;
};

export function getProductReviews(id) {
  if (!isProduct(id)) return [];
  const raw = readJson(REVIEW_KEY, {});
  const reviews = Array.isArray(raw[id]) ? raw[id] : [];
  const validReviews = reviews.filter(value => value && typeof value === 'object');
  if (validReviews.length) return validReviews;

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

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const shipping = subtotal > 0 ? (subtotal >= 6000 ? 0 : 260) : 0;
  const tax = Math.round(subtotal * 0.09);
  const total = subtotal + shipping + tax;

  return { items, subtotal, shipping, tax, total };
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
  if (cartBtn) cartBtn.setAttribute('aria-label', `رزروها، ${faNum(count)} مورد`);

  const menuCartQuickCount = $('#menuCartQuickCount');
  if (menuCartQuickCount) menuCartQuickCount.textContent = faNum(count);

  const dockCartBadge = $('#dockCartBadge');
  if (dockCartBadge) dockCartBadge.textContent = faNum(count);

  for (const btn of $$('[data-add]')) {
    const held = cart.includes(btn.dataset.add);
    btn.disabled = held;
    btn.classList.toggle('is-added', held);
    const label = $('.btn-label', btn);
    if (label) label.textContent = held ? 'در بریف شماست' : btn.dataset.label || 'رزرو';
  }

  const body = $('#cartBody');
  const footer = $('#cartFooter');
  if (!count) {
    if (footer) footer.hidden = true;
    if (body) {
      body.innerHTML = `<div class="cart-empty">${icon('i-bag')}<h3>هنوز چیزی رزرو نشده.</h3><p>برای شروع بریف، یک نسخه رزرو کنید.</p><button class="btn btn-solid" type="button" data-browse>دیدن نسخه‌ها</button></div>`;
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

  let deposits = 0,
    monthly = 0;
  for (const id of cart) {
    const p = CATALOG[id];
    if (p.total) deposits += p.price;
    else monthly += p.price;
  }
  const totals = $('#cartTotals');
  if (totals) {
    totals.innerHTML =
      `${deposits ? `<div><span>بیعانه‌های رزرو</span><b>${money(deposits)}</b></div>` : ''}` +
      `${monthly ? `<div><span>ریتینر ماهانه</span><b>${money(monthly)} / ماه</b></div>` : ''}` +
      `<div class="total"><span>جمع بریف شما</span><b>${money(deposits + monthly)}</b></div>`;
  }
}

export function addToCart(id, variant = null) {
  if (!isProduct(id)) return;
  if (cart.includes(id)) {
    if (variant) setVariant(id, variant);
    toast('قبلاً در بریف شماست.', 'دیدن', openCart);
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
  toast(`${CATALOG[id].no}${suffix} به بریفتان اضافه شد.`, 'دیدن', openCart);
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

export function openCheckout() {
  if (!cart.length) return;
  const summary = getCheckoutSummary(cart);
  const body = $('#checkoutBody');
  if (!body) return;

  body.innerHTML = `
    <div class="checkout-layout">
      <div class="checkout-panel">
        <div class="checkout-section">
          <p class="eyebrow">داده‌های ارسال</p>
          <div class="checkout-grid">
            <label class="field"><span>نام و نام خانوادگی</span><input class="control" id="checkoutName" type="text" required /></label>
            <label class="field"><span>شماره تماس</span><input class="control" id="checkoutPhone" type="tel" required /></label>
            <label class="field field--full"><span>آدرس کامل</span><input class="control" id="checkoutAddress" type="text" required /></label>
            <label class="field"><span>شهر</span><input class="control" id="checkoutCity" type="text" required /></label>
            <label class="field"><span>کد پستی</span><input class="control" id="checkoutZip" type="text" required /></label>
          </div>
        </div>

        <div class="checkout-section">
          <p class="eyebrow">پرداخت</p>
          <p class="checkout-notice" role="note">درگاه پرداخت و ثبت سفارش سمت سرور هنوز متصل نشده‌اند. برای جلوگیری از پرداخت یا سفارش صوری، ثبت نهایی در این نسخه غیرفعال است.</p>
        </div>
      </div>

      <aside class="checkout-summary">
        <p class="eyebrow">خلاصه سفارش</p>
        <div class="summary-items">
          ${summary.items
            .map(
              item => `
              <div class="summary-item">
                <div>
                  <strong>${esc(item.name)}</strong>
                  <span>${esc(item.no)}</span>
                </div>
                <b>${money(item.price)}</b>
              </div>
            `
            )
            .join('')}
        </div>
        <div class="summary-line"><span>جمع جزء</span><b>${money(summary.subtotal)}</b></div>
        <div class="summary-line"><span>حمل و نقل</span><b>${money(summary.shipping)}</b></div>
        <div class="summary-line"><span>مالیات</span><b>${money(summary.tax)}</b></div>
        <div class="summary-line total"><span>مبلغ نهایی</span><b>${money(summary.total)}</b></div>
      </aside>
    </div>
  `;

  const methodButtons = body.querySelectorAll('.payment-option');
  for (const option of methodButtons) {
    option.addEventListener('click', () => {
      for (const item of methodButtons) item.classList.toggle('is-selected', item === option);
    });
  }

  openDialog($('#checkoutDialog'));
}

export function cartInit() {
  cart = load();
  wishlist = loadWishlist();
  variants = loadVariants();
  verifiedPurchases = Array.isArray(readJson(VERIFIED_KEY, [])) ? readJson(VERIFIED_KEY, []) : [];
  paintCart();
  if (typeof document !== 'undefined') {
    renderWishlist();
    syncWishlistButtons(document);
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
  if (placeOrder) {
    placeOrder.addEventListener('click', () => {
      toast(
        'ثبت نهایی سفارش تا زمان اتصال امن بک‌اند و درگاه پرداخت در دسترس نیست؛ سبد خرید شما حفظ شده است.'
      );
    });
  }

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
