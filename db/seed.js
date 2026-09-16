const bcrypt = require('bcryptjs');

async function getSeedData() {
    const passwordHash = await bcrypt.hash('password123', 10);
    const adminPasswordHash = await bcrypt.hash('admin123', 10);

    return {
        users: [
            {
                id: 1,
                email: 'admin@inclusive-market.org',
                password_hash: adminPasswordHash,
                full_name: 'ผู้ดูแลระบบกลาง (Admin)',
                phone: '081-999-0000',
                role: 'admin',
                avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
                bio: 'ผู้ดูแลระบบแพลตฟอร์มตลาดกลางออนไลน์เพื่อผู้พิการ'
            },
            {
                id: 2,
                email: 'somchai.blindcraft@gmail.com',
                password_hash: passwordHash,
                full_name: 'คุณสมชาย ทัศนีย์ (ครูช่างจักสานสายตา)',
                phone: '089-123-4567',
                role: 'seller',
                avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
                bio: 'ช่างหัตถกรรมจักสานผักตบชวาและไม้ไผ่ ผู้บกพร่องทางการมองเห็น'
            },
            {
                id: 3,
                email: 'wilai.deafcraft@gmail.com',
                password_hash: passwordHash,
                full_name: 'คุณวิไลพร สุขเกษม (ร้านผ้าทอมือและขนมหวาน)',
                phone: '086-555-8899',
                role: 'seller',
                avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
                bio: 'ช่างทอผ้าไหมมัดหมี่ลายโบราณและทำขนมไทย ผู้บกพร่องทางการได้ยิน'
            },
            {
                id: 4,
                email: 'ekkachai.woodart@gmail.com',
                password_hash: passwordHash,
                full_name: 'คุณเอกชัย ศิลป์ประดิษฐ์ (งานไม้และเครื่องหนัง)',
                phone: '082-444-1122',
                role: 'seller',
                avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
                bio: 'งานแกะสลักไม้จามจุรีและเครื่องหนังทำมือ ผู้บกพร่องทางการเคลื่อนไหว (วีลแชร์)'
            },
            {
                id: 5,
                email: 'nattapong.artheart@gmail.com',
                password_hash: passwordHash,
                full_name: 'น้องณัฐพงษ์ ใจสร้างสรรค์ (ภาพวาดสีน้ำ & เซรามิก)',
                phone: '085-777-3344',
                role: 'seller',
                avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
                bio: 'ศิลปินออทิสติกผู้ถ่ายทอดความสุขผ่านภาพวาดสีน้ำและงานปั้นเซรามิก'
            },
            {
                id: 6,
                email: 'buyer.anurak@gmail.com',
                password_hash: passwordHash,
                full_name: 'คุณอนุรักษ์ ส่งเสริมศิลป์',
                phone: '081-333-7788',
                role: 'buyer',
                avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&auto=format&fit=crop&q=80',
                bio: 'ผู้สนับสนุนงานฝีมือไทยและสินค้าเพื่อสังคม'
            },
            {
                id: 7,
                email: 'buyer.kanokwan@gmail.com',
                password_hash: passwordHash,
                full_name: 'คุณกนกวรรณ ปรีชาสุข',
                phone: '089-777-9911',
                role: 'buyer',
                avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
                bio: 'ชื่นชอบงานตกแต่งบ้าน eco-friendly และผ้าไทย'
            }
        ],
        stores: [
            {
                id: 1,
                user_id: 2,
                store_name: 'แสงสว่างจักสาน (Light & Craft Basketry)',
                disability_type: 'visual',
                story: 'เกิดจากกลุ่มช่างจักสานผู้บกพร่องทางการมองเห็น ที่รวมตัวกันเรียนรู้การสัมผัสเส้นใยผักตบชวาและไม้ไผ่ด้วยปลายนิ้ว การสานแต่ละเส้นใช้สมาธิและความจำของกล้ามเนื้อมือเพื่อให้ได้ลวดลายที่แน่นหนา ประณีต และแข็งแรง สินค้าทุกชิ้นไม่เพียงแต่เป็นของใช้ แต่คือแสงสว่างและกำลังใจในการพึ่งพาตนเองอย่างภาคภูมิใจ',
                craft_technique: 'การจักสานด้วยเทคนิคการจำผังลายด้วยสัมผัสปลายนิ้ว เคลือบด้วยสารสกัดธรรมชาติกันมอดและรา',
                support_goal_title: 'ระดมทุนจัดซื้อเครื่องอบแห้งผักตบชวาพลังงานแสงอาทิตย์สำหรับศูนย์ฝึกอาชีพคนตาบอด',
                support_goal_target: 25000.00,
                support_goal_current: 18450.00,
                verification_status: 'approved',
                phone: '089-123-4567',
                province: 'ขอนแก่น',
                address: 'ศูนย์ฝึกอาชีพและโรงเรียนการศึกษาคนตาบอด ขอนแก่น ถ.มะลิวัลย์ ต.บ้านเป็ด อ.เมือง จ.ขอนแก่น',
                avatar_image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
                cover_image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=800&auto=format&fit=crop&q=80'
            },
            {
                id: 2,
                user_id: 3,
                store_name: 'ทอมือยินดี (Deaf Silk & Sweet Delight)',
                disability_type: 'hearing',
                story: 'พวกเราคือกลุ่มแม่บ้านและเยาวชนผู้บกพร่องทางการได้ยิน ภาษาของเราคือภาษามือและลวดลายบนผืนผ้าไหมมัดหมี่ ทุกเส้นไหมถูกย้อมด้วยสีธรรมชาติจากใบไม้และเปลือกไม้ในท้องถิ่นขอนแก่น นอกจากงานผ้าทอแล้ว เรายังทำขนมไทยทองเอกและกลีบลำดวนอบควันเทียนสูตรโบราณ เพื่อถ่ายทอดความหวานละมุนแทนคำพูด',
                craft_technique: 'ผ้าไหมมัดหมี่ลายโบราณ 6 ตะกอ ย้อมสีธรรมชาติ และขนมไทยโบราณสูตรใช้น้ำตาลโตนดแท้',
                support_goal_title: 'จัดซื้อกี่กระตุกทอผ้าขนาดใหญ่ 4 เครื่อง เพื่อขยายกลุ่มฝึกอาชีพคนหูหนวก',
                support_goal_target: 30000.00,
                support_goal_current: 24200.00,
                verification_status: 'approved',
                phone: '086-555-8899',
                province: 'ขอนแก่น',
                address: 'สมาคมพัฒนาศักยภาพคนหูหนวกและหูตึงจังหวัดขอนแก่น อ.เมือง จ.ขอนแก่น',
                avatar_image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
                cover_image: 'https://images.unsplash.com/photo-1606744888344-493238955de0?w=800&auto=format&fit=crop&q=80'
            },
            {
                id: 3,
                user_id: 4,
                store_name: 'เอกชัยศิลป์ไม้ & หนังแท้ (Wheelchair Woodcraft)',
                disability_type: 'physical',
                story: 'หลังจากประสบอุบัติเหตุทำให้ต้องใช้วีลแชร์ ผมไม่ยอมแพ้และเปลี่ยนพื้นที่โรงรถให้กลายเป็นสตูดิองานไม้และเครื่องหนัง ผมออกแบบโต๊ะทำงานระดับวีลแชร์และใช้สิ่วแกะสลักไม้จามจุรีชิ้นต่อชิ้น งานหนังแท้ทุกใบเย็บด้วยมือแบบ Saddle Stitch สองเข็ม แข็งแรงทนทานใช้งานได้นับสิบปี',
                craft_technique: 'งานแกะสลักไม้ตันชิ้นเดียว ขัดผิวเนียน และการเย็บหนังฟอกฝาดด้วยมือไร้รอยต่อจักร',
                support_goal_title: 'ปรับปรุงโต๊ะทำงานระบบไฮดรอลิกสำหรับช่างฝีมือผู้ใช้วีลแชร์ในชุมชน',
                support_goal_target: 20000.00,
                support_goal_current: 15300.00,
                verification_status: 'approved',
                phone: '082-444-1122',
                province: 'ขอนแก่น',
                address: 'ศูนย์พัฒนาศักยภาพและอาชีพคนพิการ จังหวัดขอนแก่น ต.ศิลา อ.เมือง จ.ขอนแก่น',
                avatar_image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
                cover_image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80'
            },
            {
                id: 4,
                user_id: 5,
                store_name: 'โลกสดใสด้วยใจศิลป์ (Autism Heart Art)',
                disability_type: 'intellectual',
                story: 'น้องณัฐพงษ์เป็นเยาวชนออทิสติกที่มีพรสวรรค์ด้านมิติสัมพันธ์และการผสมสี ศิลปะคือสะพานเชื่อมที่ทำให้น้องสื่อสารความสุขและจินตนาการสู่โลกภายนอก ภาพวาดและแก้วกาแฟเซรามิกทุกใบถูกแต้มด้วยลวดลายแห่งความสุขและพลังบวก รายได้ทั้งหมดช่วยเสริมสร้างพัฒนาการและการศึกษาต่อเนื่อง',
                craft_technique: 'ภาพวาดสีน้ำบนกระดาษคอตตอน 300 แกรม และเซรามิกเคลือบใสเผาอุณหภูมิ 1200 องศาเซลเซียส',
                support_goal_title: 'จัดหาอุปกรณ์สีน้ำนำเข้าและเตาเผาเซรามิกไฟฟ้าขนาดเล็กสำหรับเยาวชนออทิสติก',
                support_goal_target: 18000.00,
                support_goal_current: 12800.00,
                verification_status: 'approved',
                phone: '085-777-3344',
                province: 'ขอนแก่น',
                address: 'ชมรมผู้ปกครองบุคคลออทิสติก จ.ขอนแก่น ต.ในเมือง อ.เมือง จ.ขอนแก่น',
                avatar_image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
                cover_image: 'https://images.unsplash.com/photo-1460661419200-fd4358377982?w=800&auto=format&fit=crop&q=80'
            }
        ],
        categories: [
            { id: 1, name: 'งานจักสานและหัตถกรรมพื้นบ้าน', description: 'กระเป๋า ตะกร้า ของใช้สานผักตบชวาและไม้ไผ่ประณีต', icon: '🧺' },
            { id: 2, name: 'ผ้าทอมือและเครื่องแต่งกาย', description: 'ผ้าไหมมัดหมี่ ผ้าฝ้ายย้อมคราม และเสื้อผ้าตัดเย็บมือ', icon: '🧵' },
            { id: 3, name: 'งานไม้และเครื่องหนังทำมือ', description: 'ของแต่งบ้าน จานชามไม้ กระเป๋าหนังแท้เย็บมือ', icon: '🪵' },
            { id: 4, name: 'ศิลปะ ภาพวาด และเซรามิก', description: 'ภาพวาดสีน้ำ งานปั้น แก้วเซรามิก และของที่ระลึกสร้างสรรค์', icon: '🎨' },
            { id: 5, name: 'อาหาร ขนมไทย และเกษตรแปรรูป', description: 'ขนมไทยโบราณ ชาสมุนไพรอินทรีย์ ผลไม้อบแห้งเพื่อสุขภาพ', icon: '🍯' }
        ],
        products: [
            {
                id: 1,
                store_id: 1,
                category_id: 1,
                name: 'กระเป๋าสะพายผักตบชวาถักลายลูกแก้ว (Luksao Water Hyacinth Bag)',
                story: 'กระเป๋าใบนี้ถักทอด้วยมือจากผู้บกพร่องทางการมองเห็น 3 ท่านที่ใช้เวลาสัมผัสเส้นใยผักตบชวาคัดเกรดอย่างละเอียด ทุกข้อต่อผูกแน่นด้วยเทคนิคลายลูกแก้วโบราณ แข็งแรงทนทาน ซับในด้วยผ้าฝ้ายทอมือสีครีมธรรมชาติ',
                description: 'กระเป๋าสะพายข้างทำจากผักตบชวาตากแห้งธรรมชาติ เคลือบน้ำยากันชื้นและกันรา ปลอดภัยต่อสิ่งแวดล้อม มาพร้อมสายสะพายหนังแท้และกระดุมกะลามะพร้าว',
                price: 490.00,
                stock: 15,
                image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
                model_3d_url: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
                dimensions: '22 x 18 x 8 ซม.',
                weight: '350 กรัม',
                is_featured: 1,
                is_active: 1
            },
            {
                id: 2,
                store_id: 1,
                category_id: 1,
                name: 'ชุดจานรองแก้วและถาดจัดโต๊ะสานไม้ไผ่ (Set of 4 Bamboo Coasters)',
                story: 'ผลงานการสานไม้ไผ่เส้นละเอียดโดยครูช่างตาบอด ผู้ใช้ฝีมือสัมผัสความเรียบเนียนของไม้ไผ่ทุกเส้นเพื่อเรียงร้อยเป็นลวดลายเรขาคณิตที่ร่วมสมัย',
                description: 'ชุดจานรองแก้วไม้ไผ่สาน 4 ชิ้นพร้อมถาดวางทรงกลม ทนความร้อน ซับหยดน้ำได้ดี เหมาะสำหรับตกแต่งโต๊ะอาหารและโต๊ะทำงาน',
                price: 250.00,
                stock: 25,
                image_url: 'https://images.unsplash.com/photo-1615865417491-9941019fbc00?w=800&auto=format&fit=crop&q=80',
                model_3d_url: null,
                dimensions: 'เส้นผ่านศูนย์กลาง 10 ซม.',
                weight: '150 กรัม',
                is_featured: 0,
                is_active: 1
            },
            {
                id: 3,
                store_id: 2,
                category_id: 2,
                name: 'ผ้าพันคอไหมมัดหมี่ย้อมครามธรรมชาติ ลายขอเจ้าฟ้า',
                story: 'ทอขึ้นจากกี่ทอมือโบราณโดยช่างทอผ้าผู้บกพร่องทางการได้ยิน การนับเส้นไหมแต่ละรอบต้องใช้สายตาและความตั้งใจอย่างสูง ลายขอเจ้าฟ้าสื่อถึงความก้าวหน้าและความมงคล ย้อมด้วยครามธรรมชาติ 100%',
                description: 'ผ้าพันคอผ้าไหมแท้ 100% ลวดลายมัดหมี่ขอนแก่น ย้อมด้วยสีธรรมชาติ ให้สัมผัสนุ่ม อบอุ่นในฤดูหนาวและเย็นสบายในฤดูร้อน ขนาด 50 x 180 ซม.',
                price: 850.00,
                stock: 8,
                image_url: 'https://images.unsplash.com/photo-1606744888344-493238955de0?w=800&auto=format&fit=crop&q=80',
                model_3d_url: 'https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb',
                dimensions: '50 x 180 ซม.',
                weight: '120 กรัม',
                is_featured: 1,
                is_active: 1
            },
            {
                id: 4,
                store_id: 2,
                category_id: 5,
                name: 'ขนมกลีบลำดวนอบควันเทียนสูตรโบราณ (กล่องของขวัญ 24 ชิ้น)',
                story: 'ขนมไทยโบราณที่ผลิตโดยสมาชิกผู้บกพร่องทางการได้ยิน ปั้นด้วยมือชิ้นต่อชิ้นอย่างใจเย็น อบควันเทียนหอมดอกมะลิแท้ค้างคืน ให้รสชาติละมุนละลายในปาก',
                description: 'ขนมกลีบลำดวนสูตรต้นตำรับ ใช้น้ำตาลโตนดเกรดพรีเมียมและแป้งอบพิเศษ ไม่ใส่สารกันบูด บรรจุในกล่องกระดาษคราฟท์สวยงามพร้อมมอบเป็นของขวัญ',
                price: 180.00,
                stock: 30,
                image_url: 'https://images.unsplash.com/photo-1579372786545-d24232daf58c?w=800&auto=format&fit=crop&q=80',
                model_3d_url: null,
                dimensions: 'กล่อง 15 x 20 ซม.',
                weight: '300 กรัม',
                is_featured: 0,
                is_active: 1
            },
            {
                id: 5,
                store_id: 3,
                category_id: 3,
                name: 'ถาดไม้จามจุรีทรงรีแกะสลักมือ (Hand-carved Acacia Tray)',
                story: 'ช่างเอกชัยแกะสลักถาดนี้จากท่อนไม้จามจุรีแท้บนเก้าอี้รถเข็น โดยคัดสรรลายไม้ธรรมชาติที่โค้งมน ผิวสัมผัสถูกขัดด้วยกระดาษทรายเบอร์ละเอียด 5 ระดับ และเคลือบด้วยขี้ผึ้งบริสุทธิ์เกรดสัมผัสอาหาร (Food grade)',
                description: 'ถาดเสิร์ฟไม้จามจุรีเนื้อแน่น แข็งแรง ทนทาน ลายไม้สวยงามไม่ซ้ำใคร เหมาะสำหรับเสิร์ฟกาแฟ ขนม หรือวางของตกแต่งบ้าน',
                price: 520.00,
                stock: 12,
                image_url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80',
                model_3d_url: 'https://modelviewer.dev/shared-assets/models/glTF-Sample-Assets/Models/SheenChair/glTF-Binary/SheenChair.glb',
                dimensions: '30 x 18 x 2.5 ซม.',
                weight: '600 กรัม',
                is_featured: 1,
                is_active: 1
            },
            {
                id: 6,
                store_id: 3,
                category_id: 3,
                name: 'กระเป๋าสตางค์หนังแท้ฟอกฝาดเย็บมือ (Hand-stitched Leather Wallet)',
                story: 'ผลิตจากหนังวัวฟอกฝาดนำเข้า ย้อมสีแทนธรรมชาติ เจาะรูและเย็บด้วยด้ายเทียนคู่ทีละเข็ม หนังจะมีความเงางามสวยขึ้นตามกาลเวลาและการใช้งาน',
                description: 'กระเป๋าสตางค์หนังแท้แบบพับสองตอน มีช่องใส่ธนบัตร 2 ช่อง ช่องใส่บัตร 6 ช่อง และช่องใส่เหรียญมีซิป YKK อย่างดี',
                price: 790.00,
                stock: 10,
                image_url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&auto=format&fit=crop&q=80',
                model_3d_url: null,
                dimensions: '11 x 9.5 x 2 ซม.',
                weight: '110 กรัม',
                is_featured: 0,
                is_active: 1
            },
            {
                id: 7,
                store_id: 4,
                category_id: 4,
                name: 'ภาพวาดสีน้ำ "ดอกคูนเมืองขอนแก่น" พร้อมกรอบไม้สน (Original Watercolor Art)',
                story: 'น้องณัฐพงษ์ใช้เวลา 2 สัปดาห์ในการวาดทัศนียภาพดอกคูนสีเหลืองอร่ามริมบึงแก่นนคร สีสันที่สดใสสะท้อนถึงความหวังและพลังใจที่เปี่ยมล้นของเยาวชนออทิสติก',
                description: 'ภาพวาดสีน้ำต้นฉบับ (Original) บนกระดาษ Arches 300g ขนาด A4 เข้ากรอบไม้สนแท้พร้อมกระจกใสตัดแสง เหมาะสำหรับแขวนประดับห้องรับแขก',
                price: 1200.00,
                stock: 3,
                image_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80',
                model_3d_url: null,
                dimensions: 'กรอบ 25 x 35 ซม.',
                weight: '750 กรัม',
                is_featured: 1,
                is_active: 1
            },
            {
                id: 8,
                store_id: 4,
                category_id: 4,
                name: 'แก้วกาแฟเซรามิกแฮนด์เมด ลาย "ท้องฟ้าแห่งรอยยิ้ม" (Ceramic Hug Mug)',
                story: 'แก้วกาแฟที่ปั้นขึ้นรูปด้วยมือและวาดลายท้องฟ้าหลากสีทีละใบโดยน้องๆ ในชมรมออทิสติก ทรงแก้วออกแบบให้อุ้มจับได้ถนัดมือ อบอุ่นหัวใจทุกครั้งที่จิบกาแฟ',
                description: 'แก้วเซรามิกเคลือบเงา Food grade เข้าไมโครเวฟและเครื่องล้างจานได้ ความจุ 350 ml ลวดลายเอกลักษณ์เฉพาะตัวไม่ซ้ำกันในแต่ละใบ',
                price: 320.00,
                stock: 20,
                image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80',
                model_3d_url: 'https://modelviewer.dev/shared-assets/models/glTF-Sample-Assets/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
                dimensions: 'สูง 9.5 ซม. ปากแก้ว 8.5 ซม.',
                weight: '320 กรัม',
                is_featured: 1,
                is_active: 1
            }
        ],
        campaigns: [
            {
                id: 1,
                title: 'มหกรรมนิทรรศการสินค้าฝีมือผู้พิการไทย 2569 (Inclusive Craft Expo 2026)',
                description: 'งานแสดงและจำหน่ายสุดยอดผลิตภัณฑ์งานฝีมือจากช่างผู้พิการทั่วภาคอีสาน พบกับการสาธิตทอผ้าไหม งานจักสาน และการแสดงศิลปะสด ณ ขอนแก่น ฮอลล์ พร้อมบูธจำหน่ายทั้งหน้าร้านจริงและออนไลน์',
                location: 'ขอนแก่น ฮอลล์ ชั้น 5 เซ็นทรัลพลาซา ขอนแก่น และช่องทางออนไลน์',
                start_date: '2026-09-15',
                end_date: '2026-09-20',
                event_type: 'both',
                image_url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80',
                is_active: 1
            },
            {
                id: 2,
                title: 'โครงการปันน้ำใจ หนุนอาชีพช่างทอและงานสานสู่ตลาดสากล',
                description: 'แคมเปญระดมทุนสนับสนุนและซื้อสินค้าล่วงหน้าเพื่อส่งเสริมกลุ่มอาชีพคนตาบอดและคนหูหนวก ให้มีอุปกรณ์เครื่องทอและวัตถุดิบคุณภาพสูง พร้อมรับของที่ระลึกรุ่นลิมิเต็ด',
                location: 'แพลตฟอร์มตลาดกลางออนไลน์ (Online Campaign)',
                start_date: '2026-08-01',
                end_date: '2026-10-31',
                event_type: 'online',
                image_url: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800&auto=format&fit=crop&q=80',
                is_active: 1
            }
        ],
        campaign_participants: [
            { campaign_id: 1, store_id: 1, status: 'approved', booth_number: 'A-01' },
            { campaign_id: 1, store_id: 2, status: 'approved', booth_number: 'A-02' },
            { campaign_id: 1, store_id: 3, status: 'approved', booth_number: 'B-05' },
            { campaign_id: 1, store_id: 4, status: 'approved', booth_number: 'B-06' },
            { campaign_id: 2, store_id: 1, status: 'approved', booth_number: 'Online-01' },
            { campaign_id: 2, store_id: 2, status: 'approved', booth_number: 'Online-02' }
        ],
        reviews: [
            {
                id: 1,
                product_id: 1,
                buyer_id: 6,
                rating: 5,
                comment: 'กระเป๋าสานได้แน่นและประณีตมากครับ ซับในผ้าฝ้ายตัดเย็บเรียบร้อย ทราบว่าผู้ผลิตเป็นผู้พิการทางสายตายิ่งทึ่งในความสามารถและตั้งใจ ภูมิใจมากที่ได้สนับสนุนครับ!',
                seller_reply: 'ขอบพระคุณคุณอนุรักษ์เป็นอย่างยิ่งครับ กำลังใจนี้มีค่าต่อพวกเราทุกคนมากครับ',
                seller_replied_at: '2026-08-20 14:30:00',
                status: 'approved'
            },
            {
                id: 2,
                product_id: 3,
                buyer_id: 7,
                rating: 5,
                comment: 'ผ้าไหมมัดหมี่นุ่มมากกก สีย้อมครามสวยคลาสสิก ใส่ไปทำงานมีแต่คนชมว่างานประณีตมากๆ จะกลับมาอุดหนุนอีกแน่นอนค่ะ',
                seller_reply: 'ทางร้านทอมือยินดีขอขอบคุณคุณกนกวรรณมากๆ นะคะ ยินดีให้บริการเสมอค่ะ',
                seller_replied_at: '2026-08-22 10:15:00',
                status: 'approved'
            },
            {
                id: 3,
                product_id: 5,
                buyer_id: 6,
                rating: 5,
                comment: 'ถาดไม้จามจุรีสวยงาม ผิวสัมผัสเนียนกริบ ไร้เสี้ยนไม้ งานฝีมือระดับพรีเมียมจริงๆ ครับ',
                seller_reply: 'ขอบคุณครับคุณอนุรักษ์ ผมตั้งใจขัดทีละใบเพื่อให้ใช้งานได้ยาวนานที่สุดครับ',
                seller_replied_at: '2026-08-25 16:00:00',
                status: 'approved'
            },
            {
                id: 4,
                product_id: 7,
                buyer_id: 7,
                rating: 5,
                comment: 'ภาพวาดดอกคูนสีสันสดใส ให้พลังบวกดีมากๆ แขวนไว้ที่ห้องรับแขกแล้วบ้านดูอบอุ่นขึ้นทันที ขอเป็นกำลังใจให้น้องณัฐพงษ์สร้างผลงานดีๆ ต่อไปนะคะ',
                seller_reply: 'คุณแม่และน้องณัฐพงษ์ขอขอบคุณสำหรับกำลังใจและคำชมมากๆ เลยนะคะ น้องดีใจมากค่ะ',
                seller_replied_at: '2026-08-28 11:45:00',
                status: 'approved'
            }
        ],
        orders: [
            {
                id: 1,
                buyer_id: 6,
                store_id: 1,
                subtotal: 490.00,
                tip_amount: 100.00,
                shipping_cost: 50.00,
                grand_total: 640.00,
                status: 'completed',
                shipping_name: 'คุณอนุรักษ์ ส่งเสริมศิลป์',
                shipping_phone: '081-333-7788',
                shipping_address: '123/45 ถนนมิตรภาพ ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000',
                payment_method: 'promptpay',
                tracking_number: 'ED123456789TH',
                courier_name: 'ไปรษณีย์ไทย (EMS)',
                notes: 'ขอร่วมสนับสนุนกองทุนจัดซื้อเครื่องอบแห้งผักตบชวาด้วยครับ'
            },
            {
                id: 2,
                buyer_id: 7,
                store_id: 2,
                subtotal: 850.00,
                tip_amount: 150.00,
                shipping_cost: 50.00,
                grand_total: 1050.00,
                status: 'shipped',
                shipping_name: 'คุณกนกวรรณ ปรีชาสุข',
                shipping_phone: '089-777-9911',
                shipping_address: '88/9 ซอยสุขุมวิท 55 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110',
                payment_method: 'promptpay',
                tracking_number: 'TH0192837465',
                courier_name: 'Flash Express',
                notes: 'แพ็คของขวัญให้ด้วยนะคะ ขอบคุณค่ะ'
            }
        ],
        order_items: [
            {
                id: 1,
                order_id: 1,
                product_id: 1,
                product_name: 'กระเป๋าสะพายผักตบชวาถักลายลูกแก้ว (Luksao Water Hyacinth Bag)',
                product_image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
                quantity: 1,
                unit_price: 490.00,
                subtotal: 490.00
            },
            {
                id: 2,
                order_id: 2,
                product_id: 3,
                product_name: 'ผ้าพันคอไหมมัดหมี่ย้อมครามธรรมชาติ ลายขอเจ้าฟ้า',
                product_image: 'https://images.unsplash.com/photo-1606744888344-493238955de0?w=800&auto=format&fit=crop&q=80',
                quantity: 1,
                unit_price: 850.00,
                subtotal: 850.00
            }
        ]
    };
}

module.exports = { getSeedData };
