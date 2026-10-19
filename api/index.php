<?php
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

$config = [
    'app_base_url' => getenv('VELORA_APP_BASE_URL') ?: '',
    'app_key' => getenv('VELORA_APP_KEY') ?: '',
    'db_host' => getenv('VELORA_DB_HOST') ?: '',
    'db_name' => getenv('VELORA_DB_NAME') ?: '',
    'db_user' => getenv('VELORA_DB_USER') ?: '',
    'db_password' => getenv('VELORA_DB_PASSWORD') ?: '',
    'zarinpal_merchant_id' => getenv('ZARINPAL_MERCHANT_ID') ?: '',
    'zarinpal_sandbox' => filter_var(getenv('ZARINPAL_SANDBOX') ?: 'false', FILTER_VALIDATE_BOOLEAN),
    'melipayamak_username' => getenv('MELIPAYAMAK_USERNAME') ?: '',
    'melipayamak_password' => getenv('MELIPAYAMAK_PASSWORD') ?: '',
    'melipayamak_otp_body_id' => getenv('MELIPAYAMAK_OTP_BODY_ID') ?: '',
    'product_prices_toman' => json_decode(getenv('VELORA_PRODUCT_PRICES_TOMAN') ?: 'null', true),
    'shipping_toman' => getenv('VELORA_SHIPPING_TOMAN') !== false ? (int) getenv('VELORA_SHIPPING_TOMAN') : null,
    'tax_toman' => getenv('VELORA_TAX_TOMAN') !== false ? (int) getenv('VELORA_TAX_TOMAN') : null,
];
$localConfigPath = __DIR__ . '/config.local.php';
if (is_file($localConfigPath)) {
    $localConfig = require $localConfigPath;
    if (is_array($localConfig)) {
        $config = array_replace($config, $localConfig);
    }
}

function cfg(string $key, mixed $fallback = null): mixed
{
    global $config;
    return $config[$key] ?? $fallback;
}

function send_json(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail_api(int $status, string $message, string $code = 'request_failed'): void
{
    send_json($status, ['ok' => false, 'error' => $code, 'message' => $message]);
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $host = trim((string) cfg('db_host', ''));
    $name = trim((string) cfg('db_name', ''));
    $user = trim((string) cfg('db_user', ''));
    $password = (string) cfg('db_password', '');
    if ($host === '' || $name === '' || $user === '') {
        throw new RuntimeException('Database configuration is incomplete.');
    }
    $dsn = 'mysql:host=' . $host . ';dbname=' . $name . ';charset=utf8mb4';
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone = '+00:00'",
    ]);
    return $pdo;
}

function app_key(): string
{
    $key = (string) cfg('app_key', '');
    if (strlen($key) < 32 || str_contains($key, 'REPLACE_WITH')) {
        throw new RuntimeException('Application key is not configured.');
    }
    return $key;
}

function app_base_url(): string
{
    $url = rtrim((string) cfg('app_base_url', ''), '/');
    $parts = parse_url($url);
    if (!is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host']) || isset($parts['query']) || isset($parts['fragment'])) {
        throw new RuntimeException('The canonical HTTPS application URL is not configured.');
    }
    return $url;
}

function configured_prices(): array
{
    $prices = cfg('product_prices_toman', []);
    if (!is_array($prices)) {
        return [];
    }
    $allowed = ['aster', 'noir', 'sol'];
    $result = [];
    foreach ($allowed as $id) {
        if (!isset($prices[$id]) || !is_numeric($prices[$id])) {
            return [];
        }
        $amount = filter_var($prices[$id], FILTER_VALIDATE_INT);
        if ($amount === false || $amount < 1000 || $amount > 2000000000) {
            return [];
        }
        $result[$id] = $amount;
    }
    return $result;
}

function checkout_ready(): bool
{
    try {
        $base = app_base_url();
        app_key();
        $prices = configured_prices();
        $merchant = trim((string) cfg('zarinpal_merchant_id', ''));
        $shipping = cfg('shipping_toman');
        $tax = cfg('tax_toman');
        return $base !== '' && $prices !== [] && $merchant !== '' &&
            !str_contains($merchant, 'REPLACE_WITH') &&
            is_int($shipping) && $shipping >= 0 &&
            is_int($tax) && $tax >= 0 &&
            trim((string) cfg('db_host', '')) !== '' &&
            trim((string) cfg('db_name', '')) !== '' &&
            trim((string) cfg('db_user', '')) !== '';
    } catch (Throwable) {
        return false;
    }
}

function sms_ready(): bool
{
    return trim((string) cfg('melipayamak_username', '')) !== '' &&
        trim((string) cfg('melipayamak_password', '')) !== '' &&
        trim((string) cfg('melipayamak_otp_body_id', '')) !== '' &&
        !str_contains((string) cfg('melipayamak_otp_body_id', ''), 'REPLACE_WITH');
}

function request_json(): array
{
    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > 65536) {
        fail_api(413, 'حجم درخواست بیش از حد مجاز است.', 'payload_too_large');
    }
    $contentType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
    if ($contentType !== 'application/json') {
        fail_api(415, 'نوع محتوای درخواست معتبر نیست.', 'json_required');
    }
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($decoded)) {
        fail_api(400, 'ساختار درخواست معتبر نیست.', 'invalid_json');
    }
    return $decoded;
}

function verify_origin(): void
{
    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin === '') {
        return;
    }
    $base = parse_url(app_base_url());
    $originParts = parse_url($origin);
    if (!is_array($base) || !is_array($originParts)) {
        fail_api(403, 'مبدأ درخواست معتبر نیست.', 'origin_rejected');
    }
    $expected = strtolower(($base['scheme'] ?? '') . '://' . ($base['host'] ?? '') . (isset($base['port']) ? ':' . $base['port'] : ''));
    $actual = strtolower(($originParts['scheme'] ?? '') . '://' . ($originParts['host'] ?? '') . (isset($originParts['port']) ? ':' . $originParts['port'] : ''));
    if (!hash_equals($expected, $actual)) {
        fail_api(403, 'مبدأ درخواست معتبر نیست.', 'origin_rejected');
    }
}

function require_csrf(): void
{
    verify_origin();
    $sessionToken = (string) ($_SESSION['csrf'] ?? '');
    $requestToken = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($sessionToken === '' || $requestToken === '' || !hash_equals($sessionToken, $requestToken)) {
        fail_api(403, 'نشست منقضی شده است؛ صفحه را تازه‌سازی کنید.', 'csrf_failed');
    }
}

function normalise_mobile(mixed $value): ?string
{
    $digits = [
        '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
        '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
        '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
    ];
    $mobile = preg_replace('/\D+/', '', strtr(trim((string) $value), $digits));
    if (!is_string($mobile)) {
        return null;
    }
    if (str_starts_with($mobile, '98') && strlen($mobile) === 12) {
        $mobile = '0' . substr($mobile, 2);
    } elseif (strlen($mobile) === 10 && str_starts_with($mobile, '9')) {
        $mobile = '0' . $mobile;
    }
    return preg_match('/^09[0-9]{9}$/', $mobile) ? $mobile : null;
}

function fingerprint(string $value): string
{
    return hash_hmac('sha256', $value, app_key());
}

function client_ip(): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : 'unknown';
}

function require_customer(): int
{
    $id = filter_var($_SESSION['customer_id'] ?? null, FILTER_VALIDATE_INT);
    if ($id === false || $id === null || $id < 1) {
        fail_api(401, 'برای ادامه ابتدا با شمارهٔ همراه خود وارد شوید.', 'authentication_required');
    }
    return $id;
}

function http_post_form(string $url, array $fields): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('The PHP cURL extension is required.');
    }
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($fields),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
    ]);
    $body = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    $error = curl_errno($handle);
    curl_close($handle);
    if ($body === false || $error !== 0 || $status < 200 || $status >= 300) {
        throw new RuntimeException('External form request failed.');
    }
    $decoded = json_decode((string) $body, true);
    return is_array($decoded) ? $decoded : ['raw' => trim((string) $body)];
}

function http_post_json(string $url, array $payload): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('The PHP cURL extension is required.');
    }
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) {
        throw new RuntimeException('Could not encode provider request.');
    }
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
    ]);
    $responseBody = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    $error = curl_errno($handle);
    curl_close($handle);
    if ($responseBody === false || $error !== 0 || $status < 200 || $status >= 300) {
        throw new RuntimeException('External JSON request failed.');
    }
    $decoded = json_decode((string) $responseBody, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('The payment provider response was invalid.');
    }
    return $decoded;
}

function zarinpal_amount_rial(int $amountToman): int
{
    if ($amountToman < 1000 || $amountToman > 2000000000) {
        throw new RuntimeException('Payment amount is outside the configured range.');
    }
    return $amountToman * 10;
}

function zarinpal_api_base(): string
{
    return filter_var(cfg('zarinpal_sandbox', false), FILTER_VALIDATE_BOOLEAN)
        ? 'https://sandbox.zarinpal.com/pg/v4/payment'
        : 'https://api.zarinpal.com/pg/v4/payment';
}

function zarinpal_start_url(string $authority): string
{
    $host = filter_var(cfg('zarinpal_sandbox', false), FILTER_VALIDATE_BOOLEAN)
        ? 'https://sandbox.zarinpal.com/pg/StartPay/'
        : 'https://www.zarinpal.com/pg/StartPay/';
    return $host . rawurlencode($authority);
}

function catalog_item(string $id): ?array
{
    $catalog = [
        'aster' => ['no' => 'VEL.01', 'name' => 'Aster Runner'],
        'noir' => ['no' => 'VEL.02', 'name' => 'Noir Street'],
        'sol' => ['no' => 'VEL.03', 'name' => 'Solace 88'],
    ];
    return $catalog[$id] ?? null;
}

function make_quote(array $items): array
{
    $prices = configured_prices();
    if ($prices === []) {
        fail_api(503, 'قیمت نهایی فروشگاه هنوز در تنظیمات امن سرور ثبت نشده است.', 'pricing_not_configured');
    }
    if (count($items) < 1 || count($items) > 20) {
        fail_api(422, 'سبد خرید خالی است یا تعداد اقلام معتبر نیست.', 'invalid_items');
    }
    $seen = [];
    $lines = [];
    $subtotal = 0;
    foreach ($items as $raw) {
        if (!is_array($raw)) {
            fail_api(422, 'یکی از اقلام سبد خرید معتبر نیست.', 'invalid_item');
        }
        $id = trim((string) ($raw['id'] ?? ''));
        $product = catalog_item($id);
        if ($product === null || isset($seen[$id]) || !isset($prices[$id])) {
            fail_api(422, 'یکی از محصولات سبد خرید معتبر نیست.', 'invalid_product');
        }
        $seen[$id] = true;
        $size = trim((string) ($raw['size'] ?? ''));
        $color = trim((string) ($raw['color'] ?? ''));
        if ($size !== '' && !preg_match('/^(3[5-9]|4[0-8])$/', $size)) {
            fail_api(422, 'سایز یکی از محصولات معتبر نیست.', 'invalid_size');
        }
        if (mb_strlen($color) > 40 || preg_match('/[\x00-\x1F\x7F]/u', $color)) {
            fail_api(422, 'رنگ یکی از محصولات معتبر نیست.', 'invalid_color');
        }
        $price = $prices[$id];
        $subtotal += $price;
        if ($subtotal > 2000000000) {
            fail_api(422, 'مبلغ سفارش بیش از حد مجاز است.', 'amount_too_large');
        }
        $lines[] = [
            'id' => $id,
            'no' => $product['no'],
            'name' => $product['name'],
            'price_toman' => $price,
            'size' => $size,
            'color' => $color,
        ];
    }
    $shipping = cfg('shipping_toman');
    $tax = cfg('tax_toman');
    if (!is_int($shipping) || $shipping < 0 || !is_int($tax) || $tax < 0) {
        fail_api(503, 'هزینهٔ ارسال و مالیات باید در تنظیمات امن سرور مشخص شوند.', 'checkout_policy_not_configured');
    }
    $total = $subtotal + $shipping + $tax;
    if ($total < 1000 || $total > 2000000000) {
        fail_api(422, 'مبلغ نهایی سفارش در بازهٔ قابل پرداخت نیست.', 'invalid_total');
    }
    return [
        'items' => $lines,
        'subtotal_toman' => $subtotal,
        'shipping_toman' => $shipping,
        'tax_toman' => $tax,
        'total_toman' => $total,
    ];
}

function redirect_payment_result(string $orderNumber, string $status = 'return'): void
{
    $url = app_base_url() . '/?payment=' . rawurlencode($status) . '&order=' . rawurlencode($orderNumber);
    header('Cache-Control: no-store');
    header('Location: ' . $url, true, 303);
    exit;
}

function payment_callback(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        redirect_payment_result('', 'failed');
    }
    $authority = trim((string) ($_GET['Authority'] ?? ''));
    $status = strtoupper(trim((string) ($_GET['Status'] ?? '')));
    if ($authority === '' || strlen($authority) > 64) {
        redirect_payment_result('', 'failed');
    }
    $pdo = db();
    $statement = $pdo->prepare(
        'SELECT p.id AS payment_id, p.order_id, p.amount_toman, p.status AS payment_status, o.order_number
         FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.authority = ? LIMIT 1'
    );
    $statement->execute([$authority]);
    $payment = $statement->fetch();
    if (!$payment) {
        redirect_payment_result('', 'failed');
    }
    if ($payment['payment_status'] === 'paid') {
        redirect_payment_result((string) $payment['order_number'], 'return');
    }
    if ($status !== 'OK') {
        $update = $pdo->prepare("UPDATE payments SET status = 'cancelled', updated_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'pending'");
        $update->execute([$payment['payment_id']]);
        $orderUpdate = $pdo->prepare("UPDATE orders SET status = 'payment_cancelled', updated_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'awaiting_payment'");
        $orderUpdate->execute([$payment['order_id']]);
        redirect_payment_result((string) $payment['order_number'], 'return');
    }

    try {
        $verified = http_post_json(zarinpal_api_base() . '/verify.json', [
            'merchant_id' => (string) cfg('zarinpal_merchant_id', ''),
            'amount' => zarinpal_amount_rial((int) $payment['amount_toman']),
            'authority' => $authority,
        ]);
    } catch (Throwable) {
        error_log('[VELORA] Payment verification request failed.');
        redirect_payment_result((string) $payment['order_number'], 'return');
    }
    $code = (int) ($verified['data']['code'] ?? 0);
    $refId = $verified['data']['ref_id'] ?? null;
    if (!in_array($code, [100, 101], true) || !is_scalar($refId) || (string) $refId === '') {
        $update = $pdo->prepare("UPDATE payments SET status = 'failed', provider_code = ?, updated_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'pending'");
        $update->execute([$code, $payment['payment_id']]);
        $orderUpdate = $pdo->prepare("UPDATE orders SET status = 'payment_failed', updated_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'awaiting_payment'");
        $orderUpdate->execute([$payment['order_id']]);
        redirect_payment_result((string) $payment['order_number'], 'return');
    }

    $pdo->beginTransaction();
    try {
        $lock = $pdo->prepare('SELECT status FROM payments WHERE id = ? FOR UPDATE');
        $lock->execute([$payment['payment_id']]);
        $current = $lock->fetch();
        if ($current && $current['status'] !== 'paid') {
            $update = $pdo->prepare("UPDATE payments SET status = 'paid', reference_id = ?, provider_code = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?");
            $update->execute([(string) $refId, $code, $payment['payment_id']]);
            $orderUpdate = $pdo->prepare("UPDATE orders SET status = 'paid', payment_status = 'paid', paid_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = ?");
            $orderUpdate->execute([$payment['order_id']]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('[VELORA] Payment callback persistence failed.');
        redirect_payment_result((string) $payment['order_number'], 'return');
    }
    redirect_payment_result((string) $payment['order_number'], 'return');
}

$schemeIsHttps = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') ||
    (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $schemeIsHttps,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store, private');

$action = trim((string) ($_GET['action'] ?? ''));
try {
    if ($action === 'payment-callback') {
        payment_callback();
    }

    if ($action === 'bootstrap' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
        if (empty($_SESSION['csrf'])) {
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
        }
        send_json(200, [
            'ok' => true,
            'csrf' => $_SESSION['csrf'],
            'user' => !empty($_SESSION['customer_id']) ? [
                'id' => (int) $_SESSION['customer_id'],
                'mobile' => (string) ($_SESSION['customer_mobile'] ?? ''),
            ] : null,
            'sms_ready' => sms_ready(),
            'checkout_ready' => checkout_ready(),
            'prices_toman' => configured_prices(),
        ]);
    }

    if ($action === 'payment-status' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
        $customerId = require_customer();
        $orderNumber = trim((string) ($_GET['order'] ?? ''));
        if (!preg_match('/^VL-[0-9]{6}-[A-F0-9]{8}$/', $orderNumber)) {
            fail_api(422, 'شمارهٔ سفارش معتبر نیست.', 'invalid_order');
        }
        $statusPdo = db();
        $stmt = $statusPdo->prepare('SELECT order_number, status, payment_status, total_toman, paid_at FROM orders WHERE order_number = ? AND customer_id = ? LIMIT 1');
        $stmt->execute([$orderNumber, $customerId]);
        $order = $stmt->fetch();
        if (!$order) {
            fail_api(404, 'سفارش پیدا نشد.', 'order_not_found');
        }
        send_json(200, ['ok' => true, 'order' => [
            'number' => $order['order_number'],
            'status' => $order['status'],
            'payment_status' => $order['payment_status'],
            'total_toman' => (int) $order['total_toman'],
            'paid' => $order['payment_status'] === 'paid' && $order['status'] === 'paid',
        ]]);
    }

    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: GET, POST');
        fail_api(405, 'روش درخواست پشتیبانی نمی‌شود.', 'method_not_allowed');
    }
    require_csrf();
    $input = request_json();
    $pdo = db();

    if ($action === 'auth-send-otp') {
        $mobile = normalise_mobile($input['mobile'] ?? '');
        if ($mobile === null) {
            fail_api(422, 'شمارهٔ همراه را به شکل معتبر وارد کنید.', 'invalid_mobile');
        }
        if (!sms_ready()) {
            fail_api(503, 'سرویس پیامک هنوز به‌صورت امن پیکربندی نشده است.', 'sms_not_configured');
        }
        $mobileHash = fingerprint($mobile);
        $ipHash = fingerprint(client_ip());
        $pdo->beginTransaction();
        $mobileLimit = $pdo->prepare('SELECT COUNT(*) FROM otp_requests WHERE mobile_hash = ? AND requested_at >= (UTC_TIMESTAMP() - INTERVAL 1 HOUR)');
        $mobileLimit->execute([$mobileHash]);
        $ipLimit = $pdo->prepare('SELECT COUNT(*) FROM otp_requests WHERE ip_hash = ? AND requested_at >= (UTC_TIMESTAMP() - INTERVAL 1 HOUR)');
        $ipLimit->execute([$ipHash]);
        $existing = $pdo->prepare('SELECT last_sent_at FROM otp_challenges WHERE mobile = ? FOR UPDATE');
        $existing->execute([$mobile]);
        $last = $existing->fetch();
        if ((int) $mobileLimit->fetchColumn() >= 5 || (int) $ipLimit->fetchColumn() >= 15) {
            $pdo->rollBack();
            fail_api(429, 'تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.', 'rate_limited');
        }
        if ($last && strtotime((string) $last['last_sent_at'] . ' UTC') > time() - 60) {
            $pdo->rollBack();
            fail_api(429, 'برای ارسال مجدد کد، ۶۰ ثانیه صبر کنید.', 'otp_cooldown');
        }
        $code = (string) random_int(100000, 999999);
        $challengeId = bin2hex(random_bytes(16));
        $codeHash = hash_hmac('sha256', $mobile . ':' . $code, app_key());
        $stmt = $pdo->prepare(
            'INSERT INTO otp_challenges (mobile, challenge_id, code_hash, expires_at, last_sent_at, attempts, consumed_at)
             VALUES (?, ?, ?, (UTC_TIMESTAMP() + INTERVAL 5 MINUTE), UTC_TIMESTAMP(), 0, NULL)
             ON DUPLICATE KEY UPDATE challenge_id = VALUES(challenge_id), code_hash = VALUES(code_hash),
               expires_at = VALUES(expires_at), last_sent_at = VALUES(last_sent_at), attempts = 0, consumed_at = NULL'
        );
        $stmt->execute([$mobile, $challengeId, $codeHash]);
        $request = $pdo->prepare('INSERT INTO otp_requests (mobile_hash, ip_hash, requested_at) VALUES (?, ?, UTC_TIMESTAMP())');
        $request->execute([$mobileHash, $ipHash]);
        $pdo->commit();

        try {
            $smsResult = http_post_form('https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber', [
                'username' => (string) cfg('melipayamak_username', ''),
                'password' => (string) cfg('melipayamak_password', ''),
                'text' => $code,
                'to' => $mobile,
                'bodyId' => (string) cfg('melipayamak_otp_body_id', ''),
            ]);
            if (isset($smsResult['RetStatus']) && (int) $smsResult['RetStatus'] !== 1) {
                throw new RuntimeException('SMS provider rejected the request.');
            }
            if (isset($smsResult['Value']) && is_numeric($smsResult['Value']) && (float) $smsResult['Value'] < 0) {
                throw new RuntimeException('SMS provider rejected the request.');
            }
        } catch (Throwable) {
            $invalidate = $pdo->prepare('UPDATE otp_challenges SET code_hash = NULL, consumed_at = UTC_TIMESTAMP() WHERE mobile = ? AND challenge_id = ?');
            $invalidate->execute([$mobile, $challengeId]);
            error_log('[VELORA] SMS provider request failed.');
            fail_api(502, 'ارسال پیامک انجام نشد؛ تنظیمات پنل یا الگوی پیامک را بررسی کنید.', 'sms_delivery_failed');
        }
        send_json(200, ['ok' => true, 'message' => 'اگر شماره و سرویس معتبر باشند، کد ورود ارسال شده است.', 'expires_in' => 300]);
    }

    if ($action === 'auth-verify-otp') {
        $mobile = normalise_mobile($input['mobile'] ?? '');
        $code = trim((string) ($input['code'] ?? ''));
        if ($mobile === null || !preg_match('/^[0-9]{6}$/', $code)) {
            fail_api(422, 'شمارهٔ همراه یا کد واردشده معتبر نیست.', 'invalid_credentials');
        }
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT challenge_id, code_hash, expires_at, attempts, consumed_at FROM otp_challenges WHERE mobile = ? FOR UPDATE');
        $stmt->execute([$mobile]);
        $challenge = $stmt->fetch();
        if (!$challenge || $challenge['code_hash'] === null || $challenge['consumed_at'] !== null ||
            strtotime((string) $challenge['expires_at'] . ' UTC') < time() || (int) $challenge['attempts'] >= 5) {
            $pdo->rollBack();
            fail_api(422, 'کد منقضی شده یا معتبر نیست؛ کد تازه درخواست کنید.', 'invalid_or_expired_code');
        }
        $increment = $pdo->prepare('UPDATE otp_challenges SET attempts = attempts + 1 WHERE mobile = ?');
        $increment->execute([$mobile]);
        $expected = hash_hmac('sha256', $mobile . ':' . $code, app_key());
        if (!hash_equals((string) $challenge['code_hash'], $expected)) {
            $pdo->commit();
            fail_api(422, 'کد واردشده معتبر نیست.', 'invalid_or_expired_code');
        }
        $consume = $pdo->prepare('UPDATE otp_challenges SET code_hash = NULL, consumed_at = UTC_TIMESTAMP() WHERE mobile = ? AND consumed_at IS NULL');
        $consume->execute([$mobile]);
        $upsert = $pdo->prepare('INSERT INTO customers (mobile, created_at, last_login_at) VALUES (?, UTC_TIMESTAMP(), UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE last_login_at = UTC_TIMESTAMP()');
        $upsert->execute([$mobile]);
        $userQuery = $pdo->prepare('SELECT id FROM customers WHERE mobile = ? LIMIT 1');
        $userQuery->execute([$mobile]);
        $customerId = (int) $userQuery->fetchColumn();
        $pdo->commit();
        session_regenerate_id(true);
        $_SESSION['customer_id'] = $customerId;
        $_SESSION['customer_mobile'] = $mobile;
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        send_json(200, ['ok' => true, 'user' => ['id' => $customerId, 'mobile' => $mobile], 'csrf' => $_SESSION['csrf']]);
    }

    if ($action === 'auth-logout') {
        unset($_SESSION['customer_id'], $_SESSION['customer_mobile']);
        session_regenerate_id(true);
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        send_json(200, ['ok' => true, 'user' => null, 'csrf' => $_SESSION['csrf']]);
    }

    if ($action === 'quote') {
        $quote = make_quote($input['items'] ?? []);
        send_json(200, ['ok' => true, 'quote' => $quote]);
    }

    if ($action === 'start-payment') {
        $customerId = require_customer();
        if (!checkout_ready()) {
            fail_api(503, 'درگاه یا تنظیمات قیمت فروشگاه هنوز کامل نشده است.', 'checkout_not_configured');
        }
        $shipping = $input['shipping'] ?? null;
        if (!is_array($shipping)) {
            fail_api(422, 'اطلاعات ارسال معتبر نیست.', 'invalid_shipping');
        }
        $name = trim((string) ($shipping['name'] ?? ''));
        $postalCode = preg_replace('/\D+/', '', strtr(trim((string) ($shipping['postal_code'] ?? '')), [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ]));
        $address = trim((string) ($shipping['address'] ?? ''));
        if (mb_strlen($name) < 2 || mb_strlen($name) > 120 ||
            !is_string($postalCode) || !preg_match('/^[0-9]{10}$/', $postalCode) ||
            mb_strlen($address) < 15 || mb_strlen($address) > 1000) {
            fail_api(422, 'نام گیرنده، کد پستی ده‌رقمی و نشانی کامل را بررسی کنید.', 'invalid_shipping');
        }
        $quote = make_quote($input['items'] ?? []);
        $mobile = (string) ($_SESSION['customer_mobile'] ?? '');
        if (normalise_mobile($mobile) === null) {
            fail_api(401, 'نشست ورود معتبر نیست؛ دوباره وارد شوید.', 'authentication_required');
        }
        $orderNumber = 'VL-' . gmdate('ymd') . '-' . strtoupper(bin2hex(random_bytes(4)));
        $pdo->beginTransaction();
        $insertOrder = $pdo->prepare(
            "INSERT INTO orders (order_number, customer_id, shipping_name, shipping_mobile, postal_code, shipping_address,
              subtotal_toman, shipping_toman, tax_toman, total_toman, status, payment_status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment', 'pending', UTC_TIMESTAMP(), UTC_TIMESTAMP())"
        );
        $insertOrder->execute([
            $orderNumber, $customerId, $name, $mobile, $postalCode, $address,
            $quote['subtotal_toman'], $quote['shipping_toman'], $quote['tax_toman'], $quote['total_toman'],
        ]);
        $orderId = (int) $pdo->lastInsertId();
        $insertLine = $pdo->prepare(
            'INSERT INTO order_items (order_id, product_id, sku, product_name, size, color, quantity, unit_price_toman, line_total_toman)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)'
        );
        foreach ($quote['items'] as $item) {
            $insertLine->execute([
                $orderId, $item['id'], $item['no'], $item['name'], $item['size'], $item['color'],
                $item['price_toman'], $item['price_toman'],
            ]);
        }
        $insertPayment = $pdo->prepare(
            "INSERT INTO payments (order_id, provider, amount_toman, status, created_at, updated_at)
             VALUES (?, 'zarinpal', ?, 'pending', UTC_TIMESTAMP(), UTC_TIMESTAMP())"
        );
        $insertPayment->execute([$orderId, $quote['total_toman']]);
        $paymentId = (int) $pdo->lastInsertId();
        $pdo->commit();

        try {
            $requested = http_post_json(zarinpal_api_base() . '/request.json', [
                'merchant_id' => (string) cfg('zarinpal_merchant_id', ''),
                'amount' => zarinpal_amount_rial((int) $quote['total_toman']),
                'callback_url' => app_base_url() . '/api/index.php?action=payment-callback',
                'description' => 'پرداخت سفارش ' . $orderNumber . ' فروشگاه ولورا',
                'metadata' => ['mobile' => $mobile],
            ]);
            $providerCode = (int) ($requested['data']['code'] ?? 0);
            $authority = trim((string) ($requested['data']['authority'] ?? ''));
            if ($providerCode !== 100 || $authority === '' || strlen($authority) > 64) {
                throw new RuntimeException('Payment request was rejected.');
            }
            $saveAuthority = $pdo->prepare('UPDATE payments SET authority = ?, provider_code = ?, updated_at = UTC_TIMESTAMP() WHERE id = ? AND status = ?');
            $saveAuthority->execute([$authority, $providerCode, $paymentId, 'pending']);
            if ($saveAuthority->rowCount() !== 1) {
                throw new RuntimeException('Payment authority could not be stored.');
            }
            send_json(200, [
                'ok' => true,
                'order_number' => $orderNumber,
                'redirect_url' => zarinpal_start_url($authority),
            ]);
        } catch (Throwable) {
            $failedPayment = $pdo->prepare("UPDATE payments SET status = 'failed', updated_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'pending'");
            $failedPayment->execute([$paymentId]);
            $failedOrder = $pdo->prepare("UPDATE orders SET status = 'payment_failed', payment_status = 'failed', updated_at = UTC_TIMESTAMP() WHERE id = ?");
            $failedOrder->execute([$orderId]);
            error_log('[VELORA] Payment request creation failed.');
            fail_api(502, 'ایجاد درخواست درگاه انجام نشد؛ مبلغی از حساب شما کم نشده است.', 'payment_request_failed');
        }
    }


    fail_api(404, 'مسیر درخواست پیدا نشد.', 'not_found');
} catch (Throwable $error) {
    error_log('[VELORA] API request failed: ' . get_class($error));
    fail_api(503, 'سرویس موقتاً در دسترس نیست؛ تنظیمات سرور را بررسی کنید.', 'service_unavailable');
}
