import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clamp,
  esc,
  faNum,
  getCustomFootSize,
  ls,
  norm,
  normalizeCustomFootSize,
  setCustomFootSize,
} from '../assets/js/core.js';
import {
  buildProductUrl,
  getCatalogEntries,
  getProductRouteId,
  isProduct,
} from '../assets/js/data.js';
import {
  getCheckoutSummary,
  getProductReviews,
  isVerifiedPurchase,
  markVerifiedPurchase,
} from '../assets/js/cart.js';

test('norm folds Arabic variants and Persian digits for search', () => {
  assert.equal(norm('كِيک ۱۲۳'), 'کیک 123');
});

test('esc encodes HTML-sensitive characters', () => {
  assert.equal(
    esc(`<img src="x" onerror='x'>&`),
    '&lt;img src=&quot;x&quot; onerror=&#39;x&#39;&gt;&amp;'
  );
});

test('faNum converts Western digits without changing other characters', () => {
  assert.equal(faNum('Order 2048 / 12'), 'Order ۲۰۴۸ / ۱۲');
});

test('clamp respects both bounds and leaves in-range values unchanged', () => {
  assert.equal(clamp(-2, 0, 10), 0);
  assert.equal(clamp(4, 0, 10), 4);
  assert.equal(clamp(12, 0, 10), 10);
});

test('catalog exposes valid products and category filtering', () => {
  assert.equal(isProduct('aster'), true);
  assert.equal(isProduct('missing-product'), false);
  assert.ok(getCatalogEntries().length > 0);
  assert.ok(getCatalogEntries('کفش رسمی').every(([, product]) => product.kind === 'کفش رسمی'));
});

test('product routes accept supported identifiers and reject malformed routes', () => {
  assert.equal(getProductRouteId('#product-aster'), 'aster');
  assert.equal(getProductRouteId('/product/noir'), 'noir');
  assert.equal(getProductRouteId('#'), null);
  assert.equal(getProductRouteId('#javascript:alert(1)'), null);
});

test('product URLs use the production domain and preserve product identifiers', () => {
  const url = new URL(buildProductUrl('aster'));
  assert.equal(url.origin, 'https://kafshevelora.ir');
  assert.equal(url.hash, '#product-aster');
  assert.equal(new URL(buildProductUrl('noir', 'https://example.org/shop')).hash, '#product-noir');
});

test('unconnected storefront does not fabricate reviews or verified purchases', () => {
  assert.deepEqual(getProductReviews('aster'), []);
  assert.equal(isVerifiedPurchase('aster'), false);
  assert.equal(markVerifiedPurchase('aster'), false);
});

test('checkout summary does not invent prices, shipping or tax before backend configuration', () => {
  const summary = getCheckoutSummary(['aster', 'noir']);
  assert.equal(summary.items.length, 2);
  assert.equal(summary.items[0].price, null);
  assert.equal(summary.subtotal, null);
  assert.equal(summary.shipping, null);
  assert.equal(summary.tax, null);
  assert.equal(summary.total, null);
});

test('custom foot measurements normalize to valid cm values and persist locally', () => {
  const normalized = normalizeCustomFootSize({ length_cm: '26.8', width_cm: '10.4' });
  assert.deepEqual(normalized, { length_cm: 26.8, width_cm: 10.4 });

  const saved = setCustomFootSize({ length_cm: '27.1', width_cm: '10.2' });
  assert.deepEqual(saved, { length_cm: 27.1, width_cm: 10.2 });
  assert.deepEqual(getCustomFootSize(), { length_cm: 27.1, width_cm: 10.2 });

  assert.equal(normalizeCustomFootSize({ length_cm: 'abc', width_cm: '10' }), null);
});

test('storage layer falls back cleanly when a saved JSON payload is malformed', () => {
  ls.setText('velora.audit-corrupt', '{not valid json');
  assert.deepEqual(ls.json('velora.audit-corrupt', { ok: true }), { ok: true });
  assert.deepEqual(ls.json('velora.audit-corrupt', null), null);
});
