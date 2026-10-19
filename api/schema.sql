SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  mobile CHAR(11) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME NOT NULL,
  last_login_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_mobile (mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS otp_challenges (
  mobile CHAR(11) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  challenge_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  code_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  expires_at DATETIME NOT NULL,
  last_sent_at DATETIME NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  consumed_at DATETIME DEFAULT NULL,
  PRIMARY KEY (mobile),
  KEY ix_otp_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS otp_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  mobile_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  requested_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_otp_mobile_time (mobile_hash, requested_at),
  KEY ix_otp_ip_time (ip_hash, requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  shipping_name VARCHAR(120) NOT NULL,
  shipping_mobile CHAR(11) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  postal_code CHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  shipping_address VARCHAR(1000) NOT NULL,
  subtotal_toman BIGINT UNSIGNED NOT NULL,
  shipping_toman BIGINT UNSIGNED NOT NULL,
  tax_toman BIGINT UNSIGNED NOT NULL,
  total_toman BIGINT UNSIGNED NOT NULL,
  status VARCHAR(32) NOT NULL,
  payment_status VARCHAR(24) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  paid_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_number (order_number),
  KEY ix_orders_customer_created (customer_id, created_at),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  sku VARCHAR(24) NOT NULL,
  product_name VARCHAR(160) NOT NULL,
  size VARCHAR(8) NOT NULL DEFAULT '',
  color VARCHAR(40) NOT NULL DEFAULT '',
  quantity TINYINT UNSIGNED NOT NULL DEFAULT 1,
  unit_price_toman BIGINT UNSIGNED NOT NULL,
  line_total_toman BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY ix_order_items_order (order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id)
    ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(24) NOT NULL,
  authority VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  amount_toman BIGINT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL,
  reference_id VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  provider_code INT DEFAULT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_order (order_id),
  UNIQUE KEY uq_payments_authority (authority),
  KEY ix_payments_status (status, updated_at),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
