// ==============================================================================
// AUTO CAPTIONS FOR STORE STORY VIDEOS
// Sends an uploaded story video to Gemini, gets back timed Thai captions
// (speech + important sounds/visuals in [brackets] for deaf viewers) and saves
// them as a WebVTT file next to the video. The seller does not have to write anything.
// ==============================================================================
const fs = require('fs');
const path = require('path');
const { GoogleGenAI, createPartFromUri } = require('@google/genai');
const db = require('../config/database');

const PUBLIC_DIR = path.join(__dirname, '../public');
const MAX_CUE_SECONDS = 7;
const running = new Set();   // store ids currently being captioned

const PROMPT = `สร้างคำบรรยายใต้ภาพ (subtitle) ภาษาไทยสำหรับวิดีโอนี้ เพื่อผู้บกพร่องทางการได้ยิน
- ถ้ามีคนพูด ให้ถอดคำพูดเป็นภาษาไทย (ถ้าพูดภาษาอื่นให้แปลเป็นไทย)
- ถ้าไม่มีคำพูด ให้บรรยายเสียงสำคัญในวงเล็บเหลี่ยม เช่น [เสียงกี่ทอกระทบ] และบรรยายสิ่งที่เกิดขึ้นในภาพสั้น ๆ เช่น "ช่างกำลังสอดเส้นใยสานตะกร้า"
- แต่ละช่วงยาวไม่เกิน ${MAX_CUE_SECONDS} วินาที ไม่เกิน 2 บรรทัด อ่านง่าย ใช้ภาษาสุภาพ
- ครอบคลุมตั้งแต่ต้นจนจบวิดีโอ เวลาเป็นวินาที (ทศนิยมได้) ห้ามเกินความยาววิดีโอ
- ห้ามแต่งเนื้อหาที่ไม่ได้อยู่ในวิดีโอ
- ไม่ต้องระบุเชื้อชาติ สัญชาติ หรือเพศของบุคคล ให้เรียกว่า "ช่าง" หรือ "ช่างฝีมือ"`;

const RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        cues: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    start: { type: 'number', description: 'วินาทีเริ่ม' },
                    end: { type: 'number', description: 'วินาทีจบ' },
                    text: { type: 'string', description: 'ข้อความคำบรรยายภาษาไทย' }
                },
                required: ['start', 'end', 'text']
            }
        },
        summary: { type: 'string', description: 'สรุปเนื้อหาวิดีโอ 1-3 ประโยค ภาษาไทย' }
    },
    required: ['cues', 'summary']
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const vttTime = sec => {
    const ms = Math.max(0, Math.round(sec * 1000));
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0');
    const s = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
    return `${h}:${m}:${s}.${String(ms % 1000).padStart(3, '0')}`;
};

function toVtt(cues) {
    const clean = cues
        .map(c => ({ start: Number(c.start), end: Number(c.end), text: String(c.text || '').replace(/-->/g, '→').trim() }))
        .filter(c => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start && c.text)
        .sort((a, b) => a.start - b.start);
    return 'WEBVTT\n\n' + clean.map((c, i) => `${i + 1}\n${vttTime(c.start)} --> ${vttTime(c.end)}\n${c.text}`).join('\n\n') + '\n';
}

// Local video path (only files we host: /uploads/store-videos/* or /videos/stories/*)
function localVideoPath(url) {
    if (!/^\/(uploads\/store-videos|videos\/stories)\/[\w-]+\.(mp4|webm)$/.test(String(url || ''))) return null;
    const file = path.join(PUBLIC_DIR, url);
    return file.startsWith(PUBLIC_DIR) && fs.existsSync(file) ? file : null;
}

async function generateCaptions(videoFile) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('ยังไม่ได้ตั้งค่า GEMINI_API_KEY');
    const ai = new GoogleGenAI({ apiKey });
    const mimeType = videoFile.endsWith('.webm') ? 'video/webm' : 'video/mp4';

    let file = await ai.files.upload({ file: videoFile, config: { mimeType } });
    for (let i = 0; i < 60 && file.state === 'PROCESSING'; i++) {
        await sleep(2000);
        file = await ai.files.get({ name: file.name });
    }
    if (file.state !== 'ACTIVE') throw new Error(`Gemini ประมวลผลวิดีโอไม่สำเร็จ (${file.state})`);

    // Busy / rate-limited models (503, 429) are retried with backoff, then a second model is tried
    const models = [...new Set([process.env.GEMINI_CAPTION_MODEL, process.env.GEMINI_MODEL, 'gemini-3.8-flash'].filter(Boolean))];
    let lastError;
    try {
        for (const model of models) {
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const res = await ai.models.generateContent({
                        model,
                        contents: [{ role: 'user', parts: [createPartFromUri(file.uri, mimeType), { text: PROMPT }] }],
                        config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0.2 }
                    });
                    const data = JSON.parse(res.text);
                    if (!Array.isArray(data.cues) || !data.cues.length) throw new Error('Gemini ไม่ได้ส่งคำบรรยายกลับมา');
                    return data;
                } catch (err) {
                    lastError = err;
                    const busy = /\b(503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand)\b/i.test(String(err.message));
                    if (!busy) break;                       // other errors: move on to the next model
                    await sleep(4000 * attempt);
                }
            }
        }
        throw lastError || new Error('สร้างคำบรรยายไม่สำเร็จ');
    } finally {
        ai.files.delete({ name: file.name }).catch(() => {});
    }
}

// Create captions for a store's current story video. Safe to call repeatedly; runs one job per store.
async function captionStoreVideo(storeId) {
    if (running.has(storeId)) return;
    const video = await db.get('SELECT video_url FROM store_videos WHERE store_id = ?', [storeId]);
    const videoFile = video && localVideoPath(video.video_url);
    if (!videoFile) {
        await db.run('UPDATE store_videos SET captions_url = NULL, captions_status = NULL WHERE store_id = ?', [storeId]);
        return;
    }
    running.add(storeId);
    await db.run("UPDATE store_videos SET captions_status = 'processing' WHERE store_id = ?", [storeId]);
    try {
        const data = await generateCaptions(videoFile);
        const vttPath = videoFile.replace(/\.(mp4|webm)$/, '.th.vtt');
        fs.writeFileSync(vttPath, toVtt(data.cues), 'utf8');
        const vttUrl = '/' + path.relative(PUBLIC_DIR, vttPath).split(path.sep).join('/');

        // Only write the transcript if the video is still the same and the seller left it empty
        const latest = await db.get('SELECT video_url, transcript FROM store_videos WHERE store_id = ?', [storeId]);
        if (!latest || latest.video_url !== video.video_url) return;
        const transcript = latest.transcript && latest.transcript.trim()
            ? latest.transcript
            : `${String(data.summary || '').trim()}\n\n${data.cues.map(c => c.text).join(' ')}`.trim();
        await db.run("UPDATE store_videos SET captions_url = ?, captions_status = 'ready', transcript = ?, updated_at = CURRENT_TIMESTAMP WHERE store_id = ?",
            [vttUrl, transcript, storeId]);
        console.log(`[Captions] Store ${storeId}: ${data.cues.length} cues -> ${vttUrl}`);
    } catch (err) {
        console.warn(`[Captions] Store ${storeId} failed:`, err.message);
        await db.run("UPDATE store_videos SET captions_status = 'failed' WHERE store_id = ?", [storeId]).catch(() => {});
    } finally {
        running.delete(storeId);
    }
}

module.exports = { captionStoreVideo, toVtt };
