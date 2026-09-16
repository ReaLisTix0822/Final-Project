// ==============================================================================
// TALADJAI AI ASSISTANT CHATBOT WIDGET (POWERED BY GEMINI FLASH)
// ==============================================================================

const ChatbotWidget = {
    isOpen: false,
    autoSpeak: false,
    messages: [],

    init() {
        this.renderWidgetDOM();
        this.addWelcomeMessage();
    },

    renderWidgetDOM() {
        if (document.getElementById('chatbot-widget-container')) return;

        const container = document.createElement('div');
        container.id = 'chatbot-widget-container';
        container.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9998;
        `;

        container.innerHTML = `
            <!-- Floating Trigger Button (TaladJai Theme) -->
            <button id="chatbot-trigger-btn" class="btn btn-primary" aria-label="เปิดแชทบอทน้องใจดี AI (คีย์ลัด Alt+B)" title="น้องใจดี AI (Alt+B)" style="border-radius:9999px; padding:12px 20px; box-shadow:0 8px 24px rgba(27,51,41,0.2); display:flex; align-items:center; gap:8px; font-weight:800; background:linear-gradient(135deg, #1b3329 0%, #2a5241 100%); border:2px solid #df8a28; color:#ffffff;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <span>น้องใจดี AI</span>
                <span style="background:#df8a28; color:#ffffff; font-size:0.68rem; font-weight:800; padding:1px 6px; border-radius:9999px;">Gemini</span>
            </button>

            <!-- Chat Modal / Drawer -->
            <div id="chatbot-window" style="position:fixed; bottom:90px; right:24px; width:400px; max-width:calc(100vw - 32px); height:560px; max-height:calc(100vh - 120px); background:#ffffff; border:2px solid var(--border-color); border-radius:24px; box-shadow:0 16px 40px rgba(27,51,41,0.18); display:none; flex-direction:column; z-index:9999; overflow:hidden;" role="dialog" aria-modal="false" aria-label="กล่องสนทนาน้องใจดี AI">
                <!-- Header -->
                <div style="background:#1b3329; color:white; padding:14px 18px; display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #df8a28;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="background:#254a3b; width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid #3d775c;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fef08a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></span>
                        <div>
                            <div style="font-weight:800; font-size:1rem; display:flex; align-items:center; gap:6px;">
                                <span>น้องใจดี</span>
                                <span style="background:#df8a28; color:#ffffff; font-size:0.65rem; padding:1px 6px; border-radius:9999px;">Gemini Flash</span>
                            </div>
                            <div style="font-size:0.75rem; color:#a4b3ab;">ผู้ช่วยอัจฉริยะตลาดใจ • ค้นหา & เล่าเรื่องราว</div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <button id="chatbot-tts-toggle" class="btn btn-sm" style="background:rgba(255,255,255,0.15); color:white; padding:4px 8px; border-radius:9999px; font-size:0.75rem; font-weight:700;" title="เปิด/ปิด การอ่านเสียงตอบกลับอัตโนมัติ">
                            เสียง: ปิด
                        </button>
                        <button id="chatbot-close-btn" class="btn btn-sm" style="background:rgba(255,255,255,0.15); color:white; padding:4px 8px; border-radius:9999px; font-size:0.9rem;" aria-label="ปิดแชทบอท">✕</button>
                    </div>
                </div>

                <!-- Message History Body -->
                <div id="chatbot-messages-body" style="flex-grow:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px; background:#fbf8f2;">
                    <!-- Messages injected here -->
                </div>

                <!-- Quick Action Chips -->
                <div id="chatbot-quick-chips" style="padding:8px 12px; background:#ffffff; border-top:1px solid var(--border-color); display:flex; gap:6px; overflow-x:auto; white-space:nowrap;">
                    <!-- Action chips -->
                </div>

                <!-- Input Footer -->
                <div style="padding:10px 14px; background:#ffffff; border-top:1px solid var(--border-color); display:flex; align-items:center; gap:8px;">
                    <button id="chatbot-mic-btn" class="icon-circle-btn" style="width:38px; height:38px; flex-shrink:0;" title="พูดคำถามผ่านไมโครโฟน">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                    </button>
                    <input type="text" id="chatbot-text-input" placeholder="ถามหาสินค้า ช่างฝีมือ หรือพิมพ์คำถาม..." style="flex-grow:1; padding:8px 14px; border:1.5px solid var(--border-color); border-radius:var(--radius-full); font-size:0.9rem; background:#fbf8f2; color:var(--text-main);" aria-label="พิมพ์ข้อความคุยกับน้องใจดี">
                    <button id="chatbot-send-btn" class="btn btn-primary" style="padding:8px 16px; border-radius:var(--radius-full); min-height:38px; font-weight:700;" aria-label="ส่งข้อความ">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(container);
        this.bindEvents();
    },

    bindEvents() {
        const trigger = document.getElementById('chatbot-trigger-btn');
        const closeBtn = document.getElementById('chatbot-close-btn');
        const sendBtn = document.getElementById('chatbot-send-btn');
        const inputEl = document.getElementById('chatbot-text-input');
        const micBtn = document.getElementById('chatbot-mic-btn');
        const ttsToggle = document.getElementById('chatbot-tts-toggle');

        trigger.addEventListener('click', () => this.toggle());
        closeBtn.addEventListener('click', () => this.close());

        sendBtn.addEventListener('click', () => this.sendMessage());
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.sendMessage();
            }
        });

        micBtn.addEventListener('click', () => {
            if (window.A11y && window.A11y.recognition) {
                const rec = window.A11y.recognition;
                rec.onresult = (event) => {
                    const text = event.results[0][0].transcript;
                    inputEl.value = text;
                    this.sendMessage();
                };
                rec.start();
                if (window.showToast) window.showToast('กำลังฟังเสียงพูดของคุณ...', 'info');
            } else {
                if (window.showToast) window.showToast('เบราว์เซอร์ไม่รองรับ Web Speech API', 'warning');
            }
        });

        ttsToggle.addEventListener('click', () => {
            this.autoSpeak = !this.autoSpeak;
            ttsToggle.innerText = this.autoSpeak ? 'เสียง: เปิด' : 'เสียง: ปิด';
            ttsToggle.style.background = this.autoSpeak ? '#1b834b' : 'rgba(255,255,255,0.15)';
            if (this.autoSpeak && window.A11y) {
                A11y.speak('เปิดการอ่านออกเสียงอัตโนมัติแล้ว');
            }
        });
    },

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },

    open() {
        const win = document.getElementById('chatbot-window');
        if (win) {
            win.style.display = 'flex';
            this.isOpen = true;
            document.getElementById('chatbot-text-input').focus();
        }
    },

    close() {
        const win = document.getElementById('chatbot-window');
        if (win) {
            win.style.display = 'none';
            this.isOpen = false;
        }
    },

    addWelcomeMessage() {
        this.appendMessage('assistant', `สวัสดีครับ! ผมคือ **น้องใจดี (AI ผู้ช่วยตลาดใจ)** ขับเคลื่อนด้วยโมเดล Gemini Flash พร้อมช่วยเหลือคุณครับ:
• แนะนำสินค้าหัตถกรรมและช่างฝีมือผู้พิการ
• สอบถามเรื่องราว ความเป็นมา และเป้าหมายระดมทุน
• ตรวจสอบสถานะคำสั่งซื้อ & พัสดุ
• แนะนำการใช้งานเว็บไซต์ตามมาตรฐานการเข้าถึง`);

        this.renderQuickChips([
            'แนะนำสินค้างานฝีมือเด่น',
            'ทำแบบจับคู่ 4 คำถาม',
            'เป้าหมายพัฒนาอาชีพของร้าน',
            'ติดตามสถานะพัสดุ'
        ]);
    },

    async sendMessage(customText = null) {
        const inputEl = document.getElementById('chatbot-text-input');
        const text = customText || inputEl.value.trim();
        if (!text) return;

        inputEl.value = '';
        this.appendMessage('user', text);
        this.messages.push({ role: 'user', content: text });

        const typingId = this.showTypingIndicator();

        try {
            const user = (window.Auth && Auth.getUser()) ? Auth.getUser() : null;
            const res = await API.post('/chatbot/message', {
                message: text,
                user_id: user ? user.id : null,
                history: this.messages.slice(-6)
            });

            this.removeTypingIndicator(typingId);

            if (res.success) {
                this.messages.push({ role: 'model', content: res.reply });
                this.appendMessage('assistant', res.reply, res.suggestedProducts, res.source);

                if (res.quickActions && res.quickActions.length > 0) {
                    this.renderQuickChips(res.quickActions);
                }

                if (this.autoSpeak && window.A11y) {
                    A11y.speak(res.reply.replace(/[*_#•]/g, ''));
                }
            }
        } catch (err) {
            this.removeTypingIndicator(typingId);
            this.appendMessage('assistant', 'ขออภัยครับ กำลังปรับปรุงการเชื่อมต่อกับเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง');
        }
    },

    appendMessage(sender, text, suggestedProducts = [], source = 'gemini_flash') {
        const body = document.getElementById('chatbot-messages-body');
        if (!body) return;

        const msgDiv = document.createElement('div');
        msgDiv.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: ${sender === 'user' ? 'flex-end' : 'flex-start'};
            gap: 4px;
        `;

        let formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\n/g, '<br>');

        const bubble = document.createElement('div');
        bubble.style.cssText = `
            max-width: 85%;
            padding: 10px 14px;
            border-radius: ${sender === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px'};
            font-size: 0.9rem;
            line-height: 1.55;
            background: ${sender === 'user' ? '#1b3329' : '#ffffff'};
            color: ${sender === 'user' ? '#ffffff' : 'var(--text-main)'};
            border: 1px solid ${sender === 'user' ? '#1b3329' : 'var(--border-color)'};
            box-shadow: 0 2px 6px rgba(0,0,0,0.04);
        `;
        bubble.innerHTML = formattedText;

        // Model Tag
        if (sender === 'assistant') {
            const metaDiv = document.createElement('div');
            metaDiv.style.cssText = 'font-size:0.7rem; color:#7e8c84; display:flex; align-items:center; gap:4px; margin-left:4px;';
            metaDiv.innerHTML = `<b>น้องใจดี</b> · <span>${source === 'gemini_flash' ? 'Gemini 2.5 Flash' : 'ระบบอัจฉริยะตลาดใจ'}</span>`;
            msgDiv.appendChild(metaDiv);
        }

        msgDiv.appendChild(bubble);

        // Render Suggested Products Cards inside chat if any
        if (suggestedProducts && suggestedProducts.length > 0) {
            const prodList = document.createElement('div');
            prodList.style.cssText = 'display:flex; flex-direction:column; gap:8px; width:100%; max-width:85%; margin-top:4px;';

            prodList.innerHTML = suggestedProducts.map(p => `
                <div style="background:#ffffff; border:1px solid #ede5d8; border-radius:12px; padding:8px 10px; display:flex; align-items:center; gap:10px; box-shadow:0 2px 4px rgba(0,0,0,0.03);">
                    <img src="${p.image_url}" alt="${p.name}" style="width:44px; height:44px; border-radius:8px; object-fit:cover;">
                    <div style="flex-grow:1; min-width:0;">
                        <div style="font-weight:700; font-size:0.85rem; color:var(--brand-dark); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                        <div style="font-size:0.75rem; color:#b4532a; font-weight:700;">฿${p.price.toLocaleString()}</div>
                    </div>
                    <a href="/product-detail.html?id=${p.id}" class="btn btn-sm btn-outline-dark" style="font-size:0.75rem; padding:3px 8px;">ดูชิ้นงาน</a>
                </div>
            `).join('');

            msgDiv.appendChild(prodList);
        }

        body.appendChild(msgDiv);
        body.scrollTop = body.scrollHeight;
    },

    renderQuickChips(chips = []) {
        const chipsContainer = document.getElementById('chatbot-quick-chips');
        if (!chipsContainer) return;

        chipsContainer.innerHTML = chips.map(c => `
            <button type="button" class="btn btn-sm" onclick="ChatbotWidget.sendMessage('${c}')" style="background:#f4eee3; border:1px solid #e2d7c5; color:var(--brand-dark); font-size:0.8rem; font-weight:700; border-radius:9999px; padding:4px 12px; flex-shrink:0;">
                ${c}
            </button>
        `).join('');
    },

    showTypingIndicator() {
        const body = document.getElementById('chatbot-messages-body');
        const id = 'typing-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.style.cssText = 'align-self:flex-start; background:#ffffff; border:1px solid var(--border-color); padding:8px 14px; border-radius:18px; font-size:0.85rem; color:#7e8c84; display:flex; align-items:center; gap:6px;';
        div.innerHTML = `<span>น้องใจดีกำลังคิดด้วย Gemini Flash...</span>`;
        body.appendChild(div);
        body.scrollTop = body.scrollHeight;
        return id;
    },

    removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ChatbotWidget.init();
});
