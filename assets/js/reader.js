/* ═══ VELORA · 8 — Reader: product details, stories, journal ═══ */
import { $, clamp, esc, faNum, frameOnce, icon, money, openDialog, transition } from './core.js';
import { buildProductUrl, CATALOG, CASES, ESSAYS } from './data.js';
import { addProductReview, getReviewSummary, getVariant, inCart, isVerifiedPurchase } from './cart.js';
import { invalidateRating } from './render.js';

const artBlock = (pal, ang) =>
  `<div class="reader-art" role="img" aria-label="ترکیب انتزاعی" style="--pa:${pal[0]};--pb:${pal[1]};--ang:${ang}"><span class="reader-art-disc" aria-hidden="true"></span></div>`;

/* Reading-progress bar.
   Scrollable height is cached and re-measured only when the article changes or
   the shell resizes — reading it on every scroll event forced a synchronous
   reflow of the reader on every frame of the scroll. */
const shell = { el: null, bar: null, max: 0 };

function paintProgress() {
  const p = shell.max > 0 ? clamp(shell.el.scrollTop / shell.max, 0, 1) : 1;
  shell.bar.style.transform = `scaleX(${p})`;
}
function measureProgress() {
  if (!shell.el) return;
  shell.max = shell.el.scrollHeight - shell.el.clientHeight;
  paintProgress();
}

function readerOpen(kicker, html) {
  const dialog = $('#readerDialog');
  $('#readerKicker').textContent = kicker;

  const apply = () => {
    $('#readerContent').innerHTML = html;
    shell.el.scrollTop = 0;
    /* Measure after layout: while the dialog is still closed the shell has no
       height, so an immediate measurement would report "nothing to read". */
    shell.max = 0;
    requestAnimationFrame(measureProgress);
  };

  if (dialog.open) transition(apply);
  else {
    apply();
    openDialog(dialog);
  }
}

function syncPdpSelection(root = document) {
  const size = root.querySelector('.pdp-size.is-selected')?.dataset.size || null;
  const color = root.querySelector('.pdp-swatch.is-selected')?.dataset.color || null;
  const addButton = root.querySelector('[data-add]');
  if (addButton) {
    addButton.dataset.size = size || '';
    addButton.dataset.color = color || '';
    const held = inCart(addButton.dataset.add);
    const current = getVariant(addButton.dataset.add);
    const label = addButton.querySelector('.btn-label');
    if (held && size && current?.size === size) {
      addButton.disabled = true;
      addButton.classList.add('is-added');
      if (label) label.textContent = 'در سبد خرید شماست';
    } else {
      addButton.disabled = false;
      addButton.classList.remove('is-added');
      if (label) label.textContent = held ? 'ثبت سایز در سبد' : 'افزودن به سبد';
    }
  }
  return { size, color };
}

function productReviewsMarkup(id) {
  const { reviews, count, average } = getReviewSummary(id);
  const verified = isVerifiedPurchase(id);
  const stars = Array.from({ length: 5 }, (_, index) => {
    const star = index + 1;
    const filled = star <= Math.round(average || 0);
    return `<span class="review-star-badge${filled ? ' is-filled' : ''}" aria-hidden="true">★</span>`;
  }).join('');

  const reviewItems = reviews.length
    ? reviews
        .slice()
        .reverse()
        .map(review => {
          const initials =
            String(review.author || 'کاربر')
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .map(part => part.replace(/[^\p{L}\p{N}]/gu, ''))
              .filter(Boolean)
              .slice(0, 2)
              .map(part => part.charAt(0).toUpperCase())
              .join('') || 'V';

          const avatarTone = `hsl(${(initials.charCodeAt(0) * 17) % 360} 55% 62%)`;
          return `
          <div class="review-item">
            <div class="review-head">
              <div class="review-author-wrap">
                <div class="review-avatar" style="--avatar-tone:${avatarTone};" aria-label="پروفایل ${esc(review.author)}">${esc(initials)}</div>
                <div class="review-author-meta">
                  <b>${esc(review.author)}</b>
                  <span class="review-badge-line">
                    ${review.verified ? '<span class="verified-badge">✓ تأییدشده</span>' : '<span class="guest-badge">بازدیدکننده</span>'}
                  </span>
                </div>
              </div>
              <div class="review-rating" aria-label="امتیاز ${faNum(review.rating)} از ${faNum(5)}">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
            </div>
            <p>${esc(review.text)}</p>
          </div>
        `;
        })
        .join('')
    : `<p class="review-empty">هنوز کسی برای این مدل دیدگاهی ثبت نکرده؛ اولین دیدگاه را شما بنویسید.</p>`;

  return `
    <div class="pdp-review-block">
      <div class="pdp-review-header">
        <div>
          <p class="eyebrow">دیدگاه‌ها</p>
          <h3 class="pdp-review-title">نظرات مشتریان</h3>
        </div>
        <div class="review-score" aria-label="میانگین ${faNum(String(average || 0))} از ${faNum(5)}">
          <b>${average ? faNum(average.toFixed(1)) : '—'}</b>
          <span>${count ? `${faNum(count)} دیدگاه` : 'بدون دیدگاه'}</span>
          <div class="review-stars-row">${stars}</div>
        </div>
      </div>
      ${
        verified
          ? `
          <form class="product-review-form" data-review-product="${id}" data-review-rating="5">
            <div class="review-stars" aria-label="امتیاز خود را انتخاب کنید">
              <button class="review-star is-selected" type="button" data-review-star="1" aria-label="۱ ستاره">★</button>
              <button class="review-star is-selected" type="button" data-review-star="2" aria-label="۲ ستاره">★</button>
              <button class="review-star is-selected" type="button" data-review-star="3" aria-label="۳ ستاره">★</button>
              <button class="review-star is-selected" type="button" data-review-star="4" aria-label="۴ ستاره">★</button>
              <button class="review-star is-selected" type="button" data-review-star="5" aria-label="۵ ستاره">★</button>
            </div>
            <label class="review-field">
              <span>دیدگاه شما</span>
              <textarea name="review-text" rows="4" maxlength="280" placeholder="این مدل از نظر راحتی، فرم و کیفیت چه احساسی به شما داده؟"></textarea>
            </label>
            <div class="pdp-actions">
              <button class="btn btn-solid" type="submit"><span class="btn-label">ثبت دیدگاه</span>${icon('i-arrow', 'arr')}</button>
            </div>
            <p class="review-status" aria-live="polite"></p>
          </form>
        `
          : `
          <div class="review-gate">
            <p>برای ثبت نظر، باید این مدل را با تأیید سفارش خریداری کرده باشید.</p>
          </div>
        `
      }
      <div class="review-list">${reviewItems}</div>
    </div>
  `;
}

document.addEventListener('click', e => {
  const sizeBtn = e.target.closest('.pdp-size');
  if (sizeBtn) {
    const root = sizeBtn.closest('#readerContent');
    for (const btn of root ? root.querySelectorAll('.pdp-size') : []) {
      btn.classList.toggle('is-selected', btn === sizeBtn);
      btn.setAttribute('aria-pressed', String(btn === sizeBtn));
    }
    root?.querySelector('.pdp-sizes')?.classList.remove('is-required');
    syncPdpSelection(root || document);
    return;
  }

  const swatchBtn = e.target.closest('.pdp-swatch');
  if (swatchBtn) {
    const root = swatchBtn.closest('#readerContent');
    for (const btn of root ? root.querySelectorAll('.pdp-swatch') : []) {
      btn.classList.toggle('is-selected', btn === swatchBtn);
      btn.setAttribute('aria-pressed', String(btn === swatchBtn));
    }
    syncPdpSelection(root || document);
    return;
  }

  const reviewStar = e.target.closest('.review-star');
  if (reviewStar) {
    const form = reviewStar.closest('.product-review-form');
    if (!form) return;
    const value = Number(reviewStar.dataset.reviewStar || 5);
    form.dataset.reviewRating = String(value);
    for (const star of form.querySelectorAll('.review-star')) {
      star.classList.toggle('is-selected', Number(star.dataset.reviewStar) <= value);
    }
    return;
  }
});

document.addEventListener('submit', e => {
  const form = e.target.closest('.product-review-form');
  if (!form) return;
  e.preventDefault();

  const id = form.dataset.reviewProduct;
  const rating = Number(form.dataset.reviewRating || 5);
  const text = form.querySelector('textarea')?.value.trim() || '';
  const status = form.querySelector('.review-status');
  const ok = addProductReview(id, { rating, text });

  if (!ok) {
    if (status) status.textContent = 'برای ثبت نظر، باید این مدل را خریداری و تأیید کرده باشید.';
    return;
  }

  if (status) status.textContent = 'دیدگاه شما با موفقیت ثبت شد.';
  form.reset();
  form.dataset.reviewRating = '5';
  /* Drop the cached rating markup before re-rendering so the new review shows. */
  invalidateRating(id);
  if (id) openProduct(id);
});

export function shareProduct(id) {
  const p = CATALOG[id];
  if (!p) return false;

  const url = buildProductUrl(id, window.location.href);
  const payload = {
    title: `${p.name} · Velora`,
    text: `${p.name} — ${p.kind}`,
    url,
  };

  if (navigator.share) {
    navigator.share(payload).catch(() => {});
    return true;
  }

  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).catch(() => {});
    return true;
  }

  const field = document.createElement('input');
  field.value = url;
  document.body.appendChild(field);
  field.select();
  document.execCommand('copy');
  document.body.removeChild(field);
  return true;
}

export function openProduct(id) {
  const p = CATALOG[id];
  if (!p) return;

  const route = `#product-${id}`;
  if (window.location.hash !== route) {
    history.replaceState(null, '', route);
  }

  const held = inCart(id);
  const { average, count } = getReviewSummary(id);
  const sizes = p.sizes || [38, 39, 40, 41, 42, 43];
  const savedVariant = getVariant(id);
  const selectedSize =
    savedVariant?.size && sizes.some(size => String(size) === String(savedVariant.size))
      ? String(savedVariant.size)
      : '';
  const swatches = [
    ['#0d0d11', '#d4af63', 'طلایی'],
    ['#c9c4bb', '#201d22', 'پلاتین'],
    ['#9a7153', '#c9a38a', 'خاکی'],
  ];

  readerOpen(
    `${p.no} — نسخه`,
    `
  <p class="eyebrow">${esc(p.no)} · ${esc(p.kind)}</p>
  <h2 class="reader-title" id="readerTitle">${esc(p.name)}</h2>
  <div class="reader-meta">
    <span>${esc(p.kind)}</span>
    <span>${count ? `${faNum(average.toFixed(1))} از ${faNum(5)}` : 'بدون امتیاز'}</span>
    <span>${count ? `${faNum(count)} بررسی` : 'اولین بررسی'}</span>
  </div>
  <div class="pdp-panel">
    <div class="pdp-gallery">
      <div class="pdp-visual" role="img" aria-label="${esc(p.art)}" style="--pa:${p.pal[0]};--pb:${p.pal[1]};--ang:${p.ang}">
        <span class="reader-art-disc" aria-hidden="true"></span>
      </div>
      <div class="pdp-thumbs" aria-hidden="true">
        <span class="pdp-thumb" style="--pa:${p.pal[0]};--pb:${p.pal[1]};--ang:${p.ang}"></span>
        <span class="pdp-thumb" style="--pa:${p.pal[1]};--pb:${p.pal[0]};--ang:${p.ang}"></span>
        <span class="pdp-thumb" style="--pa:oklch(96% 0.02 90);--pb:${p.pal[1]};--ang:${p.ang}"></span>
      </div>
    </div>
    <aside class="pdp-aside">
      <div class="pdp-price-row">
        <div class="reader-price"><b>${money(p.price)}</b>${p.price == null ? '' : '<span>' + esc(p.unit) + '</span>'}</div>
        <span class="pdp-badge">${esc(p.type)}</span>
      </div>
      <p class="reader-credit">${esc(p.credit)}</p>
      <div>
        <div class="reader-meta" style="margin-block-end:0.75rem;"><span>انتخاب سایز</span></div>
        <div class="pdp-sizes">${sizes.map(size => {
          const selected = String(size) === selectedSize;
          return '<button class="pdp-size' + (selected ? ' is-selected' : '') + '" type="button" data-size="' + size + '" aria-label="سایز ' + faNum(size) + '" aria-pressed="' + selected + '">' + faNum(size) + '</button>';
        }).join('')}</div>
      </div>
      <div>
        <div class="reader-meta" style="margin-block-end:0.75rem;"><span>رنگ‌ها</span></div>
        <div class="pdp-swatches">${swatches.map(([a, b, name], index) => `<button class="pdp-swatch${index === 0 ? ' is-selected' : ''}" type="button" data-color="${name}" aria-label="رنگ ${name}" aria-pressed="${index === 0}" style="background:linear-gradient(135deg, ${a}, ${b});"></button>`).join('')}</div>
      </div>
      <div class="pdp-actions">
        <button class="btn btn-solid${held && selectedSize ? ' is-added' : ''}" type="button" data-add="${id}" data-size="${selectedSize}" data-color="${savedVariant?.color || swatches[0][2]}"${held && selectedSize ? ' disabled' : ''}><span class="btn-label">${held && selectedSize ? 'در سبد خرید شماست' : held ? 'ثبت سایز در سبد' : 'افزودن به سبد'}</span>${icon('i-arrow', 'arr')}</button>
        <button class="btn btn-ghost" type="button" data-share-product="${id}">اشتراک‌گذاری</button>
        <button class="btn btn-ghost" type="button" data-enquire="${id}">پرسش</button>
      </div>
      <ul class="pdp-points">
        <li>${icon('i-check')}<span>مشخصات ساخت و متریال پس از تأیید نمونهٔ واقعی تکمیل می‌شوند.</span></li>
        <li>${icon('i-check')}<span>قیمت نهایی و هزینه‌های سفارش پیش از پرداخت نمایش داده می‌شوند.</span></li>
        <li>${icon('i-check')}<span>تأیید سفارش فقط پس از تأیید سروری پرداخت انجام می‌شود.</span></li>
      </ul>
    </aside>
  </div>
  <div class="reader-specs">${p.spec.map(([label, value]) => `<div><small>${esc(label)}</small>${esc(value)}</div>`).join('')}</div>
  <div class="reader-body">
    <p><em style="color:var(--primary)">${esc(p.desc)}</em></p>
    <p><strong>آنچه در این نسخه می‌آید</strong></p>
    <ul class="check-list">${p.includes.map(x => `<li>${icon('i-check')}<span>${esc(x)}</span></li>`).join('')}</ul>
  </div>
  <div class="pdp-grid">
    <div class="pdp-card">
      <h3>معرفی محصول</h3>
      <p class="reader-body" style="margin:0;max-width:none;">${esc(p.short)}</p>
    </div>
    <div class="pdp-card">
      <h3>مزایای روزمره</h3>
      <ul class="check-list">${p.includes
        .slice(0, 3)
        .map(x => `<li>${icon('i-check')}<span>${esc(x)}</span></li>`)
        .join('')}</ul>
    </div>
  </div>
  ${productReviewsMarkup(id)}
  `
  );
}

export function openCase(index) {
  const c = CASES[index];
  if (!c) return;
  const next = (index + 1) % CASES.length;
  const upcoming = CASES[next];

  readerOpen(
    `راهنمای انتخاب ${faNum(String(index + 1).padStart(2, '0'))} — ${c.cat}`,
    `
  <p class="eyebrow">${esc(c.client)} · ${esc(c.year)}</p>
  <h2 class="reader-title" id="readerTitle">${esc(c.name)} <em style="color:var(--primary)">${esc(c.italic)}</em></h2>
  <div class="reader-meta"><span>${esc(c.cat)}</span><span>${esc(c.role)}</span></div>
  ${artBlock(c.pal, c.ang)}
  <div class="reader-body"><p style="font-size:var(--fs-m);color:var(--ink)">${esc(c.intro)}</p>
  ${c.body.map(p => `<p>${esc(p)}</p>`).join('')}
  <blockquote class="reader-quote">${esc(c.quote)}</blockquote></div>
  ${c.metrics?.length ? `<div class="metrics">${c.metrics.map(([value, label]) => `<div><b>${esc(value)}</b><span>${esc(label)}</span></div>`).join('')}</div>` : ''}
  <button class="reader-next" type="button" data-next-case="${next}"><span><small>راهنمای بعدی</small><b>${esc(upcoming.name)} ${esc(upcoming.italic)}</b></span>${icon('i-arrow')}</button>`
  );
}

export function openEssay(id) {
  const index = ESSAYS.findIndex(e => e.id === id);
  if (index < 0) return;
  const e = ESSAYS[index];
  /* Advance through the list in order, wrapping at the end. */
  const next = ESSAYS[(index + 1) % ESSAYS.length];

  readerOpen(
    `${e.cat} — ${e.m} مطالعه`,
    `
  <p class="eyebrow">${esc(e.cat)} · ${esc(e.m)} مطالعه</p>
  <h2 class="reader-title" id="readerTitle">${esc(e.t)}</h2>
  ${artBlock(e.pal, '135deg')}
  <div class="reader-body">${e.body.map((p, i) => `${i === 1 ? `<blockquote class="reader-quote">${esc(e.quote)}</blockquote>` : ''}<p>${esc(p)}</p>`).join('')}</div>
  <button class="reader-next" type="button" data-next-essay="${next.id}"><span><small>ادامهٔ خواندن</small><b>${esc(next.t)}</b></span>${icon('i-arrow')}</button>`
  );
}

export function readerInit() {
  shell.el = $('#readerShell');
  shell.bar = $('#readerProgress');

  shell.el.addEventListener('scroll', frameOnce(paintProgress), { passive: true });

  addEventListener('resize', measureProgress, { passive: true });
  /* The article body is what actually changes height between reads. */
  const body = $('#readerContent');
  if ('ResizeObserver' in window) new ResizeObserver(measureProgress).observe(body);
  else body.addEventListener('transitionend', measureProgress);

  measureProgress();
}
