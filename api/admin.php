<?php
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

$zarinpalSandboxSetting = getenv('ZARINPAL_SANDBOX');
$adminConfig = [
    'app_base_url' => getenv('VELORA_APP_BASE_URL') ?: '',
    'app_key' => getenv('VELORA_APP_KEY') ?: '',
    'db_host' => getenv('VELORA_DB_HOST') ?: '',
    'db_name' => getenv('VELORA_DB_NAME') ?: '',
    'db_user' => getenv('VELORA_DB_USER') ?: '',
    'db_password' => getenv('VELORA_DB_PASSWORD') ?: '',
    'zarinpal_merchant_id' => getenv('ZARINPAL_MERCHANT_ID') ?: '',
    'zarinpal_sandbox' => ($zarinpalSandboxSetting === false || trim((string) $zarinpalSandboxSetting) === '')
        ? true : filter_var($zarinpalSandboxSetting, FILTER_VALIDATE_BOOLEAN),
    'melipayamak_username' => getenv('MELIPAYAMAK_USERNAME') ?: '',
    'melipayamak_password' => getenv('MELIPAYAMAK_PASSWORD') ?: '',
    'melipayamak_otp_body_id' => getenv('MELIPAYAMAK_OTP_BODY_ID') ?: '',
    'product_prices_toman' => json_decode(getenv('VELORA_PRODUCT_PRICES_TOMAN') ?: 'null', true),
    'shipping_toman' => getenv('VELORA_SHIPPING_TOMAN') !== false ? (int) getenv('VELORA_SHIPPING_TOMAN') : null,
    'tax_toman' => getenv('VELORA_TAX_TOMAN') !== false ? (int) getenv('VELORA_TAX_TOMAN') : null,
    'catalog_live' => filter_var(getenv('VELORA_CATALOG_LIVE') ?: 'false', FILTER_VALIDATE_BOOLEAN),
    'admin_username' => getenv('VELORA_ADMIN_USERNAME') ?: '',
    'admin_password_hash' => getenv('VELORA_ADMIN_PASSWORD_HASH') ?: '',
];
$adminLocalConfigPath = __DIR__ . '/config.local.php';
$adminLocalConfig = null;
if (is_file($adminLocalConfigPath)) {
    $local = require $adminLocalConfigPath;
    if (is_array($local)) {
        $adminLocalConfig = $local;
        $adminConfig = array_replace($adminConfig, $local);
    }
}

function admin_cfg(string $key, mixed $fallback = null): mixed
{
    global $adminConfig;
    return $adminConfig[$key] ?? $fallback;
}

function admin_json(int $status, array $payload): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function admin_fail(int $status, string $message, string $code = 'request_failed'): never
{
    admin_json($status, ['ok' => false, 'error' => $code, 'message' => $message]);
}

function admin_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $host = trim((string) admin_cfg('db_host', ''));
    $name = trim((string) admin_cfg('db_name', ''));
    $user = trim((string) admin_cfg('db_user', ''));
    if ($host === '' || $name === '' || $user === '') {
        throw new RuntimeException('Database settings are missing.');
    }
    $pdo = new PDO('mysql:host=' . $host . ';dbname=' . $name . ';charset=utf8mb4', $user, (string) admin_cfg('db_password', ''), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone = '+00:00'",
    ]);
    return $pdo;
}

function admin_catalog(): array
{
    return [
        'aster' => ['id' => 'aster', 'sku' => 'VEL.01', 'name' => 'Aster Runner', 'kind' => 'روزمره'],
        'noir' => ['id' => 'noir', 'sku' => 'VEL.02', 'name' => 'Noir Street', 'kind' => 'رسمی'],
        'sol' => ['id' => 'sol', 'sku' => 'VEL.03', 'name' => 'Solace 88', 'kind' => 'اسپرت'],
    ];
}

function admin_sizes(): array
{
    return ['38', '39', '40', '41', '42', '43'];
}

function admin_colors(): array
{
    return ['طلایی', 'پلاتین', 'خاکی'];
}

function admin_config_ready(): bool
{
    $user = trim((string) admin_cfg('admin_username', ''));
    $hash = (string) admin_cfg('admin_password_hash', '');
    return $user !== '' && !str_contains($user, 'REPLACE_WITH') &&
        $hash !== '' && !str_contains($hash, 'REPLACE_WITH') &&
        password_get_info($hash)['algo'] !== null;
}

function admin_csrf(): string
{
    if (empty($_SESSION['admin_csrf'])) {
        $_SESSION['admin_csrf'] = bin2hex(random_bytes(32));
    }
    return (string) $_SESSION['admin_csrf'];
}

function admin_verify_origin(): void
{
    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin === '') {
        return;
    }
    $configured = parse_url((string) admin_cfg('app_base_url', ''));
    $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
    $expected = is_array($configured) && !empty($configured['host'])
        ? strtolower(($configured['scheme'] ?? 'https') . '://' . $configured['host'] . (isset($configured['port']) ? ':' . $configured['port'] : ''))
        : 'https://' . strtolower($host);
    $actualParts = parse_url($origin);
    $actual = is_array($actualParts)
        ? strtolower(($actualParts['scheme'] ?? '') . '://' . ($actualParts['host'] ?? '') . (isset($actualParts['port']) ? ':' . $actualParts['port'] : ''))
        : '';
    if ($actual === '' || !hash_equals($expected, $actual)) {
        admin_fail(403, 'مبدأ درخواست معتبر نیست.', 'origin_rejected');
    }
}

function admin_require_auth(): void
{
    if (empty($_SESSION['admin_user']) || empty($_SESSION['admin_csrf'])) {
        admin_fail(401, 'نشست مدیر پایان یافته است؛ دوباره وارد شوید.', 'admin_auth_required');
    }
}

function admin_require_csrf(): void
{
    admin_verify_origin();
    admin_require_auth();
    $expected = (string) ($_SESSION['admin_csrf'] ?? '');
    $provided = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
        admin_fail(403, 'نشست امنیتی منقضی شده است؛ صفحه را تازه کنید.', 'csrf_failed');
    }
}

function admin_request(): array
{
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 65536) {
        admin_fail(413, 'حجم درخواست بیش از حد مجاز است.', 'payload_too_large');
    }
    $type = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
    if ($type !== 'application/json') {
        admin_fail(415, 'درخواست باید JSON باشد.', 'json_required');
    }
    $raw = file_get_contents('php://input');
    $data = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($data)) {
        admin_fail(400, 'ساختار درخواست معتبر نیست.', 'invalid_json');
    }
    return $data;
}

function admin_ip_hash(): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    return hash('sha256', filter_var($ip, FILTER_VALIDATE_IP) ? $ip : 'unknown');
}

function admin_audit(PDO $pdo, string $action, string $target = '', array $details = []): void
{
    $stmt = $pdo->prepare('INSERT INTO admin_audit_log (actor, action, target, details_json, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())');
    $stmt->execute([
        (string) ($_SESSION['admin_user'] ?? 'system'),
        $action,
        mb_substr($target, 0, 120),
        $details === [] ? null : json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
}

function admin_write_local_config(array $values): void
{
    global $adminLocalConfigPath, $adminLocalConfig, $adminConfig;
    if (!is_file($adminLocalConfigPath) || !is_writable($adminLocalConfigPath) ||
        !is_writable(dirname($adminLocalConfigPath)) || !is_array($adminLocalConfig)) {
        admin_fail(503, 'فایل خصوصی تنظیمات موجود نیست یا قابل‌نوشتن نیست؛ api/config.local.php را فقط با دسترسی مدیر هاست آماده کنید.', 'private_config_not_writable');
    }
    // Write only the existing private file's values; never copy environment secrets into it.
    $updated = $adminLocalConfig;
    foreach (['product_prices_toman', 'shipping_toman', 'tax_toman', 'catalog_live'] as $key) {
        if (array_key_exists($key, $values)) {
            $updated[$key] = $values[$key];
        }
    }
    $temp = $adminLocalConfigPath . '.tmp-' . bin2hex(random_bytes(6));
    $source = "<?php\ndeclare(strict_types=1);\n\nreturn " . var_export($updated, true) . ";\n";
    if (file_put_contents($temp, $source, LOCK_EX) === false) {
        admin_fail(503, 'ذخیرهٔ تنظیمات خصوصی انجام نشد.', 'config_write_failed');
    }
    @chmod($temp, 0600);
    if (!rename($temp, $adminLocalConfigPath)) {
        @unlink($temp);
        admin_fail(503, 'جایگزینی امن فایل تنظیمات انجام نشد.', 'config_replace_failed');
    }
    @chmod($adminLocalConfigPath, 0600);
    $adminLocalConfig = $updated;
    $adminConfig = array_replace($adminConfig, $updated);
}

function admin_stock_rows(PDO $pdo, ?string $productId = null): array
{
    $query = 'SELECT product_id, size, color, stock_quantity, updated_at FROM product_inventory';
    $params = [];
    if ($productId !== null) {
        $query .= ' WHERE product_id = ?';
        $params[] = $productId;
    }
    $query .= ' ORDER BY product_id, CAST(size AS UNSIGNED), color';
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $rows = [];
    foreach ($stmt->fetchAll() as $row) {
        $key = $row['product_id'] . '|' . $row['size'] . '|' . $row['color'];
        $rows[$key] = [
            'product_id' => $row['product_id'],
            'size' => $row['size'],
            'color' => $row['color'],
            'stock' => (int) $row['stock_quantity'],
            'updated_at' => $row['updated_at'],
        ];
    }
    $catalog = admin_catalog();
    $complete = [];
    foreach ($catalog as $id => $product) {
        if ($productId !== null && $productId !== $id) {
            continue;
        }
        foreach (admin_sizes() as $size) {
            foreach (admin_colors() as $color) {
                $key = $id . '|' . $size . '|' . $color;
                $complete[] = $rows[$key] ?? [
                    'product_id' => $id, 'size' => $size, 'color' => $color, 'stock' => 0, 'updated_at' => null,
                ];
            }
        }
    }
    return $complete;
}

function admin_orders(PDO $pdo, string $search = '', int $limit = 50): array
{
    $limit = max(1, min(100, $limit));
    $sql = 'SELECT o.id, o.order_number, o.shipping_name, o.shipping_mobile, o.postal_code, o.shipping_address,
                   o.subtotal_toman, o.shipping_toman, o.tax_toman, o.total_toman, o.status, o.payment_status,
                   o.created_at, o.updated_at, o.paid_at, p.reference_id
            FROM orders o LEFT JOIN payments p ON p.order_id = o.id';
    $params = [];
    if ($search !== '') {
        $sql .= ' WHERE o.order_number LIKE ? OR o.shipping_name LIKE ? OR o.shipping_mobile LIKE ?';
        $term = '%' . str_replace(['%', '_'], ['\\%', '\\_'], mb_substr($search, 0, 80)) . '%';
        $params = [$term, $term, $term];
    }
    $sql .= ' ORDER BY o.created_at DESC LIMIT ' . $limit;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $orders = $stmt->fetchAll();
    if ($orders === []) {
        return [];
    }
    $ids = array_map(static fn(array $row): int => (int) $row['id'], $orders);
    $marks = implode(',', array_fill(0, count($ids), '?'));
    $itemStmt = $pdo->prepare('SELECT order_id, product_name, sku, size, color, quantity, unit_price_toman FROM order_items WHERE order_id IN (' . $marks . ') ORDER BY id');
    $itemStmt->execute($ids);
    $byOrder = [];
    foreach ($itemStmt->fetchAll() as $item) {
        $byOrder[(int) $item['order_id']][] = [
            'name' => $item['product_name'], 'sku' => $item['sku'],
            'size' => $item['size'], 'color' => $item['color'],
            'quantity' => (int) $item['quantity'], 'price_toman' => (int) $item['unit_price_toman'],
        ];
    }
    foreach ($orders as &$order) {
        $order['id'] = (int) $order['id'];
        foreach (['subtotal_toman', 'shipping_toman', 'tax_toman', 'total_toman'] as $key) {
            $order[$key] = (int) $order[$key];
        }
        $order['items'] = $byOrder[$order['id']] ?? [];
    }
    unset($order);
    return $orders;
}

function admin_inventory_complete(PDO $pdo): bool
{
    $expected = count(admin_catalog()) * count(admin_sizes()) * count(admin_colors());
    $stmt = $pdo->query('SELECT COUNT(*) FROM product_inventory');
    return (int) $stmt->fetchColumn() === $expected;
}

function admin_bootstrap(PDO $pdo): never
{
    $orders = admin_orders($pdo, '', 8);
    $sales = $pdo->query("SELECT COUNT(*) AS order_count, COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_toman ELSE 0 END), 0) AS revenue_toman,
                          SUM(CASE WHEN status = 'awaiting_payment' THEN 1 ELSE 0 END) AS awaiting_payment,
                          SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_count
                          FROM orders WHERE created_at >= (UTC_TIMESTAMP() - INTERVAL 30 DAY)")->fetch();
    $all = $pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn();
    $customers = $pdo->query('SELECT COUNT(*) FROM customers')->fetchColumn();
    $stock = admin_stock_rows($pdo);
    $low = count(array_filter($stock, static fn(array $item): bool => $item['stock'] > 0 && $item['stock'] <= 2));
    $out = count(array_filter($stock, static fn(array $item): bool => $item['stock'] === 0));
    $dailyStmt = $pdo->query("SELECT DATE(created_at) AS day, COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_toman ELSE 0 END), 0) AS revenue_toman
                              FROM orders WHERE created_at >= (UTC_DATE() - INTERVAL 6 DAY)
                              GROUP BY DATE(created_at) ORDER BY day");
    $daily = $dailyStmt->fetchAll();
    $dailyMap = [];
    foreach ($daily as $day) {
        $dailyMap[$day['day']] = (int) $day['revenue_toman'];
    }
    $chart = [];
    for ($i = 6; $i >= 0; $i--) {
        $day = gmdate('Y-m-d', time() - $i * 86400);
        $chart[] = ['day' => $day, 'revenue_toman' => $dailyMap[$day] ?? 0];
    }
    $configPrices = admin_cfg('product_prices_toman', []);
    $prices = is_array($configPrices) ? $configPrices : [];
    $priceMap = [];
    foreach (admin_catalog() as $id => $product) {
        $priceMap[$id] = isset($prices[$id]) && is_numeric($prices[$id]) ? (int) $prices[$id] : null;
    }
    $validPrices = !in_array(null, $priceMap, true) && min(array_map('intval', $priceMap)) >= 1000;
    $shipping = admin_cfg('shipping_toman');
    $tax = admin_cfg('tax_toman');
    $merchant = trim((string) admin_cfg('zarinpal_merchant_id', ''));
    $smsConfigured = trim((string) admin_cfg('melipayamak_username', '')) !== '' &&
        !str_contains((string) admin_cfg('melipayamak_username', ''), 'REPLACE_WITH') &&
        trim((string) admin_cfg('melipayamak_password', '')) !== '' &&
        !str_contains((string) admin_cfg('melipayamak_password', ''), 'REPLACE_WITH') &&
        trim((string) admin_cfg('melipayamak_otp_body_id', '')) !== '' &&
        !str_contains((string) admin_cfg('melipayamak_otp_body_id', ''), 'REPLACE_WITH');
    $configReady = trim((string) admin_cfg('app_key', '')) !== '' &&
        !str_contains((string) admin_cfg('app_key', ''), 'REPLACE_WITH') &&
        trim((string) admin_cfg('app_base_url', '')) !== '';
    $merchantValid = preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $merchant) === 1;
    $catalogLive = admin_cfg('catalog_live', false) === true;
    $inventoryComplete = admin_inventory_complete($pdo);
    $paymentReady = $configReady && $validPrices && $inventoryComplete &&
        $catalogLive && $smsConfigured && $merchantValid &&
        is_int($shipping) && $shipping >= 0 && is_int($tax) && $tax >= 0;
    admin_json(200, [
        'ok' => true,
        'csrf' => admin_csrf(),
        'admin_user' => (string) $_SESSION['admin_user'],
        'stats' => [
            'orders_30d' => (int) ($sales['order_count'] ?? 0),
            'revenue_30d_toman' => (int) ($sales['revenue_toman'] ?? 0),
            'awaiting_payment' => (int) ($sales['awaiting_payment'] ?? 0),
            'paid_30d' => (int) ($sales['paid_count'] ?? 0),
            'all_orders' => (int) $all,
            'customers' => (int) $customers,
            'low_stock' => $low,
            'out_of_stock' => $out,
        ],
        'chart' => $chart,
        'orders' => $orders,
        'products' => array_values(admin_catalog()),
        'stock' => $stock,
        'settings' => [
            'prices' => $priceMap,
            'shipping_toman' => is_int($shipping) ? $shipping : null,
            'tax_toman' => is_int($tax) ? $tax : null,
            'catalog_live' => $catalogLive,
            'inventory_complete' => $inventoryComplete,
            'payment_ready' => $paymentReady,
            'sandbox' => (bool) admin_cfg('zarinpal_sandbox', true),
        ],
    ]);
}

function admin_write_stock(PDO $pdo, array $items): void
{
    if (count($items) !== count(admin_catalog()) * count(admin_sizes()) * count(admin_colors())) {
        admin_fail(422, 'هر ۵۴ ترکیب محصول، سایز و رنگ را ارسال کنید.', 'incomplete_inventory');
    }
    $allowedProducts = admin_catalog();
    $allowedSizes = admin_sizes();
    $allowedColors = admin_colors();
    $seen = [];
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO product_inventory (product_id, size, color, stock_quantity, updated_at)
             VALUES (?, ?, ?, ?, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE stock_quantity = VALUES(stock_quantity), updated_at = VALUES(updated_at)'
        );
        foreach ($items as $item) {
            if (!is_array($item)) {
                throw new InvalidArgumentException('Invalid inventory row.');
            }
            $product = (string) ($item['product_id'] ?? '');
            $size = (string) ($item['size'] ?? '');
            $color = (string) ($item['color'] ?? '');
            $stock = filter_var($item['stock'] ?? null, FILTER_VALIDATE_INT);
            $key = $product . '|' . $size . '|' . $color;
            if (!isset($allowedProducts[$product]) || !in_array($size, $allowedSizes, true) ||
                !in_array($color, $allowedColors, true) || isset($seen[$key]) ||
                $stock === false || $stock < 0 || $stock > 10000) {
                throw new InvalidArgumentException('Invalid inventory values.');
            }
            $seen[$key] = true;
            $stmt->execute([$product, $size, $color, $stock]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($error instanceof InvalidArgumentException) {
            admin_fail(422, 'مقادیر موجودی معتبر نیستند؛ تعداد باید از صفر تا ۱۰٬۰۰۰ باشد.', 'invalid_inventory');
        }
        throw $error;
    }
}

function admin_handle(): never
{
    $https = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') ||
        (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443;
    if (!$https) {
        admin_fail(426, 'پنل مدیریت فقط از طریق HTTPS قابل استفاده است.', 'https_required');
    }
    $sessionPath = '/';
    session_name('VELORA_ADMIN');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => $sessionPath, 'secure' => true,
        'httponly' => true, 'samesite' => 'Strict',
    ]);
    session_start();

    $method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $action = trim((string) ($_GET['action'] ?? ''));
    if ($method === 'GET' && $action === 'session') {
        admin_json(200, [
            'ok' => true,
            'authenticated' => !empty($_SESSION['admin_user']),
            'csrf' => admin_csrf(),
            'configured' => admin_config_ready(),
        ]);
    }
    if ($method === 'GET' && in_array($action, ['bootstrap', 'orders'], true)) {
        admin_require_auth();
        $pdo = admin_db();
        if ($action === 'bootstrap') {
            admin_bootstrap($pdo);
        }
        $search = trim((string) ($_GET['search'] ?? ''));
        admin_json(200, ['ok' => true, 'orders' => admin_orders($pdo, $search, 100)]);
    }
    if ($method === 'POST') {
        admin_verify_origin();
        $body = admin_request();
        if ($action === 'login') {
            if (!admin_config_ready()) {
                admin_fail(503, 'ورود مدیر هنوز پیکربندی نشده است؛ نام کاربری و هش رمز را در فایل خصوصی سرور تنظیم کنید.', 'admin_not_configured');
            }
            $pdo = admin_db();
            $username = trim((string) ($body['username'] ?? ''));
            $password = (string) ($body['password'] ?? '');
            if (mb_strlen($username) > 80 || strlen($password) > 1024) {
                admin_fail(422, 'نام کاربری یا رمز معتبر نیست.', 'invalid_credentials');
            }
            $usernameHash = hash('sha256', strtolower($username));
            $ipHash = admin_ip_hash();
            $limit = $pdo->prepare('SELECT COUNT(*) FROM admin_login_attempts WHERE succeeded = 0 AND attempted_at >= (UTC_TIMESTAMP() - INTERVAL 15 MINUTE) AND (ip_hash = ? OR username_hash = ?)');
            $limit->execute([$ipHash, $usernameHash]);
            if ((int) $limit->fetchColumn() >= 8) {
                admin_fail(429, 'تلاش‌های ورود بیش از حد است؛ ۱۵ دقیقه بعد دوباره امتحان کنید.', 'login_rate_limited');
            }
            $expectedUser = (string) admin_cfg('admin_username', '');
            $hash = (string) admin_cfg('admin_password_hash', '');
            $valid = hash_equals($expectedUser, $username) && password_verify($password, $hash);
            $record = $pdo->prepare('INSERT INTO admin_login_attempts (username_hash, ip_hash, succeeded, attempted_at) VALUES (?, ?, ?, UTC_TIMESTAMP())');
            $record->execute([$usernameHash, $ipHash, $valid ? 1 : 0]);
            $pdo->exec('DELETE FROM admin_login_attempts WHERE attempted_at < (UTC_TIMESTAMP() - INTERVAL 7 DAY)');
            if (!$valid) {
                usleep(250000);
                admin_fail(401, 'نام کاربری یا رمز عبور درست نیست.', 'invalid_credentials');
            }
            session_regenerate_id(true);
            $_SESSION = [];
            $_SESSION['admin_user'] = $expectedUser;
            $_SESSION['admin_csrf'] = bin2hex(random_bytes(32));
            admin_json(200, ['ok' => true, 'csrf' => $_SESSION['admin_csrf']]);
        }

        admin_require_csrf();
        if ($action === 'logout') {
            $_SESSION = [];
            if (ini_get('session.use_cookies')) {
                $params = session_get_cookie_params();
                setcookie(session_name(), '', [
                    'expires' => time() - 42000,
                    'path' => $params['path'], 'secure' => true, 'httponly' => true, 'samesite' => 'Strict',
                ]);
            }
            session_destroy();
            admin_json(200, ['ok' => true]);
        }
        $pdo = admin_db();
        if ($action === 'bootstrap') {
            admin_bootstrap($pdo);
        }
        if ($action === 'orders') {
            $search = trim((string) ($_GET['search'] ?? ''));
            admin_json(200, ['ok' => true, 'orders' => admin_orders($pdo, $search, 100)]);
        }
        if ($action === 'stock-save') {
            $items = $body['items'] ?? null;
            if (!is_array($items)) {
                admin_fail(422, 'فهرست موجودی معتبر نیست.', 'invalid_inventory');
            }
            admin_write_stock($pdo, $items);
            admin_audit($pdo, 'inventory.updated', 'product_inventory', ['rows' => count($items)]);
            admin_json(200, ['ok' => true, 'message' => 'موجودی ذخیره شد.']);
        }
        if ($action === 'settings-save') {
            $rawPrices = $body['prices'] ?? null;
            $shipping = filter_var($body['shipping_toman'] ?? null, FILTER_VALIDATE_INT);
            $tax = filter_var($body['tax_toman'] ?? null, FILTER_VALIDATE_INT);
            if (!is_array($rawPrices) || $shipping === false || $tax === false ||
                $shipping < 0 || $tax < 0 || $shipping > 2000000000 || $tax > 2000000000) {
                admin_fail(422, 'قیمت‌ها و هزینه‌های ارسال/مالیات را بررسی کنید.', 'invalid_settings');
            }
            $prices = [];
            foreach (admin_catalog() as $id => $product) {
                $price = filter_var($rawPrices[$id] ?? null, FILTER_VALIDATE_INT);
                if ($price === false || $price < 1000 || $price > 2000000000) {
                    admin_fail(422, 'قیمت هر سه محصول باید عدد صحیح و حداقل ۱٬۰۰۰ تومان باشد.', 'invalid_price');
                }
                $prices[$id] = $price;
            }
            $goLive = ($body['catalog_live'] ?? false) === true;
            if ($goLive && ($body['live_confirmation'] ?? '') !== 'I_HAVE_VERIFIED_REAL_CATALOG') {
                admin_fail(422, 'برای فعال‌سازی فروش، تأیید بررسی کاتالوگ لازم است.', 'catalog_confirmation_required');
            }
            if ($goLive && !admin_inventory_complete($pdo)) {
                admin_fail(422, 'ابتدا تمام ۵۴ ترکیب سایز و رنگ را در صفحهٔ موجودی ثبت کنید.', 'inventory_incomplete');
            }
            admin_write_local_config([
                'product_prices_toman' => $prices,
                'shipping_toman' => $shipping,
                'tax_toman' => $tax,
                'catalog_live' => $goLive,
            ]);
            admin_audit($pdo, 'settings.updated', 'store', [
                'catalog_live' => $goLive, 'shipping_toman' => $shipping, 'tax_toman' => $tax,
            ]);
            admin_json(200, ['ok' => true, 'message' => 'تنظیمات فروشگاه ذخیره شد.']);
        }
        if ($action === 'order-status') {
            $number = trim((string) ($body['order_number'] ?? ''));
            $next = trim((string) ($body['status'] ?? ''));
            if (!preg_match('/^VL-[0-9]{6}-[A-F0-9]{8}$/', $number) ||
                !in_array($next, ['processing', 'shipped', 'delivered'], true)) {
                admin_fail(422, 'وضعیت یا شمارهٔ سفارش معتبر نیست.', 'invalid_order_status');
            }
            $pdo->beginTransaction();
            try {
                $currentQuery = $pdo->prepare("SELECT status FROM orders WHERE order_number = ? AND payment_status = 'paid' LIMIT 1 FOR UPDATE");
                $currentQuery->execute([$number]);
                $currentStatus = $currentQuery->fetchColumn();
                $progress = ['paid' => 0, 'processing' => 1, 'shipped' => 2, 'delivered' => 3];
                if ($currentStatus === false || !isset($progress[$currentStatus])) {
                    $pdo->rollBack();
                    admin_fail(409, 'فقط سفارش پرداخت‌شده و قابل‌مدیریت را می‌توان تغییر داد.', 'order_not_updatable');
                }
                if ($progress[$next] < $progress[$currentStatus]) {
                    $pdo->rollBack();
                    admin_fail(409, 'مرحلهٔ تحویل را نمی‌توان به وضعیت قبلی برگرداند.', 'order_status_regression');
                }
                if ($currentStatus === $next) {
                    $pdo->commit();
                    admin_json(200, ['ok' => true, 'message' => 'این سفارش از قبل همین وضعیت را دارد.']);
                }
                $update = $pdo->prepare("UPDATE orders SET status = ?, updated_at = UTC_TIMESTAMP() WHERE order_number = ? AND payment_status = 'paid'");
                $update->execute([$next, $number]);
                if ($update->rowCount() !== 1) {
                    throw new RuntimeException('Order status changed during update.');
                }
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $error;
            }
            admin_audit($pdo, 'order.status', $number, ['from' => $currentStatus, 'to' => $next]);
            admin_json(200, ['ok' => true, 'message' => 'وضعیت سفارش به‌روزرسانی شد.']);
        }
        admin_fail(404, 'عملیات پنل پیدا نشد.', 'not_found');
    }
    header('Allow: GET, POST');
    admin_fail(405, 'روش درخواست پشتیبانی نمی‌شود.', 'method_not_allowed');
}

try {
    admin_handle();
} catch (Throwable $error) {
    error_log('[VELORA_ADMIN] ' . get_class($error));
    admin_fail(503, 'سرویس پنل در دسترس نیست؛ پیکربندی سرور و جدول‌های دیتابیس را بررسی کنید.', 'admin_service_unavailable');
}
