// ==============================================================================
// GEMINI FLASH API SERVICE (FREE TIER INTEGRATION)
// Powered by @google/genai & Google AI Studio (Model: gemini-2.5-flash)
// ==============================================================================

const { GoogleGenAI } = require('@google/genai');

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY || '';
        this.modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
        this.client = null;

        if (this.apiKey) {
            try {
                this.client = new GoogleGenAI({ apiKey: this.apiKey });
            } catch (err) {
                console.error('⚠️ [Gemini] Failed to initialize GoogleGenAI client:', err.message);
            }
        }
    }

    isConfigured() {
        return !!this.apiKey && !!this.client;
    }

    setApiKey(newKey) {
        this.apiKey = newKey;
        if (newKey) {
            this.client = new GoogleGenAI({ apiKey: newKey });
            return true;
        }
        this.client = null;
        return false;
    }

    /**
     * AI Assistant Chat (น้องใจดี)
     * Provides empathetic, accurate responses with live marketplace context
     */
    async chat({ message, history = [], marketplaceContext = {} }) {
        if (!this.isConfigured()) {
            return this.localFallbackChat(message, marketplaceContext);
        }

        try {
            const systemInstruction = `
คุณคือ "น้องใจดี" AI ผู้ช่วยประจำแพลตฟอร์ม "ตลาดใจ" (TaladJai) ซึ่งเป็นตลาดกลางออนไลน์สำหรับส่งเสริมการจำหน่ายสินค้าหัตถกรรมและสร้างรายได้ให้แก่ผู้พิการ (วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น IT 2569/WEB06)
บุคลิกภาพของคุณ: สุภาพ อบอุ่น ให้เกียรติผู้พิการ เข้าใจจิตใจ ให้กำลังใจ และกระตือรือร้นในการช่วยแนะนำผลงานของช่างฝีมือ

ข้อมูลบริบทปัจจุบันของแพลตฟอร์มตลาดใจ:
- มีช่างฝีมือ 4 กลุ่มหลัก:
  1. ช่างฝีมือสายตา (งานจักสานผักตบชวา ไม้ไผ่ ลายโบราณ เช่น ร้านพี่มล, กลุ่มจักสานบ้านโนนสูง)
  2. ช่างทอ & ขนมไทยผู้บกพร่องทางการได้ยิน (ผ้าไหมมัดหมี่ ขนมกลีบลำดวน เช่น ร้านกี่ทอมือแม่บัว, ร้านป้าวิไล)
  3. ช่างไม้วีลแชร์ & เครื่องหนัง (งานแกะสลักไม้จามจุรี กระเป๋าหนังฟอกฝาด เช่น ช่างเอกชัย)
  4. ศิลปินออทิสติกและกลุ่มพัฒนาการ (ภาพวาดสีน้ำ เซรามิก ลายท้องฟ้าแห่งรอยยิ้ม เช่น สตูดิโอดินเผาใจดี)
- จุดเด่นของเว็บ: รองรับการเข้าถึง WCAG 2.1 AA, มีตัวหมุนโมเดล 3 มิติ (3D/AR 360°), มีระบบเป้าหมายพัฒนาอาชีพ (Support Goal) ให้ผู้ซื้อสามารถเพิ่มเงินทิปสนับสนุนช่างฝีมือได้โดยตรง
- ข้อมูลสินค้าเด่นปัจจุบัน: ${JSON.stringify(marketplaceContext.featuredProducts || [])}

แนวทางการตอบ:
1. ตอบเป็นภาษาไทยที่สุภาพ เป็นมิตร และให้ข้อมูลที่เป็นประโยชน์
2. หากผู้ใช้ถามหาสินค้าหรือช่างฝีมือ ให้แนะนำสินค้าที่เกี่ยวข้องพร้อมบอกจุดเด่นและเรื่องราวของช่างฝีมือ
3. หากผู้ใช้ถามเรื่องการสั่งซื้อ ให้บอกขั้นตอนง่ายๆ หรือแนะนำให้ไปที่หน้า /matching.html หรือ /products.html
4. สรุปคำตอบให้กระชับ ชัดเจน และอ่านออกเสียงได้ง่ายสำหรับผู้ใช้ที่ใช้โปรแกรมอ่านหน้าจอ (Screen Reader)
`;

            const contents = [
                { role: 'user', parts: [{ text: `${systemInstruction}\n\nคำถามจากผู้ใช้งาน: ${message}` }] }
            ];

            // Append short history if available
            if (Array.isArray(history) && history.length > 0) {
                history.slice(-4).forEach(h => {
                    contents.push({
                        role: h.role === 'user' ? 'user' : 'model',
                        parts: [{ text: h.content || h.text || '' }]
                    });
                });
                contents.push({ role: 'user', parts: [{ text: message }] });
            }

            const response = await this.client.models.generateContent({
                model: this.modelName,
                contents: contents
            });

            return {
                reply: response.text,
                source: 'gemini_flash',
                model: this.modelName
            };
        } catch (err) {
            console.warn('⚠️ [Gemini API Error, using intelligent fallback]:', err.message);
            const fallback = this.localFallbackChat(message, marketplaceContext);
            fallback.note = `(ใช้ระบบคลังความรู้สำรองเนื่องจาก: ${err.message.includes('429') ? 'โควตาฟรีชั่วคราวเต็ม' : 'การเชื่อมต่อ API'})`;
            return fallback;
        }
    }

    /**
     * AI Storytelling Generator for Disabled Sellers
     * Helps disabled artisans turn rough notes/voice into heartfelt marketing stories
     */
    async generateStory({ artisanName, disabilityType, craftName, rawNotes, goalTitle }) {
        if (!this.isConfigured()) {
            return this.localFallbackStory(artisanName, craftName, rawNotes, goalTitle);
        }

        try {
            const prompt = `
คุณเป็นผู้เชี่ยวชาญด้านการเล่าเรื่อง (Storytelling) สำหรับสินค้าหัตถกรรมคนพิการ
ช่วยเขียนเรื่องราวและคำโปรยที่อบอุ่นและสร้างแรงบันดาลใจให้แก่ร้านค้าช่างฝีมือคนพิการ โดยไม่ใช้ถ้อยคำที่น่าสงสารเวทนา แต่เน้น "คุณค่า ความมุ่งมั่น และความประณีตของผลงาน"

ข้อมูลที่ได้รับจากช่างฝีมือ:
- ชื่อช่างฝีมือ / ร้าน: ${artisanName || 'ช่างฝีมือตลาดใจ'}
- กลุ่มความพิการ: ${disabilityType || 'ผู้สร้างสรรค์งานฝีมือ'}
- ประเภทงานหัตถกรรม: ${craftName || 'งานฝีมือแฮนด์เมด'}
- ข้อความดิบ / บันทึกย่อ: ${rawNotes || 'ตั้งใจทำด้วยมือทุกขั้นตอน'}
- เป้าหมายระดมทุนพัฒนาอาชีพ: ${goalTitle || 'จัดซื้ออุปกรณ์เพื่อประกอบอาชีพ'}

กรุณาสร้างผลลัพธ์เป็น JSON รูปแบบนี้:
{
  "quote": "คำคมสั้นๆ พาดหัวที่จับใจ (ไม่เกิน 15 คำ)",
  "tagline": "คำโปรยสั้นๆ ใต้ชื่อร้าน (ไม่เกิน 25 คำ)",
  "story_paragraph_1": "เนื้อเรื่องย่อหน้าที่ 1 เล่าถึงจุดเริ่มต้น ความรักในงานฝีมือ และเทคนิคเฉพาะตัว",
  "story_paragraph_2": "เนื้อเรื่องย่อหน้าที่ 2 เล่าถึงความตั้งใจ และการนำรายได้ไปสนับสนุนเป้าหมายพัฒนาอาชีพ",
  "recommended_craft_technique": "คำอธิบายเทคนิคการผลิตสั้นๆ"
}
ตอบเฉพาะ JSON เท่านั้น
`;

            const response = await this.client.models.generateContent({
                model: this.modelName,
                contents: prompt
            });

            let text = response.text.trim();
            if (text.startsWith('```json')) {
                text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (text.startsWith('```')) {
                text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            try {
                return JSON.parse(text);
            } catch (parseErr) {
                return {
                    quote: `“ทุกชิ้นงานสร้างสรรค์จากหัวใจและความมุ่งมั่นของ ${artisanName}”`,
                    tagline: `งานหัตถกรรมประณีต ส่งต่อความหมายและคุณค่าสู่มือคุณ`,
                    story_paragraph_1: response.text.substring(0, 300),
                    story_paragraph_2: `ทุกการสั่งซื้อเป็นกำลังใจสำคัญในการสนับสนุนเป้าหมาย: ${goalTitle || 'พัฒนาอาชีพช่างฝีมือ'}`,
                    recommended_craft_technique: 'งานฝีมือประณีตแฮนด์เมด 100%'
                };
            }
        } catch (err) {
            console.warn('⚠️ [Gemini Storytelling Error, using fallback]:', err.message);
            return this.localFallbackStory(artisanName, craftName, rawNotes, goalTitle);
        }
    }

    /**
     * Fallback Chat Engine (Zero latency, runs without API key)
     */
    localFallbackChat(message, context = {}) {
        const lower = message.toLowerCase();

        if (lower.includes('สินค้า') || lower.includes('แนะนำ') || lower.includes('ซื้ออะไรดี') || lower.includes('ขาย')) {
            return {
                reply: 'ยินดีแนะนำสินค้าครับ! ตอนนี้ในตลาดใจมีผลงานหัตถกรรมยอดนิยม เช่น "ตะกร้าสานไม้ไผ่ลายสองสี" ของร้านพี่มล (ช่างฝีมือสายตา), "ผ้าคลุมไหล่มัดหมี่" ของร้านกี่ทอมือแม่บัว, และ "แก้วเซรามิกแฮนด์เมด" ของสตูดิโอดินเผาใจดี (เยาวชนออทิสติก) คุณสามารถเข้าไปชมสินค้าพร้อมดูโมเดล 3D ได้ที่หน้ารวมสินค้า (/products.html) ได้เลยครับ',
                source: 'local_engine'
            };
        }

        if (lower.includes('จับคู่') || lower.includes('matching') || lower.includes('ค้นหา')) {
            return {
                reply: 'เรามีระบบ "จับคู่ผู้สนับสนุน" (Matching Wizard) ที่ตอบคำถามง่ายๆ เพียง 4 ข้อ เพื่อช่วยจับคู่ร้านค้าและสินค้าที่ตรงกับสิ่งที่คุณต้องการสนับสนุนมากที่สุด ลองเข้าไปทดสอบได้ที่หน้า /matching.html ได้เลยครับ!',
                source: 'local_engine'
            };
        }

        if (lower.includes('ทิป') || lower.includes('บริจาค') || lower.includes('สนับสนุน') || lower.includes('เป้าหมาย')) {
            return {
                reply: 'ในทุกคำสั่งซื้อหรือที่หน้ารายละเอียดร้านค้า คุณสามารถเพิ่มเงินทิปสนับสนุน (Support Tip) เพื่อร่วมสมทบทุน "เป้าหมายพัฒนาอาชีพ (Support Goal)" เช่น การจัดซื้อเครื่องอบแห้งผักตบชวา หรือกี่ทอผ้าใหม่ โดยเงินสนับสนุนจะส่งตรงถึงช่างฝีมือ 100% ครับ',
                source: 'local_engine'
            };
        }

        if (lower.includes('คนพิการ') || lower.includes('ช่าง') || lower.includes('ร้านค้า')) {
            return {
                reply: 'ตลาดใจรวบรวมร้านค้าช่างฝีมือผู้พิการ 4 กลุ่มหลัก ได้แก่ ผู้บกพร่องทางการเห็น, การได้ยิน, ทางการเคลื่อนไหว/วีลแชร์, และออทิสติก ทุกร้านผ่านการยืนยันตัวตน และคุณสามารถอ่านเรื่องราวความตั้งใจของแต่ละคนได้ที่หน้ารวมร้านค้า (/stores.html) ครับ',
                source: 'local_engine'
            };
        }

        return {
            reply: `สวัสดีครับ! น้องใจดีพร้อมช่วยเหลือและแนะนำสินค้างานฝีมือจากช่างผู้พิการในตลาดใจครับ คุณสามารถสอบถามเกี่ยวกับสินค้า เรื่องราวช่างฝีมือ วิธีการจับคู่ หรือการเข้าถึงเว็บไซต์ได้ตลอดเวลาเลยนะครับ 😊`,
            source: 'local_engine'
        };
    }

    /**
     * Fallback Story Generator
     */
    localFallbackStory(artisanName, craftName, rawNotes, goalTitle) {
        return {
            quote: `“ทุกฝีเข็มและทุกลวดลาย คือเสียงสะท้อนของความตั้งใจที่ไม่มีวันยอมแพ้”`,
            tagline: `${craftName || 'งานหัตถกรรมฝีมือประณีต'} โดย ${artisanName || 'ช่างฝีมือตลาดใจ'} รังสรรค์ด้วยความรักและประสบการณ์อันทรงคุณค่า`,
            story_paragraph_1: `${artisanName || 'ช่างฝีมือ'} ได้ถ่ายทอดความตั้งใจผ่าน${craftName || 'ชิ้นงานหัตถกรรม'} ${rawNotes ? `('${rawNotes}')` : ''} ทุกลวดลายถูกสร้างสรรค์ขึ้นด้วยความละเอียดประณีต โดยใช้ผัสสะและทักษะที่สั่งสมมาอย่างยาวนานเพื่อส่งต่อผลงานที่ดีที่สุด`,
            story_paragraph_2: `รายได้จากทุกชิ้นงานและทิปสนับสนุน จะถูกนำไปต่อยอดในการจัดซื้ออุปกรณ์คุณภาพสูงและสมทบทุนเป้าหมาย: "${goalTitle || 'จัดซื้ออุปกรณ์ประกอบอาชีพ'}" เพื่อสร้างรายได้ที่มั่นคงและยั่งยืนให้แก่ครอบครัวต่อไป`,
            recommended_craft_technique: 'งานฝีมือทำมือแบบดั้งเดิม ผสานความประณีตระดับคราฟต์ช่างฝีมือ'
        };
    }

    /**
     * AI Autofill Product Generator (Magic Product Assistant)
     * Analyzes image and/or seller prompt/voice notes to generate complete product listing
     */
    async autofillProduct({ imageUrl, prompt = '', sellerContext = {} }) {
        const artisanName = sellerContext.store_name || sellerContext.artisanName || 'ช่างฝีมือตลาดใจ';
        const disabilityType = sellerContext.disability_type || sellerContext.disabilityType || 'ผู้สร้างสรรค์งานฝีมือ';
        const storeCraft = sellerContext.craft_technique || sellerContext.craftTechnique || '';

        if (!this.isConfigured()) {
            return this.localFallbackAutofill({ imageUrl, prompt, sellerContext });
        }

        try {
            const fs = require('fs');
            const path = require('path');

            let imagePart = null;

            if (imageUrl) {
                // Check if local file in public/
                if (imageUrl.startsWith('/') || imageUrl.startsWith('public/')) {
                    const cleanPath = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
                    const fullPath = path.join(__dirname, '..', 'public', cleanPath.replace(/^public\//, ''));
                    if (fs.existsSync(fullPath)) {
                        const ext = path.extname(fullPath).toLowerCase();
                        let mimeType = 'image/jpeg';
                        if (ext === '.png') mimeType = 'image/png';
                        else if (ext === '.webp') mimeType = 'image/webp';
                        else if (ext === '.gif') mimeType = 'image/gif';

                        const data = fs.readFileSync(fullPath).toString('base64');
                        imagePart = {
                            inlineData: {
                                mimeType,
                                data
                            }
                        };
                    }
                } else if (imageUrl.startsWith('data:image/')) {
                    const match = imageUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
                    if (match) {
                        imagePart = {
                            inlineData: {
                                mimeType: match[1],
                                data: match[2]
                            }
                        };
                    }
                }
            }

            const promptInstructions = `
คุณคือ AI ผู้เชี่ยวชาญการลงรายการสินค้าหัตถกรรมไทยและการตลาดออนไลน์สำหรับช่างฝีมือคนพิการ บนแพลตฟอร์ม "ตลาดใจ" (TaladJai)
หน้าที่ของคุณคือช่วยช่างฝีมือสร้างข้อมูลสินค้าที่สมบูรณ์ ไพเราะ ทรงคุณค่า และพร้อมจำหน่ายทันทีจากรูปภาพ และ/หรือ บันทึก/คำสั่งเสียงสั้นๆ

ข้อมูลบริบทของร้านค้า:
- ชื่อร้าน/ช่างฝีมือ: ${artisanName}
- กลุ่มช่างฝีมือ/ความพิการ: ${disabilityType}
- เอกลักษณ์/เทคนิคประจำร้าน: ${storeCraft || 'งานแฮนด์เมดประณีต'}
- บันทึกเพิ่มเติมหรือคำสั่งเสียงจากผู้ขาย: ${prompt || 'ไม่มีข้อความเพิ่มเติม ให้วิเคราะห์จากรูปภาพหรือแนะนำงานฝีมือเด่น'}

หมวดหมู่สินค้าในระบบ มี 5 หมวดเท่านั้น (ต้องเลือก category_id เป็นตัวเลข 1-5):
1: งานจักสานและหัตถกรรม (เช่น กระเป๋าผักตบชวา, ตะกร้าไม้ไผ่, ชะลอม, เสื่อกระจูด)
2: ผ้าทอมือและเครื่องแต่งกาย (เช่น ผ้าไหมมัดหมี่, ผ้าคลุมไหล่ย้อมคราม, เสื้อผ้าฝ้ายทอมือ)
3: งานไม้และเครื่องหนัง (เช่น งานแกะสลักไม้จามจุรี, กล่องไม้สัก, กระเป๋าหนังแท้ทำมือ)
4: ศิลปะ ภาพวาด และเซรามิก (เช่น จานชามดินเผา, แก้วเซรามิก, ภาพวาดสีน้ำ, โคมไฟเซรามิก)
5: อาหาร ขนมไทย และเกษตรแปรรูป (เช่น ขนมกลีบลำดวน, มะม่วงกวน, ข้าวเกรียบ, ชาสมุนไพร)

กรุณาตอบเป็น JSON ในรูปแบบนี้เท่านั้น (ห้ามใส่คำนำหน้าหรือคำลงท้ายนอกเหนือจาก JSON):
{
  "name": "ชื่อสินค้าทางการที่ไพเราะ ชัดเจน ระบุรูปทรง/ลวดลาย/วัสดุ (ไม่เกิน 50 ตัวอักษร)",
  "category_id": 1,
  "category_name": "หมวดหมู่ที่ตรงที่สุดจาก 5 หมวดด้านบน",
  "price": 490,
  "stock": 10,
  "dimensions": "ขนาดโดยประมาณ เช่น กว้าง 15 x ยาว 25 x สูง 20 ซม.",
  "story": "เรื่องราวและความเป็นมาของชิ้นงาน (Storytelling) 2 ย่อหน้า เน้นความประณีต ความรักในงานฝีมือ และแรงบันดาลใจอันทรงคุณค่า",
  "description": "คำอธิบายสินค้าอย่างละเอียด ระบุวัสดุธรรมชาติที่ใช้ เอกลักษณ์ชิ้นงาน ประโยชน์การใช้งาน และคำแนะนำการดูแลรักษา",
  "craft_technique": "เทคนิคการผลิตเฉพาะตัวสั้นๆ เช่น ถักลายลูกแก้วโบราณ, ย้อมครามธรรมชาติ 4 รอบ",
  "suggested_tags": ["คำค้นหา1", "คำค้นหา2", "คำค้นหา3"]
}
`;

            const parts = [{ text: promptInstructions }];
            if (imagePart) {
                parts.push(imagePart);
            }

            const response = await this.client.models.generateContent({
                model: this.modelName,
                contents: [{ role: 'user', parts }]
            });

            let text = response.text.trim();
            if (text.startsWith('```json')) {
                text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (text.startsWith('```')) {
                text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            try {
                const parsed = JSON.parse(text);
                parsed.source = 'gemini_flash';
                return parsed;
            } catch (err) {
                console.warn('⚠️ [Gemini Autofill JSON Parse Failed]:', err.message);
                return this.localFallbackAutofill({ imageUrl, prompt, sellerContext });
            }
        } catch (err) {
            console.warn('⚠️ [Gemini Autofill Error, using fallback]:', err.message);
            const fallback = this.localFallbackAutofill({ imageUrl, prompt, sellerContext });
            fallback.note = `(ใช้ระบบคลังข้อมูลสำรองเนื่องจาก: ${err.message.includes('429') ? 'โควตาชั่วคราวเต็ม' : 'การเชื่อมต่อ'})`;
            return fallback;
        }
    }

    /**
     * Fallback Autofill Generator
     */
    localFallbackAutofill({ imageUrl = '', prompt = '', sellerContext = {} }) {
        const text = (prompt + ' ' + imageUrl + ' ' + (sellerContext.craft_technique || '')).toLowerCase();
        const artisanName = sellerContext.store_name || 'ช่างฝีมือตลาดใจ';

        if (text.includes('ผ้า') || text.includes('ไหม') || text.includes('คราม') || text.includes('ฝ้าย') || text.includes('คลุมไหล่') || text.includes('silk') || text.includes('scarf')) {
            return {
                name: 'ผ้าคลุมไหล่ไหมมัดหมี่ ย้อมสีธรรมชาติทอมือ',
                category_id: 2,
                category_name: 'ผ้าทอมือและเครื่องแต่งกาย',
                price: 750,
                stock: 8,
                dimensions: 'กว้าง 60 x ยาว 180 ซม.',
                story: `ชิ้นงานผ้าทอมือผืนนี้ถักทอขึ้นด้วยกี่ทอไม้โบราณ โดย ${artisanName} ผู้เปี่ยมด้วยสมาธิและความประณีต เส้นใยไหมธรรมชาติถูกย้อมด้วยสีครามธรรมชาติที่บ่มเพาะด้วยความอดทน ทุกลวดลายสะท้อนถึงภูมิปัญญาที่สืบทอดมารุ่นสู่รุ่น\n\nการสนับสนุนผ้าผืนนี้ ไม่เพียงแต่มอบความอบอุ่นสง่างามแก่ผู้สวมใส่ แต่ยังเป็นการร่วมส่งเสริมอาชีพและสร้างความภาคภูมิใจให้แก่ช่างทอมือผู้พิการอย่างยั่งยืน`,
                description: 'ผ้าคลุมไหล่ทอมือจากเส้นไหมและฝ้ายธรรมชาติ 100% เนื้อผ้านุ่มเบาสบาย ระบายอากาศได้ดี เหมาะสำหรับใช้คลุมไหล่ในห้องแอร์ หรือสวมใส่ออกงานทางการ การดูแลรักษา: ซักมือด้วยน้ำยาซักผ้าไหมและตากในที่ร่ม',
                craft_technique: 'ทอมือด้วยกี่โบราณ มัดหมี่ย้อมครามธรรมชาติ',
                suggested_tags: ['ผ้าไหม', 'มัดหมี่', 'ย้อมคราม', 'ทอมือ'],
                source: 'local_engine'
            };
        }

        if (text.includes('ไม้') || text.includes('หนัง') || text.includes('แกะสลัก') || text.includes('wood') || text.includes('leather')) {
            return {
                name: 'กล่องไม้จามจุรีแกะสลักลายวิจิตรศิลป์',
                category_id: 3,
                category_name: 'งานไม้และเครื่องหนัง',
                price: 590,
                stock: 12,
                dimensions: 'กว้าง 15 x ยาว 20 x สูง 10 ซม.',
                story: `ผลงานแกะสลักชิ้นนี้รังสรรค์จากไม้จามจุรีคัดสรรพิเศษ โดย ${artisanName} ช่างฝีมือผู้ใช้พลังใจและสองมือในการแกะสลักลวดลายอันประณีตลงบนเนื้อไม้ ทุกเหลี่ยมมุมสะท้อนถึงความมุ่งมั่นที่ไม่ยอมแพ้ต่ออุปสรรคทางร่างกาย\n\nกล่องไม้ใบนี้พร้อมทำหน้าที่เป็นพื้นที่เก็บรักษาของมีค่าและความทรงจำอันอบอุ่น พร้อมส่งต่อกำลังใจจากผู้สร้างสรรค์สู่ผู้ครอบครอง`,
                description: 'กล่องอเนกประสงค์ทำจากไม้จามจุรีแท้ เคลือบผิวด้วยน้ำมันธรรมชาติ ปกป้องเนื้อไม้และเผยลวดลายธรรมชาติอย่างงดงาม เหมาะสำหรับใส่เครื่องประดับ นาฬิกา หรือของสะสมทรงคุณค่า',
                craft_technique: 'แกะสลักมือและขัดเงาด้วยขี้ผึ้งธรรมชาติ',
                suggested_tags: ['งานไม้', 'แกะสลัก', 'ของแต่งบ้าน', 'แฮนด์เมด'],
                source: 'local_engine'
            };
        }

        if (text.includes('เซรามิก') || text.includes('ดินเผา') || text.includes('แก้ว') || text.includes('ภาพวาด') || text.includes('ceramic') || text.includes('art')) {
            return {
                name: 'ชุดแก้วเซรามิกปั้นมือ ลายบทกวีแห่งท้องฟ้า',
                category_id: 4,
                category_name: 'ศิลปะ ภาพวาด และเซรามิก',
                price: 390,
                stock: 15,
                dimensions: 'เส้นผ่านศูนย์กลาง 8.5 x สูง 9.5 ซม. (ความจุ 300 มล.)',
                story: `แก้วเซรามิกใบนี้ขึ้นรูปด้วยมือทุกขั้นตอนโดย ${artisanName} ถ่ายทอดจินตนาการผ่านเส้นสายและสีเคลือบที่เป็นเอกลักษณ์ ทุกสัมผัสของผิวดินเผาเป็นหลักฐานของความตั้งใจและความสุขในการสร้างสรรค์ศิลปะ\n\nเมื่อคุณดื่มน้ำหรือกาแฟจากแก้วใบนี้ คุณจะได้สัมผัสถึงความอบอุ่นและพลังบวกที่ศิลปินได้ตั้งใจส่งมอบให้`,
                description: 'แก้วเซรามิกสโตนแวร์เผาอุณหภูมิสูง 1,250 องศาเซลเซียส ผิวสัมผัสกึ่งด้าน ให้ความรู้สึกนุ่มนวล ปลอดภัยต่อการใส่อาหารและเครื่องดื่ม (Food-grade) สามารถเข้าไมโครเวฟและเครื่องล้างจานได้',
                craft_technique: 'ปั้นขึ้นรูปมือและเคลือบศิลาดลธรรมชาติ',
                suggested_tags: ['เซรามิก', 'แก้วกาแฟ', 'ปั้นมือ', 'ศิลปะ'],
                source: 'local_engine'
            };
        }

        if (text.includes('ขนม') || text.includes('อาหาร') || text.includes('ลำดวน') || text.includes('ชา') || text.includes('food')) {
            return {
                name: 'ขนมกลีบลำดวนสูตรโบราณ อบควันเทียนหอมกรุ่น',
                category_id: 5,
                category_name: 'อาหาร ขนมไทย และเกษตรแปรรูป',
                price: 180,
                stock: 20,
                dimensions: 'กล่องบรรจุ 16 ชิ้น (น้ำหนัก 250 กรัม)',
                story: `ขนมไทยโบราณที่ปั้นด้วยความประณีตทีละกลีบโดย ${artisanName} ความตั้งใจในการผสมผสานแป้งและน้ำตาลอย่างลงตัว ผ่านการอบควันเทียนสูตรชาววังที่หอมละมุนติดปลายลิ้น\n\nทุกกระปุกคือความภาคภูมิใจในการอนุรักษ์รสชาติไทยแท้และสร้างรายได้พึ่งพาตนเองของช่างทำขนม`,
                description: 'ขนมกลีบลำดวนเนื้อเนียนละลายในปาก หวานน้อย อบควันเทียนหอมละมุนตามกรรมวิธีโบราณ ไม่ใส่วัตถุกันเสีย อายุการเก็บรักษา 3 สัปดาห์ในภาชนะปิดสนิท',
                craft_technique: 'ปั้นกลีบมือทีละชิ้น และอบร่ำควันเทียนธรรมชาติ',
                suggested_tags: ['ขนมไทย', 'กลีบลำดวน', 'อบควันเทียน', 'ของฝาก'],
                source: 'local_engine'
            };
        }

        // Default: Basketry & Handicraft
        return {
            name: 'กระเป๋าสะพายผักตบชวาถักมือ ทรงโท้ทลายโบราณ',
            category_id: 1,
            category_name: 'งานจักสานและหัตถกรรม',
            price: 520,
            stock: 10,
            dimensions: 'กว้าง 14 x ยาว 30 x สูง 22 ซม. (สายสะพาย 24 ซม.)',
            story: `กระเป๋าสะพายใบนี้ถักทอจากเส้นใยผักตบชวาที่คัดสรรและตากแดดธรรมชาติอย่างพิถีพิถัน โดย ${artisanName} ช่างจักสานผู้สืบทอดภูมิปัญญาท้องถิ่น ทุกลวดลายถักทอด้วยความประณีต สะท้อนถึงคุณค่าแห่งการอนุรักษ์สิ่งแวดล้อมและศิลปวัฒนธรรมไทย\n\nรายได้จากการจำหน่ายกระเป๋าใบนี้ เป็นพลังขับเคลื่อนให้ช่างฝีมือผู้พิการมีรายได้เลี้ยงดูครอบครัวและพัฒนาอุปกรณ์การผลิตต่อไป`,
            description: 'กระเป๋าสะพายทำจากผักตบชวาธรรมชาติ 100% ภายในบุด้วยผ้าฝ้ายอย่างดี มีช่องใส่ของขนาดกะทัดรัด น้ำหนักเบา ทนทาน รองรับน้ำหนักได้ดี เคลือบน้ำยากันเชื้อราจากสารสกัดธรรมชาติ วิธีดูแลรักษา: ใช้ผ้าแห้งหรือชุบน้ำหมาดๆ เช็ดทำความสะอาดและผึ่งในที่ร่ม',
            craft_technique: 'ถักลายเปียคู่และเคลือบสารธรรมชาติกันชื้น',
            suggested_tags: ['กระเป๋าสาน', 'ผักตบชวา', 'งานจักสาน', 'มินิมอล', 'รักษ์โลก'],
            source: 'local_engine'
        };
    }
}

module.exports = new GeminiService();

