<?php
declare(strict_types=1);
$https = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') ||
    (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443;
if (!$https) {
    http_response_code(426);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo 'VELORA Admin requires HTTPS.';
    exit;
}
header('Cache-Control: no-store, private');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'; upgrade-insecure-requests");
?>
<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#090909">
  <meta name="description" content="پنل خصوصی مدیریت فروشگاه ولورا">
  <title>VELORA | پنل خصوصی مدیریت</title>
  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="./admin.css">
  <script src="./admin.js" defer></script>
</head>
<body>
  <div class="noise" aria-hidden="true"></div>
  <div class="login-screen" id="loginScreen">
    <div class="login-brand">
      <div class="velora-mark" aria-hidden="true">V<span></span></div>
      <div><span class="brand-overline">PRIVATE ATELIER</span><strong>VELORA</strong></div>
    </div>
    <div class="login-panel">
      <p class="eyebrow">ACCESS · 01</p>
      <h1>فضای اختصاصی<br><em>مدیریت ولورا</em></h1>
      <p class="login-description">برای ورود به فضای عملیاتی فروشگاه، مشخصات مدیر را وارد کنید.</p>
      <div class="setup-notice" id="setupNotice" hidden>
        <strong>ورود مدیر هنوز پیکربندی نشده است.</strong>
        <p>در فایل خصوصی <code>api/config.local.php</code>، مقدارهای <code>admin_username</code> و <code>admin_password_hash</code> را تنظیم کنید. راهنما در README پروژه است.</p>
      </div>
      <form id="loginForm" autocomplete="on">
        <label for="adminUsername">نام کاربری</label>
        <input id="adminUsername" name="username" autocomplete="username" required maxlength="80" spellcheck="false">
        <label for="adminPassword">رمز عبور</label>
        <input id="adminPassword" name="password" type="password" autocomplete="current-password" required maxlength="1024">
        <p class="form-error" id="loginError" role="alert" aria-live="polite"></p>
        <button class="button button-gold button-wide" type="submit" id="loginSubmit"><span>ورود امن</span><span aria-hidden="true">↗</span></button>
      </form>
      <div class="login-foot"><span class="secure-dot"></span> نشست محافظت‌شده · اتصال HTTPS</div>
    </div>
    <footer class="login-copyright">VELORA® — CRAFTED WITH INTENTION</footer>
  </div>

  <div class="app-shell" id="appShell" hidden>
    <aside class="sidebar" id="sidebar">
      <a class="sidebar-brand" href="./" aria-label="VELORA home">
        <span class="velora-mark" aria-hidden="true">V<span></span></span>
        <span class="sidebar-wordmark"><span class="brand-overline">PRIVATE ATELIER</span><strong>VELORA</strong></span>
      </a>
      <div class="sidebar-caption">WORKSPACE <span>01</span></div>
      <nav class="side-nav" aria-label="منوی پنل">
        <button class="nav-item is-active" data-view="overview"><span class="nav-icon">◈</span><span>نمای کلی</span><span class="nav-marker"></span></button>
        <button class="nav-item" data-view="orders"><span class="nav-icon">▤</span><span>سفارش‌ها</span><span class="nav-count" id="navPending">۰</span></button>
        <button class="nav-item" data-view="inventory"><span class="nav-icon">◇</span><span>موجودی و سایزها</span></button>
        <button class="nav-item" data-view="settings"><span class="nav-icon">⚙</span><span>تنظیمات فروشگاه</span></button>
      </nav>
      <div class="sidebar-bottom">
        <div class="sidebar-live"><span class="status-dot" id="sidebarStatusDot"></span><div><strong id="sidebarStatus">فروش غیرفعال</strong><small>وضعیت کانال فروش</small></div></div>
        <button class="sidebar-help" type="button" data-view="settings"><span>؟</span><span>تنظیمات و راه‌اندازی<small>پیکربندی امن فروشگاه</small></span><b>↙</b></button>
        <div class="profile-row"><span class="avatar" id="adminAvatar">V</span><div class="profile-copy"><strong id="adminName">مدیر ولورا</strong><small>مدیریت فروشگاه</small></div><button class="icon-button" id="logoutButton" type="button" aria-label="خروج امن">↗</button></div>
      </div>
    </aside>

    <main class="main-panel">
      <header class="topbar">
        <div class="topbar-start">
          <button class="mobile-menu" id="mobileMenu" type="button" aria-label="بازکردن منو">☰</button>
          <span class="crumb">VELORA <b>/</b> <span id="crumbCurrent">نمای کلی</span></span>
        </div>
        <div class="topbar-end"><span class="topbar-date" id="todayLabel"></span><span class="topbar-divider"></span><span class="topbar-avatar">V</span></div>
      </header>

      <section class="view is-visible" id="view-overview">
        <div class="page-heading">
          <div><p class="eyebrow">THE HOUSE · OVERVIEW</p><h1>سلام، <em>خوش آمدید.</em></h1><p class="page-subtitle">دیدی روشن از جریان فروش، سفارش‌ها و وضعیت موجودی ولورا.</p></div>
          <div class="heading-actions"><span class="status-pill" id="livePill"><i></i><span>فروش غیرفعال</span></span><button class="button button-quiet" data-view="orders" type="button">مشاهده سفارش‌ها <span>↙</span></button></div>
        </div>
        <div class="setup-banner" id="setupBanner">
          <span class="banner-mark">!</span><div><strong>فروشگاه در حالت آماده‌سازی است.</strong><p>قبل از فعال‌کردن فروش، قیمت واقعی، اطلاعات محصول، موجودی و اتصال‌های پرداخت و پیامک را تکمیل کنید.</p></div>
          <button type="button" data-view="settings" aria-label="رفتن به تنظیمات">↙</button>
        </div>
        <div class="section-kicker"><span>شاخص‌های کلیدی</span><span>۳۰ روز گذشته <i></i></span></div>
        <div class="metric-grid">
          <article class="metric-card metric-featured"><div class="metric-top"><span>فروش تأییدشده</span><span class="metric-icon">↗</span></div><strong class="metric-value" id="metricRevenue">—</strong><span class="metric-meta">تومان · فقط تراکنش‌های تأییدشده</span><div class="metric-line"><span></span></div></article>
          <article class="metric-card"><div class="metric-top"><span>سفارش‌های ثبت‌شده</span><span class="metric-icon">▤</span></div><strong class="metric-value" id="metricOrders">—</strong><span class="metric-meta">در ۳۰ روز گذشته</span><div class="metric-foot"><span>همهٔ سفارش‌ها</span><b id="metricAllOrders">—</b></div></article>
          <article class="metric-card"><div class="metric-top"><span>در انتظار پرداخت</span><span class="metric-icon">◷</span></div><strong class="metric-value" id="metricPending">—</strong><span class="metric-meta">درخواست‌های هنوز تعیین‌تکلیف‌نشده</span><div class="metric-foot"><span>پرداخت‌های موفق</span><b id="metricPaid">—</b></div></article>
          <article class="metric-card"><div class="metric-top"><span>مشتریان</span><span class="metric-icon">♧</span></div><strong class="metric-value" id="metricCustomers">—</strong><span class="metric-meta">حساب‌های ثبت‌شده</span><div class="metric-foot"><span>کمبود موجودی</span><b id="metricStockAlerts">—</b></div></article>
        </div>
        <div class="overview-grid">
          <article class="surface chart-surface"><div class="surface-heading"><div><p class="eyebrow">REVENUE FLOW</p><h2>روند فروش</h2></div><span class="quiet-chip">۷ روز اخیر</span></div><div class="chart-summary"><strong id="chartTotal">۰ <small>تومان</small></strong><span>مجموع تراکنش‌های تأییدشده</span></div><div class="chart-bars" id="revenueChart" role="img" aria-label="نمودار فروش روزانه"></div><div class="chart-legend"><span><i></i> فروش تأییدشده</span><span>ارقام بر پایهٔ دادهٔ سرور</span></div></article>
          <article class="surface attention-surface"><div class="surface-heading"><div><p class="eyebrow">STOCK WATCH</p><h2>وضعیت موجودی</h2></div><button class="text-link" data-view="inventory" type="button">مدیریت <span>↙</span></button></div><div class="stock-number"><strong id="stockOut">—</strong><span>ترکیب ناموجود سایز و رنگ</span></div><div class="stock-number stock-number-small"><strong id="stockLow">—</strong><span>ترکیب با موجودی ۱ یا ۲ جفت</span></div><div class="attention-note"><span>✳</span><p>موجودی این بخش، از جدول واقعی موجودی می‌آید و هنگام شروع پرداخت رزرو می‌شود.</p></div></article>
        </div>
        <article class="surface recent-surface"><div class="surface-heading"><div><p class="eyebrow">RECENT ACTIVITY</p><h2>آخرین سفارش‌ها</h2></div><button class="text-link" data-view="orders" type="button">همهٔ سفارش‌ها <span>↙</span></button></div><div id="recentOrders" class="recent-orders"></div></article>
      </section>

      <section class="view" id="view-orders">
        <div class="page-heading page-heading-compact"><div><p class="eyebrow">ORDER DESK · 02</p><h1>سفارش‌ها <em>و تحویل</em></h1><p class="page-subtitle">بررسی وضعیت پرداخت و مدیریت مراحل آماده‌سازی سفارش‌های تأییدشده.</p></div></div>
        <div class="surface order-toolbar"><label class="searchbox"><span>⌕</span><input id="orderSearch" type="search" placeholder="جست‌وجوی شماره سفارش، نام یا موبایل" autocomplete="off"><kbd>⌘ /</kbd></label><button class="button button-quiet" id="refreshOrders" type="button">↻ به‌روزرسانی</button></div>
        <div class="order-filter-row"><span id="orderResultCount">در حال دریافت سفارش‌ها…</span><span class="quiet-chip">فقط وضعیت پرداخت از سرور معتبر است</span></div>
        <div id="ordersList" class="orders-list"></div>
      </section>

      <section class="view" id="view-inventory">
        <div class="page-heading page-heading-compact"><div><p class="eyebrow">PRODUCT ATELIER · 03</p><h1>موجودی <em>و تناسب</em></h1><p class="page-subtitle">کنترل موجودی قابل‌فروش برای هر مدل، سایز و رنگ؛ بدون حدس موجودی از سمت مرورگر.</p></div></div>
        <div class="inventory-intro surface"><div class="inventory-intro-mark">V.</div><div><strong>دفتر موجودی محصولات</strong><p>هر سلول تعداد جفت‌های موجود را نگه می‌دارد. مقدار صفر یعنی آن ترکیب قابل خرید نیست.</p></div><span class="quiet-chip" id="inventoryCompleteness">۰ / ۵۴ ترکیب ثبت‌شده</span></div>
        <div class="product-switcher" id="productSwitcher"></div>
        <div class="surface inventory-surface"><div class="surface-heading"><div><p class="eyebrow">SIZE × COLOUR</p><h2 id="inventoryProductTitle">Aster Runner</h2></div><span class="quiet-chip">حداکثر ۱۰٬۰۰۰ جفت</span></div><div class="inventory-table-wrap"><table class="inventory-table"><thead><tr><th>سایز</th><th><span class="color-dot gold"></span> طلایی</th><th><span class="color-dot platinum"></span> پلاتین</th><th><span class="color-dot sand"></span> خاکی</th></tr></thead><tbody id="inventoryMatrix"></tbody></table></div><div class="inventory-footer"><p>تغییرات تا فشردن «ذخیره موجودی» در سرور ثبت نمی‌شوند.</p><button class="button button-gold" id="saveInventory" type="button">ذخیره موجودی <span>↗</span></button></div></div>
      </section>

      <section class="view" id="view-settings">
        <div class="page-heading page-heading-compact"><div><p class="eyebrow">STORE CONFIGURATION · 04</p><h1>تنظیمات <em>فروشگاه</em></h1><p class="page-subtitle">قیمت‌گذاری قطعی، سیاست هزینه و کنترل انتشار فروش؛ همهٔ تغییرها در تنظیمات خصوصی سرور ذخیره می‌شوند.</p></div></div>
        <div class="settings-status surface"><div class="settings-status-icon" id="settingsStatusIcon">!</div><div class="settings-status-copy"><strong id="settingsStatusTitle">کانال فروش غیرفعال است</strong><p id="settingsStatusText">برای فعال‌سازی فروش، اطلاعات واقعی محصولات و پیکربندی پرداخت و پیامک باید بررسی شوند.</p></div><span class="settings-status-label" id="paymentStatusLabel">غیرفعال</span></div>
        <form id="settingsForm">
          <article class="surface settings-surface"><div class="surface-heading"><div><p class="eyebrow">PRICING · TUMAN</p><h2>قیمت محصولات</h2></div><span class="quiet-chip">قیمت مرجع سرور</span></div><p class="settings-help">قیمت صحیح را به تومان وارد کنید. هیچ مبلغ نمونه‌ای به مشتری نمایش داده نمی‌شود.</p><div class="pricing-grid" id="pricingFields"></div></article>
          <article class="surface settings-surface"><div class="surface-heading"><div><p class="eyebrow">DELIVERY POLICY</p><h2>هزینه‌های سفارش</h2></div></div><div class="policy-grid"><label class="setting-field"><span>هزینهٔ ارسال (تومان)</span><input id="shippingFee" name="shipping_toman" type="number" min="0" max="2000000000" step="1" required><small>صفر فقط اگر واقعاً رایگان است.</small></label><label class="setting-field"><span>مالیات کل سفارش (تومان)</span><input id="taxFee" name="tax_toman" type="number" min="0" max="2000000000" step="1" required><small>بر اساس سیاست مصوب فروشگاه.</small></label></div></article>
          <article class="surface live-control-surface"><div class="surface-heading"><div><p class="eyebrow">PUBLIC SALES CHANNEL</p><h2>انتشار فروش</h2></div><span class="live-switch-label" id="liveSwitchLabel">خاموش</span></div><p class="settings-help">این گزینه سمت سرور کنترل می‌شود. حتی با روشن‌بودن آن، پرداخت فقط در صورت کامل‌بودن اتصال دیتابیس، پیامک، زرین‌پال، قیمت‌ها و ماتریس موجودی فعال خواهد شد.</p><label class="live-checkbox"><input type="checkbox" id="catalogLive"><span class="live-check-ui"></span><span><strong>کاتالوگ واقعی و آمادهٔ فروش را تأیید می‌کنم.</strong><small>عکس‌ها، نام‌ها، مواد و مشخصات، سایز/رنگ‌های موجود، قیمت‌ها و موجودی هر ترکیب را شخصاً بررسی کرده‌ام.</small></span></label><div class="danger-note"><span>✳</span><p>فعال‌کردن این گزینه تأیید مدیریتی محسوب می‌شود. تا قبل از تکمیل واقعی کاتالوگ، آن را خاموش نگه دارید.</p></div><div class="settings-footer"><p id="settingsMessage" role="status" aria-live="polite"></p><button class="button button-gold" id="saveSettings" type="submit">ذخیره تنظیمات <span>↗</span></button></div></article>
        </form>
        <article class="surface security-checks"><div class="surface-heading"><div><p class="eyebrow">SYSTEM READINESS</p><h2>چک‌لیست انتشار</h2></div></div><div class="readiness-list" id="readinessList"></div><p class="settings-help">برای دسترسی به تنظیمات خصوصی، فایل <code>api/config.local.php</code> باید روی هاست وجود داشته و توسط PHP قابل‌نوشتن باشد. این فایل نباید در GitHub قرار بگیرد.</p></article>
      </section>
      <footer class="app-footer"><span>VELORA® <i>·</i> PRIVATE ATELIER</span><span>CRAFT IS NEVER ACCIDENTAL</span></footer>
    </main>
  </div>
  <div class="toast-region" id="toastRegion" role="status" aria-live="polite"></div>
  <div class="mobile-nav" id="mobileNav" hidden>
    <button class="mobile-nav-item is-active" data-view="overview"><span>◈</span><small>نمای کلی</small></button>
    <button class="mobile-nav-item" data-view="orders"><span>▤</span><small>سفارش‌ها</small><i id="mobilePendingDot" hidden></i></button>
    <button class="mobile-nav-item" data-view="inventory"><span>◇</span><small>موجودی</small></button>
    <button class="mobile-nav-item" data-view="settings"><span>⚙</span><small>تنظیمات</small></button>
  </div>
  <div class="mobile-overlay" id="mobileOverlay" hidden></div>
</body>
</html>
