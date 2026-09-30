# พรอมป์สำหรับพัฒนาเว็บไซต์: ตลาดใจ (WEB06)

## ภาพรวมโครงงาน

พัฒนาเว็บแอปพลิเคชัน **"แพลตฟอร์มตลาดกลางออนไลน์สำหรับส่งเสริมการจำหน่ายสินค้าและสร้างรายได้ให้แก่ผู้พิการ"**
(Online Marketplace Platform for Products by Disabilities People)

**แนวคิดหลัก:** ผู้พิการเป็นเจ้าของร้านค้าและจัดการร้านด้วยตนเองโดยตรง (ไม่ผ่านมูลนิธิเป็นตัวแทน) เชื่อมกับผู้สนับสนุนผ่านระบบจับคู่แบบ "คนกับคน" โดยใช้สินค้าเป็นสื่อกลาง ไม่ใช่ปลายทาง โดยยึด **Web Accessibility ตามมาตรฐาน WCAG 2.1 ระดับ AA** เป็นแกนหลักของการออกแบบทั้งระบบ ไม่ใช่ฟีเจอร์เสริม

---

## เทคโนโลยีที่ใช้ (Tech Stack)

| ชั้น | เทคโนโลยี | เหตุผล |
|---|---|---|
| Front-end | HTML5, CSS3, JavaScript (Vanilla ไม่ใช้เฟรมเวิร์กหนัก) | ควบคุม Semantic HTML ให้ Screen Reader ทำงานแม่นยำ หลีกเลี่ยงปัญหา Focus Management ของ SPA |
| Back-end | Node.js + Express.js | REST API เรียบง่าย เหมาะกับขอบเขตโปรเจคระดับปริญญาตรี |
| Database | MySQL (Relational) | ธุรกรรมมีความสัมพันธ์ชัดเจนระหว่างผู้ใช้/ร้านค้า/สินค้า/คำสั่งซื้อ |
| AI สำหรับ Chatbot | Google Gemini API (รุ่น Flash) | รองรับภาษาไทยดี มี Vision ในตัว (อธิบายภาพสินค้าเป็นเสียง) มีฟรีเทียร์เหมาะงบนักศึกษา |
| AI สร้างโมเดล 3D | Meshy API (Image-to-3D) | รับรูปภาพสินค้า 1 รูปขึ้นไป สร้างโมเดล .glb อัตโนมัติ มีเครดิตฟรีให้ทดลอง |
| แสดงผลโมเดล 3D | `<model-viewer>` (Google Web Component) | หมุนดู/ซูม 360° ได้ในตัว ไม่ต้องเขียน WebXR เอง |
| เสียง | Web Speech API (เบราว์เซอร์, ฟรี) | Speech-to-Text และ Text-to-Speech สำหรับ Chatbot ผู้ช่วยการเข้าถึง |

**สถาปัตยกรรม:** 3-tier — Client (Browser) → Server (Node.js/Express) → Database (MySQL) + External API (Gemini, Meshy) เรียกผ่าน HTTPS จากฝั่ง Server เท่านั้น (เก็บ API Key ใน `.env` ห้ามเปิดเผยฝั่ง Client)

---

## โครงสร้างฐานข้อมูล (MySQL)

**หลักการสำคัญ:** แยกตารางผู้ใช้ตามบทบาทแบบ Class Table Inheritance — มี `USERS` เป็นตารางกลางสำหรับ Login เท่านั้น ส่วนข้อมูลเฉพาะบทบาทแยกไปตาราง `SELLERS` / `BUYERS` / `ADMINS` ที่ใช้ user_id เดิมเป็นทั้ง Primary Key และ Foreign Key (Shared Primary Key)

```
USERS            — user_id(PK), email, password_hash, name, phone, created_at
SELLERS          — seller_id(PK,FK→USERS), verified, bio_short
BUYERS           — buyer_id(PK,FK→USERS)
ADMINS           — admin_id(PK,FK→USERS), permission_level

SHOPS            — shop_id(PK), seller_id(FK→SELLERS), shop_name, story, verified
PRODUCTS         — product_id(PK), shop_id(FK), category_id(FK), name, price, stock, description
CATEGORIES       — category_id(PK), name
PRODUCT_IMAGES   — image_id(PK), product_id(FK), image_url, alt_text
PRODUCT_3D_MODELS— model_id(PK), product_id(FK), model_url(.glb), meshy_task_id, status, source_image_count

DISABILITY_TYPES     — type_id(PK), name
MATCHING_PREFERENCES — pref_id(PK), buyer_id(FK→BUYERS), type_id(FK), category_id(FK)

CART_ITEMS       — cart_id(PK), buyer_id(FK→BUYERS), product_id(FK), qty
ORDERS           — order_id(PK), buyer_id(FK→BUYERS), status, total, shipping_address
ORDER_ITEMS      — item_id(PK), order_id(FK), product_id(FK), qty, price
SHIPPING_TRACKING— tracking_id(PK), order_id(FK), carrier, tracking_number, status, last_updated
PAYMENTS         — payment_id(PK), order_id(FK), method, amount, status  (จำลอง Simulation เท่านั้น)

ADDRESSES        — address_id(PK), buyer_id(FK→BUYERS), label, address_detail, is_default
FAVORITES        — favorite_id(PK), buyer_id(FK→BUYERS), product_id(FK)
FOLLOWS          — follow_id(PK), buyer_id(FK→BUYERS), shop_id(FK)
REVIEWS          — review_id(PK), buyer_id(FK→BUYERS), product_id(FK), rating, comment
TIPS             — tip_id(PK), buyer_id(FK→BUYERS), shop_id(FK), amount
REPORTS          — report_id(PK), reporter_id(FK→USERS), target_type, target_id, reason, status
NOTIFICATIONS    — notification_id(PK), user_id(FK→USERS), message, is_read, created_at

CAMPAIGNS        — campaign_id(PK), name, location, event_date
CAMPAIGN_SHOPS   — campaign_id(FK), shop_id(FK)   -- ตารางเชื่อม many-to-many

ACCESSIBILITY_SETTINGS — setting_id(PK), user_id(FK→USERS), font_size, high_contrast, voice_mode
```

---

## ฟีเจอร์ตามบทบาทผู้ใช้ (Functional Requirements)

### ผู้ขาย (ผู้พิการ/ญาติ) — เจ้าของร้านค้า จัดการทุกอย่างด้วยตนเอง
- ลงทะเบียน/ยืนยันตัวตนเป็นผู้ขายด้วยตนเอง
- สร้าง/จัดการหน้าร้านค้า พร้อมเขียนเรื่องราว (Storytelling) บอกตัวตนและเป้าหมาย
- **อัปโหลดรูปภาพสินค้า → เรียก Meshy API สร้างโมเดล 3D อัตโนมัติ** → ให้ Gemini Vision อธิบายภาพกลับเป็นเสียงให้ผู้ขายยืนยัน (สำคัญมากสำหรับผู้ขายที่มองไม่เห็น)
- เพิ่ม/แก้ไข/ลบสินค้า, ตั้งเป้าหมายการสนับสนุน, ติดตามความคืบหน้า
- จัดการคำสั่งซื้อ/สถานะจัดส่ง, ดูสรุปยอดขาย/ทิป
- รับการแจ้งเตือนด้วยเสียงเมื่อมีคำสั่งซื้อใหม่/เงินเข้า (Push Notification ไม่ใช่แค่ aria-live)
- เข้าร่วมกิจกรรม/บูธ (Campaign)

### ผู้ซื้อ (ผู้สนับสนุน)
- ค้นหา/กรองสินค้า (หมวดหมู่ ราคา รีวิว)
- **ใช้ระบบจับคู่ (Matching System)** — จับคู่ตามความสนใจ/ประเภทความพิการที่อยากสนับสนุน (Content-based Filtering) → ได้ร้านค้า/บุคคล ไม่ใช่แค่รายการสินค้า
- อ่าน Storytelling ผู้ขาย + ดูโมเดลสินค้าแบบหมุน 360° **ก่อนตัดสินใจซื้อ**
- บันทึกรายการโปรด, ติดตามร้านค้า
- ตะกร้าสินค้า → สั่งซื้อ (จำลองชำระเงิน) → ให้ทิป → รีวิว
- ติดตามสถานะคำสั่งซื้อ/การขนส่ง
- **ใช้ Chatbot ผู้ช่วยการเข้าถึง (Accessibility Assistant)** — ดูรายละเอียดด้านล่าง
- ดู/เข้าร่วมกิจกรรม-บูธ

### ผู้ดูแลระบบ (Admin)
- อนุมัติยืนยันตัวตนร้านค้าใหม่
- จัดการผู้ใช้งาน/เนื้อหาที่ไม่เหมาะสม
- ตรวจสอบ/จัดการรีวิวสแปม
- จัดการข้อร้องเรียนระหว่างผู้ซื้อ-ผู้ขาย
- สร้าง/จัดการกิจกรรม-บูธ
- ดูสถิติภาพรวมแพลตฟอร์ม

---

## Chatbot ผู้ช่วยการเข้าถึง (Accessibility Assistant) — ฟีเจอร์แกนหลัก

**ห้ามออกแบบเป็น Chatbot ตอบคำถามสินค้าทั่วไป** (ซ้ำกับคู่แข่ง) — ต้องผูกกับ Accessibility ทั้ง 5 ด้านนี้เท่านั้น:

1. **ทางสายตา** — ทำงานร่วมกับ Screen Reader, ใช้ Gemini Vision อธิบายภาพสินค้าเป็นเสียงละเอียด (สี ลวดลาย ขนาดโดยประมาณ) ไม่ใช่แค่ alt text สั้น ๆ
2. **ทางการเคลื่อนไหว** — สั่งงานด้วยเสียง (Web Speech API), ปุ่มทุกจุดกดผ่านคีย์บอร์ดได้, autofill ฟอร์มจากคำพูด
3. **ทางสติปัญญา** — นำทางทีละขั้นตอน (Task Chunking) พร้อมบอกตำแหน่งเสมอ ("ขั้นตอนที่ 2 จาก 3") หนึ่งคำถามต่อหนึ่งข้อความ เสนอค่าเริ่มต้นที่เดาไว้ล่วงหน้า
4. **สายตาเลือนราง** — คอนทราสต์สูง (ผ่านเกณฑ์ WCAG AA: ข้อความปกติ ≥4.5:1, UI ≥3:1), ปรับขนาดตัวอักษรได้
5. **ทางการได้ยิน** — คำบรรยายแทนเสียง/วิดีโอ, สรุปเนื้อหาเสียงเป็นข้อความ

**หลักการสำคัญ:** ฟีเจอร์เสียง/โหมดพิเศษต้อง**เปิดเมื่อผู้ใช้สั่งเท่านั้น** ห้ามเล่นเสียงอัตโนมัติ (จะชนกับ Screen Reader ของผู้ใช้เอง) และ**ห้ามมีหน้าจอบังคับให้เลือกประเภทความพิการตอนเข้าเว็บ** — ฟีเจอร์พื้นฐาน (Semantic HTML, keyboard nav, contrast) ต้องทำงานถูกต้องอัตโนมัติสำหรับทุกคน ส่วนฟีเจอร์เสริมอยู่ใน **A11y Bar ที่แสดงถาวรทุกหน้า** ให้เปิด/ปิดเองได้ทุกเมื่อ และจดจำการตั้งค่าไว้ใน `ACCESSIBILITY_SETTINGS` เมื่อล็อกอิน

---

## ข้อกำหนดด้าน Web Accessibility (บังคับทุกหน้า)

- **Semantic HTML เท่านั้น** — `<nav>`, `<main>`, `<button>` จริง ห้ามใช้ `<div>` ทำหน้าที่แทน
- **Skip link** ข้ามไปเนื้อหาหลักที่ต้นทุกหน้า
- **Alt text ทุกรูปภาพ** สื่อความหมายจริง ไม่ใช่ชื่อไฟล์
- **Stretched-link pattern** สำหรับการ์ดสินค้า — ลิงก์อยู่ที่ชื่อสินค้า (`<h3><a>` + CSS `::after` ขยายพื้นที่คลิก) **ห้ามครอบทั้งการ์ดด้วย `<a>`** เพราะจะทำให้ปุ่มข้างในซ้อนกับลิงก์ (invalid HTML)
- **`aria-live="polite"`** ประกาศการเปลี่ยนแปลงสำคัญ (เพิ่มสินค้าลงตะกร้า, ผลค้นหา)
- **Focus indicator ชัดเจน** ห้าม `outline:none` ทิ้งไว้
- **Heading ระดับห้ามข้าม** (h1→h2→h3)
- **คอนทราสต์สี:** ข้อความปกติ ≥4.5:1, ข้อความใหญ่/UI ≥3:1 (ตรวจด้วย WebAIM Contrast Checker ก่อน deploy ทุกคู่สี)
- **ทดสอบด้วยเครื่องมือ:** WAVE, Lighthouse, axe DevTools + ทดสอบจริงกับ NVDA/VoiceOver

---

## จุดที่ตั้งใจให้ต่างจากคู่แข่ง (ห้ามลอกโครงสร้าง)

| ฟีเจอร์ | ทำแบบนี้ | ห้ามทำแบบนี้ |
|---|---|---|
| เจ้าของร้าน | ผู้พิการเป็นเจ้าของเอง | มูลนิธิเป็นตัวแทนขาย |
| Storytelling | แสดง**ก่อน**ตัดสินใจซื้อ ในหน้าโปรไฟล์ร้าน | แสดงหลังซื้อผ่าน AR/QR code |
| AR | หมุนดูโมเดลสินค้า 360° **ก่อนซื้อ** ผ่าน `<model-viewer>` | วิดีโอเล่าเรื่องราวหลังซื้อ |
| ระบบจับคู่ | จับคู่ **คนกับคน** ผ่านสินค้าเป็นสื่อกลาง | แนะนำสินค้าตามอารมณ์แบบ gift-finder |
| Chatbot | ผู้ช่วยการเข้าถึง 5 ด้าน | ตอบคำถามสินค้า/เช็คสถานะทั่วไป |

---

## ข้อจำกัดของโครงงาน (Out of Scope)

- ระบบชำระเงินเป็นการจำลอง (Simulation) เท่านั้น ยังไม่เชื่อมธนาคารจริง
- โมเดล 3D จากภาพมุมเดียวเป็นการประมาณผลของ AI ในส่วนที่มองไม่เห็น ต้องแสดงข้อความแจ้งผู้ซื้อให้ทราบ
- AR เป็นการหมุนดูผ่านหน้าจอ (`<model-viewer>`) เท่านั้น ยังไม่รองรับวางโมเดลในพื้นที่จริงผ่านกล้อง (Spatial AR)
- ยังไม่พัฒนาเป็น Native Mobile App เฉพาะ (ใช้ Responsive Web แทน)

---

## คำสั่งสำหรับเครื่องมือพัฒนา

เมื่อเริ่มพัฒนา ให้ยึดพรอมป์นี้เป็นแหล่งความจริงหลัก (source of truth) และ:
1. เริ่มจาก schema ฐานข้อมูลข้างต้นก่อน (สร้าง migration/SQL)
2. พัฒนา Backend REST API ตาม endpoint ที่สอดคล้องกับตาราง
3. พัฒนา Front-end โดยตรวจสอบ Accessibility checklist ข้างต้นทุกหน้าที่สร้าง ก่อนถือว่าหน้านั้นเสร็จ
4. เชื่อม Gemini API และ Meshy API ผ่าน Server เท่านั้น ห้ามเรียกจาก Client โดยตรง