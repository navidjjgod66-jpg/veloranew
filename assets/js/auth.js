import { $, closeDialog, esc, getCustomFootSize, latinDigits, openDialog, toast } from './core.js';
import { apiRequest, bootstrap, currentUser, saveCustomFootSize, smsReady } from './api.js';

let step = 'phone';
let pendingMobile = '';
let bootError = '';

function normaliseMobileForUi(value) {
  let mobile = latinDigits(value).replace(/\D+/g, '');
  if (mobile.startsWith('98') && mobile.length === 12) mobile = '0' + mobile.slice(2);
  if (mobile.length === 10 && mobile.startsWith('9')) mobile = '0' + mobile;
  return mobile;
}

async function syncPendingCustomFootSize() {
  const pending = getCustomFootSize();
  if (!pending || !currentUser()) return;
  try {
    await saveCustomFootSize(pending);
  } catch (error) {
    console.warn('[VELORA] Custom foot size sync failed after login:', error);
  }
}

function renderAuth() {
  const body = $('#authDialog .sheet-body');
  if (!body) return;
  const user = currentUser();
  if (user) {
    const foot = user.custom_foot_size || getCustomFootSize();
    const footSummary = foot
      ? '<p class="checkout-notice">سایز سفارشی شما: <b>' +
        esc(String(foot.length_cm)) +
        ' × ' +
        esc(String(foot.width_cm)) +
        ' سانتیمتر</b></p>'
      : '<p class="checkout-notice">هنوز سایز سفارشی ثبت نشده است؛ از راهنمای سایز در هدر می‌توانید آن را ثبت کنید.</p>';
    body.innerHTML =
      '<div class="checkout-panel"><div class="checkout-section">' +
      '<p class="eyebrow">حساب تأییدشده</p><h3 class="reader-title" style="margin:0">به ولورا خوش آمدید.</h3>' +
      '<p class="checkout-notice">شمارهٔ تأییدشده: <b class="mono" dir="ltr">' +
      esc(user.mobile) +
      '</b></p>' +
      footSummary +
      '<button class="btn btn-ghost" id="authLogout" type="button">خروج امن از حساب</button></div></div>';
    return;
  }

  const readinessNote = bootError
    ? '<p class="checkout-notice" role="status">' + esc(bootError) + '</p>'
    : !smsReady()
      ? '<p class="checkout-notice" role="status">ورود زمانی فعال می‌شود که حساب ملی‌پیامک، الگوی تأییدشدهٔ OTP و پایگاه داده روی سرور تنظیم شوند. کد نمونه یا ورود ساختگی استفاده نمی‌شود.</p>'
      : '';

  if (step === 'verify') {
    body.innerHTML =
      '<div class="checkout-panel"><div class="checkout-section">' +
      '<p class="eyebrow">تأیید شماره</p><h3 class="reader-title" style="margin:0">کد یک‌بارمصرف را وارد کنید.</h3>' +
      '<p class="checkout-notice">کد به شمارهٔ <b class="mono" dir="ltr">' +
      esc(pendingMobile) +
      '</b> ارسال شده و ۵ دقیقه اعتبار دارد.</p>' +
      '<form id="authCodeForm" class="commerce-form" novalidate>' +
      '<div class="field field--full"><label for="authOtp">کد ۶ رقمی</label>' +
      '<input class="control" id="authOtp" name="code" inputmode="numeric" autocomplete="one-time-code" enterkeyhint="done" pattern="[0-9۰-۹]{6}" minlength="6" maxlength="6" required aria-describedby="authOtpHint" />' +
      '<small id="authOtpHint">کد را فقط در همین صفحه وارد کنید.</small></div>' +
      '<p class="commerce-message" id="authMessage" role="status" aria-live="polite"></p>' +
      '<button class="btn btn-solid commerce-submit" type="submit"><span>تأیید و ورود</span></button>' +
      '<div class="commerce-actions"><button class="tlink" type="button" data-auth-back>تغییر شماره</button>' +
      '<button class="tlink" type="button" data-auth-resend>ارسال دوبارهٔ کد</button></div></form></div></div>';
    const code = $('#authOtp');
    if (code) code.focus({ preventScroll: true });
    return;
  }

  body.innerHTML =
    '<div class="checkout-panel"><div class="checkout-section">' +
    '<p class="eyebrow">ورود امن با پیامک</p><h3 class="reader-title" style="margin:0">حساب شما، فقط با شمارهٔ تأییدشده.</h3>' +
    '<p class="checkout-notice">برای ورود یا ساخت حساب، شمارهٔ همراه خود را وارد کنید. کد فقط از سرویس پیامک سرور ارسال می‌شود و در این صفحه یا پاسخ API نمایش داده نمی‌شود.</p>' +
    readinessNote +
    '<form id="authPhoneForm" class="commerce-form" novalidate>' +
    '<div class="field field--full"><label for="authMobile">شمارهٔ همراه</label>' +
    '<input class="control" id="authMobile" name="mobile" type="tel" inputmode="tel" autocomplete="tel" enterkeyhint="send" placeholder="۰۹۱۲۳۴۵۶۷۸۹" maxlength="16" required aria-describedby="authMobileHint" />' +
    '<small id="authMobileHint">شمارهٔ همراه ایران با ۰۹ آغاز می‌شود.</small></div>' +
    '<p class="commerce-message" id="authMessage" role="status" aria-live="polite"></p>' +
    '<button class="btn btn-solid commerce-submit" type="submit"' +
    (!smsReady() ? ' disabled' : '') +
    '><span>ارسال کد تأیید</span></button></form></div></div>';
}

export function openAuth() {
  const dialog = $('#authDialog');
  if (!dialog) return;
  bootError = '';
  openDialog(dialog);
  renderAuth();
  bootstrap(true)
    .then(() => renderAuth())
    .catch(error => {
      bootError = error.message || 'اتصال به سرویس ورود برقرار نشد.';
      renderAuth();
    });
}

export async function authInit() {
  const button = $('#authBtn');
  const dialog = $('#authDialog');
  const body = $('#authDialog .sheet-body');
  if (!button || !dialog || !body) return;

  button.addEventListener('click', openAuth);
  window.addEventListener('velora:auth-changed', () => {
    button.setAttribute('aria-label', currentUser() ? 'حساب کاربری تأییدشده' : 'ورود با پیامک');
    renderAuth();
  });

  body.addEventListener('submit', async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id !== 'authPhoneForm' && form.id !== 'authCodeForm') return;
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    const message = $('#authMessage', form);
    if (submit) submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    if (message) message.textContent = 'در حال بررسی امن درخواست…';
    try {
      if (form.id === 'authPhoneForm') {
        pendingMobile = normaliseMobileForUi(new FormData(form).get('mobile'));
        const result = await apiRequest('auth-send-otp', { body: { mobile: pendingMobile } });
        step = 'verify';
        renderAuth();
        toast(result.message || 'در صورت معتبر بودن درخواست، کد ارسال شده است.');
      } else {
        const values = new FormData(form);
        const code = latinDigits(values.get('code')).replace(/\D+/g, '');
        const result = await apiRequest('auth-verify-otp', {
          body: { mobile: pendingMobile, code },
        });
        step = 'phone';
        pendingMobile = '';
        bootError = '';
        window.dispatchEvent(new CustomEvent('velora:auth-changed', { detail: result.user }));
        try {
          await syncPendingCustomFootSize();
        } catch (error) {
          console.warn('[VELORA] Profile sync after login failed:', error);
        }
        toast('ورود با موفقیت تأیید شد.');
        closeDialog(dialog);
      }
    } catch (error) {
      if (message) message.textContent = error.message || 'درخواست ناموفق بود؛ دوباره تلاش کنید.';
      else toast(error.message || 'درخواست ناموفق بود.');
    } finally {
      if (submit && submit.isConnected) {
        submit.disabled = form.id === 'authPhoneForm' && !smsReady();
      }
      form.removeAttribute('aria-busy');
    }
  });

  body.addEventListener('click', async event => {
    const target =
      event.target instanceof Element
        ? event.target.closest('[data-auth-back], [data-auth-resend], #authLogout')
        : null;
    if (!target) return;
    if (target.hasAttribute('data-auth-back')) {
      step = 'phone';
      renderAuth();
      const input = $('#authMobile');
      if (input) input.value = pendingMobile;
      return;
    }
    if (target.hasAttribute('data-auth-resend')) {
      step = 'phone';
      renderAuth();
      const input = $('#authMobile');
      if (input) input.value = pendingMobile;
      const form = $('#authPhoneForm');
      if (form) form.requestSubmit();
      return;
    }
    if (target.id === 'authLogout') {
      target.disabled = true;
      try {
        await apiRequest('auth-logout');
        window.dispatchEvent(new CustomEvent('velora:auth-changed', { detail: null }));
        toast('از حساب کاربری خارج شدید.');
        closeDialog(dialog);
      } catch (error) {
        target.disabled = false;
        toast(error.message || 'خروج انجام نشد.');
      }
    }
  });

  try {
    await bootstrap();
    button.setAttribute('aria-label', currentUser() ? 'حساب کاربری تأییدشده' : 'ورود با پیامک');
  } catch {
    // The unavailable API is explained when the user opens the account dialog.
  }
}
