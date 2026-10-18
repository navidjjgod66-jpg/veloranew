import { $, byId, ls, openDialog, toast } from './core.js';

const SESSION_KEY = 'lm-auth-session';
const DEFAULT_SMS = {
  apiKey: '',
  sender: 'Velora',
  endpoint: '',
};

export function normalizePhone(raw) {
  const digits = String(raw ?? '')
    .replace(/\D+/g, '')
    .replace(/^00/, '')
    .replace(/^98/, '');

  if (!digits) return '';
  if (digits.startsWith('0')) return digits.replace(/^0+/, '');
  return digits;
}

export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000);
}

export function createAuthSession(phone, code) {
  const normalized = normalizePhone(phone);
  if (!normalized || !/^9\d{9}$/.test(normalized)) {
    return null;
  }

  const token = [
    normalized.slice(0, 3),
    Date.now().toString(16),
    Math.random().toString(16).slice(2),
  ].join('-');

  const session = {
    phone: normalized,
    code: String(code).padStart(6, '0'),
    token,
    createdAt: Date.now(),
  };

  ls.setJson(SESSION_KEY, session);
  return session;
}

function getSmsConfig() {
  const runtime = typeof window !== 'undefined' ? window.MY_PAYAMAK || window.MeyPayamak || {} : {};
  const stored = ls.json('lm-meypayamak', {});
  return {
    ...DEFAULT_SMS,
    ...stored,
    ...runtime,
  };
}

export function setSmsConfig(config) {
  ls.setJson('lm-meypayamak', { ...ls.json('lm-meypayamak', {}), ...(config || {}) });
  return getSmsConfig();
}

export async function sendOtp(phone, opts = {}) {
  const normalized = normalizePhone(phone);
  if (!/^9\d{9}$/.test(normalized)) {
    return { success: false, reason: 'INVALID_PHONE', message: 'شماره موبایل معتبر نیست.' };
  }

  const code = String(opts.code ?? generateOtp()).padStart(6, '0');
  const config = getSmsConfig();

  try {
    if (config.apiKey && config.endpoint) {
      const payload = {
        to: `0${normalized}`,
        from: config.sender,
        text: `کد ورود ولورا: ${code}`,
      };

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        createAuthSession(normalized, code);
        return { success: true, demo: false, code, message: 'کد با موفقیت ارسال شد.' };
      }
    }
  } catch (error) {
    console.warn('[VELORA] SMS provider failed, falling back to secure demo mode.', error);
  }

  createAuthSession(normalized, code);
  return {
    success: true,
    demo: true,
    code,
    message: 'در حالت دمو، کد ورود برای تست در فرم نمایش داده می‌شود.',
  };
}

export function verifyOtp(phone, code) {
  const normalized = normalizePhone(phone);
  const session = ls.json(SESSION_KEY, null);
  if (!session || session.phone !== normalized) {
    return { success: false, reason: 'NO_SESSION', message: 'نشست ورود پیدا نشد.' };
  }

  const expected = String(code).trim();
  if (session.code !== expected) {
    return { success: false, reason: 'INVALID_CODE', message: 'کد یک‌بارمصرف اشتباه است.' };
  }

  const token = [session.token, Date.now().toString(16)].join('-');
  const finalSession = { ...session, token, verifiedAt: Date.now() };
  ls.setJson(SESSION_KEY, finalSession);
  return { success: true, token, message: 'احراز هویت با موفقیت انجام شد.' };
}

export function getCurrentAuthSession() {
  return ls.json(SESSION_KEY, null);
}

export function isAuthenticated() {
  const session = getCurrentAuthSession();
  return Boolean(session && session.token);
}

export function authInit() {
  const authBtn = $('#authBtn');
  const authDialog = $('#authDialog');
  if (!authBtn || !authDialog) return;

  const syncButton = () => {
    const session = getCurrentAuthSession();
    authBtn.innerHTML = session?.token ? '<span>حساب من</span>' : '<span>ورود با SMS</span>';
  };

  authBtn.addEventListener('click', () => openDialog(authDialog));

  const phoneForm = $('#authPhoneForm');
  const otpForm = $('#authOtpForm');
  const phoneInput = $('#authPhoneInput');
  const otpInput = $('#authOtpInput');
  const resend = $('#authResend');
  const submitPhone = $('#authSendCode');
  const submitOtp = $('#authVerifyCode');
  const stepPhone = $('#authStepPhone');
  const stepOtp = $('#authStepOtp');
  const success = $('#authSuccess');

  if (!phoneForm || !otpForm || !phoneInput || !otpInput || !submitPhone || !submitOtp) return;

  const showPhoneStep = () => {
    stepPhone.hidden = false;
    stepOtp.hidden = true;
    success.hidden = true;
    otpInput.value = '';
  };

  const showOtpStep = () => {
    stepPhone.hidden = true;
    stepOtp.hidden = false;
    success.hidden = true;
  };

  const showSuccess = () => {
    stepPhone.hidden = true;
    stepOtp.hidden = true;
    success.hidden = false;
    const session = getCurrentAuthSession();
    const user = byId('authUserName');
    if (user) user.textContent = session ? `0${session.phone}` : 'کاربر';
    syncButton();
  };

  phoneForm.addEventListener('submit', async e => {
    e.preventDefault();
    const result = await sendOtp(phoneInput.value, { code: generateOtp() });
    if (!result.success) {
      toast(result.message || 'خطا در ارسال کد');
      return;
    }
    showOtpStep();
    if (otpInput) otpInput.focus();
    if (result.demo) {
      const demo = byId('authDemoCode');
      if (demo) demo.textContent = `کد تست: ${result.code}`;
    }
    toast(result.message || 'کد ارسال شد.');
  });

  otpForm.addEventListener('submit', e => {
    e.preventDefault();
    const result = verifyOtp(phoneInput.value, otpInput.value);
    if (!result.success) {
      toast(result.message || 'کد نامعتبر است.');
      return;
    }
    showSuccess();
    toast(result.message || 'احراز هویت انجام شد.');
  });

  resend.addEventListener('click', async () => {
    const result = await sendOtp(phoneInput.value, { code: generateOtp() });
    toast(result.message || 'کد مجدداً ارسال شد.');
    if (result.demo) {
      const demo = byId('authDemoCode');
      if (demo) demo.textContent = `کد تست: ${result.code}`;
    }
  });

  submitPhone.addEventListener('click', () => phoneForm.requestSubmit());
  submitOtp.addEventListener('click', () => otpForm.requestSubmit());

  syncButton();
  showPhoneStep();
}
