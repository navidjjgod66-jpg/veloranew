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

const ratingCache = new Map();

/* Ratings change only when a review is written; cart.js calls this invalidator
   from addProductReview so the cache can stay hot across re-renders. */
export function invalidateRating(id) {
  if (id === undefined) ratingCache.clear();
  else ratingCache.delete(id + '\0true');
}

function ratingMarkup(id, compact = false) {
  const key = id + '\0' + String(compact);
  const cached = ratingCache.get(key);
  if (cached) return cached;

  const { average, count } = getReviewSummary(id);
  const safeAverage = Number.isFinite(average) ? Math.min(Math.max(average, 0), 5) : 0;
  /* Fixed-length output: five star spans joined by a precomputed separator —
     no per-index Array.from allocation on the render hot path. */
  const filled = Math.round(safeAverage);
  let stars = '';
  for (let index = 0; index < 5; index++) {
    stars += `<span class="rating-star${index < filled ? ' is-active' : ''}">★</span>`;
  }
  const score = count ? faNum(safeAverage.toFixed(1)) : '—';
  const label = compact ? `${score}` : `${score} · ${faNum(count || 0)} بررسی`;

  const markup = `
    <span class="product-rating" aria-label="امتیاز ${score} از ۵">
      <span class="rating-stars">${stars}</span>
      <span class="rating-score">${label}</span>
    </span>
  `;
  ratingCache.set(key, markup);
  return markup;
}

function productCardMarkup(id, p, i) {
  return `
  <article class="p-card rv${p.featured ? ' is-featured' : ''}" style="--d:${i * 0.07}s">
    <div class="p-media" data-shape="${p.shape}" role="img" aria-label="${esc(p.art)}" style="--pa:${p.pal[0]};--pb:${p.pal[1]};--ang:${p.ang}">
      <svg class="p-generative" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${generateArt(p.pal, p.shape, i)}</svg>
      <span class="p-ghost" aria-hidden="true">${p.no.slice(-2)}</span>
      <span class="p-form" aria-hidden="true"></span><span class="p-ring" aria-hidden="true"></span>
      <span class="p-fig">شکل ${faNum(p.no.slice(-2))} — ${esc(p.shapeName)}</span>
    </div>
    <div class="p-body">
      <div class="p-top"><span class="eyebrow"><span class="eyebrow-num">${p.no.slice(-2)}</span> · ${esc(p.kind)}</span>${p.featured ? '<span class="badge">پیشنهاد ولورا</span>' : ''}</div>
      <h3 class="p-name">${esc(p.name)}</h3>
      <p class="p-meta">${esc(p.short)}</p>
      <div class="p-price"><b>${money(p.price)}</b>${p.price == null ? '' : '<span>' + esc(p.unit) + '</span>'}</div>
      <p class="p-credit">${esc(p.credit)}</p>
      <div class="p-review-inline">${ratingMarkup(id, true)}</div>
      <div class="p-key-facts"><span>${esc(p.type)}</span><span>${esc(p.shapeName)}</span></div>
      <div class="p-actions">
        <button class="wishlist-toggle${isWishlisted(id) ? ' is-wishlisted' : ''}" type="button" data-wishlist="${id}" aria-label="${isWishlisted(id) ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}" aria-pressed="${String(isWishlisted(id))}">${icon('i-star')}</button>
        <button class="btn btn-solid btn-sm" type="button" data-add="${id}" data-label="رزرو"><span class="btn-label">رزرو</span>${icon('i-arrow', 'arr')}</button>
        <button class="p-more" type="button" data-qv="${id}">جزئیات ${icon('i-up')}</button>
      </div>
    </div>
  </article>`;
}

/**
 * Render the shop grid from the catalog (cached markup per product).
 * @returns {void}
 */
export function renderShop() {
  const grid = $('#shopGrid');
  if (!grid) return;
  const items = getCatalogEntries('all');
  const frag = document.createDocumentFragment();
  items.forEach(([id, p], i) => {
    const div = document.createElement('div');
    div.className = `p-card rv shop-card${p.featured ? ' is-featured' : ''}`;
    div.dataset.category = p.kind;
    div.style.setProperty('--d', `${i * 0.05}s`);
    div.innerHTML = `
      <div class="p-media shop-media" data-shape="${p.shape}" role="img" aria-label="${esc(p.art)}" style="--pa:${p.pal[0]};--pb:${p.pal[1]};--ang:${p.ang}">
        <svg class="p-generative" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${generateArt(p.pal, p.shape, i)}</svg>
        <span class="shop-badge">${esc(p.kind)}</span>
      </div>
      <div class="p-body">
        <div class="p-top">
          <span class="eyebrow"><span class="eyebrow-num">${p.no.slice(-2)}</span> · ${esc(p.kind)}</span>
          <span class="badge">${p.featured ? 'پیشنهاد ولورا' : esc(p.type)}</span>
        </div>
        <h3 class="p-name">${esc(p.name)}</h3>
        <p class="p-meta">${esc(p.short)}</p>
        <div class="p-price"><b>${money(p.price)}</b>${p.price == null ? '' : `<span>${esc(p.unit)}</span>`}</div>
        <div class="shop-meta-line">
          <span class="mono">${esc(p.type)} · ${esc(p.shapeName)}</span>
          <span class="shop-rating-mini">${ratingMarkup(id, true)}</span>
        </div>
        <div class="shop-actions">
          <button class="wishlist-toggle${isWishlisted(id) ? ' is-wishlisted' : ''}" type="button" data-wishlist="${id}" aria-label="${isWishlisted(id) ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به ارتباط‌مندی‌ها'}" aria-pressed="${String(isWishlisted(id))}">${icon('i-star')}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-qv="${id}">
            <span>جزئیات</span>
          </button>
          <button class="btn btn-solid btn-sm" type="button" data-add="${id}" data-label="افزودن به سبد">
            <span class="btn-label">افزودن به سبد</span>${icon('i-arrow', 'arr')}
          </button>
        </div>
      </div>
    `;
    frag.appendChild(div);
  });
  grid.innerHTML = '';
  grid.appendChild(frag);
}

/**
 * Wire the shop rail (scroll buttons, drag-to-scroll, ResizeObserver sync).
 * @returns {void}
 */
export function shopInit() {
  const vibeButtons = $$('.shop-category');
  const typeButtons = $$('.shop-type');
  const grid = $('#shopGrid');
  const count = $('#shopCount');
  const searchInput = $('#shopSearch');
  const searchClear = $('#shopSearchClear');
  const sortSelect = $('#shopSort');
  const resetButton = $('#shopReset');
  const empty = $('#shopEmpty');
  const emptyResetButton = $('#shopEmptyReset');
  if (!vibeButtons.length || !typeButtons.length || !grid) return;

  let activeVibe = 'all';
  let activeType = 'all';
  let query = '';
  let sort = 'featured';

  const normalizeSearch = value =>
    String(value ?? '')
      .normalize('NFKC')
      .toLocaleLowerCase('fa')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[يى]/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/[\u200c\u200e\u200f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const priceValue = value => {
    if (value == null || value === '') return null;
    const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const reset = () => {
    activeVibe = 'all';
    activeType = 'all';
    query = '';
    sort = 'featured';
    if (searchInput) searchInput.value = '';
    if (sortSelect) sortSelect.value = 'featured';
    apply();
  };

  const apply = () => {
    const normalizedQuery = normalizeSearch(query);
    let items = getCatalogEntries(activeVibe, activeType);
    if (normalizedQuery) {
      items = items.filter(([id, product]) => {
        const searchable = [
          id, product.no, product.name, product.kind, product.type,
          product.shapeName, product.short, product.desc, product.art,
          ...(product.spec || []).flat(), ...(product.includes || []),
        ].join(' ');
        return normalizeSearch(searchable).includes(normalizedQuery);
      });
    }

    if (sort === 'name') {
      items.sort(([, a], [, b]) => String(a.name).localeCompare(String(b.name), 'fa'));
    } else if (sort === 'price-asc' || sort === 'price-desc') {
      items.sort(([, a], [, b]) => {
        const priceA = priceValue(a.price);
        const priceB = priceValue(b.price);
        if (priceA == null && priceB == null) return 0;
        if (priceA == null) return 1;
        if (priceB == null) return -1;
        return sort === 'price-asc' ? priceA - priceB : priceB - priceA;
      });
    } else {
      items.sort(([, a], [, b]) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    }

    const frag = document.createDocumentFragment();
    items.forEach(([id, product], i) => {
      const div = document.createElement('div');
      div.className = `p-card rv${product.featured ? ' is-featured' : ''}`;
      div.style.setProperty('--d', `${i * 0.07}s`);
      div.innerHTML = productCardMarkup(id, product, i);
      frag.appendChild(div);
    });
    grid.replaceChildren(frag);
    grid.hidden = items.length === 0;
    if (empty) empty.hidden = items.length > 0;

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

    const hasFilters = activeVibe !== 'all' || activeType !== 'all' || normalizedQuery !== '';
    const canReset = hasFilters || sort !== 'featured';
    const total = getCatalogEntries().length;
    if (count) count.textContent = hasFilters
      ? `${faNum(items.length)} از ${faNum(total)} مدل`
      : `${faNum(items.length)} مدل`;
    if (searchClear) searchClear.hidden = normalizedQuery === '';
    if (resetButton) resetButton.hidden = !canReset;
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
  if (searchInput) searchInput.addEventListener('input', () => {
    query = searchInput.value;
    apply();
  });
  if (searchClear) searchClear.addEventListener('click', () => {
    query = '';
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
    apply();
  });
  if (sortSelect) sortSelect.addEventListener('change', () => {
    sort = sortSelect.value || 'featured';
    apply();
  });
  if (resetButton) resetButton.addEventListener('click', reset);
  if (emptyResetButton) emptyResetButton.addEventListener('click', reset);
  window.addEventListener('velora:prices-updated', apply);
  apply();
}

/**
 * Render the editions grid (hero-adjacent product cards).
 * @returns {void}
 */
export function renderEditions() {
  const list = $('#editionList');
  if (!list) return;
  const frag = document.createDocumentFragment();
  Object.entries(CATALOG).forEach(([id, p], i) => {
    const div = document.createElement('div');
    div.innerHTML = productCardMarkup(id, p, i);
    frag.appendChild(div);
  });
  list.innerHTML = '';
  list.appendChild(frag);
}

/**
 * Render the work grid (case-study cards).
 * @returns {void}
 */
export function renderWork() {
  const rail = $('#caseRail');
  if (!rail) return;
  const frag = document.createDocumentFragment();
  CASES.forEach((c, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
  <button class="plate rv" type="button" data-case="${i}" aria-label="بازکردن دستهٔ محصول ${esc(c.name)}" style="--d:${i * 0.05}s">
    <span class="plate-art" role="img" aria-label="دستهٔ محصول ${esc(c.cat)} برای ${esc(c.client)}" style="--pa:${c.pal[0]};--pb:${c.pal[1]};--ang:${c.ang}">
    <span class="plate-disc" aria-hidden="true"></span><span class="plate-ring" aria-hidden="true"></span>
    <span class="plate-no">${faNum(String(i + 1).padStart(2, '0'))} / ${esc(c.year)}</span>
    <span class="plate-open" aria-hidden="true">${icon('i-up')}</span></span>
    <span class="plate-cap"><b>${esc(c.name)} <em>${esc(c.italic)}</em></b><span>${esc(c.cat)} · ${esc(c.client)}</span></span>
  </button>`;
    frag.appendChild(li);
  });
  rail.innerHTML = '';
  rail.appendChild(frag);
}

/* Horizontal work rail: buttons, progress bar and mouse drag. */
/**
 * Initialise rail filtering and render shop/work/editions once.
 * @returns {void}
 */
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

/**
 * Render the journal essay list.
 * @returns {void}
 */
export function renderJournal() {
  const list = $('#journalList');
  if (!list) return;
  const frag = document.createDocumentFragment();
  ESSAYS.forEach((e, i) => {
    const article = document.createElement('article');
    article.className = `post rv${i === 0 ? ' post--lead' : ''}`;
    article.dataset.cat = esc(e.cat);
    article.style.setProperty('--d', `${(i % 3) * 0.06}s`);
    article.innerHTML = `
  <a class="post-open" href="#journal" data-essay="${e.id}" aria-label="خواندن ${esc(e.t)}">
    <span class="post-art" role="img" aria-label="نمونهٔ تایپوگرافیک ${esc(e.glyph)}" style="--pa:${e.pal[0]};--pb:${e.pal[1]}"><span class="post-glyph" aria-hidden="true">${esc(e.glyph)}</span></span>
    <span class="post-body"><span class="post-meta"><span>${esc(e.cat)}</span><span>${esc(e.m)} مطالعه</span></span>
    <h3>${esc(e.t)}</h3><p>${esc(e.excerpt)}</p>
    <span class="post-read">خواندن مقاله ${icon('i-arrow')}</span></span></a>
  </article>`;
    frag.appendChild(article);
  });
  list.innerHTML = '';
  list.appendChild(frag);
}

/**
 * Wire journal category filter chips and reveal observers.
 * @returns {void}
 */
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
