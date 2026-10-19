import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../api/index.php', import.meta.url), 'utf8');
const example = readFileSync(new URL('../api/config.local.php.example', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../api/schema.sql', import.meta.url), 'utf8');
const gitignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
const apache = readFileSync(new URL('../.htaccess', import.meta.url), 'utf8');
const adminApi = readFileSync(new URL('../api/admin.php', import.meta.url), 'utf8');
const adminPanel = readFileSync(new URL('../admin/index.php', import.meta.url), 'utf8');
const adminScript = readFileSync(new URL('../admin/admin.js', import.meta.url), 'utf8');
const adminStyles = readFileSync(new URL('../admin/admin.css', import.meta.url), 'utf8');

test('payment amounts are converted from the store Toman unit for ZarinPal API calls', () => {
  assert.match(api, /function zarinpal_amount_rial\(int \$amountToman\): int/);
  assert.match(api, /return \$amountToman \* 10;/);
  assert.match(api, /'amount' => zarinpal_amount_rial\(\(int\) \$quote\['total_toman'\]\)/);
  assert.match(api, /'amount' => zarinpal_amount_rial\(\(int\) \$payment\['amount_toman'\]\)/);
});

test('a paid order depends on the server-side verification result, not the browser return URL', () => {
  assert.match(api, /\/verify\.json/);
  assert.match(api, /in_array\(\$code, \[100, 101\], true\)/);
  assert.match(api, /payment_status = 'paid'/);
  assert.match(api, /reference_id = \?/);
  assert.match(
    api,
    /'paid' => \$order\['payment_status'\] === 'paid' && \$order\['status'\] === 'paid'/
  );
});

test('payment status is available as an authenticated GET endpoint before the POST-only guard', () => {
  const getStatus = api.indexOf(
    "$action === 'payment-status' && (\$_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET'"
  );
  const postOnly = api.indexOf("if ((\$_SERVER['REQUEST_METHOD'] ?? '') !== 'POST')");
  assert.notEqual(getStatus, -1);
  assert.notEqual(postOnly, -1);
  assert.ok(getStatus < postOnly);
  assert.match(api, /WHERE order_number = \? AND customer_id = \? LIMIT 1/);
});

test('OTP storage and responses do not disclose the generated code', () => {
  assert.match(api, /hash_hmac\('sha256', \$mobile \. ':' \. \$code, app_key\(\)\)/);
  assert.match(api, /INTERVAL 5 MINUTE/);
  assert.match(api, /attempts = attempts \+ 1/);
  assert.match(api, /INTERVAL 1 HOUR/);
  assert.match(api, /'expires_in' => 300/);
  assert.doesNotMatch(api, /send_json\([^;]*['"]code['"]\s*=>\s*\$code/s);
});

test('runtime credentials are private and incomplete payment policy disables checkout by default', () => {
  assert.match(gitignore, /api\/config\.local\.php/);
  assert.match(example, /REPLACE_WITH_ZARINPAL_MERCHANT_ID/);
  assert.match(example, /REPLACE_WITH_MELIPAYAMAK_USERNAME/);
  assert.match(example, /'aster' => null/);
  assert.match(example, /'shipping_toman' => null/);
  assert.match(example, /'tax_toman' => null/);
  assert.match(api, /is_int\(\$shipping\) && \$shipping >= 0/);
  assert.match(api, /is_int\(\$tax\) && \$tax >= 0/);
  assert.match(example, /'catalog_live' => false/);
  assert.match(api, /cfg\('catalog_live', false\) === true/);
});

test('unverified catalogue cannot activate live checkout', () => {
  assert.match(example, /'catalog_live' => false/);
  assert.match(api, /cfg\('catalog_live', false\) === true/);
});

test('production readiness fails closed and the API bootstrap survives missing deployment configuration', () => {
  assert.ok(api.includes("$zarinpalSandboxSetting = getenv('ZARINPAL_SANDBOX');"));
  assert.match(
    api,
    /\$zarinpalSandboxSetting === false \|\| trim\(\(string\) \$zarinpalSandboxSetting\) === ''/
  );
  assert.match(api, /filter_var\(\$zarinpalSandboxSetting, FILTER_VALIDATE_BOOLEAN\)/);
  assert.match(api, /'sms_ready' => \$ready && sms_ready\(\)/);
  assert.match(api, /'prices_toman' => \$ready \? configured_prices\(\) : \[\]/);
  assert.match(api, /sms_ready\(\) &&/);
});

test('server-side checkout requires a selected size shown by the current catalogue', () => {
  assert.match(api, /!in_array\(\$size, \['38', '39', '40', '41', '42', '43'\], true\)/);
});

test('SMS readiness rejects unchanged example credentials', () => {
  assert.match(
    api,
    /!str_contains\(\(string\) cfg\('melipayamak_username', ''\), 'REPLACE_WITH'\)/
  );
  assert.match(
    api,
    /!str_contains\(\(string\) cfg\('melipayamak_password', ''\), 'REPLACE_WITH'\)/
  );
});

test('MeliPayamak rejects zero receipt IDs as successful sends', () => {
  assert.ok(api.includes("(float) $smsResult['Value'] > 0;"));
  assert.ok(api.includes('(float) $rawStatus > 0;'));
});

test('database enforces unique mobile, order, and payment authority identities', () => {
  assert.match(schema, /UNIQUE KEY uq_customers_mobile/);
  assert.match(schema, /UNIQUE KEY uq_orders_number/);
  assert.match(schema, /UNIQUE KEY uq_payments_authority/);
  assert.match(schema, /FOREIGN KEY \(customer_id\) REFERENCES customers/);
  assert.match(schema, /FOREIGN KEY \(order_id\) REFERENCES orders/);
});

test('Apache entry point and private-file protections are configured', () => {
  assert.match(apache, /^DirectoryIndex index\.html index\.php$/m);
  assert.ok(
    apache.includes(
      '<FilesMatch "^(config\\.local\\.php|config\\.local\\.php\\.tmp-[a-fA-F0-9]+|schema\\.sql|.*\\.sql)$">'
    )
  );
  assert.ok(apache.includes('Require all denied'));
  assert.ok(apache.includes('RewriteRule (^|/)\\.git(/|$) - [F,L]'));
  assert.ok(apache.includes('RewriteRule (^|/)\\.env($|\\.) - [F,L]'));
});

test('checkout reserves and releases variant stock safely', () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS product_inventory/);
  assert.match(schema, /PRIMARY KEY \(product_id, size, color\)/);
  assert.match(
    api,
    /SELECT stock_quantity FROM product_inventory WHERE product_id = \? AND size = \? AND color = \? FOR UPDATE/
  );
  assert.match(api, /stock_quantity = stock_quantity - 1/);
  assert.match(api, /function restore_order_inventory\(PDO \$pdo, int \$orderId\): void/);
  assert.match(
    api,
    /if \(\$orderUpdate->rowCount\(\) === 1\) \{\s+restore_order_inventory\(\$pdo, \(int\) \$payment\['order_id'\]\);/
  );
  assert.match(api, /function inventory_matrix_ready\(\): bool/);
  assert.match(api, /inventory_matrix_ready\(\)/);
});

test('admin API uses a separate session and CSRF-protected actions', () => {
  assert.ok(adminApi.includes("session_name('VELORA_ADMIN')"));
  assert.ok(adminApi.includes("'samesite' => 'Strict'"));
  assert.ok(adminApi.includes('password_verify($password, $hash)'));
  assert.ok(adminApi.includes("$_SERVER['HTTP_X_CSRF_TOKEN']"));
  assert.ok(adminApi.includes('INTERVAL 15 MINUTE'));
  assert.ok(adminApi.includes('admin_require_auth();'));
  assert.ok(
    adminApi.includes(
      "if ($method === 'GET' && in_array($action, ['bootstrap', 'orders', 'activity'], true))"
    )
  );
  assert.ok(adminApi.includes('admin_audit($pdo,'));
  assert.ok(adminApi.includes('admin_write_local_config'));
});

test('admin settings update only approved keys in the private config', () => {
  assert.ok(adminApi.includes('global $adminLocalConfigPath, $adminLocalConfig, $adminConfig;'));
  assert.ok(
    adminApi.includes(
      "// Write only the existing private file's values; never copy environment secrets into it."
    )
  );
  assert.ok(
    adminApi.includes(
      "foreach (['product_prices_toman', 'shipping_toman', 'tax_toman', 'catalog_live'] as $key)"
    )
  );
  assert.ok(
    adminApi.includes("($body['live_confirmation'] ?? '') !== 'I_HAVE_VERIFIED_REAL_CATALOG'")
  );
  assert.ok(adminApi.includes('I_HAVE_VERIFIED_REAL_CATALOG'));
  assert.ok(adminApi.includes('rename($temp, $adminLocalConfigPath)'));
});

test('admin panel has a secure entry point and mobile navigation', () => {
  assert.ok(adminPanel.includes('X-Robots-Tag: noindex, nofollow, noarchive'));
  assert.ok(adminPanel.includes('Content-Security-Policy'));
  assert.ok(adminPanel.includes('requires HTTPS'));
  assert.ok(adminPanel.includes('id="mobileNav"'));
  assert.ok(adminPanel.includes('id="inventoryMatrix"'));
  assert.ok(adminPanel.includes('id="ordersList"'));
  assert.ok(adminScript.includes("request('bootstrap')"));
  assert.ok(adminScript.includes("request('stock-save'"));
  assert.ok(adminScript.includes("request('settings-save'"));
  assert.ok(adminScript.includes("request('order-status'"));
  assert.ok(adminStyles.includes('@media (max-width: 620px)'));
  assert.ok(adminStyles.includes('.mobile-nav'));
});

test('admin activity log is read-only, session-protected, and connected to the panel', () => {
  assert.ok(adminApi.includes("if ($action === 'activity')"));
  assert.ok(adminApi.includes('FROM admin_audit_log'));
  assert.ok(adminApi.includes('ORDER BY id DESC'));
  assert.ok(adminPanel.includes('id="view-activity"'));
  assert.ok(adminPanel.includes('data-view="activity"'));
  assert.ok(adminPanel.includes('id="activitySearch"'));
  assert.ok(adminScript.includes("request('activity')"));
  assert.ok(adminScript.includes('function renderActivity()'));
  assert.ok(adminStyles.includes('.activity-row'));
});

test('order desk loads searchable records and exports UTF-8 CSV safely', () => {
  assert.ok(adminPanel.includes('id="exportOrders"'));
  assert.ok(adminScript.includes('function exportOrdersCsv()'));
  assert.ok(adminScript.includes("const csv = '\\uFEFF'"));
  assert.ok(adminScript.includes("join('\\r\\n')"));
  assert.ok(adminScript.includes('textValue.replace(/"/g, \'""\')'));
  assert.ok(
    adminScript.includes("searchOrders().catch(error => showToast(error.message, 'error'))")
  );
  assert.ok(adminStyles.includes('grid-template-columns: repeat(5, minmax(0, 1fr))'));
});

test('admin cannot move an order backward through fulfillment stages', () => {
  assert.ok(
    adminApi.includes(
      "$progress = ['paid' => 0, 'processing' => 1, 'shipped' => 2, 'delivered' => 3];"
    )
  );
  assert.ok(adminApi.includes('$progress[$next] < $progress[$currentStatus]'));
  assert.ok(
    adminScript.includes(
      'allStatusOptions.filter((status, index) => index >= Math.max(0, currentRank))'
    )
  );
});
