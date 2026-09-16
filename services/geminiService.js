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
}

module.exports = new GeminiService();
