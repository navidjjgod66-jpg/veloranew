import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.VELORA_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });

  const catalogueAdd = page.locator('#shopGrid [data-add]').first();
  await catalogueAdd.waitFor({ timeout: 10000 });
  await catalogueAdd.click();
  await page.locator('#readerDialog[open]').waitFor({ timeout: 5000 });

  assert.equal(
    await page.locator('#readerContent .pdp-size.is-selected').count(),
    0,
    'a new product must not silently preselect the first shoe size'
  );

  const detailAdd = page.locator('#readerContent [data-add]').first();
  assert.equal(await detailAdd.getAttribute('data-size'), '');

  await detailAdd.click();
  assert.equal(
    await page.locator('#readerContent .pdp-sizes.is-required').count(),
    1,
    'adding without a size should focus the size picker and show validation'
  );

  const sizeButton = page.locator('#readerContent .pdp-size').first();
  const selectedSize = await sizeButton.getAttribute('data-size');
  assert.ok(selectedSize, 'the size option should expose its value');
  await sizeButton.click();
  assert.equal(
    await page.locator('#readerContent .pdp-size.is-selected').getAttribute('data-size'),
    selectedSize
  );
  assert.equal(await detailAdd.getAttribute('data-size'), selectedSize);

  await detailAdd.click();
  assert.equal(await detailAdd.isDisabled(), true, 'successful addition should update button state');
  await page.locator('#cartBtn').click();
  await page.locator('#cartDialog[open]').waitFor({ timeout: 5000 });
  const cartVariant = await page.locator('#cartBody .cart-line small').first().textContent();
  assert.ok(
    cartVariant.includes('سایز ' + selectedSize),
    'the chosen size must persist into the cart summary'
  );
  await page.locator('[data-close="readerDialog"]').click();
  await page.locator('#readerDialog:not([open])').waitFor({ timeout: 5000 });
  assert.deepEqual(pageErrors, [], 'storefront interactions should not throw browser errors');

  console.log('Passed: product details, required size selection, add-to-cart, and saved size.');
} finally {
  await browser.close();
}
