-- Chuyen tien te tu VND so nguyen sang USD co xu: moi cot tien -> DECIMAL(12,2).
-- Gia hien tai la so nguyen theo don vi USD (22 = $22.00) nen chi doi kieu, khong doi gia tri.
-- Diem thuong (customers.point, orders.point_value/point_used, customer_point_history.points) giu INT.
-- customer_catalogues.point_percent la phan tram, giu nguyen.
-- promotions.discountValue/maxDiscountValue: khi discountType = 'percent' thi la %, van luu DECIMAL(12,2).
-- Tien nam trong JSON (promotions.discountInformation, orders.cart/promotion, products.variant) khong doi.
-- Ap dung: docker exec -i next-core-db mysql -uroot -proot --default-character-set=utf8mb4 next_core < prisma/sql/2026-10-25-money-usd-decimal.sql
-- Backup truoc khi chay: ../next-core-backups/next_core-before-usd-decimal-20261025.sql

ALTER TABLE `products`
  MODIFY `price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  MODIFY `combo_price` DECIMAL(12,2) NULL DEFAULT NULL COMMENT 'Giá combo 5 chai';

ALTER TABLE `product_variants`
  MODIFY `price` DECIMAL(12,2) NOT NULL DEFAULT 0.00;

ALTER TABLE `order_product`
  MODIFY `price` DECIMAL(12,2) NOT NULL,
  MODIFY `priceOriginal` DECIMAL(12,2) NOT NULL;

ALTER TABLE `orders`
  MODIFY `shipping` DECIMAL(12,2) NOT NULL DEFAULT 0.00;

ALTER TABLE `promotions`
  MODIFY `discountValue` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  MODIFY `maxDiscountValue` DECIMAL(12,2) NOT NULL;

ALTER TABLE `promotion_combos`
  MODIFY `price` DECIMAL(12,2) NOT NULL DEFAULT 0.00;

ALTER TABLE `vouchers`
  MODIFY `discount_value` DECIMAL(12,2) NOT NULL,
  MODIFY `max_discount_amount` DECIMAL(12,2) NULL DEFAULT NULL;

ALTER TABLE `voucher_order_conditions`
  MODIFY `min_order_value` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  MODIFY `max_order_value` DECIMAL(12,2) NULL DEFAULT NULL;

ALTER TABLE `voucher_shipping_conditions`
  MODIFY `min_shipping_value` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  MODIFY `max_shipping_value` DECIMAL(12,2) NULL DEFAULT NULL;
