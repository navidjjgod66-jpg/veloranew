import test from 'node:test';
import assert from 'node:assert/strict';

import { clamp, esc, faNum, norm } from '../assets/js/core.js';

test('norm folds Arabic variants and Persian digits for search', () => {
  assert.equal(norm('كِيک ۱۲۳'), 'کییک 123');
});

test('esc encodes HTML-sensitive characters', () => {
  assert.equal(esc(`<img src="x" onerror='x'>&`), '&lt;img src=&quot;x&quot; onerror=&#39;x&#39;&gt;&amp;');
});

test('faNum converts Western digits without changing other characters', () => {
  assert.equal(faNum('Order 2048 / 12'), 'Order ۲۰۴۸ / ۱۲');
});

test('clamp respects both bounds and leaves in-range values unchanged', () => {
  assert.equal(clamp(-2, 0, 10), 0);
  assert.equal(clamp(4, 0, 10), 4);
  assert.equal(clamp(12, 0, 10), 10);
});
