import test from 'node:test';
import assert from 'node:assert/strict';

import { clamp, esc, faNum, norm } from '../assets/js/core.js';
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


test('checkout summary does not invent shipping or tax before backend integration', () => {
  const summary = getCheckoutSummary(['aster', 'noir']);
  assert.equal(summary.subtotal, 7050);
  assert.equal(summary.shipping, null);
  assert.equal(summary.tax, null);
  assert.equal(summary.total, 7050);
});
