/* ═══ VELORA · 10 — Command palette (global search) ═══ */
import { $, $$, closeDialog, esc, goHash, icon, norm, openDialog } from './core.js';
import { CATALOG, CASES, ESSAYS } from './data.js';
import { openCase, openEssay, openProduct } from './reader.js';

const EMPTY = 8;
const DEFAULT_VISIBLE = 7;

/* Searchable records with a pre-folded haystack. Folding happens once at build
   time instead of on every keystroke. */
let index = [],
  results = [],
  active = 0;

const record = (kind, label, text, run) => ({
  kind,
  label,
  run,
  foldedLabel: norm(label),
  foldedText: norm(text),
});

const SECTION_LABELS = {
  editions: 'نسخه‌ها',
  work: 'نمونه‌کارها',
  studio: 'استودیو',
  journal: 'ژورنال',
  contact: 'تماس',
  difference: 'تفاوت در جزئیات',
};

function buildIndex() {
  index = [
    ...Object.entries(CATALOG).map(([id, p]) =>
      record(p.no, p.name, `${p.name} ${p.kind} ${p.short} نسخه رزرو`, () => openProduct(id))
    ),
    ...CASES.map((c, i) =>
      record('سفارش', `${c.name} ${c.italic}`, `${c.name} ${c.client} ${c.cat}`, () => openCase(i))
    ),
    ...ESSAYS.map(e => record(e.cat, e.t, `${e.t} ${e.cat} ${e.excerpt}`, () => openEssay(e.id))),
    ...Object.entries(SECTION_LABELS).map(([id, label]) =>
      record('صفحه', label, label, () => goHash(id))
    ),
  ];
}

function paint() {
  const list = $('#paletteList');
  if (!results.length) {
    list.innerHTML = '<li class="palette-empty">موردی یافت نشد.</li>';
    return;
  }
  list.innerHTML = results
    .map(
      (r, i) =>
        `<li class="palette-opt" id="popt-${i}" role="option" aria-selected="${i === active}" data-pi="${i}"><span class="p-kind">${esc(r.kind)}</span><span class="p-label">${esc(r.label)}</span>${icon('i-up')}</li>`
    )
    .join('');
  $('#paletteInput').setAttribute('aria-activedescendant', `popt-${active}`);
}

/* Exact label > prefix > substring in label > substring in body. */
function score(r, term) {
  if (r.foldedLabel === term) return 100;
  if (r.foldedLabel.startsWith(term)) return 70;
  if (r.foldedLabel.includes(term)) return 50;
  if (r.foldedText.includes(term)) return 10;
  return 0;
}

function search(query) {
  const term = norm(query.trim());
  if (!term) {
    results = index.slice(0, DEFAULT_VISIBLE);
  } else {
    const scored = [];
    for (const r of index) {
      const s = score(r, term);
      if (s) scored.push({ r, s });
    }
    scored.sort((a, b) => b.s - a.s);
    results = scored.slice(0, EMPTY).map(x => x.r);
  }
  active = 0;
  paint();
}

function activate(i) {
  const r = results[i];
  if (r) closeDialog($('#paletteDialog'), r.run);
}

function openPalette() {
  if ($('#paletteDialog').open) return;
  $('#paletteInput').value = '';
  search('');
  openDialog($('#paletteDialog'));
  requestAnimationFrame(() => $('#paletteInput').focus());
}

export function paletteInit() {
  buildIndex();

  const input = $('#paletteInput');
  const list = $('#paletteList');

  input.addEventListener('input', () => search(input.value));

  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!results.length) return;
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      active = (active + dir + results.length) % results.length;
      paint();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activate(active);
    }
  });

  list.addEventListener('click', e => {
    const option = e.target.closest('[data-pi]');
    if (option) activate(Number(option.dataset.pi));
  });

  $('#searchBtn').addEventListener('click', openPalette);
  $('#paletteFromMenu').addEventListener('click', () => closeDialog($('#menuDialog'), openPalette));
  $('#paletteFromFoot').addEventListener('click', openPalette);

  document.addEventListener('keydown', e => {
    const el = document.activeElement;
    const typing = el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if ($('#paletteDialog').open) closeDialog($('#paletteDialog'));
      else openPalette();
    } else if (e.key === '/' && !typing && !$$('dialog[open]').length) {
      e.preventDefault();
      openPalette();
    }
  });
}
