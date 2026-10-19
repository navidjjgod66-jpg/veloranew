import { CATALOG } from './data.js';
import { ls, normalizeCustomFootSize } from './core.js';

const ENDPOINT = '/api/index.php';
let baseUrl = null;
function getBaseUrl() {
  if (!baseUrl)
    baseUrl = typeof window !== 'undefined' ? window.location.origin + ENDPOINT : ENDPOINT;
  return baseUrl;
}
let csrfToken = '';
let user = null;
let readiness = { smsReady: false, checkoutReady: false };
let pricesReady = false;
let bootstrapPromise = null;

const acceptHeaders = { Accept: 'application/json' };

function applyServerPrices(priceMap) {
  const ids = Object.keys(CATALOG);
  const valid =
    priceMap &&
    typeof priceMap === 'object' &&
    !Array.isArray(priceMap) &&
    ids.every(id => Number.isSafeInteger(priceMap[id]) && priceMap[id] >= 1000);

  let changed = false;
  for (const id of ids) {
    const nextPrice = valid ? priceMap[id] : null;
    if (CATALOG[id].price !== nextPrice) changed = true;
    CATALOG[id].price = nextPrice;
  }
  pricesReady = Boolean(valid);
  if (changed && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('velora:prices-updated'));
  }
}

async function readResponse(response) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(
      'پاسخ سرور قابل خواندن نیست؛ مطمئن شوید بک‌اند PHP روی همین دامنه نصب شده است.'
    );
  }
  if (!response.ok || !payload || payload.ok !== true) {
    const error = new Error(payload && payload.message ? payload.message : 'درخواست انجام نشد.');
    error.status = response.status;
    error.code = payload && payload.error ? payload.error : 'request_failed';
    throw error;
  }
  return payload;
}

export async function bootstrap(force = false) {
  if (bootstrapPromise && !force) return bootstrapPromise;
  bootstrapPromise = (async () => {
    const response = await fetch(ENDPOINT + '?action=bootstrap', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const payload = await readResponse(response);
    csrfToken = typeof payload.csrf === 'string' ? payload.csrf : '';
    user = payload.user && typeof payload.user.mobile === 'string' ? payload.user : null;
    readiness = {
      smsReady: payload.sms_ready === true,
      checkoutReady: payload.checkout_ready === true,
    };
    applyServerPrices(payload.prices_toman);
    return { user: currentUser(), ...readiness, pricesReady };
  })();
  try {
    return await bootstrapPromise;
  } finally {
    bootstrapPromise = null;
  }
}

export async function apiRequest(action, options = {}) {
  const method = options.method || 'POST';
  if (method === 'POST' && !csrfToken) await bootstrap();
  const url = new URL(getBaseUrl());
  url.searchParams.set('action', action);
  if (options.query && typeof options.query === 'object') {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }
  const headers = { ...acceptHeaders };
  const init = { method, credentials: 'same-origin', cache: 'no-store', headers };
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
    headers['X-CSRF-Token'] = csrfToken;
    init.body = JSON.stringify(options.body || {});
  }
  const payload = await readResponse(await fetch(url, init));
  if (typeof payload.csrf === 'string') csrfToken = payload.csrf;
  if (Object.hasOwn(payload, 'user')) user = payload.user || null;
  if (user) readiness.checkoutReady = readiness.checkoutReady;
  return payload;
}

export function currentUser() {
  if (!user) return null;
  return {
    ...user,
    id: user.id,
    mobile: user.mobile,
  };
}

export async function saveCustomFootSize(value) {
  const normalized = normalizeCustomFootSize(value);
  if (!normalized) {
    throw new Error('سایز واردشده برای پای سفارشی معتبر نیست.');
  }
  const payload = await apiRequest('profile-save-foot-size', {
    body: normalized,
  });
  const saved = normalizeCustomFootSize(payload.user?.custom_foot_size || normalized);
  if (!saved) {
    throw new Error('ثبت سایز سفارشی با خطا مواجه شد.');
  }
  ls.setJson('velora.custom-foot-size', saved);
  return saved;
}

export function checkoutReady() {
  return readiness.checkoutReady;
}

export function smsReady() {
  return readiness.smsReady;
}

export function serverPricesReady() {
  return pricesReady;
}
