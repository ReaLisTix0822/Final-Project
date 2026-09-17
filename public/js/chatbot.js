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
            const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRec) {
                if (window.showToast) window.showToast('เบราว์เซอร์ไม่รองรับการสั่งงานด้วยเสียง (แนะนำ Chrome / Edge)', 'warning');
                return;
            }

            try {
                const rec = new SpeechRec();
                rec.lang = 'th-TH';
                rec.continuous = false;
                rec.interimResults = false;

                rec.onstart = () => {
                    micBtn.style.background = '#dc2626';
                    micBtn.style.color = '#ffffff';
                    micBtn.classList.add('pulse-active');
                    if (window.showToast) window.showToast('🎙️ กำลังฟังเสียงคำสั่งของคุณ...', 'info');
                };

                rec.onresult = (event) => {
                    const text = event.results[0][0].transcript;
                    inputEl.value = text;
                    this.sendMessage();
                };

                rec.onerror = (event) => {
                    console.warn('Chatbot mic error:', event.error);
                };

                rec.onend = () => {
                    micBtn.style.background = '';
                    micBtn.style.color = '';
                    micBtn.classList.remove('pulse-active');
                };

                rec.start();
            } catch (err) {
                console.error('Speech recognition error:', err);
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
• สั่งงานด้วยเสียงเพื่อนำทาง เช่น *"พาไปหน้าสินค้า"*, *"จับคู่ผู้สนับสนุน"*, *"ค้นหากระเป๋า"*, *"เปิดตะกร้า"*
• ตรวจสอบสถานะคำสั่งซื้อ & พัสดุ
• แนะนำการใช้งานเว็บไซต์ตามมาตรฐานการเข้าถึง`);

        this.renderQuickChips([
            'พาไปหน้าสินค้า',
            'ทำแบบจับคู่ 4 คำถาม',
            'ดูงานโมเดล 3D',
            'ไปหน้าร้านค้าช่างฝีมือ',
            'ติดตามสถานะพัสดุ'
        ]);
    },

    // Fast Client-side Voice Command Matcher
    parseQuickVoiceAction(text) {
        const cmd = text.toLowerCase().trim();

        // 1. Search Query
        const searchMatch = cmd.match(/(?:ค้นหา|ค้น|หา|สืบค้น)\s*(?:สินค้า|ผลงาน|ของ)?\s*(.+)/);
        if (searchMatch && searchMatch[1] && searchMatch[1].trim() && !cmd.includes('หน้าแรก') && !cmd.includes('ร้านค้า') && !cmd.includes('ตะกร้า')) {
            const query = searchMatch[1].trim();
            return {
                type: 'navigate',
                url: `/products.html?search=${encodeURIComponent(query)}`,
                label: `ค้นหา "${query}"`,
                reply: `รับทราบครับ! กำลังนำทางไปค้นหาสินค้า **"${query}"** ให้คุณครับ 🔍`,
                speak: `กำลังค้นหาสินค้า ${query} ให้คุณครับ`
            };
        }

        // 2. 3D Model Gallery
        if (cmd.includes('3d') || cmd.includes('สามมิติ') || cmd.includes('โมเดล') || cmd.includes('3 มิติ')) {
            return {
                type: 'navigate',
                url: '/products.html?has_3d=true',
                label: 'ชมผลงาน 3D / AR',
                reply: 'ได้เลยครับ! กำลังเปิดหน้าชมสินค้าที่มี **โมเดล 3 มิติ (3D/AR 360°)** ให้คุณครับ 🎨✨',
                speak: 'กำลังนำทางไปชมผลงานที่มีโมเดล 3 มิติครับ'
            };
        }

        // 3. Navigation
        if (cmd.includes('หน้าแรก') || cmd.includes('กลับหน้าแรก') || cmd.includes('home')) {
            return {
                type: 'navigate',
                url: '/index.html',
                label: 'ไปที่หน้าแรก',
                reply: 'รับทราบครับ! กำลังนำคุณกลับไปยัง **หน้าแรก** ครับ 🏠',
                speak: 'กำลังนำคุณไปที่หน้าแรกครับ'
            };
        }

        if (cmd.includes('ไปหน้าสินค้า') || cmd.includes('เปิดหน้าสินค้า') || cmd.includes('ดูสินค้า') || cmd.includes('ช็อป') || cmd.includes('ร้านค้าทั้งหมด') || cmd.includes('ซื้อของ')) {
            return {
                type: 'navigate',
                url: '/products.html',
                label: 'ไปที่หน้ารวมสินค้า',
                reply: 'รับทราบครับ! กำลังนำคุณไปยัง **หน้ารวมสินค้าหัตถกรรมทั้งหมด** ครับ 🛍️',
                speak: 'กำลังนำทางไปที่หน้ารวมสินค้าทั้งหมดครับ'
            };
        }

        if (cmd.includes('จับคู่') || cmd.includes('matching') || cmd.includes('แนะนำ')) {
            return {
                type: 'navigate',
                url: '/matching.html',
                label: 'ไปที่หน้าจับคู่ผู้สนับสนุน',
                reply: 'ได้เลยครับ! กำลังเปิดระบบ **แบบประเมินจับคู่ผู้สนับสนุน 4 คำถาม** ให้คุณครับ 🤝✨',
                speak: 'กำลังเปิดระบบจับคู่ผู้สนับสนุน 4 คำถามครับ'
            };
        }

        if (cmd.includes('ร้านค้า') || cmd.includes('ช่างฝีมือ') || cmd.includes('คนพิการ')) {
            return {
                type: 'navigate',
                url: '/stores.html',
                label: 'ไปที่หน้าร้านค้าช่างฝีมือ',
                reply: 'รับทราบครับ! กำลังพาคุณไปที่ **หน้ารวมร้านค้าและเรื่องราวช่างฝีมือ** ครับ 🧑‍🎨',
                speak: 'กำลังนำคุณไปที่หน้ารวมร้านค้าช่างฝีมือครับ'
            };
        }

        if (cmd.includes('แดชบอร์ด') || cmd.includes('จัดการร้าน') || cmd.includes('หลังบ้าน') || cmd.includes('seller')) {
            return {
                type: 'navigate',
                url: '/seller-dashboard.html',
                label: 'ไปที่แดชบอร์ดร้านค้า',
                reply: 'รับทราบครับ! กำลังเปิด **แดชบอร์ดจัดการร้านค้าสำหรับช่างฝีมือ** ครับ 📊',
                speak: 'กำลังเปิดแดชบอร์ดจัดการร้านค้าสำหรับช่างฝีมือครับ'
            };
        }

        if (cmd.includes('ตะกร้า') || cmd.includes('สั่งซื้อ') || cmd.includes('cart') || cmd.includes('เช็คเอาท์')) {
            return {
                type: 'navigate',
                url: '/cart.html',
                label: 'ไปที่ตะกร้าสินค้า',
                reply: 'รับทราบครับ! กำลังเปิด **ตะกร้าสินค้าของคุณ** ครับ 🛒',
                speak: 'กำลังนำทางไปที่ตะกร้าสินค้าของคุณครับ'
            };
        }

        if (cmd.includes('โปรไฟล์') || cmd.includes('บัญชี') || cmd.includes('ข้อมูลส่วนตัว') || cmd.includes('profile')) {
            return {
                type: 'navigate',
                url: '/profile.html',
                label: 'ไปที่หน้าข้อมูลส่วนตัว',
                reply: 'รับทราบครับ! กำลังเปิด **หน้าโปรไฟล์และประวัติคำสั่งซื้อ** ครับ 👤',
                speak: 'กำลังเปิดหน้าโปรไฟล์ของคุณครับ'
            };
        }

        if (cmd.includes('แคมเปญ') || cmd.includes('บูธ') || cmd.includes('กิจกรรม') || cmd.includes('งานออกร้าน')) {
            return {
                type: 'navigate',
                url: '/campaigns.html',
                label: 'ไปที่หน้ากิจกรรมและงานออกบูธ',
                reply: 'รับทราบครับ! กำลังนำทางไปที่ **หน้ากิจกรรมและงานออกบูธ** ครับ 🎪',
                speak: 'กำลังไปที่หน้ากิจกรรมและงานออกบูธครับ'
            };
        }

        if (cmd.includes('เข้าสู่ระบบ') || cmd.includes('ล็อกอิน') || cmd.includes('login') || cmd.includes('สมัคร')) {
            return {
                type: 'navigate',
                url: '/login.html',
                label: 'เข้าสู่ระบบ / สมัครสมาชิก',
                reply: 'รับทราบครับ! กำลังเปิด **หน้าเข้าสู่ระบบและสมัครสมาชิก** ครับ 🔑',
                speak: 'กำลังเปิดหน้าเข้าสู่ระบบและสมัครสมาชิกครับ'
            };
        }

        return null;
    },

    executeAction(action) {
        if (!action || !action.url) return;

        // Visual announcement and Voice feedback
        const speakText = action.speak || `กำลังนำทางไปที่ ${action.label || 'หน้าที่ต้องการ'}`;
        if (window.A11y) {
            window.A11y.speak(speakText);
        }

        // Show toast notification
        if (window.showToast) {
            window.showToast(`🚀 ${speakText}`, 'info', 2000);
        }

        // Smooth navigation after short delay to allow voice feedback
        setTimeout(() => {
            window.location.href = action.url;
        }, 1200);
    },

    async sendMessage(customText = null) {
        const inputEl = document.getElementById('chatbot-text-input');
        const text = customText || inputEl.value.trim();
        if (!text) return;

        inputEl.value = '';
        this.appendMessage('user', text);
        this.messages.push({ role: 'user', content: text });

        // Check for immediate voice / text command match
        const directAction = this.parseQuickVoiceAction(text);
        if (directAction) {
            this.appendMessage('assistant', directAction.reply, [], 'gemini_flash', directAction);
            this.executeAction(directAction);
            return;
        }

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
                this.appendMessage('assistant', res.reply, res.suggestedProducts, res.source, res.action);

                if (res.quickActions && res.quickActions.length > 0) {
                    this.renderQuickChips(res.quickActions);
                }

                if (res.action && res.action.type === 'navigate') {
                    this.executeAction(res.action);
                } else if (this.autoSpeak && window.A11y) {
                    A11y.speak(res.reply.replace(/[*_#•]/g, ''));
                }
            }
        } catch (err) {
            this.removeTypingIndicator(typingId);
            this.appendMessage('assistant', 'ขออภัยครับ กำลังปรับปรุงการเชื่อมต่อกับเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง');
        }
    },

    appendMessage(sender, text, suggestedProducts = [], source = 'gemini_flash', action = null) {
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

        // Render Action Button / Navigation Indicator if present
        if (action && action.url) {
            const actionCard = document.createElement('div');
            actionCard.style.cssText = 'max-width:85%; width:100%; margin-top:2px;';
            actionCard.innerHTML = `
                <a href="${action.url}" style="display:inline-flex; align-items:center; gap:8px; background:linear-gradient(135deg, #1b3329 0%, #2a5241 100%); color:#fef08a; padding:8px 16px; border-radius:9999px; text-decoration:none; font-size:0.85rem; font-weight:700; border:1px solid #df8a28; box-shadow:0 3px 8px rgba(27,51,41,0.2);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                    <span>${action.label || 'คลิกเพื่อไปยังหน้าเป้าหมาย'}</span>
                    <span style="font-size:0.75rem; background:rgba(223,138,40,0.3); padding:2px 6px; border-radius:9999px; color:#ffffff;">อัตโนมัติ 🚀</span>
                </a>
            `;
            msgDiv.appendChild(actionCard);
        }

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
