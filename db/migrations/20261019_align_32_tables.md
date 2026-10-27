# ตารางเทียบชื่อ: แบบ 32 ตารางในรายงาน ↔ ฐานข้อมูลจริง (MariaDB `inclusive_marketplace`)

ใช้ปรับ Data Dictionary ในเล่ม ปรับโครงสร้างด้วย `db/migrations/20261019_align_32_tables.sql`

## หลักทั่วไป (ใช้กับทุกตารางเดิม)
- **คีย์หลัก:** ตารางเดิมใช้ชื่อ `id` แทนชื่อในรายงาน เช่น `users.id` = `user_id`, `stores.id` = `store_id`, `products.id` = `product_id`
  - ตารางใหม่ 7 ตารางใช้ชื่อตามรายงาน
- **คีย์นอก:** ชื่อคอลัมน์ตรงกับรายงาน เช่น `store_id`, `buyer_id` แต่ชี้ไปที่ `id` ของตารางแม่
- **ชื่อตาราง:** ในฐานข้อมูลเป็นตัวพิมพ์เล็กพหูพจน์ เช่น `Users` = `users`
- **BOOLEAN:** MySQL/MariaDB เก็บเป็น `TINYINT(1)`
- **คอลัมน์ที่มีเพิ่มจากรายงาน:** เช่น `created_at`, `phone`, `avatar_url` ไม่ได้ลบ และไม่จำเป็นต้องใส่ในเล่ม

## ตารางเทียบชื่อตาราง

| # | รายงาน | ฐานข้อมูลจริง | หมายเหตุ |
|---|---|---|---|
| 1 | Users | `users` | |
| 2 | Addresses | `addresses` | |
| 3 | Accessibility_Settings | `accessibility_settings` | ใหม่ |
| 4 | Stores | `stores` | |
| 5 | Store_Verifications | `store_verifications` | ใหม่ ส่วนไฟล์เอกสารอยู่ใน `store_documents` |
| 6 | Store_Stories | `store_videos` | ร้านละ 1 วิดีโอ (UNIQUE store_id) |
| 7 | Support_Goals | `support_goals` | ใหม่ ข้อมูลเดิมยังอยู่ที่ `stores.support_goal_*` และ trigger sync ให้ |
| 8 | Follows | `follows` | |
| 9 | Tips | `tips` | มี `order_id` เพิ่ม (ทิปที่จ่ายพร้อมคำสั่งซื้อ) |
| 10 | Products | `products` | |
| 11 | Product_Images | `product_images` | |
| 12 | Product_3D_Models | `product_3d_models` | |
| 13 | Categories | `categories` | |
| 14 | Disability_Types | `disability_types` | มี `code` เพิ่ม (visual, hearing, physical, intellectual, organization) |
| 15 | Matching_Preferences | `matching_preferences` | |
| 16 | Favorites | `favorites` | |
| 17 | Cart_Items | `cart_items` | |
| 18 | Orders | `orders` | 1 คำสั่งซื้อต่อ 1 ร้าน (มี `store_id`) |
| 19 | Order_Items | `order_items` | |
| 20 | Order_Status_History | `order_status_history` | ใหม่ |
| 21 | Payments | `payments` | |
| 22 | Shipping_Tracking | `shipping_tracking` | |
| 23 | Reviews | `reviews` | |
| 24 | Complaints | `complaints` | การรายงานเนื้อหา (สินค้า/รีวิว) แยกอยู่ใน `reports` |
| 25 | Chat_Room | `chat_rooms` | ใหม่ |
| 26 | Messages | `chat_messages` | |
| 27 | Bot_Sessions | `bot_sessions` | ใหม่ |
| 28 | Bot_Messages | `bot_messages` | ใหม่ |
| 29 | Campaigns | `campaigns` | |
| 30 | Campaign_Shops | `campaign_participants` | |
| 31 | Notifications | `notifications` | |
| 32 | Search_History | `search_history` | |

**ตารางที่มีจริงแต่ไม่อยู่ในรายงาน:**
- `login_history` (ประวัติการเข้าสู่ระบบ)
- `chatbot_logs` (log แชทบอทแบบเดิม ยังเขียนคู่กับ bot_*)
- `reports` (รายงานเนื้อหา)
- `store_documents` (ไฟล์เอกสารยืนยันตัวตน)

## ตารางเทียบชื่อคอลัมน์ (เฉพาะที่ต่างจากรายงาน)

| ตาราง (รายงาน) | คอลัมน์ในรายงาน | ชื่อจริง | หมายเหตุ |
|---|---|---|---|
| Users | name | `full_name` | |
| Users | password | `password_hash` | เก็บเป็น bcrypt hash |
| Users | role ENUM | `role` VARCHAR(20) + CHECK `chk_users_role` | ค่าได้แค่ buyer/seller/admin |
| Users | email VARCHAR(150) | `email` VARCHAR(191) | |
| Addresses | label VARCHAR(50) | `label` VARCHAR(100) | |
| Stores | verified BOOLEAN | `verified` | คอลัมน์คำนวณ (VIRTUAL) = `verification_status = 'approved'` |
| Stores | type_id | `type_id` | ค่าเดิมยังเก็บใน `disability_type` (code) และ trigger เติม `type_id` ให้ |
| Store_Stories | story_id | `store_videos.id` | |
| Store_Stories | caption_url | `captions_url` | |
| Store_Stories | created_at | `created_at` (TIMESTAMP) | |
| Support_Goals | target_amount CHECK > 0 | ตรงตามรายงาน | `chk_support_goals_target` |
| Products | status ENUM | `status` | คอลัมน์คำนวณ (VIRTUAL) จาก `is_active` ได้ 'active' หรือ 'inactive' |
| Products | name VARCHAR(150) | `name` VARCHAR(200) | |
| Product_Images | image_url VARCHAR(255) | `image_url` TEXT | |
| Product_3D_Models | model_url VARCHAR(255) | `model_url` TEXT | |
| Product_3D_Models | tripo_task_id | `tripo_task_id` | `meshy_task_id` เดิมยังอยู่ |
| Disability_Types | type_id | `id` | `name` UNIQUE แล้ว |
| Cart_Items | cart_id | `id` | |
| Orders | order_id / total | `id` / `grand_total` | `grand_total` = `subtotal + tip_amount + shipping_cost` |
| Orders | status DEFAULT 'pending_payment' | DEFAULT `'paid'` | ไม่ได้เปลี่ยน เพราะห้ามแก้ flow ชำระเงิน (Demo) |
| Order_Items | item_id / qty / price | `id` / `quantity` / `unit_price` | |
| Payments | method VARCHAR(30) | `method` VARCHAR(50) | |
| Complaints | complaint_id | `id` | |
| Complaints | resolution | `admin_reply` | |
| Complaints | target_type / target_id | ตรงตามรายงาน | ยังเป็น NULL ได้ เพราะเรื่องที่ไม่ผูกกับคำสั่งซื้อไม่มีเป้าหมาย |
| Complaints | (ไม่มี) | `category` | หมวดเรื่องร้องเรียนเดิม |
| Messages | message_id / content | `id` / `message` | |
| Messages | chat_id | `chat_id` | NULL ได้สำหรับข้อความระบบหรือแอดมินที่ไม่ใช่ห้องผู้ซื้อ–ร้าน |
| Bot_Sessions | (ไม่มี) | `client_session_key` | รหัส session ของเบราว์เซอร์ |
| Campaigns | campaign_id / name | `id` / `title` | |
| Campaigns | event_date | `start_date` | มี `end_date` เพิ่ม |
| Campaign_Shops | PK (campaign_id, store_id) | `id` + UNIQUE `uk_camp_part (campaign_id, store_id)` | |
| Notifications | link_url | `link` | |
| Notifications | message NOT NULL | `message` NULL ได้ | |
| Search_History | keyword / searched_at | `query` / `created_at` | |
| Search_History | (ไม่มี) | `source` | หน้าที่ค้นหา: navbar, products หรือ stores |

## กฎ Foreign Key ที่ใช้จริง
- **CASCADE:**
  - addresses, accessibility_settings, favorites, cart_items, follows
  - product_images, product_3d_models, chat_messages (→ chat_rooms), bot_messages, campaign_participants
- **RESTRICT:** orders, order_items, payments, tips (buyer/store) และ reviews
- **SET NULL:**
  - store_verifications.reviewed_by, complaints.admin_id
  - search_history.user_id, bot_sessions.user_id, tips.order_id
- **Index:** มีครบทุก FK (ตรวจจาก information_schema แล้ว ไม่มี FK ที่ไม่มี index)
