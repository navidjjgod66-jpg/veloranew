import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.VELORA_BASE_URL || 'http://127.0.0.1:4173';
const viewports = [
  { width: 320, height: 780, mobile: true },
  { width: 360, height: 800, mobile: true },
  { width: 390, height: 844, mobile: true },
  { width: 414, height: 896, mobile: true },
  { width: 768, height: 1024, mobile: false },
  { width: 1024, height: 768, mobile: false },
];

const browser = await chromium.launch({ headless: true });
const failures = [];
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.mobile,
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    try {
      await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.locator('#cartBtn').click();
      await page.locator('#cartDialog[open]').waitFor({ timeout: 5000 });
      const cartLayout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        dialog: document.querySelector('#cartDialog').getBoundingClientRect().width,
      }));
      assert.ok(cartLayout.document <= cartLayout.viewport + 1, `document overflows: ${JSON.stringify(cartLayout)}`);
      assert.ok(cartLayout.body <= cartLayout.viewport + 1, `body overflows: ${JSON.stringify(cartLayout)}`);
      assert.ok(cartLayout.dialog <= cartLayout.viewport + 1, `cart dialog overflows: ${JSON.stringify(cartLayout)}`);

      await page.locator('[data-close="cartDialog"]').click();
      await page.locator('#authBtn').click();
      await page.locator('#authDialog[open]').waitFor({ timeout: 5000 });
      const authLayout = await page.evaluate(() => {
        const dialog = document.querySelector('#authDialog');
        const input = dialog.querySelector('input');
        return {
          viewport: window.innerWidth,
          document: document.documentElement.scrollWidth,
          dialog: dialog.getBoundingClientRect().width,
          inputFontSize: input ? parseFloat(getComputedStyle(input).fontSize) : 16,
          closeButton: dialog.querySelector('[data-close="authDialog"]').getBoundingClientRect().height,
        };
      });
      assert.ok(authLayout.document <= authLayout.viewport + 1, `document overflows during auth: ${JSON.stringify(authLayout)}`);
      assert.ok(authLayout.dialog <= authLayout.viewport + 1, `auth dialog overflows: ${JSON.stringify(authLayout)}`);
      assert.ok(authLayout.inputFontSize >= 16, `form field may trigger mobile zoom: ${JSON.stringify(authLayout)}`);
      assert.ok(authLayout.closeButton >= 40, `auth close target too small: ${JSON.stringify(authLayout)}`);
      assert.deepEqual(pageErrors, [], `uncaught browser errors at ${viewport.width}px`);

      process.stdout.write(`PASS ${viewport.width}x${viewport.height}: no horizontal overflow; cart and account dialogs open; input and close target are mobile-safe.\n`);
    } catch (error) {
      failures.push(`${viewport.width}x${viewport.height}: ${error.stack || error.message}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length) {
  process.stderr.write(failures.join('\n\n') + '\n');
  process.exitCode = 1;
}
