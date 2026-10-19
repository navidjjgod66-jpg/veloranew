const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const API = '/api/admin.php';
const SIZES = ['38', '39', '40', '41', '42', '43'];
const COLORS = ['طلایی', 'پلاتین', 'خاکی'];
const moneyFormat = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' });
const timeFormat = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
let csrf = '';
let appState = null;
let selectedProduct = 'aster';
let draftStock = new Map();
let visibleOrders = [];
let activityRows = [];
let searchTimer = null;
let activitySearchTimer = null;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}
function fa(value) { return moneyFormat.format(Number(value || 0)); }
function toman(value) {
  if (value === null || value === undefined || value === '') return 'ثبت نشده';
  return fa(value) + ' تومان';
}
function dayLabel(value) {
  const date = new Date(value + 'T12:00:00Z');
  return new Intl.DateTimeFormat('fa-IR', { weekday: 'short' }).format(date);
}
function showToast(message, kind = 'success') {
  const region = $('#toastRegion');
  const node = document.createElement('div');
  node.className = 'toast' + (kind === 'error' ? ' is-error' : ' is-success');
  node.textContent = message;
  region.append(node);
  window.setTimeout(() => node.remove(), 4200);
}
async function request(action, { method = 'GET', body, query = {} } = {}) {
  const params = new URLSearchParams({ action, ...query });
  const headers = { Accept: 'application/json' };
  const options = { method, credentials: 'same-origin', headers, cache: 'no-store' };
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    if (action !== 'login' && csrf) headers['X-CSRF-Token'] = csrf;
    options.body = JSON.stringify(body || {});
  }
  let response;
  try {
    response = await fetch(API + '?' + params.toString(), options);
  } catch {
    throw new Error('اتصال به سرور برقرار نشد؛ HTTPS و در دسترس بودن هاست را بررسی کنید.');
  }
  let payload;
  try { payload = await response.json(); } catch {
    throw new Error('پاسخ سرور قابل‌خواندن نیست؛ مسیر /api/admin.php را بررسی کنید.');
  }
  if (!response.ok || payload?.ok !== true) {
    if (response.status === 401 && action !== 'login') showLogin();
    const error = new Error(payload?.message || 'درخواست انجام نشد.');
    error.code = payload?.error;
    error.status = response.status;
    throw error;
  }
  if (typeof payload.csrf === 'string') csrf = payload.csrf;
  return payload;
}
function showLogin() {
  $('#appShell').hidden = true;
  $('#mobileNav').hidden = true;
  $('#loginScreen').hidden = false;
  $('#adminPassword').value = '';
  closeMobileMenu();
}
function showApp() {
  $('#loginScreen').hidden = true;
  $('#appShell').hidden = false;
  $('#mobileNav').hidden = false;
  const date = new Date();
  $('#todayLabel').textContent = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full' }).format(date);
}
function closeMobileMenu() {
  $('#sidebar').classList.remove('is-open');
  $('#mobileOverlay').hidden = true;
}
function setView(view) {
  const allowed = ['overview', 'orders', 'inventory', 'activity', 'settings'];
  if (!allowed.includes(view)) return;
  $$('.view').forEach(node => node.classList.toggle('is-visible', node.id === 'view-' + view));
  $$('[data-view]').forEach(node => node.classList.toggle('is-active', node.dataset.view === view));
  const labels = { overview: 'نمای کلی', orders: 'سفارش‌ها', inventory: 'موجودی و سایزها', activity: 'فعالیت‌های مدیریتی', settings: 'تنظیمات فروشگاه' };
  $('#crumbCurrent').textContent = labels[view];
  closeMobileMenu();
  if (view === 'orders') {
    $('#orderSearch')?.focus({ preventScroll: true });
    searchOrders().catch(error => showToast(error.message, 'error'));
  }
  if (view === 'activity') loadActivity().catch(error => showToast(error.message, 'error'));
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
function paymentLabel(status) {
  const labels = {
    paid: ['پرداخت تأییدشده', 'paid'],
    pending: ['در انتظار پرداخت', 'pending'],
    cancelled: ['لغوشده', 'failed'],
    failed: ['ناموفق', 'failed'],
  };
  return labels[status] || [status || 'نامشخص', ''];
}
function fulfillmentLabel(status) {
  const labels = {
    awaiting_payment: 'در انتظار پرداخت',
    paid: 'پرداخت‌شده',
    processing: 'در حال آماده‌سازی',
    shipped: 'ارسال‌شده',
    delivered: 'تحویل‌شده',
    payment_cancelled: 'پرداخت لغوشده',
    payment_failed: 'پرداخت ناموفق',
  };
  return labels[status] || status || 'نامشخص';
}
function renderStatus() {
  const settings = appState?.settings;
  if (!settings) return;
  const live = Boolean(settings.catalog_live);
  const usable = Boolean(settings.payment_ready);
  const sandbox = Boolean(settings.sandbox);
  const label = !live ? 'فروش غیرفعال' : usable && sandbox ? 'محیط آزمایشی' : usable ? 'کانال فروش آماده' : 'نیازمند تکمیل';
  $('#sidebarStatus').textContent = label;
  $('#sidebarStatusDot').classList.toggle('live', live && usable);
  $('#livePill').classList.toggle('is-live', live && usable);
  $('#livePill span').textContent = label;
  $('#setupBanner').classList.toggle('is-ready', live && usable);
  $('#setupBanner strong').textContent = live && usable ? (sandbox ? 'اتصال‌ها آمادهٔ آزمون در محیط سندباکس هستند.' : 'پیکربندی فروشگاه کامل گزارش شده است.') : 'فروشگاه در حالت آماده‌سازی است.';
  $('#setupBanner p').textContent = live && usable
    ? 'قبل از دریافت وجه واقعی، آزمون پرداخت و ارسال پیامک را کامل کنید و از صحت کاتالوگ واقعی مطمئن شوید.'
    : 'قبل از فعال‌کردن فروش، قیمت واقعی، اطلاعات محصول، موجودی و اتصال‌های پرداخت و پیامک باید بررسی شوند.';
  $('#settingsStatusTitle').textContent = !live ? 'کانال فروش غیرفعال است' : usable ? (sandbox ? 'آمادهٔ آزمون · Sandbox' : 'پیکربندی کانال فروش کامل است') : 'تنظیمات فروش هنوز کامل نیست';
  $('#settingsStatusText').textContent = usable
    ? (sandbox ? 'درگاه روی محیط آزمایشی قرار دارد؛ پرداخت واقعی انجام نمی‌شود.' : 'پیکربندی سرور آماده گزارش شده؛ قبل از فروش عمومی آزمون نهایی را انجام دهید.')
    : 'قیمت، موجودی کامل، تنظیمات خصوصی، تأیید کاتالوگ و اتصال پیامک/درگاه باید همگی معتبر باشند.';
  $('#settingsStatusLabel').textContent = usable ? (sandbox ? 'SANDBOX' : 'READY') : 'INCOMPLETE';
  $('#settingsStatusLabel').classList.toggle('ready', usable);
  $('#settingsStatusIcon').classList.toggle('ready', usable);
  $('#settingsStatusIcon').textContent = usable ? '✓' : '!';
  $('#liveSwitchLabel').textContent = $('#catalogLive').checked ? 'روشن' : 'خاموش';
  $('#liveSwitchLabel').classList.toggle('is-live', $('#catalogLive').checked);
  const pricesSet = Object.values(settings.prices || {}).length === 3 && Object.values(settings.prices || {}).every(value => Number.isSafeInteger(value) && value >= 1000);
  const checks = [
    ['اتصال دیتابیس و جداول فروشگاه', true, 'پنل داده‌های واقعی را از دیتابیس می‌خواند.'],
    ['قیمت نهایی محصولات', pricesSet, pricesSet ? 'هر سه قیمت روی سرور تنظیم شده‌اند.' : 'قیمت هر سه مدل باید ثبت شود.'],
    ['ماتریس موجودی ۵۴ ترکیب', Boolean(settings.inventory_complete), settings.inventory_complete ? 'تمام سایزها و رنگ‌ها رکورد دارند.' : 'ابتدا هر ۵۴ ترکیب را در صفحهٔ موجودی ذخیره کنید.'],
    ['کاتالوگ واقعی تأیید شده', live, live ? 'تأیید مدیر در تنظیمات سرور ثبت شده است.' : 'تصاویر و مشخصات واقعی را بررسی و سپس تأیید کنید.'],
    ['اتصال پیامک و زرین‌پال', usable, usable ? 'پیکربندی مورد نیاز از سمت سرور معتبر است.' : 'اعتبار اتصال‌ها از سمت سرور هنوز کامل نیست.'],
    ['محیط پرداخت', !sandbox, sandbox ? 'درگاه در Sandbox است؛ پرداخت زنده خاموش می‌ماند.' : 'خروج از Sandbox باید فقط پس از آزمون رسمی انجام شود.'],
  ];
  $('#readinessList').innerHTML = checks.map(([name, ok, note]) => `
    <div class="readiness-item ${ok ? 'is-ready' : ''}"><span class="readiness-icon">${ok ? '✓' : '!'}</span><div><strong>${esc(name)}</strong><small>${esc(note)}</small></div></div>
  `).join('');
}
function renderDashboard() {
  const stats = appState.stats;
  $('#metricRevenue').textContent = fa(stats.revenue_30d_toman);
  $('#metricOrders').textContent = fa(stats.orders_30d);
  $('#metricPending').textContent = fa(stats.awaiting_payment);
  $('#metricPaid').textContent = fa(stats.paid_30d);
  $('#metricAllOrders').textContent = fa(stats.all_orders);
  $('#metricCustomers').textContent = fa(stats.customers);
  $('#metricStockAlerts').textContent = fa(stats.low_stock + stats.out_of_stock);
  $('#navPending').textContent = fa(stats.awaiting_payment);
  $('#mobilePendingDot').hidden = stats.awaiting_payment < 1;
  $('#stockOut').textContent = fa(stats.out_of_stock);
  $('#stockLow').textContent = fa(stats.low_stock);
  const points = appState.chart || [];
  const max = Math.max(1, ...points.map(point => Number(point.revenue_toman)));
  const total = points.reduce((sum, point) => sum + Number(point.revenue_toman), 0);
  $('#chartTotal').innerHTML = `${fa(total)} <small>تومان</small>`;
  $('#revenueChart').innerHTML = points.map(point => {
    const pct = Number(point.revenue_toman) > 0
      ? Math.max(5, Math.round(Number(point.revenue_toman) / max * 20) * 5)
      : 0;
    return `<div class="chart-day" title="${esc(dateFormat.format(new Date(point.day + 'T12:00:00Z')))} · ${esc(toman(point.revenue_toman))}"><div class="chart-bar bar-level-${pct}"></div><span class="chart-day-label">${esc(dayLabel(point.day))}</span></div>`;
  }).join('');
  renderRecentOrders();
  renderStatus();
}
function renderRecentOrders() {
  const orders = appState.orders.slice(0, 8);
  $('#recentOrders').innerHTML = orders.length ? orders.map(order => {
    const [label, tone] = paymentLabel(order.payment_status);
    return `<div class="recent-row"><div class="recent-row-main"><strong>${esc(order.order_number)}</strong><small>${esc(order.shipping_name)} · ${esc(order.created_at)}</small></div><span class="status-tag ${tone}">${esc(label)}</span><span class="recent-price">${esc(toman(order.total_toman))}</span></div>`;
  }).join('') : '<div class="empty-state"><span>◇</span><strong>هنوز سفارشی ثبت نشده است.</strong><p>پس از ثبت سفارش، اطلاعات آن اینجا دیده می‌شود.</p></div>';
}
function renderOrders(orders = appState.orders) {
  visibleOrders = [...orders];
  $('#orderResultCount').textContent = `${fa(orders.length)} سفارش در این فهرست`;
  $('#ordersList').innerHTML = orders.length ? orders.map(order => {
    const [paymentText, paymentTone] = paymentLabel(order.payment_status);
    const paid = order.payment_status === 'paid';
    const allStatusOptions = ['processing', 'shipped', 'delivered'];
    const current = allStatusOptions.includes(order.status) ? order.status : 'processing';
    const currentRank = allStatusOptions.indexOf(current);
    const statusOptions = allStatusOptions.filter((status, index) => index >= Math.max(0, currentRank));
    const items = (order.items || []).map(item => `${esc(item.name)} · سایز ${esc(item.size)} · رنگ ${esc(item.color)} · ${fa(item.quantity)} جفت`).join('، ');
    const canUpdate = paid && !['payment_cancelled', 'payment_failed'].includes(order.status);
    const options = statusOptions.map(status => `<option value="${status}" ${current === status ? 'selected' : ''}>${fulfillmentLabel(status)}</option>`).join('');
    return `
      <article class="order-card" data-order-card="${esc(order.order_number)}">
        <div class="order-card-head">
          <div class="order-ref"><strong>${esc(order.order_number)}</strong><small>${esc(order.shipping_name)} · ${esc(order.shipping_mobile)}</small></div>
          <span class="status-tag ${paymentTone}">${esc(paymentText)}</span>
          <div class="order-total">${esc(toman(order.total_toman))}<small>${esc(fulfillmentLabel(order.status))}</small></div>
        </div>
        <div class="order-body">
          <div class="order-items"><strong>اقلام سفارش</strong><p>${items || 'اطلاعات اقلام ثبت نشده'}</p><p class="order-cost-meta">هزینه ارسال: ${esc(toman(order.shipping_toman))} · مالیات: ${esc(toman(order.tax_toman))}</p></div>
          <div class="order-shipping"><strong>اطلاعات تحویل</strong><p>${esc(order.shipping_name)} · ${esc(order.shipping_mobile)}</p><p>کد پستی: <b dir="ltr">${esc(order.postal_code)}</b></p><p class="address">${esc(order.shipping_address)}</p>${order.reference_id ? `<p class="order-reference">کد پیگیری درگاه: <b dir="ltr">${esc(order.reference_id)}</b></p>` : ''}</div>
        </div>
        <div class="order-card-footer"><span class="order-date">ثبت: ${esc(order.created_at)} ${order.paid_at ? '· پرداخت: ' + esc(order.paid_at) : ''}</span><div class="order-actions">${canUpdate ? `<select aria-label="وضعیت تحویل سفارش ${esc(order.order_number)}" data-order-status-select="${esc(order.order_number)}">${options}</select><button class="button button-quiet save-order-status" data-order-number="${esc(order.order_number)}" type="button"><span>ذخیره</span> ↗</button>` : '<span class="quiet-chip">وضعیت پرداخت فقط از درگاه</span>'}</div></div>
      </article>`;
  }).join('') : '<div class="surface empty-state"><span>▤</span><strong>نتیجه‌ای پیدا نشد.</strong><p>عبارت جست‌وجو را تغییر دهید یا سفارش دیگری انتخاب کنید.</p></div>';
}
function renderInventory() {
  const products = appState.products || [];
  $('#productSwitcher').innerHTML = products.map(product => {
    const count = appState.stock.filter(row => row.product_id === product.id).filter(row => Number(draftStock.get(keyFor(row)) ?? row.stock) > 0).length;
    return `<button type="button" class="product-switch ${product.id === selectedProduct ? 'is-active' : ''}" data-product="${esc(product.id)}"><span class="product-switch-sku">${esc(product.sku)}</span><strong>${esc(product.name)}</strong><small>${fa(count)} ترکیب دارای موجودی</small></button>`;
  }).join('');
  const product = products.find(item => item.id === selectedProduct) || products[0];
  if (!product) return;
  selectedProduct = product.id;
  $('#inventoryProductTitle').textContent = product.name;
  const rows = appState.stock.filter(row => row.product_id === product.id);
  $('#inventoryMatrix').innerHTML = SIZES.map(size => `
    <tr><td>${fa(size)}</td>${COLORS.map(color => {
      const row = rows.find(item => item.size === size && item.color === color);
      const value = row ? Number(draftStock.get(keyFor(row)) ?? row.stock) : 0;
      return `<td><input type="number" inputmode="numeric" min="0" max="10000" step="1" value="${value}" aria-label="${esc(product.name)}، سایز ${size}، رنگ ${esc(color)}" data-stock-key="${esc(keyFor({ product_id: product.id, size, color }))}" class="${value === 0 ? 'is-empty' : ''}"></td>`;
    }).join('')}</tr>`).join('');
  const registered = appState.stock.filter(row => row.updated_at).length;
  $('#inventoryCompleteness').textContent = `${fa(registered)} / ۵۴ ترکیب ثبت‌شده`;
}
function keyFor(row) { return row.product_id + '|' + row.size + '|' + row.color; }
function renderSettings() {
  const settings = appState.settings;
  $('#pricingFields').innerHTML = appState.products.map(product => {
    const price = settings.prices?.[product.id];
    return `<label class="price-field"><small>${esc(product.sku)}</small><strong>${esc(product.name)}</strong><input type="number" min="1000" max="2000000000" step="1" required inputmode="numeric" name="price-${esc(product.id)}" data-price-id="${esc(product.id)}" value="${price ?? ''}" placeholder="قیمت قطعی به تومان"><em>${price ? esc(toman(price)) : 'قیمت هنوز ثبت نشده'}</em></label>`;
  }).join('');
  $('#shippingFee').value = settings.shipping_toman ?? '';
  $('#taxFee').value = settings.tax_toman ?? '';
  $('#catalogLive').checked = Boolean(settings.catalog_live);
  renderStatus();
}
async function reloadData() {
  const response = await request('bootstrap');
  appState = response;
  $('#adminName').textContent = response.admin_user || 'مدیر ولورا';
  $('#adminAvatar').textContent = (response.admin_user || 'V').trim().slice(0, 1).toLocaleUpperCase('fa');
  draftStock = new Map((response.stock || []).map(row => [keyFor(row), Number(row.stock)]));
  showApp();
  renderDashboard();
  renderOrders(response.orders);
  renderInventory();
  renderSettings();
}
async function searchOrders() {
  const search = $('#orderSearch').value.trim();
  const result = await request('orders', { query: { search } });
  renderOrders(result.orders);
}
function activityLabel(action) {
  const labels = {
    'inventory.updated': ['موجودی به‌روزرسانی شد', 'inventory'],
    'settings.updated': ['تنظیمات فروشگاه تغییر کرد', 'settings'],
    'order.status': ['مرحلهٔ سفارش تغییر کرد', 'order'],
  };
  return labels[action] || ['رویداد مدیریتی', 'generic'];
}
function renderActivity() {
  const needle = ($('#activitySearch')?.value || '').trim().toLocaleLowerCase('fa');
  const rows = activityRows.filter(row =>
    [row.actor, row.action, row.target].some(value => String(value || '').toLocaleLowerCase('fa').includes(needle))
  );
  $('#activityCount').textContent = needle
    ? `${fa(rows.length)} رویداد مطابق جست‌وجو`
    : `${fa(rows.length)} رویداد ثبت‌شده`;
  $('#activityList').innerHTML = rows.length ? rows.map(row => {
    const [label, kind] = activityLabel(row.action);
    const rawDate = String(row.created_at || '');
    const timestamp = rawDate ? rawDate.replace(' ', 'T') + 'Z' : '';
    const date = timestamp && !Number.isNaN(Date.parse(timestamp))
      ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp))
      : rawDate;
    return `
      <article class="activity-row">
        <span class="activity-row-icon ${kind}" aria-hidden="true">${kind === 'order' ? '↗' : kind === 'inventory' ? '◇' : kind === 'settings' ? '⚙' : '•'}</span>
        <div class="activity-row-copy"><strong>${esc(label)}</strong><span>${esc(row.target || 'فروشگاه')}</span><small>ثبت‌شده توسط ${esc(row.actor || 'مدیر')}</small></div>
        <time class="activity-row-time" datetime="${esc(timestamp)}">${esc(date)}</time>
      </article>`;
  }).join('') : '<div class="surface empty-state"><span>↻</span><strong>رویدادی پیدا نشد.</strong><p>با ثبت یا به‌روزرسانی سفارش، موجودی یا تنظیمات، گزارش جدید اینجا نمایش داده می‌شود.</p></div>';
}
async function loadActivity() {
  const button = $('#refreshActivity');
  if (button) { button.disabled = true; button.dataset.previousLabel = button.textContent; button.textContent = 'در حال دریافت…'; }
  try {
    const result = await request('activity');
    activityRows = Array.isArray(result.activities) ? result.activities : [];
    renderActivity();
  } finally {
    if (button) { button.disabled = false; button.textContent = button.dataset.previousLabel || '↻ تازه‌سازی'; }
  }
}
function csvCell(value) {
  let textValue = String(value ?? '');
  if (/^[=+\-@\t\r\n]/.test(textValue)) textValue = "'" + textValue;
  return '"' + textValue.replace(/"/g, '""') + '"';
}
function exportOrdersCsv() {
  if (!visibleOrders.length) {
    showToast('سفارشی برای خروجی گرفتن در این فهرست وجود ندارد.', 'error');
    return;
  }
  const headers = ['شماره سفارش', 'تاریخ ثبت', 'نام گیرنده', 'موبایل', 'وضعیت تحویل', 'وضعیت پرداخت', 'مبلغ نهایی تومان', 'هزینه ارسال تومان', 'مالیات تومان', 'اقلام'];
  const rows = visibleOrders.map(order => [
    order.order_number, order.created_at, order.shipping_name, order.shipping_mobile,
    fulfillmentLabel(order.status), paymentLabel(order.payment_status)[0],
    order.total_toman, order.shipping_toman, order.tax_toman,
    (order.items || []).map(item => `${item.name} / ${item.size} / ${item.color} × ${item.quantity}`).join(' | '),
  ]);
  const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'velora-orders-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`${fa(rows.length)} سفارش به فایل CSV صادر شد.`);
}
async function login(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('#loginSubmit');
  const errorNode = $('#loginError');
  button.disabled = true;
  button.querySelector('span').textContent = 'در حال بررسی…';
  errorNode.textContent = '';
  try {
    const data = Object.fromEntries(new FormData(form));
    const result = await request('login', { method: 'POST', body: data });
    csrf = result.csrf || '';
    form.reset();
    await reloadData();
  } catch (error) {
    errorNode.textContent = error.message || 'ورود انجام نشد.';
    if (error.code === 'admin_not_configured') $('#setupNotice').hidden = false;
  } finally {
    button.disabled = false;
    button.querySelector('span').textContent = 'ورود امن';
  }
}
async function saveInventory() {
  const button = $('#saveInventory');
  button.disabled = true;
  const previous = button.innerHTML;
  button.textContent = 'در حال ذخیره…';
  try {
    const items = appState.stock.map(row => ({ ...row, stock: Number(draftStock.get(keyFor(row)) ?? row.stock) }));
    if (items.some(row => !Number.isInteger(row.stock) || row.stock < 0 || row.stock > 10000)) {
      throw new Error('موجودی باید عدد صحیح بین صفر تا ۱۰٬۰۰۰ باشد.');
    }
    const result = await request('stock-save', { method: 'POST', body: { items } });
    showToast(result.message || 'موجودی ذخیره شد.');
    await reloadData();
    setView('inventory');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = previous;
  }
}
async function saveSettings(event) {
  event.preventDefault();
  const button = $('#saveSettings');
  const message = $('#settingsMessage');
  const goLive = $('#catalogLive').checked;
  button.disabled = true;
  message.classList.remove('is-error');
  message.textContent = 'در حال ذخیره امن تنظیمات…';
  try {
    const prices = Object.fromEntries($$('[data-price-id]').map(input => [input.dataset.priceId, Number(input.value)]));
    if (Object.values(prices).some(value => !Number.isSafeInteger(value) || value < 1000 || value > 2000000000)) {
      throw new Error('قیمت هر سه مدل باید عدد صحیح و حداقل ۱٬۰۰۰ تومان باشد.');
    }
    const shipping = Number($('#shippingFee').value);
    const tax = Number($('#taxFee').value);
    if (!Number.isSafeInteger(shipping) || shipping < 0 || !Number.isSafeInteger(tax) || tax < 0) {
      throw new Error('مبلغ ارسال و مالیات باید عدد صحیح صفر یا بیشتر باشد.');
    }
    let live_confirmation = '';
    if (goLive) {
      const ok = window.confirm('تأیید نهایی: آیا تصاویر واقعی، مشخصات، قیمت و تمام ۵۴ ترکیب سایز/رنگ را بررسی کرده‌اید و آمادهٔ فروش هستند؟ پرداخت زنده فقط پس از تنظیم همهٔ اتصال‌ها فعال می‌شود.');
      if (!ok) {
        $('#catalogLive').checked = false;
        throw new Error('فعال‌سازی فروش لغو شد.');
      }
      live_confirmation = 'I_HAVE_VERIFIED_REAL_CATALOG';
    }
    const result = await request('settings-save', {
      method: 'POST',
      body: { prices, shipping_toman: shipping, tax_toman: tax, catalog_live: goLive, live_confirmation },
    });
    message.textContent = result.message || 'تنظیمات ذخیره شد.';
    showToast(result.message || 'تنظیمات فروشگاه ذخیره شد.');
    await reloadData();
    setView('settings');
  } catch (error) {
    message.classList.add('is-error');
    message.textContent = error.message || 'ذخیره تنظیمات ناموفق بود.';
    showToast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}
async function saveOrderStatus(button) {
  const orderNumber = button.dataset.orderNumber;
  const select = document.querySelector('[data-order-status-select="' + CSS.escape(orderNumber) + '"]');
  if (!select) return;
  button.disabled = true;
  try {
    const result = await request('order-status', { method: 'POST', body: { order_number: orderNumber, status: select.value } });
    showToast(result.message || 'وضعیت سفارش تغییر کرد.');
    await reloadData();
    setView('orders');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}
async function logout() {
  try { await request('logout', { method: 'POST' }); } catch {}
  csrf = '';
  appState = null;
  showLogin();
  showToast('از پنل خارج شدید.');
}
function bindEvents() {
  $('#loginForm').addEventListener('submit', login);
  $('#logoutButton').addEventListener('click', logout);
  $('#mobileMenu').addEventListener('click', () => {
    const open = !$('#sidebar').classList.contains('is-open');
    $('#sidebar').classList.toggle('is-open', open);
    $('#mobileOverlay').hidden = !open;
  });
  $('#mobileOverlay').addEventListener('click', closeMobileMenu);
  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-view]');
    if (nav) { setView(nav.dataset.view); return; }
    const product = event.target.closest('[data-product]');
    if (product) { selectedProduct = product.dataset.product; renderInventory(); return; }
    const statusButton = event.target.closest('.save-order-status');
    if (statusButton) { saveOrderStatus(statusButton); return; }
  });
  $('#orderSearch').addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => searchOrders().catch(error => showToast(error.message, 'error')), 240);
  });
  $('#refreshOrders').addEventListener('click', () => searchOrders().then(() => showToast('فهرست سفارش‌ها به‌روزرسانی شد.')).catch(error => showToast(error.message, 'error')));
  $('#exportOrders').addEventListener('click', exportOrdersCsv);
  $('#refreshActivity').addEventListener('click', () => loadActivity().catch(error => showToast(error.message, 'error')));
  $('#activitySearch').addEventListener('input', () => {
    window.clearTimeout(activitySearchTimer);
    activitySearchTimer = window.setTimeout(renderActivity, 120);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== '/' || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    setView('orders');
    window.setTimeout(() => { $('#orderSearch')?.focus(); $('#orderSearch')?.select(); }, 0);
  });
  $('#inventoryMatrix').addEventListener('input', event => {
    const input = event.target.closest('[data-stock-key]');
    if (!input) return;
    const value = Number(input.value);
    input.classList.toggle('is-empty', value === 0);
    draftStock.set(input.dataset.stockKey, input.value === '' ? 0 : value);
  });
  $('#saveInventory').addEventListener('click', saveInventory);
  $('#settingsForm').addEventListener('submit', saveSettings);
  $('#catalogLive').addEventListener('change', () => {
    $('#liveSwitchLabel').textContent = $('#catalogLive').checked ? 'روشن' : 'خاموش';
    $('#liveSwitchLabel').classList.toggle('is-live', $('#catalogLive').checked);
  });
}
async function boot() {
  bindEvents();
  try {
    const session = await request('session');
    csrf = session.csrf || '';
    if (!session.configured) $('#setupNotice').hidden = false;
    if (session.authenticated) {
      try { await reloadData(); } catch (error) {
        showLogin();
        $('#loginError').textContent = error.message;
      }
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin();
    $('#loginError').textContent = error.message;
  }
}
document.addEventListener('DOMContentLoaded', boot);
