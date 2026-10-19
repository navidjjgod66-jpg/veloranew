import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../api/index.php', import.meta.url), 'utf8');
const example = readFileSync(new URL('../api/config.local.php.example', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../api/schema.sql', import.meta.url), 'utf8');
const gitignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
const apache = readFileSync(new URL('../.htaccess', import.meta.url), 'utf8');

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


test('Apache deployment uses the HTML entry point and blocks private runtime files', () => {
  assert.match(apache, /^DirectoryIndex index\.html index\.php$/m);
  assert.ok(apache.includes('<FilesMatch "^(config\\.local\\.php|schema\\.sql|.*\\.sql)$">'));
  assert.ok(apache.includes('Require all denied'));
  assert.ok(apache.includes('RewriteRule (^|/)\\.git(/|$) - [F,L]'));
  assert.ok(apache.includes('RewriteRule (^|/)\\.env($|\\.) - [F,L]'));
});
