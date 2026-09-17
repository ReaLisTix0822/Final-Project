-- ==============================================================================
-- DATABASE DUMP FOR PHPMYADMIN / MYSQL
-- Project: แพลตฟอร์มตลาดกลางออนไลน์สำหรับส่งเสริมการจำหน่ายสินค้าและสร้างรายได้ให้แก่ผู้พิการ
-- Database Name: inclusive_marketplace
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+07:00";

-- 1. Create Database
CREATE DATABASE IF NOT EXISTS `inclusive_marketplace` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `inclusive_marketplace`;

-- --------------------------------------------------------
-- Table structure for table `users`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(191) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `role` varchar(20) DEFAULT 'buyer',
  `avatar_url` text DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `stores`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `stores`;
CREATE TABLE `stores` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `store_name` varchar(150) NOT NULL,
  `disability_type` varchar(100) NOT NULL,
  `story` text NOT NULL,
  `craft_technique` text DEFAULT NULL,
  `support_goal_title` varchar(200) DEFAULT NULL,
  `support_goal_target` decimal(12,2) DEFAULT 0.00,
  `support_goal_current` decimal(12,2) DEFAULT 0.00,
  `verification_status` varchar(30) DEFAULT 'approved',
  `verification_doc` text DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `province` varchar(100) DEFAULT 'ขอนแก่น',
  `address` text DEFAULT NULL,
  `cover_image` text DEFAULT NULL,
  `avatar_image` text DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_stores_user_id` (`user_id`),
  CONSTRAINT `fk_stores_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `categories`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `icon` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `products`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `store_id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `name` varchar(200) NOT NULL,
  `story` text DEFAULT NULL,
  `description` text NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `stock` int(11) DEFAULT 10,
  `image_url` text NOT NULL,
  `model_3d_url` text DEFAULT NULL,
  `dimensions` varchar(100) DEFAULT NULL,
  `weight` varchar(50) DEFAULT NULL,
  `is_featured` tinyint(1) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_products_store_id` (`store_id`),
  KEY `idx_products_category_id` (`category_id`),
  CONSTRAINT `fk_products_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `orders`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `buyer_id` int(11) NOT NULL,
  `store_id` int(11) NOT NULL,
  `subtotal` decimal(12,2) NOT NULL,
  `tip_amount` decimal(12,2) DEFAULT 0.00,
  `shipping_cost` decimal(10,2) DEFAULT 0.00,
  `grand_total` decimal(12,2) NOT NULL,
  `status` varchar(30) DEFAULT 'paid',
  `shipping_name` varchar(150) NOT NULL,
  `shipping_phone` varchar(30) NOT NULL,
  `shipping_address` text NOT NULL,
  `payment_method` varchar(50) DEFAULT 'promptpay',
  `tracking_number` varchar(100) DEFAULT NULL,
  `courier_name` varchar(100) DEFAULT 'ไปรษณีย์ไทย (EMS)',
  `notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_orders_buyer_id` (`buyer_id`),
  KEY `idx_orders_store_id` (`store_id`),
  CONSTRAINT `fk_orders_buyer` FOREIGN KEY (`buyer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_orders_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `order_items`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `product_name` varchar(200) NOT NULL,
  `product_image` text DEFAULT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `subtotal` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order_id` (`order_id`),
  KEY `idx_order_items_product_id` (`product_id`),
  CONSTRAINT `fk_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `reviews`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `reviews`;
CREATE TABLE `reviews` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `buyer_id` int(11) NOT NULL,
  `rating` int(11) NOT NULL,
  `comment` text DEFAULT NULL,
  `seller_reply` text DEFAULT NULL,
  `seller_replied_at` datetime DEFAULT NULL,
  `status` varchar(20) DEFAULT 'approved',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reviews_product_id` (`product_id`),
  KEY `idx_reviews_buyer_id` (`buyer_id`),
  CONSTRAINT `fk_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_buyer` FOREIGN KEY (`buyer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `campaigns`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `campaigns`;
CREATE TABLE `campaigns` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `description` text NOT NULL,
  `location` varchar(200) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `event_type` varchar(50) DEFAULT 'both',
  `image_url` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `campaign_participants`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `campaign_participants`;
CREATE TABLE `campaign_participants` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `campaign_id` int(11) NOT NULL,
  `store_id` int(11) NOT NULL,
  `status` varchar(30) DEFAULT 'approved',
  `booth_number` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_camp_part` (`campaign_id`, `store_id`),
  CONSTRAINT `fk_camp_part_camp` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_camp_part_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `favorites`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `favorites`;
CREATE TABLE `favorites` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_product` (`user_id`, `product_id`),
  KEY `idx_fav_user` (`user_id`),
  KEY `idx_fav_product` (`product_id`),
  CONSTRAINT `fk_fav_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fav_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `chat_messages`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `chat_messages`;
CREATE TABLE `chat_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sender_id` int(11) NOT NULL,
  `receiver_id` int(11) DEFAULT NULL,
  `store_id` int(11) DEFAULT NULL,
  `sender_role` varchar(20) DEFAULT 'buyer',
  `message` text NOT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_chat_sender` (`sender_id`),
  KEY `idx_chat_receiver` (`receiver_id`),
  KEY `idx_chat_store` (`store_id`),
  CONSTRAINT `fk_chat_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_chat_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- DUMPING DATA FOR TABLES
-- ========================================================

INSERT INTO `users` (`id`, `email`, `password_hash`, `full_name`, `phone`, `role`, `avatar_url`, `bio`) VALUES
(1, "admin@inclusive-market.org", "$2a$10$b6W/XkPeD0vGadzXlacYCuHjLBUE/wVh2gWfy2XlkwjjqqX6eHrTi", "ผู้ดูแลระบบกลาง (Admin)", "081-999-0000", "admin", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80", "ผู้ดูแลระบบแพลตฟอร์มตลาดกลางออนไลน์เพื่อผู้พิการ"),
(2, "somchai.blindcraft@gmail.com", "$2a$10$4E9rCgGTM5UUVeFKIbbQ6.YODe.42i34dAThfMaPtIGkbNwO.rA0K", "คุณสมชาย ทัศนีย์ (ครูช่างจักสานสายตา)", "089-123-4567", "seller", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80", "ช่างหัตถกรรมจักสานผักตบชวาและไม้ไผ่ ผู้บกพร่องทางการมองเห็น"),
(3, "wilai.deafcraft@gmail.com", "$2a$10$4E9rCgGTM5UUVeFKIbbQ6.YODe.42i34dAThfMaPtIGkbNwO.rA0K", "คุณวิไลพร สุขเกษม (ร้านผ้าทอมือและขนมหวาน)", "086-555-8899", "seller", "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80", "ช่างทอผ้าไหมมัดหมี่ลายโบราณและทำขนมไทย ผู้บกพร่องทางการได้ยิน"),
(4, "ekkachai.woodart@gmail.com", "$2a$10$4E9rCgGTM5UUVeFKIbbQ6.YODe.42i34dAThfMaPtIGkbNwO.rA0K", "คุณเอกชัย ศิลป์ประดิษฐ์ (งานไม้และเครื่องหนัง)", "082-444-1122", "seller", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80", "งานแกะสลักไม้จามจุรีและเครื่องหนังทำมือ ผู้บกพร่องทางการเคลื่อนไหว (วีลแชร์)"),
(5, "nattapong.artheart@gmail.com", "$2a$10$4E9rCgGTM5UUVeFKIbbQ6.YODe.42i34dAThfMaPtIGkbNwO.rA0K", "น้องณัฐพงษ์ ใจสร้างสรรค์ (ภาพวาดสีน้ำ & เซรามิก)", "085-777-3344", "seller", "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80", "ศิลปินออทิสติกผู้ถ่ายทอดความสุขผ่านภาพวาดสีน้ำและงานปั้นเซรามิก"),
(6, "buyer.anurak@gmail.com", "$2a$10$4E9rCgGTM5UUVeFKIbbQ6.YODe.42i34dAThfMaPtIGkbNwO.rA0K", "คุณอนุรักษ์ ส่งเสริมศิลป์", "081-333-7788", "buyer", "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&auto=format&fit=crop&q=80", "ผู้สนับสนุนงานฝีมือไทยและสินค้าเพื่อสังคม"),
(7, "buyer.kanokwan@gmail.com", "$2a$10$4E9rCgGTM5UUVeFKIbbQ6.YODe.42i34dAThfMaPtIGkbNwO.rA0K", "คุณกนกวรรณ ปรีชาสุข", "089-777-9911", "buyer", "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80", "ชื่นชอบงานตกแต่งบ้าน eco-friendly และผ้าไทย");

INSERT INTO `stores` (`id`, `user_id`, `store_name`, `disability_type`, `story`, `craft_technique`, `support_goal_title`, `support_goal_target`, `support_goal_current`, `verification_status`, `phone`, `province`, `address`, `avatar_image`, `cover_image`) VALUES
(1, 2, "แสงสว่างจักสาน (Light & Craft Basketry)", "visual", "เกิดจากกลุ่มช่างจักสานผู้บกพร่องทางการมองเห็น ที่รวมตัวกันเรียนรู้การสัมผัสเส้นใยผักตบชวาและไม้ไผ่ด้วยปลายนิ้ว การสานแต่ละเส้นใช้สมาธิและความจำของกล้ามเนื้อมือเพื่อให้ได้ลวดลายที่แน่นหนา ประณีต และแข็งแรง สินค้าทุกชิ้นไม่เพียงแต่เป็นของใช้ แต่คือแสงสว่างและกำลังใจในการพึ่งพาตนเองอย่างภาคภูมิใจ", "การจักสานด้วยเทคนิคการจำผังลายด้วยสัมผัสปลายนิ้ว เคลือบด้วยสารสกัดธรรมชาติกันมอดและรา", "ระดมทุนจัดซื้อเครื่องอบแห้งผักตบชวาพลังงานแสงอาทิตย์สำหรับศูนย์ฝึกอาชีพคนตาบอด", 25000, 18450, "approved", "089-123-4567", "ขอนแก่น", "ศูนย์ฝึกอาชีพและโรงเรียนการศึกษาคนตาบอด ขอนแก่น ถ.มะลิวัลย์ ต.บ้านเป็ด อ.เมือง จ.ขอนแก่น", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80", "https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=800&auto=format&fit=crop&q=80"),
(2, 3, "ทอมือยินดี (Deaf Silk & Sweet Delight)", "hearing", "พวกเราคือกลุ่มแม่บ้านและเยาวชนผู้บกพร่องทางการได้ยิน ภาษาของเราคือภาษามือและลวดลายบนผืนผ้าไหมมัดหมี่ ทุกเส้นไหมถูกย้อมด้วยสีธรรมชาติจากใบไม้และเปลือกไม้ในท้องถิ่นขอนแก่น นอกจากงานผ้าทอแล้ว เรายังทำขนมไทยทองเอกและกลีบลำดวนอบควันเทียนสูตรโบราณ เพื่อถ่ายทอดความหวานละมุนแทนคำพูด", "ผ้าไหมมัดหมี่ลายโบราณ 6 ตะกอ ย้อมสีธรรมชาติ และขนมไทยโบราณสูตรใช้น้ำตาลโตนดแท้", "จัดซื้อกี่กระตุกทอผ้าขนาดใหญ่ 4 เครื่อง เพื่อขยายกลุ่มฝึกอาชีพคนหูหนวก", 30000, 24200, "approved", "086-555-8899", "ขอนแก่น", "สมาคมพัฒนาศักยภาพคนหูหนวกและหูตึงจังหวัดขอนแก่น อ.เมือง จ.ขอนแก่น", "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80", "https://images.unsplash.com/photo-1606744888344-493238955de0?w=800&auto=format&fit=crop&q=80"),
(3, 4, "เอกชัยศิลป์ไม้ & หนังแท้ (Wheelchair Woodcraft)", "physical", "หลังจากประสบอุบัติเหตุทำให้ต้องใช้วีลแชร์ ผมไม่ยอมแพ้และเปลี่ยนพื้นที่โรงรถให้กลายเป็นสตูดิองานไม้และเครื่องหนัง ผมออกแบบโต๊ะทำงานระดับวีลแชร์และใช้สิ่วแกะสลักไม้จามจุรีชิ้นต่อชิ้น งานหนังแท้ทุกใบเย็บด้วยมือแบบ Saddle Stitch สองเข็ม แข็งแรงทนทานใช้งานได้นับสิบปี", "งานแกะสลักไม้ตันชิ้นเดียว ขัดผิวเนียน และการเย็บหนังฟอกฝาดด้วยมือไร้รอยต่อจักร", "ปรับปรุงโต๊ะทำงานระบบไฮดรอลิกสำหรับช่างฝีมือผู้ใช้วีลแชร์ในชุมชน", 20000, 15300, "approved", "082-444-1122", "ขอนแก่น", "ศูนย์พัฒนาศักยภาพและอาชีพคนพิการ จังหวัดขอนแก่น ต.ศิลา อ.เมือง จ.ขอนแก่น", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80", "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80"),
(4, 5, "โลกสดใสด้วยใจศิลป์ (Autism Heart Art)", "intellectual", "น้องณัฐพงษ์เป็นเยาวชนออทิสติกที่มีพรสวรรค์ด้านมิติสัมพันธ์และการผสมสี ศิลปะคือสะพานเชื่อมที่ทำให้น้องสื่อสารความสุขและจินตนาการสู่โลกภายนอก ภาพวาดและแก้วกาแฟเซรามิกทุกใบถูกแต้มด้วยลวดลายแห่งความสุขและพลังบวก รายได้ทั้งหมดช่วยเสริมสร้างพัฒนาการและการศึกษาต่อเนื่อง", "ภาพวาดสีน้ำบนกระดาษคอตตอน 300 แกรม และเซรามิกเคลือบใสเผาอุณหภูมิ 1200 องศาเซลเซียส", "จัดหาอุปกรณ์สีน้ำนำเข้าและเตาเผาเซรามิกไฟฟ้าขนาดเล็กสำหรับเยาวชนออทิสติก", 18000, 12800, "approved", "085-777-3344", "ขอนแก่น", "ชมรมผู้ปกครองบุคคลออทิสติก จ.ขอนแก่น ต.ในเมือง อ.เมือง จ.ขอนแก่น", "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80", "https://images.unsplash.com/photo-1460661419200-fd4358377982?w=800&auto=format&fit=crop&q=80");

INSERT INTO `categories` (`id`, `name`, `description`, `icon`) VALUES
(1, "งานจักสานและหัตถกรรมพื้นบ้าน", "กระเป๋า ตะกร้า ของใช้สานผักตบชวาและไม้ไผ่ประณีต", "🧺"),
(2, "ผ้าทอมือและเครื่องแต่งกาย", "ผ้าไหมมัดหมี่ ผ้าฝ้ายย้อมคราม และเสื้อผ้าตัดเย็บมือ", "🧵"),
(3, "งานไม้และเครื่องหนังทำมือ", "ของแต่งบ้าน จานชามไม้ กระเป๋าหนังแท้เย็บมือ", "🪵"),
(4, "ศิลปะ ภาพวาด และเซรามิก", "ภาพวาดสีน้ำ งานปั้น แก้วเซรามิก และของที่ระลึกสร้างสรรค์", "🎨"),
(5, "อาหาร ขนมไทย และเกษตรแปรรูป", "ขนมไทยโบราณ ชาสมุนไพรอินทรีย์ ผลไม้อบแห้งเพื่อสุขภาพ", "🍯");

INSERT INTO `products` (`id`, `store_id`, `category_id`, `name`, `story`, `description`, `price`, `stock`, `image_url`, `model_3d_url`, `dimensions`, `weight`, `is_featured`, `is_active`) VALUES
(1, 1, 1, "กระเป๋าสะพายผักตบชวาถักลายลูกแก้ว (Luksao Water Hyacinth Bag)", "กระเป๋าใบนี้ถักทอด้วยมือจากผู้บกพร่องทางการมองเห็น 3 ท่านที่ใช้เวลาสัมผัสเส้นใยผักตบชวาคัดเกรดอย่างละเอียด ทุกข้อต่อผูกแน่นด้วยเทคนิคลายลูกแก้วโบราณ แข็งแรงทนทาน ซับในด้วยผ้าฝ้ายทอมือสีครีมธรรมชาติ", "กระเป๋าสะพายข้างทำจากผักตบชวาตากแห้งธรรมชาติ เคลือบน้ำยากันชื้นและกันรา ปลอดภัยต่อสิ่งแวดล้อม มาพร้อมสายสะพายหนังแท้และกระดุมกะลามะพร้าว", 490, 15, "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80", "https://modelviewer.dev/shared-assets/models/Astronaut.glb", "22 x 18 x 8 ซม.", "350 กรัม", 1, 1),
(2, 1, 1, "ชุดจานรองแก้วและถาดจัดโต๊ะสานไม้ไผ่ (Set of 4 Bamboo Coasters)", "ผลงานการสานไม้ไผ่เส้นละเอียดโดยครูช่างตาบอด ผู้ใช้ฝีมือสัมผัสความเรียบเนียนของไม้ไผ่ทุกเส้นเพื่อเรียงร้อยเป็นลวดลายเรขาคณิตที่ร่วมสมัย", "ชุดจานรองแก้วไม้ไผ่สาน 4 ชิ้นพร้อมถาดวางทรงกลม ทนความร้อน ซับหยดน้ำได้ดี เหมาะสำหรับตกแต่งโต๊ะอาหารและโต๊ะทำงาน", 250, 25, "https://images.unsplash.com/photo-1615865417491-9941019fbc00?w=800&auto=format&fit=crop&q=80", NULL, "เส้นผ่านศูนย์กลาง 10 ซม.", "150 กรัม", 0, 1),
(3, 2, 2, "ผ้าพันคอไหมมัดหมี่ย้อมครามธรรมชาติ ลายขอเจ้าฟ้า", "ทอขึ้นจากกี่ทอมือโบราณโดยช่างทอผ้าผู้บกพร่องทางการได้ยิน การนับเส้นไหมแต่ละรอบต้องใช้สายตาและความตั้งใจอย่างสูง ลายขอเจ้าฟ้าสื่อถึงความก้าวหน้าและความมงคล ย้อมด้วยครามธรรมชาติ 100%", "ผ้าพันคอผ้าไหมแท้ 100% ลวดลายมัดหมี่ขอนแก่น ย้อมด้วยสีธรรมชาติ ให้สัมผัสนุ่ม อบอุ่นในฤดูหนาวและเย็นสบายในฤดูร้อน ขนาด 50 x 180 ซม.", 850, 8, "https://images.unsplash.com/photo-1606744888344-493238955de0?w=800&auto=format&fit=crop&q=80", "https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb", "50 x 180 ซม.", "120 กรัม", 1, 1),
(4, 2, 5, "ขนมกลีบลำดวนอบควันเทียนสูตรโบราณ (กล่องของขวัญ 24 ชิ้น)", "ขนมไทยโบราณที่ผลิตโดยสมาชิกผู้บกพร่องทางการได้ยิน ปั้นด้วยมือชิ้นต่อชิ้นอย่างใจเย็น อบควันเทียนหอมดอกมะลิแท้ค้างคืน ให้รสชาติละมุนละลายในปาก", "ขนมกลีบลำดวนสูตรต้นตำรับ ใช้น้ำตาลโตนดเกรดพรีเมียมและแป้งอบพิเศษ ไม่ใส่สารกันบูด บรรจุในกล่องกระดาษคราฟท์สวยงามพร้อมมอบเป็นของขวัญ", 180, 30, "https://images.unsplash.com/photo-1579372786545-d24232daf58c?w=800&auto=format&fit=crop&q=80", NULL, "กล่อง 15 x 20 ซม.", "300 กรัม", 0, 1),
(5, 3, 3, "ถาดไม้จามจุรีทรงรีแกะสลักมือ (Hand-carved Acacia Tray)", "ช่างเอกชัยแกะสลักถาดนี้จากท่อนไม้จามจุรีแท้บนเก้าอี้รถเข็น โดยคัดสรรลายไม้ธรรมชาติที่โค้งมน ผิวสัมผัสถูกขัดด้วยกระดาษทรายเบอร์ละเอียด 5 ระดับ และเคลือบด้วยขี้ผึ้งบริสุทธิ์เกรดสัมผัสอาหาร (Food grade)", "ถาดเสิร์ฟไม้จามจุรีเนื้อแน่น แข็งแรง ทนทาน ลายไม้สวยงามไม่ซ้ำใคร เหมาะสำหรับเสิร์ฟกาแฟ ขนม หรือวางของตกแต่งบ้าน", 520, 12, "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80", "https://modelviewer.dev/shared-assets/models/glTF-Sample-Assets/Models/SheenChair/glTF-Binary/SheenChair.glb", "30 x 18 x 2.5 ซม.", "600 กรัม", 1, 1),
(6, 3, 3, "กระเป๋าสตางค์หนังแท้ฟอกฝาดเย็บมือ (Hand-stitched Leather Wallet)", "ผลิตจากหนังวัวฟอกฝาดนำเข้า ย้อมสีแทนธรรมชาติ เจาะรูและเย็บด้วยด้ายเทียนคู่ทีละเข็ม หนังจะมีความเงางามสวยขึ้นตามกาลเวลาและการใช้งาน", "กระเป๋าสตางค์หนังแท้แบบพับสองตอน มีช่องใส่ธนบัตร 2 ช่อง ช่องใส่บัตร 6 ช่อง และช่องใส่เหรียญมีซิป YKK อย่างดี", 790, 10, "https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&auto=format&fit=crop&q=80", NULL, "11 x 9.5 x 2 ซม.", "110 กรัม", 0, 1),
(7, 4, 4, "ภาพวาดสีน้ำ \"ดอกคูนเมืองขอนแก่น\" พร้อมกรอบไม้สน (Original Watercolor Art)", "น้องณัฐพงษ์ใช้เวลา 2 สัปดาห์ในการวาดทัศนียภาพดอกคูนสีเหลืองอร่ามริมบึงแก่นนคร สีสันที่สดใสสะท้อนถึงความหวังและพลังใจที่เปี่ยมล้นของเยาวชนออทิสติก", "ภาพวาดสีน้ำต้นฉบับ (Original) บนกระดาษ Arches 300g ขนาด A4 เข้ากรอบไม้สนแท้พร้อมกระจกใสตัดแสง เหมาะสำหรับแขวนประดับห้องรับแขก", 1200, 3, "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80", NULL, "กรอบ 25 x 35 ซม.", "750 กรัม", 1, 1),
(8, 4, 4, "แก้วกาแฟเซรามิกแฮนด์เมด ลาย \"ท้องฟ้าแห่งรอยยิ้ม\" (Ceramic Hug Mug)", "แก้วกาแฟที่ปั้นขึ้นรูปด้วยมือและวาดลายท้องฟ้าหลากสีทีละใบโดยน้องๆ ในชมรมออทิสติก ทรงแก้วออกแบบให้อุ้มจับได้ถนัดมือ อบอุ่นหัวใจทุกครั้งที่จิบกาแฟ", "แก้วเซรามิกเคลือบเงา Food grade เข้าไมโครเวฟและเครื่องล้างจานได้ ความจุ 350 ml ลวดลายเอกลักษณ์เฉพาะตัวไม่ซ้ำกันในแต่ละใบ", 320, 20, "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80", "https://modelviewer.dev/shared-assets/models/glTF-Sample-Assets/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb", "สูง 9.5 ซม. ปากแก้ว 8.5 ซม.", "320 กรัม", 1, 1);

INSERT INTO `campaigns` (`id`, `title`, `description`, `location`, `start_date`, `end_date`, `event_type`, `image_url`, `is_active`) VALUES
(1, "มหกรรมนิทรรศการสินค้าฝีมือผู้พิการไทย 2569 (Inclusive Craft Expo 2026)", "งานแสดงและจำหน่ายสุดยอดผลิตภัณฑ์งานฝีมือจากช่างผู้พิการทั่วภาคอีสาน พบกับการสาธิตทอผ้าไหม งานจักสาน และการแสดงศิลปะสด ณ ขอนแก่น ฮอลล์ พร้อมบูธจำหน่ายทั้งหน้าร้านจริงและออนไลน์", "ขอนแก่น ฮอลล์ ชั้น 5 เซ็นทรัลพลาซา ขอนแก่น และช่องทางออนไลน์", "2026-09-15", "2026-09-20", "both", "https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80", 1),
(2, "โครงการปันน้ำใจ หนุนอาชีพช่างทอและงานสานสู่ตลาดสากล", "แคมเปญระดมทุนสนับสนุนและซื้อสินค้าล่วงหน้าเพื่อส่งเสริมกลุ่มอาชีพคนตาบอดและคนหูหนวก ให้มีอุปกรณ์เครื่องทอและวัตถุดิบคุณภาพสูง พร้อมรับของที่ระลึกรุ่นลิมิเต็ด", "แพลตฟอร์มตลาดกลางออนไลน์ (Online Campaign)", "2026-08-01", "2026-10-31", "online", "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800&auto=format&fit=crop&q=80", 1);

INSERT INTO `campaign_participants` (`campaign_id`, `store_id`, `status`, `booth_number`) VALUES
(1, 1, "approved", "A-01"),
(1, 2, "approved", "A-02"),
(1, 3, "approved", "B-05"),
(1, 4, "approved", "B-06"),
(2, 1, "approved", "Online-01"),
(2, 2, "approved", "Online-02");

INSERT INTO `reviews` (`id`, `product_id`, `buyer_id`, `rating`, `comment`, `seller_reply`, `seller_replied_at`, `status`) VALUES
(1, 1, 6, 5, "กระเป๋าสานได้แน่นและประณีตมากครับ ซับในผ้าฝ้ายตัดเย็บเรียบร้อย ทราบว่าผู้ผลิตเป็นผู้พิการทางสายตายิ่งทึ่งในความสามารถและตั้งใจ ภูมิใจมากที่ได้สนับสนุนครับ!", "ขอบพระคุณคุณอนุรักษ์เป็นอย่างยิ่งครับ กำลังใจนี้มีค่าต่อพวกเราทุกคนมากครับ", "2026-08-20 14:30:00", "approved"),
(2, 3, 7, 5, "ผ้าไหมมัดหมี่นุ่มมากกก สีย้อมครามสวยคลาสสิก ใส่ไปทำงานมีแต่คนชมว่างานประณีตมากๆ จะกลับมาอุดหนุนอีกแน่นอนค่ะ", "ทางร้านทอมือยินดีขอขอบคุณคุณกนกวรรณมากๆ นะคะ ยินดีให้บริการเสมอค่ะ", "2026-08-22 10:15:00", "approved"),
(3, 5, 6, 5, "ถาดไม้จามจุรีสวยงาม ผิวสัมผัสเนียนกริบ ไร้เสี้ยนไม้ งานฝีมือระดับพรีเมียมจริงๆ ครับ", "ขอบคุณครับคุณอนุรักษ์ ผมตั้งใจขัดทีละใบเพื่อให้ใช้งานได้ยาวนานที่สุดครับ", "2026-08-25 16:00:00", "approved"),
(4, 7, 7, 5, "ภาพวาดดอกคูนสีสันสดใส ให้พลังบวกดีมากๆ แขวนไว้ที่ห้องรับแขกแล้วบ้านดูอบอุ่นขึ้นทันที ขอเป็นกำลังใจให้น้องณัฐพงษ์สร้างผลงานดีๆ ต่อไปนะคะ", "คุณแม่และน้องณัฐพงษ์ขอขอบคุณสำหรับกำลังใจและคำชมมากๆ เลยนะคะ น้องดีใจมากค่ะ", "2026-08-28 11:45:00", "approved");

INSERT INTO `orders` (`id`, `buyer_id`, `store_id`, `subtotal`, `tip_amount`, `shipping_cost`, `grand_total`, `status`, `shipping_name`, `shipping_phone`, `shipping_address`, `payment_method`, `tracking_number`, `courier_name`, `notes`) VALUES
(1, 6, 1, 490, 100, 50, 640, "completed", "คุณอนุรักษ์ ส่งเสริมศิลป์", "081-333-7788", "123/45 ถนนมิตรภาพ ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000", "promptpay", "ED123456789TH", "ไปรษณีย์ไทย (EMS)", "ขอร่วมสนับสนุนกองทุนจัดซื้อเครื่องอบแห้งผักตบชวาด้วยครับ"),
(2, 7, 2, 850, 150, 50, 1050, "shipped", "คุณกนกวรรณ ปรีชาสุข", "089-777-9911", "88/9 ซอยสุขุมวิท 55 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110", "promptpay", "TH0192837465", "Flash Express", "แพ็คของขวัญให้ด้วยนะคะ ขอบคุณค่ะ");

INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `product_name`, `product_image`, `quantity`, `unit_price`, `subtotal`) VALUES
(1, 1, 1, "กระเป๋าสะพายผักตบชวาถักลายลูกแก้ว (Luksao Water Hyacinth Bag)", "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80", 1, 490, 490),
(2, 2, 3, "ผ้าพันคอไหมมัดหมี่ย้อมครามธรรมชาติ ลายขอเจ้าฟ้า", "https://images.unsplash.com/photo-1606744888344-493238955de0?w=800&auto=format&fit=crop&q=80", 1, 850, 850);

INSERT INTO `favorites` (`id`, `user_id`, `product_id`, `created_at`) VALUES
(1, 6, 1, "2026-08-20 15:00:00"),
(2, 6, 3, "2026-08-21 11:20:00"),
(3, 6, 5, "2026-08-22 09:15:00"),
(4, 7, 3, "2026-08-22 10:00:00"),
(5, 7, 7, "2026-08-23 14:30:00");

INSERT INTO `chat_messages` (`id`, `sender_id`, `receiver_id`, `store_id`, `sender_role`, `message`, `is_read`, `created_at`) VALUES
(1, 6, 2, 1, "buyer", "สวัสดีครับคุณสมชาย กระเป๋าสะพายผักตบชวารุ่นลายลูกแก้ว สามารถสั่งทำสายยาวพิเศษสำหรับสะพายข้างได้ไหมครับ", 1, "2026-08-19 10:00:00"),
(2, 2, 6, 1, "seller", "สวัสดีครับคุณอนุรักษ์ ทำได้แน่นอนครับ ทางกลุ่มเราปรับความยาวสายหนังให้ตามความต้องการได้เลยครับ สั่งผ่านระบบแล้วแจ้งในหมายเหตุได้เลยครับ", 1, "2026-08-19 10:15:00"),
(3, 7, 3, 2, "buyer", "สวัสดีค่ะคุณวิไลพร สอบถามผ้าพันคอไหมมัดหมี่ มีบริการห่อของขวัญพร้อมการ์ดอวยพรไหมคะ จะส่งให้คุณแม่ค่ะ", 1, "2026-08-21 09:30:00"),
(4, 3, 7, 2, "seller", "สวัสดีค่ะ มีบริการห่อกล่องของขวัญและแนบการ์ดเขียนข้อความให้ฟรีเลยค่ะ ระบุข้อความที่ต้องการในการสั่งซื้อได้เลยนะคะ", 1, "2026-08-21 09:45:00");

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;

