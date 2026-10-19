/* ═══ VELORA · 12 — Brief composer (contact form) ═══ */
import { $, byId, goHash, haptic, toast } from './core.js';
import { CATALOG, isProduct } from './data.js';

/* Long enough for the smooth scroll to settle before focus moves. */
const FOCUS_DELAY = 560;

const BUDGET_HINTS = {
  روزمره: 'مدلی برای استفادهٔ روزانه.',
  رسمی: 'مدلی برای موقعیت‌های رسمی.',
  اسپرت: 'مدلی برای استایل فعال و اسپرت.',
  مهمانی: 'مدلی برای موقعیت‌های خاص و عصرگاهی.',
  'نیازمند راهنمایی': 'دستهٔ مناسب را در پیام توضیح دهید.',
};

const VALIDATORS = {
  fName: v => (v.trim().length >= 2 ? '' : 'لطفاً نام خود را بنویسید.'),
  fEmail: v =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'لطفاً ایمیل معتبر وارد کنید.',
  fType: v => (v ? '' : 'موضوع پیام را انتخاب کنید.'),
  fMessage: v => (v.trim().length >= 20 ? '' : 'کمی جزئیات بیشتر، لطفاً.'),
};
const FIELDS = Object.keys(VALIDATORS);

let composedBrief = '';

function setError(id, message) {
  const field = byId(id);
  const error = byId('err' + id.slice(1));
  if (!field || !error) return !message;
  error.textContent = message;
  error.hidden = !message;
  if (message) field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');
  return !message;
}

function validateField(id) {
  const el = byId(id);
  if (!el) return true;
  return setError(id, VALIDATORS[id](el.value));
}

function clearValidation() {
  for (const id of FIELDS) setError(id, '');
  $('#errBudget').hidden = true;
  $('#budgetHint').hidden = true;
}

function showForm() {
  $('#formPanel').hidden = false;
  $('#formSuccess').hidden = true;
  composedBrief = '';
}

export function beginBrief(ids) {
  if ($('#formPanel').hidden) showForm();

  const picks = (ids || []).filter(isProduct);
  if (picks.length) {
    $('#fType').value = 'product';
    const summary =
      'دربارهٔ این مدل‌ها پرسش دارم: ' +
      picks.map(id => `${CATALOG[id].no} — ${CATALOG[id].name}`).join('؛ ') +
      '.';
    const message = $('#fMessage');
    const current = message.value.trim();
    if (!current.includes(summary)) message.value = (current ? current + '\n' : '') + summary;
  }

  goHash('contact');
  setTimeout(() => $('#fName').focus({ preventScroll: true }), FOCUS_DELAY);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  return false;
}

function composeBrief(form) {
  const name = $('#fName').value.trim();
  const company = $('#fCompany').value.trim();
  const type = $('#fType').value;
  const typeName =
    {
      product: 'پرسش دربارهٔ محصول',
      size: 'راهنمای انتخاب سایز',
      order: 'پیگیری سفارش',
      shipping: 'ارسال و مرجوعی',
      other: 'سایر پرسش‌ها',
    }[type] || 'سایر پرسش‌ها';

  return [
    'پیام پشتیبانی ولورا',
    '────────────────────────',
    `نام: ${name}`,
    `ایمیل: ${$('#fEmail').value.trim()}`,
    `شماره سفارش: ${company || '—'}`,
    `موضوع: ${typeName}`,
    `دستهٔ کفش: ${form.querySelector('input[name="budget"]:checked').value}`,
    '',
    'شرح پروژه',
    $('#fMessage').value.trim(),
  ].join('\n');
}

export function formInit() {
  const form = $('#briefForm');

  for (const id of FIELDS) {
    const el = byId(id);
    el.addEventListener('blur', () => {
      if (el.value) validateField(id);
    });
    /* Only re-validate a field the user already got wrong. */
    el.addEventListener('input', () => {
      if (el.getAttribute('aria-invalid') === 'true') validateField(id);
    });
  }

  $('#budgetChips').addEventListener('change', e => {
    const input = e.target.closest('input[name="budget"]');
    if (!input) return;
    const hint = $('#budgetHint');
    hint.textContent = BUDGET_HINTS[input.value] || '';
    hint.hidden = !hint.textContent;
    $('#errBudget').hidden = true;
  });

  form.addEventListener('submit', e => {
    e.preventDefault();

    let firstBad = null;
    for (const id of FIELDS) if (!validateField(id) && !firstBad) firstBad = byId(id);

    const budget = form.querySelector('input[name="budget"]:checked');
    if (!budget) {
      const err = $('#errBudget');
      err.textContent = 'یک دسته‌بندی انتخاب کنید.';
      err.hidden = false;
      if (!firstBad) firstBad = form.querySelector('input[name="budget"]');
    }
    if (firstBad) {
      firstBad.focus();
      toast('چند جزئیات ناقص است.');
      return;
    }

    composedBrief = composeBrief(form);
    const subject = `پیام پشتیبانی ولورا — ${$('#fName').value.trim()}`;
    $('#mailLink').href =
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(composedBrief)}`;

    $('#formPanel').hidden = true;
    $('#formSuccess').hidden = false;
    haptic(10);
    toast('پیام آماده شد؛ چیزی ارسال نشده.');
  });

  $('#copyBrief').addEventListener('click', async () => {
    const ok = await copyText(composedBrief);
    toast(ok ? 'پیام کپی شد.' : 'کپی ممکن نشد.');
  });

  $('#resetBrief').addEventListener('click', () => {
    form.reset();
    clearValidation();
    showForm();
    $('#fName').focus();
  });
}
