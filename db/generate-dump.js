const fs = require('fs');
const path = require('path');
const { getSeedData } = require('./seed');

async function generateSQL() {
    const seed = await getSeedData();

    let sql = `-- ==============================================================================
-- DATABASE DUMP FOR PHPMYADMIN / MYSQL
-- Project: แพลตฟอร์มตลาดกลางออนไลน์สำหรับส่งเสริมการจำหน่ายสินค้าและสร้างรายได้ให้แก่ผู้พิการ
-- Database Name: inclusive_marketplace
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+07:00";

-- 1. Create Database
CREATE DATABASE IF NOT EXISTS \`inclusive_marketplace\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`inclusive_marketplace\`;

-- --------------------------------------------------------
-- Table structure for table \`users\`
-- --------------------------------------------------------
DROP TABLE IF EXISTS \`users\`;
CREATE TABLE \`users\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`email\` varchar(191) NOT NULL,
  \`password_hash\` varchar(255) NOT NULL,
  \`full_name\` varchar(150) NOT NULL,
  \`phone\` varchar(30) DEFAULT NULL,
  \`role\` varchar(20) DEFAULT 'buyer',
  \`avatar_url\` text DEFAULT NULL,
  \`bio\` text DEFAULT NULL,
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_users_email\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table \`stores\`
-- --------------------------------------------------------
DROP TABLE IF EXISTS \`stores\`;
CREATE TABLE \`stores\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`user_id\` int(11) NOT NULL,
  \`store_name\` varchar(150) NOT NULL,
  \`disability_type\` varchar(100) NOT NULL,
  \`story\` text NOT NULL,
  \`craft_technique\` text DEFAULT NULL,
  \`support_goal_title\` varchar(200) DEFAULT NULL,
  \`support_goal_target\` decimal(12,2) DEFAULT 0.00,
  \`support_goal_current\` decimal(12,2) DEFAULT 0.00,
  \`verification_status\` varchar(30) DEFAULT 'approved',
  \`verification_doc\` text DEFAULT NULL,
  \`phone\` varchar(30) DEFAULT NULL,
  \`province\` varchar(100) DEFAULT 'ขอนแก่น',
  \`address\` text DEFAULT NULL,
  \`cover_image\` text DEFAULT NULL,
  \`avatar_image\` text DEFAULT NULL,
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_stores_user_id\` (\`user_id\`),
  CONSTRAINT \`fk_stores_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table \`categories\`
-- --------------------------------------------------------
DROP TABLE IF EXISTS \`categories\`;
CREATE TABLE \`categories\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`name\` varchar(100) NOT NULL,
  \`description\` text DEFAULT NULL,
  \`icon\` varchar(50) DEFAULT NULL,
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table \`products\`
-- --------------------------------------------------------
DROP TABLE IF EXISTS \`products\`;
CREATE TABLE \`products\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`store_id\` int(11) NOT NULL,
  \`category_id\` int(11) NOT NULL,
  \`name\` varchar(200) NOT NULL,
  \`story\` text DEFAULT NULL,
  \`description\` text NOT NULL,
  \`price\` decimal(10,2) NOT NULL,
  \`stock\` int(11) DEFAULT 10,
  \`image_url\` text NOT NULL,
  \`model_3d_url\` text DEFAULT NULL,
  \`dimensions\` varchar(100) DEFAULT NULL,
  \`weight\` varchar(50) DEFAULT NULL,
  \`is_featured\` tinyint(1) DEFAULT 0,
  \`is_active\` tinyint(1) DEFAULT 1,
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_products_store_id\` (\`store_id\`),
  KEY \`idx_products_category_id\` (\`category_id\`),
  CONSTRAINT \`fk_products_store\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_products_category\` FOREIGN KEY (\`category_id\`) REFERENCES \`categories\` (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table \`orders\`
-- --------------------------------------------------------
DROP TABLE IF EXISTS \`orders\`;
CREATE TABLE \`orders\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`buyer_id\` int(11) NOT NULL,
  \`store_id\` int(11) NOT NULL,
  \`subtotal\` decimal(12,2) NOT NULL,
  \`tip_amount\` decimal(12,2) DEFAULT 0.00,
  \`shipping_cost\` decimal(10,2) DEFAULT 0.00,
  \`grand_total\` decimal(12,2) NOT NULL,
  \`status\` varchar(30) DEFAULT 'paid',
  \`shipping_name\` varchar(150) NOT NULL,
  \`shipping_phone\` varchar(30) NOT NULL,
  \`shipping_address\` text NOT NULL,
  \`payment_method\` varchar(50) DEFAULT 'promptpay',
  \`tracking_number\` varchar(100) DEFAULT NULL,
  \`courier_name\` varchar(100) DEFAULT 'ไปรษณีย์ไทย (EMS)',
  \`notes\` text DEFAULT NULL,
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_orders_buyer_id\` (\`buyer_id\`),
  KEY \`idx_orders_store_id\` (\`store_id\`),
  CONSTRAINT \`fk_orders_buyer\` FOREIGN KEY (\`buyer_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_orders_store\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table \`order_items\`
-- --------------------------------------------------------
DROP TABLE IF EXISTS \`order_items\`;
CREATE TABLE \`order_items\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`order_id\` int(11) NOT NULL,
  \`product_id\` int(11) NOT NULL,
  \`product_name\` varchar(200) NOT NULL,
  \`product_image\` text DEFAULT NULL,
  \`quantity\` int(11) NOT NULL,
  \`unit_price\` decimal(10,2) NOT NULL,
  \`subtotal\` decimal(12,2) NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_order_items_order_id\` (\`order_id\`),
  KEY \`idx_order_items_product_id\` (\`product_id\`),
  CONSTRAINT \`fk_items_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_items_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table \`reviews\`
-- --------------------------------------------------------
DROP TABLE IF EXISTS \`reviews\`;
CREATE TABLE \`reviews\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`product_id\` int(11) NOT NULL,
  \`buyer_id\` int(11) NOT NULL,
  \`rating\` int(11) NOT NULL,
  \`comment\` text DEFAULT NULL,
  \`seller_reply\` text DEFAULT NULL,
  \`seller_replied_at\` datetime DEFAULT NULL,
  \`status\` varchar(20) DEFAULT 'approved',
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_reviews_product_id\` (\`product_id\`),
  KEY \`idx_reviews_buyer_id\` (\`buyer_id\`),
  CONSTRAINT \`fk_reviews_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_reviews_buyer\` FOREIGN KEY (\`buyer_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table \`campaigns\`
-- --------------------------------------------------------
DROP TABLE IF EXISTS \`campaigns\`;
CREATE TABLE \`campaigns\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`title\` varchar(200) NOT NULL,
  \`description\` text NOT NULL,
  \`location\` varchar(200) NOT NULL,
  \`start_date\` date NOT NULL,
  \`end_date\` date NOT NULL,
  \`event_type\` varchar(50) DEFAULT 'both',
  \`image_url\` text DEFAULT NULL,
  \`is_active\` tinyint(1) DEFAULT 1,
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table \`campaign_participants\`
-- --------------------------------------------------------
DROP TABLE IF EXISTS \`campaign_participants\`;
CREATE TABLE \`campaign_participants\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`campaign_id\` int(11) NOT NULL,
  \`store_id\` int(11) NOT NULL,
  \`status\` varchar(30) DEFAULT 'approved',
  \`booth_number\` varchar(50) DEFAULT NULL,
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_camp_part\` (\`campaign_id\`, \`store_id\`),
  CONSTRAINT \`fk_camp_part_camp\` FOREIGN KEY (\`campaign_id\`) REFERENCES \`campaigns\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_camp_part_store\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
\n`;

    // INSERTS
    sql += `-- ========================================================\n-- DUMPING DATA FOR TABLES\n-- ========================================================\n\n`;

    // Users
    sql += `INSERT INTO \`users\` (\`id\`, \`email\`, \`password_hash\`, \`full_name\`, \`phone\`, \`role\`, \`avatar_url\`, \`bio\`) VALUES\n`;
    sql += seed.users.map(u => `(${u.id}, ${JSON.stringify(u.email)}, ${JSON.stringify(u.password_hash)}, ${JSON.stringify(u.full_name)}, ${JSON.stringify(u.phone)}, ${JSON.stringify(u.role)}, ${JSON.stringify(u.avatar_url)}, ${JSON.stringify(u.bio)})`).join(',\n') + ';\n\n';

    // Stores
    sql += `INSERT INTO \`stores\` (\`id\`, \`user_id\`, \`store_name\`, \`disability_type\`, \`story\`, \`craft_technique\`, \`support_goal_title\`, \`support_goal_target\`, \`support_goal_current\`, \`verification_status\`, \`phone\`, \`province\`, \`address\`, \`avatar_image\`, \`cover_image\`) VALUES\n`;
    sql += seed.stores.map(s => `(${s.id}, ${s.user_id}, ${JSON.stringify(s.store_name)}, ${JSON.stringify(s.disability_type)}, ${JSON.stringify(s.story)}, ${JSON.stringify(s.craft_technique)}, ${JSON.stringify(s.support_goal_title)}, ${s.support_goal_target}, ${s.support_goal_current}, ${JSON.stringify(s.verification_status)}, ${JSON.stringify(s.phone)}, ${JSON.stringify(s.province)}, ${JSON.stringify(s.address)}, ${JSON.stringify(s.avatar_image)}, ${JSON.stringify(s.cover_image)})`).join(',\n') + ';\n\n';

    // Categories
    sql += `INSERT INTO \`categories\` (\`id\`, \`name\`, \`description\`, \`icon\`) VALUES\n`;
    sql += seed.categories.map(c => `(${c.id}, ${JSON.stringify(c.name)}, ${JSON.stringify(c.description)}, ${JSON.stringify(c.icon)})`).join(',\n') + ';\n\n';

    // Products
    sql += `INSERT INTO \`products\` (\`id\`, \`store_id\`, \`category_id\`, \`name\`, \`story\`, \`description\`, \`price\`, \`stock\`, \`image_url\`, \`model_3d_url\`, \`dimensions\`, \`weight\`, \`is_featured\`, \`is_active\`) VALUES\n`;
    sql += seed.products.map(p => `(${p.id}, ${p.store_id}, ${p.category_id}, ${JSON.stringify(p.name)}, ${JSON.stringify(p.story)}, ${JSON.stringify(p.description)}, ${p.price}, ${p.stock}, ${JSON.stringify(p.image_url)}, ${p.model_3d_url ? JSON.stringify(p.model_3d_url) : 'NULL'}, ${JSON.stringify(p.dimensions)}, ${JSON.stringify(p.weight)}, ${p.is_featured}, ${p.is_active})`).join(',\n') + ';\n\n';

    // Campaigns
    sql += `INSERT INTO \`campaigns\` (\`id\`, \`title\`, \`description\`, \`location\`, \`start_date\`, \`end_date\`, \`event_type\`, \`image_url\`, \`is_active\`) VALUES\n`;
    sql += seed.campaigns.map(cp => `(${cp.id}, ${JSON.stringify(cp.title)}, ${JSON.stringify(cp.description)}, ${JSON.stringify(cp.location)}, ${JSON.stringify(cp.start_date)}, ${JSON.stringify(cp.end_date)}, ${JSON.stringify(cp.event_type)}, ${JSON.stringify(cp.image_url)}, ${cp.is_active})`).join(',\n') + ';\n\n';

    // Campaign Participants
    sql += `INSERT INTO \`campaign_participants\` (\`campaign_id\`, \`store_id\`, \`status\`, \`booth_number\`) VALUES\n`;
    sql += seed.campaign_participants.map(p => `(${p.campaign_id}, ${p.store_id}, ${JSON.stringify(p.status)}, ${JSON.stringify(p.booth_number)})`).join(',\n') + ';\n\n';

    // Reviews
    sql += `INSERT INTO \`reviews\` (\`id\`, \`product_id\`, \`buyer_id\`, \`rating\`, \`comment\`, \`seller_reply\`, \`seller_replied_at\`, \`status\`) VALUES\n`;
    sql += seed.reviews.map(r => `(${r.id}, ${r.product_id}, ${r.buyer_id}, ${r.rating}, ${JSON.stringify(r.comment)}, ${JSON.stringify(r.seller_reply)}, ${JSON.stringify(r.seller_replied_at)}, ${JSON.stringify(r.status)})`).join(',\n') + ';\n\n';

    // Orders
    sql += `INSERT INTO \`orders\` (\`id\`, \`buyer_id\`, \`store_id\`, \`subtotal\`, \`tip_amount\`, \`shipping_cost\`, \`grand_total\`, \`status\`, \`shipping_name\`, \`shipping_phone\`, \`shipping_address\`, \`payment_method\`, \`tracking_number\`, \`courier_name\`, \`notes\`) VALUES\n`;
    sql += seed.orders.map(o => `(${o.id}, ${o.buyer_id}, ${o.store_id}, ${o.subtotal}, ${o.tip_amount}, ${o.shipping_cost}, ${o.grand_total}, ${JSON.stringify(o.status)}, ${JSON.stringify(o.shipping_name)}, ${JSON.stringify(o.shipping_phone)}, ${JSON.stringify(o.shipping_address)}, ${JSON.stringify(o.payment_method)}, ${JSON.stringify(o.tracking_number)}, ${JSON.stringify(o.courier_name)}, ${JSON.stringify(o.notes)})`).join(',\n') + ';\n\n';

    // Order Items
    sql += `INSERT INTO \`order_items\` (\`id\`, \`order_id\`, \`product_id\`, \`product_name\`, \`product_image\`, \`quantity\`, \`unit_price\`, \`subtotal\`) VALUES\n`;
    sql += seed.order_items.map(oi => `(${oi.id}, ${oi.order_id}, ${oi.product_id}, ${JSON.stringify(oi.product_name)}, ${JSON.stringify(oi.product_image)}, ${oi.quantity}, ${oi.unit_price}, ${oi.subtotal})`).join(',\n') + ';\n\n';

    sql += `SET FOREIGN_KEY_CHECKS = 1;\nCOMMIT;\n`;

    fs.writeFileSync(path.join(__dirname, "phpmyadmin_dump.sql"), sql, "utf8");
    fs.writeFileSync(path.join(__dirname, "../inclusive_marketplace.sql"), sql, "utf8");
    console.log("✅ Successfully updated inclusive_marketplace.sql with clean unique keys!");
}

generateSQL();
