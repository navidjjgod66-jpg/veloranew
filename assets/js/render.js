/* ═══ VELORA · 7 — Renderers: catalog, showcase, journal ═══ */
import {
  $,
  $$,
  clamp,
  esc,
  faNum,
  frameOnce,
  icon,
  money,
  motion,
  revealOnScreen,
} from './core.js';
import { CATALOG, CASES, ESSAYS, generateArt, getCatalogEntries } from './data.js';
import { getReviewSummary, isWishlisted } from './cart.js';

function ratingMarkup(id, compact = false) {
  const { average, count } = getReviewSummary(id);
  const safeAverage = Number.isFinite(average) ? Math.min(Math.max(average, 0), 5) : 0;
  const stars = Array.from(
    { length: 5 },
    (_, index) =>
      `<span class="rating-star${index < Math.round(safeAverage) ? ' is-active' : ''}">★</span>`
  ).join('');
  const score = count ? faNum(safeAverage.toFixed(1)) : '—';
  const label = compact ? `${score}` : `${score} · ${faNum(count || 0)} بررسی`;

  return `
    <span class="product-rating" aria-label="امتیاز ${score} از ۵">
      <span class="rating-stars">${stars}</span>
      <span class="rating-score">${label}</span>
    </span>
  `;
}

function productCardMarkup(id, p, i) {
  const open = p.max - p.held;
  const heldMarks = '<i class="is-held"></i>'.repeat(p.held);
  const openMarks = Array.from({ length: open }, (_, j) => `<i style="--i:${j}"></i>`).join('');

  return `
  <article class="p-card rv${p.featured ? ' is-featured' : ''}" style="--d:${i * 0.07}s">
    <div class="p-media" data-shape="${p.shape}" role="img" aria-label="${esc(p.art)}" style="--pa:${p.pal[0]};--pb:${p.pal[1]};--ang:${p.ang}">
      <svg class="p-generative" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${generateArt(p.pal, p.shape, i)}</svg>
      <span class="p-ghost" aria-hidden="true">${p.no.slice(-2)}</span>
      <span class="p-form" aria-hidden="true"></span><span class="p-ring" aria-hidden="true"></span>
      <span class="p-fig">شکل ${faNum(p.no.slice(-2))} — ${esc(p.shapeName)}</span>
    </div>
    <div class="p-body">
      <div class="p-top"><span class="eyebrow"><span class="eyebrow-num">${p.no.slice(-2)}</span> · ${esc(p.kind)}</span>${p.featured ? '<span class="badge">بیشترین انتخاب</span>' : ''}</div>
      <h3 class="p-name">${esc(p.name)}</h3>
      <p class="p-meta">${esc(p.short)}</p>
      <div class="p-price"><b>${money(p.price)}</b>${p.price == null ? "" : "<span>" + esc(p.unit) + "</span>"}</div>
      <p class="p-credit">${esc(p.credit)}</p>
      <div class="p-review-inline">${ratingMarkup(id, true)}</div>
      <div class="p-stock"><span class="p-gauge" role="img" aria-label="${faNum(p.held)} از ${faNum(p.max)} ظرفیت رزرو شده">${heldMarks}${openMarks}</span><span>${faNum(open)} از ${faNum(p.max)} در دسترس</span></div>
      <div class="p-actions">
        <button class="wishlist-toggle${isWishlisted(id) ? ' is-wishlisted' : ''}" type="button" data-wishlist="${id}" aria-label="${isWishlisted(id) ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}" aria-pressed="${String(isWishlisted(id))}">${icon('i-star')}</button>
        <button class="btn btn-solid btn-sm" type="button" data-add="${id}" data-label="رزرو"><span class="btn-label">رزرو</span>${icon('i-arrow', 'arr')}</button>
        <button class="p-more" type="button" data-qv="${id}">جزئیات ${icon('i-up')}</button>
      </div>
    </div>
  </article>`;
}

export function renderShop() {
  const grid = $('#shopGrid');
  if (!grid) return;
  const items = getCatalogEntries('all');
  grid.innerHTML = items
    .map(
      ([id, p], i) => `
    <article class="p-card rv shop-card${p.featured ? ' is-featured' : ''}" data-category="${p.kind}" style="--d:${i * 0.05}s">
      <div class="p-media shop-media" data-shape="${p.shape}" role="img" aria-label="${esc(p.art)}" style="--pa:${p.pal[0]};--pb:${p.pal[1]};--ang:${p.ang}">
        <svg class="p-generative" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${generateArt(p.pal, p.shape, i)}</svg>
        <span class="shop-badge">${esc(p.kind)}</span>
      </div>
      <div class="p-body">
        <div class="p-top">
          <span class="eyebrow"><span class="eyebrow-num">${p.no.slice(-2)}</span> · ${esc(p.kind)}</span>
          <span class="badge">${p.featured ? 'پرفروش' : 'جدید'}</span>
        </div>
        <h3 class="p-name">${esc(p.name)}</h3>
        <p class="p-meta">${esc(p.short)}</p>
        <div class="p-price"><b>${money(p.price)}</b>${p.price == null ? '' : `<span>${esc(p.unit)}</span>`}</div>
        <div class="shop-meta-line">
          <span class="mono">${faNum(p.max - p.held)} در انبار</span>
          <span class="shop-rating-mini">${ratingMarkup(id, true)}</span>
        </div>
        <div class="shop-actions">
          <button class="wishlist-toggle${isWishlisted(id) ? ' is-wishlisted' : ''}" type="button" data-wishlist="${id}" aria-label="${isWishlisted(id) ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}" aria-pressed="${String(isWishlisted(id))}">${icon('i-star')}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-qv="${id}">
            <span>جزئیات</span>
          </button>
          <button class="btn btn-solid btn-sm" type="button" data-add="${id}" data-label="افزودن به سبد">
            <span class="btn-label">افزودن به سبد</span>${icon('i-arrow', 'arr')}
          </button>
        </div>
      </div>
    </article>
  `
    )
    .join('');
}

export function shopInit() {
  const vibeButtons = $$('.shop-category');
  const typeButtons = $$('.shop-type');
  const grid = $('#shopGrid');
  const count = $('#shopCount');
  if (!vibeButtons.length || !typeButtons.length || !grid) return;

  let activeVibe = 'all';
  let activeType = 'all';

  const apply = () => {
    const items = getCatalogEntries(activeVibe, activeType);
    grid.innerHTML = items.map(([id, p], i) => productCardMarkup(id, p, i)).join('');

    for (const button of vibeButtons) {
      const match = button.dataset.shopFilter === activeVibe;
      button.classList.toggle('is-active', match);
      button.setAttribute('aria-pressed', String(match));
    }

    for (const button of typeButtons) {
      const match = button.dataset.shoeType === activeType;
      button.classList.toggle('is-active', match);
      button.setAttribute('aria-pressed', String(match));
    }

    if (count) count.textContent = `${faNum(items.length)} مدل`;
  };

  for (const button of vibeButtons) {
    button.addEventListener('click', () => {
      activeVibe = button.dataset.shopFilter || 'all';
      apply();
    });
  }

  for (const button of typeButtons) {
    button.addEventListener('click', () => {
      const selected = button.dataset.shoeType || 'all';
      activeType = activeType === selected ? 'all' : selected;
      apply();
    });
  }

  apply();
}

export function renderEditions() {
  $('#editionList').innerHTML = Object.entries(CATALOG)
    .map(([id, p], i) => productCardMarkup(id, p, i))
    .join('');
}

export function renderWork() {
  $('#caseRail').innerHTML = CASES.map(
    (c, i) => `
  <li><button class="plate rv" type="button" data-case="${i}" aria-label="بازکردن دستهٔ محصول ${esc(c.name)}" style="--d:${i * 0.05}s">
    <span class="plate-art" role="img" aria-label="دستهٔ محصول ${esc(c.cat)} برای ${esc(c.client)}" style="--pa:${c.pal[0]};--pb:${c.pal[1]};--ang:${c.ang}">
    <span class="plate-disc" aria-hidden="true"></span><span class="plate-ring" aria-hidden="true"></span>
    <span class="plate-no">${faNum(String(i + 1).padStart(2, '0'))} / ${esc(c.year)}</span>
    <span class="plate-open" aria-hidden="true">${icon('i-up')}</span></span>
    <span class="plate-cap"><b>${esc(c.name)} <em>${esc(c.italic)}</em></b><span>${esc(c.cat)} · ${esc(c.client)}</span></span>
  </button></li>`
  ).join('');
}

/* Horizontal work rail: buttons, progress bar and mouse drag. */
export function railInit() {
  const rail = $('#caseRail');
  if (!rail) return;

  const prev = $('#railPrev'),
    next = $('#railNext'),
    bar = $('#railProgress');
  if (!prev || !next || !bar) return;
  const rtl = getComputedStyle(rail).direction === 'rtl';

  const sync = () => {
    const max = rail.scrollWidth - rail.clientWidth;
    const x = Math.abs(rail.scrollLeft);
    const ratio = max > 0 ? clamp(x / max, 0, 1) : 1;
    bar.style.transform = `scaleX(${Math.max(0.12, ratio)})`;
    prev.disabled = x <= 2;
    next.disabled = max <= 2 || x >= max - 2;
  };
  const schedule = frameOnce(sync);

  const step = dir => {
    const item = rail.firstElementChild;
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 24;
    const amount = (item ? item.getBoundingClientRect().width : 320) + gap;
    rail.scrollBy({
      left: (rtl ? -amount : amount) * dir,
      behavior: motion.matches ? 'auto' : 'smooth',
    });
  };
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));

  rail.addEventListener('scroll', schedule, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(rail);
  /* Deferred: reading scrollWidth/clientWidth forces a layout, and at init the
     rail is still inside a content-visibility section that has not been laid
     out. The ResizeObserver fires on its own first callback regardless. */
  requestAnimationFrame(sync);

  /* Mouse drag-to-scroll, suppressed for touch so native panning still works. */
  let dragging = false,
    dragged = false,
    startX = 0,
    startScroll = 0;
  rail.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || motion.matches) return;
    dragging = true;
    dragged = false;
    startX = e.clientX;
    startScroll = rail.scrollLeft;
  });
  addEventListener(
    'pointermove',
    e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (!dragged && Math.abs(dx) > 6) {
        dragged = true;
        rail.classList.add('is-drag');
      }
      if (dragged) rail.scrollLeft = startScroll + (rtl ? dx : -dx);
    },
    { passive: true }
  );
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    rail.classList.remove('is-drag');
  };
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', endDrag);
  rail.addEventListener(
    'click',
    e => {
      if (!dragged) return;
      e.preventDefault();
      e.stopPropagation();
      dragged = false;
    },
    true
  );
}

export function renderJournal() {
  $('#journalList').innerHTML = ESSAYS.map(
    (e, i) => `
  <article class="post rv${i === 0 ? ' post--lead' : ''}" data-cat="${esc(e.cat)}" style="--d:${(i % 3) * 0.06}s">
    <a class="post-open" href="#journal" data-essay="${e.id}" aria-label="خواندن ${esc(e.t)}">
      <span class="post-art" role="img" aria-label="نمونهٔ تایپوگرافیک ${esc(e.glyph)}" style="--pa:${e.pal[0]};--pb:${e.pal[1]}"><span class="post-glyph" aria-hidden="true">${esc(e.glyph)}</span></span>
      <span class="post-body"><span class="post-meta"><span>${esc(e.cat)}</span><span>${esc(e.m)} مطالعه</span></span>
      <h3>${esc(e.t)}</h3><p>${esc(e.excerpt)}</p>
      <span class="post-read">خواندن مقاله ${icon('i-arrow')}</span></span></a>
  </article>`
  ).join('');
}

export function journalInit() {
  const list = $('#journalList');
  const empty = $('#journalEmpty');
  const countEl = $('#filterCount');
  if (!list || !empty) return;
  const chips = $$('.filter-bar .chip');
  const posts = $$('.post', list);

  const filter = cat => {
    let shown = 0;
    for (const post of posts) {
      const visible = cat === 'all' || post.dataset.cat === cat;
      post.hidden = !visible;
      if (visible) {
        shown++;
        /* A post hidden by an earlier filter may never have been revealed by
           the boot observer, so re-arm a one-shot reveal for it here. */
        if (!post.classList.contains('in')) revealOnScreen(post);
      }
    }
    for (const chip of chips)
      chip.setAttribute('aria-pressed', String(chip.dataset.filter === cat));
    if (countEl) countEl.textContent = `${faNum(shown)} مقاله`;
    empty.hidden = shown > 0;
  };

  for (const chip of chips) chip.addEventListener('click', () => filter(chip.dataset.filter));
  empty.addEventListener('click', e => {
    const chip = e.target.closest('[data-filter]');
    if (chip) filter(chip.dataset.filter);
  });
  filter('all');
}
