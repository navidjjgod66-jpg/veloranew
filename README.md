# VELORA — فروشگاه آنلاین کفش لوکس

تجربهٔ خرید کفش با رویکردی لوکس، مدرن، سریع و mobile-first؛ با رابط فارسی و راست‌به‌چپ.

## وضعیت فعلی

این مخزن یک فرانت‌اند استاتیک مبتنی بر HTML، CSS و JavaScript Modules است. کاتالوگ و تعاملات فعلی در مرورگر اجرا می‌شوند. **اتصال واقعی درگاه پرداخت، سرویس سمت سرور سفارش، مدیریت موجودی و تأیید امن خرید در این مخزن پیاده‌سازی نشده است.** تا زمان اتصال این سرویس‌ها، نباید رابط کاربری ادعای پرداخت موفق یا ثبت قطعی سفارش کند.

## ساختار

```text
index.html
assets/
  css/       Design tokens, typography, base, components and page sections
  fonts/     Self-hosted WOFF2 fonts
  js/
    app.js       App orchestration and delegated interactions
    core.js      DOM utilities, storage helpers, dialogs, scroll and shared frame loop
    data.js      Product catalogue, routes and editorial content
    render.js    Product and content rendering
    reader.js    Product and editorial detail dialogs
    cart.js      Cart, wishlist and checkout interface
    auth.js      Account entry point; disabled until server-side auth exists
    form.js      Contact / enquiry flow
    chrome.js    Header, navigation and status UI
    fx.js        Optional visual effects
    showcase.js  Showcase interactions
  vendor/     Self-hosted Lenis dependency
scripts/      Syntax validation
tests/        Node test suite
```

## کیفیت کد

نیازمندی‌ها: Node.js 20 یا بالاتر.

```bash
npm ci
npm run syntax
npm run lint
npm run format:check
npm test
npm run check
```

`npm run check` سینتکس ماژول‌ها، ESLint، فرمت و تست‌ها را اجرا می‌کند. CI همین مراحل را روی pull request اجرا می‌کند.

## اصول مهندسی

- محتوای ورودی و داده‌های ذخیره‌شده را قابل‌اعتماد فرض نکنید؛ از escape و اعتبارسنجی متناسب با محل خروجی استفاده کنید.
- داده‌های قیمت، موجودی، سفارش و خرید تأییدشده باید سمت سرور منبع حقیقت داشته باشند.
- هیچ اطلاعات شخصی واقعی یا نمونهٔ ظاهراً واقعی را از پیش در فرم سفارش قرار ندهید.
- قابلیت‌های پرهزینهٔ بصری باید به تنظیمات کاهش حرکت، توان دستگاه و وضعیت صفحه احترام بگذارند.
- تغییرات معماری را مرحله‌ای انجام دهید و ادعاهای عملکرد را فقط پس از اندازه‌گیری تکرارپذیر ثبت کنید.

## استقرار

این پروژه در حال حاضر بدون مرحلهٔ build به‌صورت استاتیک قابل سرو است. پیش از انتشار فروشگاهی، دامنهٔ canonical، تنظیمات امنیتی سرور، سیاست CSP، بک‌اند سفارش و درگاه پرداخت باید با محیط واقعی هماهنگ و آزمایش شوند.

---

© VELORA
