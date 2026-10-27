// ==============================================================================
// TRELLIS.2 / 3D GENERATIVE AI SERVICE
// Microsoft TRELLIS.2 (Image-to-3D GLB Generation)
// Supports Fal.ai Trellis.2 API, custom TRELLIS endpoint, and high-fidelity fallback
// ==============================================================================

const https = require('https');
const http = require('http');

class TrellisService {
    constructor() {
        this.apiKey = process.env.TRELLIS_API_KEY || process.env.FAL_KEY || '';
        this.customEndpoint = process.env.TRELLIS_ENDPOINT || ''; // e.g. self-hosted TRELLIS.2 instance
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    isConfigured() {
        return !!(this.apiKey || this.customEndpoint);
    }

    /**
     * Generate a 3D model (.glb) from a 2D image URL using TRELLIS.2
     * @param {Object} params - { imageUrl, prompt, artisanName, craftCategory }
     * @returns {Promise<{ success: boolean, modelUrl: string, source: string, format: string, duration?: string }>}
     */
    async generate3DFromImage({ imageUrl, prompt = '', artisanName = '', craftCategory = '' }) {
        if (!imageUrl) {
            throw new Error('กรุณาระบุ URL รูปภาพสินค้าสำหรับสร้างโมเดล 3 มิติ');
        }

        // 1. If custom self-hosted TRELLIS.2 endpoint is provided
        if (this.customEndpoint) {
            try {
                return await this._callCustomTrellisEndpoint(imageUrl, prompt);
            } catch (err) {
                console.warn('[TRELLIS.2] Custom endpoint failed, falling back:', err.message);
            }
        }

        // 2. If Fal.ai API key is available
        if (this.apiKey) {
            try {
                return await this._callFalTrellis(imageUrl);
            } catch (err) {
                console.warn('[TRELLIS.2] Fal.ai API failed, falling back:', err.message);
            }
        }

        // 3. No generator available: do NOT fall back to unrelated sample models (a scarf must never
        //    show an astronaut). The product simply has no 3D model until a real one is generated.
        const err = new Error('ยังสร้างโมเดล 3D จริงไม่ได้ เพราะยังไม่ได้ตั้งค่า TRELLIS_API_KEY / TRELLIS_ENDPOINT สินค้านี้จะแสดงเฉพาะรูปภาพไปก่อน');
        err.status = 503;
        throw err;
    }

    /**
     * Call Fal.ai TRELLIS.2 endpoint
     */
    async _callFalTrellis(imageUrl) {
        return new Promise((resolve, reject) => {
            const endpoint = 'https://fal.run/fal-ai/trellis-2';
            const urlObj = new URL(endpoint);
            const postData = JSON.stringify({
                image_url: imageUrl,
                texture_size: 1024,
                mesh_simplify: 0.95
            });

            const req = https.request({
                hostname: urlObj.hostname,
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    'Authorization': `Key ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout: 120000 // 2 minutes
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            const glbUrl = json.model_mesh?.url || json.glb_file?.url || json.output_url;
                            if (glbUrl) {
                                return resolve({
                                    success: true,
                                    modelUrl: glbUrl,
                                    source: 'trellis_2_cloud',
                                    format: 'glb'
                                });
                            }
                        }
                        reject(new Error(json.message || json.detail || `HTTP ${res.statusCode}`));
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }

    /**
     * Call custom/self-hosted TRELLIS.2 endpoint
     */
    async _callCustomTrellisEndpoint(imageUrl, prompt) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(this.customEndpoint);
            const client = urlObj.protocol === 'https:' ? https : http;
            const postData = JSON.stringify({
                image_url: imageUrl,
                prompt: prompt
            });

            const req = client.request({
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout: 60000
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.glb_url || json.modelUrl) {
                            return resolve({
                                success: true,
                                modelUrl: json.glb_url || json.modelUrl,
                                source: 'trellis_2_self_hosted',
                                format: 'glb'
                            });
                        }
                        reject(new Error(json.message || 'No GLB returned'));
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }
}

module.exports = new TrellisService();
