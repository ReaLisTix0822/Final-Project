# แพลตฟอร์มตลาดกลางออนไลน์สำหรับส่งเสริมการจำหน่ายสินค้าและสร้างรายได้ให้แก่ผู้พิการ
## Inclusive Handicraft Marketplace for Disabilities People (IT 2569/WEB06)
**สาขาวิชาวิทยาการคอมพิวเตอร์ วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น**

---

### 🌟 ภาพรวมระบบ (Overview)
ระบบตลาดกลางออนไลน์สำหรับให้ผู้พิการนำสินค้าและผลิตภัณฑ์งานฝีมือมาจำหน่าย เพื่อส่งเสริมการสร้างรายได้และนำเสนอเรื่องราวคุณค่าของชิ้นงาน (Storytelling) ภายใต้มาตรฐานการเข้าถึง **WCAG 2.1 ระดับ AA** และการออกแบบเพื่อคนทั้งมวล (**Universal Design**)

---

### 🚀 สถาปัตยกรรมเทคโนโลยี (Tech Stack)
- **Front-end**: HTML5 Semantic, CSS3 / Universal Styles, Vanilla JavaScript
- **Back-end**: Node.js, Express.js REST API
- **Database**: MySQL (รองรับ DDL `schema.sql` และมี embedded storage สำรองอัตโนมัติ)
- **Assistive Technology**: Web Speech API (Text-to-Speech & Speech-to-Text Voice Commands), Google `<model-viewer>` (3D & AR 360°)

---

### ♿ การรองรับผู้พิการทั้ง 5 ประเภท (WCAG 2.1 AA)
1. **ผู้พิการทางสายตา (Visual Impairment)**: มีโครงสร้าง Semantic HTML, WAI-ARIA, และปุ่มกดอ่านออกเสียง (Text-to-Speech) ทุกจุด
2. **ผู้มีสายตาเลือนราง (Low Vision)**: ปุ่มขยายขนาดตัวอักษรไดนามิก และฟอนต์อ่านง่าย
3. **ผู้พิการทางการเคลื่อนไหว (Motor Impairment)**: ควบคุมผ่านคีย์บอร์ด 100% (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Alt+A`, `Alt+S`, `Alt+B`, `Alt+H`) และสั่งงานด้วยเสียง (Voice Command)
4. **ผู้พิการทางการได้ยิน (Hearing Impairment)**: ข้อความบรรยายและระบบแจ้งเตือนแบบภาพ (Visual notification)
5. **ผู้บกพร่องทางสติปัญญา / ออทิสติก (Cognitive/Intellectual)**: โหมดขั้นตอนย่อยเข้าใจง่าย (Easy Mode / Step-by-Step UI)

---

### 🔑 บัญชีทดสอบด่วน (Demo Accounts)
| บทบาท | อีเมล | รหัสผ่าน | จุดเด่น |
| :--- | :--- | :--- | :--- |
| **ผู้ดูแลระบบ (Admin)** | `admin@inclusive-market.org` | `admin123` | ตรวจสอบสถิติภาพรวม, อนุมัติร้านค้า, สร้างแคมเปญ |
| **ช่างฝีมือสายตา (Seller)** | `somchai.blindcraft@gmail.com` | `password123` | แสงสว่างจักสานผักตบชวา, เป้าหมายเครื่องอบแห้ง |
| **ช่างทอหูหนวก (Seller)** | `wilai.deafcraft@gmail.com` | `password123` | ผ้าไหมมัดหมี่และขนมไทยโบราณ |
| **ช่างไม้วีลแชร์ (Seller)** | `ekkachai.woodart@gmail.com` | `password123` | งานไม้จามจุรีและเครื่องหนังแท้เย็บมือ |
| **ศิลปินออทิสติก (Seller)** | `nattapong.artheart@gmail.com` | `password123` | ภาพวาดสีน้ำและแก้วเซรามิก |
| **ผู้ซื้อ/ผู้สนับสนุน (Buyer)** | `buyer.anurak@gmail.com` | `password123` | ค้นหาสินค้า, ระบบจับคู่, ให้ทิป, ตรวจสอบพัสดุ |

---

### 🛠️ วิธีการติดตั้งและเริ่มใช้งาน (Getting Started)
1. ติดตั้ง Dependencies:
   ```bash
   npm install
   ```
2. (ทางเลือก) กำหนดค่าฐานข้อมูล MySQL ในไฟล์ `.env`:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=inclusive_marketplace
   DB_PORT=3306
   ```
3. เริ่มต้นเซิร์ฟเวอร์:
   ```bash
   npm start
   ```
4. เปิดเบราว์เซอร์เข้าใช้งานที่: **`http://localhost:3000`**
>>>>>>> b346638 (Initial commit: Inclusive Marketplace platform with products and stores redesign)
