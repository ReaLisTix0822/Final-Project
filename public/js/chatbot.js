// ==============================================================================
// TALADJAI AI ASSISTANT CHATBOT WIDGET (POWERED BY GEMINI FLASH)
// ==============================================================================

const ChatbotWidget = {
    isOpen: false,
    autoSpeak: false,
    messages: [],

    // One id per browser tab so a conversation can be followed in chatbot_logs
    getSessionId() {
        try {
            let id = sessionStorage.getItem('taladjai_chat_session');
            if (!id) {
                id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
                sessionStorage.setItem('taladjai_chat_session', id);
            }
            return id;
        } catch {
            return null;
        }
    },

    HISTORY_KEY: 'taladjai_chat_history',
    HISTORY_LIMIT: 40,

    init() {
        this.renderWidgetDOM();
        this.addWelcomeMessage();
        this.restoreHistory();
        this.loadModelName();
    },

    // Conversation survives page changes in the same tab (sessionStorage)
    saveHistoryEntry(entry) {
        try {
            const list = JSON.parse(sessionStorage.getItem(this.HISTORY_KEY) || '[]');
            list.push(entry);
            sessionStorage.setItem(this.HISTORY_KEY, JSON.stringify(list.slice(-this.HISTORY_LIMIT)));
        } catch (e) { /* storage unavailable: chat still works on this page */ }
    },

    restoreHistory() {
        let list = [];
        try { list = JSON.parse(sessionStorage.getItem(this.HISTORY_KEY) || '[]'); } catch (e) { list = []; }
        if (!Array.isArray(list)) return;
        list.forEach(m => {
            this.appendMessage(m.sender, m.text, m.suggestedProducts || [], m.source, m.action, false);
            this.messages.push({ role: m.sender === 'user' ? 'user' : 'model', content: m.text });
        });
    },

    // Show the model the backend really uses (GEMINI_MODEL)
    async loadModelName() {
        try {
            let model = sessionStorage.getItem('taladjai_ai_model');
            if (!model) {
                const res = await API.get('/ai/status');
                model = res.model || '';
                sessionStorage.setItem('taladjai_ai_model', model);
            }
            document.querySelectorAll('#chatbot-widget-container [data-ai-model-name]').forEach(el => { el.textContent = model ? ` · ${model}` : ''; });
        } catch (e) { /* keep the generic label */ }
    },

    renderWidgetDOM() {
        if (document.getElementById('chatbot-widget-container')) return;

        if (!document.querySelector('link[href="/css/chatbot.css"]')) {
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = '/css/chatbot.css';
            document.head.appendChild(css);
        }

        const container = document.createElement('div');
        container.id = 'chatbot-widget-container';
        container.innerHTML = `
            <button id="chatbot-trigger-btn" type="button" class="cb-trigger" aria-expanded="false" aria-controls="chatbot-window" aria-label="เปิดผู้ช่วย น้องใจดี AI" aria-keyshortcuts="Alt+B" title="น้องใจดี AI (Alt+B)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span class="cb-trigger-text">น้องใจดี AI</span>
                <span class="cb-trigger-badge">Gemini</span>
            </button>

            <div id="chatbot-window" class="cb-window" role="dialog" aria-modal="false" aria-labelledby="cb-title">
                <div class="cb-header">
                    <span class="cb-avatar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
                    <div class="cb-title">
                        <div class="cb-title-row"><strong id="cb-title">น้องใจดี AI</strong><span class="cb-online">ออนไลน์</span></div>
                        <p class="cb-subtitle">ผู้ช่วยตลาดใจ · สั่งงานด้วยเสียงได้</p>
                    </div>
                    <button id="chatbot-tts-toggle" type="button" class="cb-head-btn" aria-pressed="false" aria-label="อ่านคำตอบออกเสียงอัตโนมัติ" title="เปิด/ปิด การอ่านคำตอบออกเสียง">
                        <span id="chatbot-tts-icon"></span>
                    </button>
                    <button id="chatbot-close-btn" type="button" class="cb-head-btn" aria-label="ปิดหน้าต่างแชทบอท" title="ปิดหน้าต่าง"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
                </div>

                <div id="chatbot-messages-body" class="cb-body" aria-live="polite"></div>

                <div class="cb-suggest" id="chatbot-suggest">
                    <p class="cb-suggest-title">ลองถามได้เลย</p>
                    <div id="chatbot-quick-chips"></div>
                </div>

                <div class="cb-composer">
                    <div class="cb-composer-row">
                        <button id="chatbot-mic-btn" type="button" class="cb-mic" aria-label="พูดคำถามหรือสั่งงานด้วยเสียง" title="พูดคำถามหรือสั่งงานด้วยเสียง"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/></svg></button>
                        <input type="text" id="chatbot-text-input" class="cb-input" placeholder="พิมพ์หรือพูดสั่งงาน" aria-label="พิมพ์ข้อความคุยกับน้องใจดี" autocomplete="off">
                        <button id="chatbot-send-btn" type="button" class="cb-send" aria-label="ส่งข้อความ"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/></svg></button>
                    </div>
                    <p class="cb-powered">ขับเคลื่อนโดย Google Gemini<span data-ai-model-name></span></p>
                </div>
            </div>
        `;

        document.body.appendChild(container);
        this.bindEvents();
        this.renderTtsState();
    },

    renderTtsState() {
        const btn = document.getElementById('chatbot-tts-toggle');
        const icon = document.getElementById('chatbot-tts-icon');
        if (!btn || !icon) return;
        const speaker = '<path d="M11 5 6 9H2v6h4l5 4V5Z"/>';
        icon.innerHTML = this.autoSpeak
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${speaker}<path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${speaker}<path d="m22 9-6 6M16 9l6 6"/></svg>`;
        btn.setAttribute('aria-pressed', String(Boolean(this.autoSpeak)));
        btn.title = this.autoSpeak ? 'ปิดการอ่านคำตอบออกเสียง' : 'เปิดการอ่านคำตอบออกเสียง';
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
        // Esc closes the chat window and puts focus back on the button that opened it
        document.getElementById('chatbot-window')?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                e.preventDefault();
                e.stopPropagation();
                this.close();
                trigger.focus();
            }
        });

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
                    micBtn.classList.add('is-listening');
                    micBtn.setAttribute('aria-label', 'กำลังฟังเสียง');
                    if (window.showToast) window.showToast('กำลังฟังเสียงคำสั่งของคุณ...', 'info');
                };

                rec.onresult = (event) => {
                    const text = event.results[0][0].transcript;
                    inputEl.value = text;
                    this.nextInputType = 'voice';
                    this.sendMessage();
                };

                rec.onerror = (event) => {
                    console.warn('Chatbot mic error:', event.error);
                };

                rec.onend = () => {
                    micBtn.classList.remove('is-listening');
                    micBtn.setAttribute('aria-label', 'พูดคำถามหรือสั่งงานด้วยเสียง');
                };

                rec.start();
            } catch (err) {
                console.error('Speech recognition error:', err);
            }
        });

        ttsToggle.addEventListener('click', () => {
            this.autoSpeak = !this.autoSpeak;
            this.renderTtsState();
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
            win.classList.add('is-open');
            this.isOpen = true;
            document.getElementById('chatbot-trigger-btn')?.setAttribute('aria-expanded', 'true');
            // Restored history: show the latest messages, not the welcome text
            const body = document.getElementById('chatbot-messages-body');
            if (body) body.scrollTop = body.scrollHeight;
            document.getElementById('chatbot-text-input').focus();
        }
    },

    close() {
        const win = document.getElementById('chatbot-window');
        if (win) {
            win.classList.remove('is-open');
            this.isOpen = false;
            document.getElementById('chatbot-trigger-btn')?.setAttribute('aria-expanded', 'false');
        }
    },

    addWelcomeMessage() {
        const body = document.getElementById('chatbot-messages-body');
        if (!body) return;
        const msg = document.createElement('div');
        msg.className = 'cb-msg';
        msg.innerHTML = `
            <div class="cb-msg-label">น้องใจดี</div>
            <div class="cb-bubble cb-welcome">
                <p>สวัสดีครับ! ผมคือ <b>น้องใจดี</b> ผู้ช่วยของตลาดใจ พร้อมช่วยคุณดังนี้ครับ</p>
                <ul class="cb-features">
                    <li><span class="cb-feature-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 7h12l1 14H5L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg></span><strong>แนะนำสินค้าหัตถกรรมและช่างฝีมือ</strong></li>
                    <li><span class="cb-feature-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/></svg></span><div><strong>สั่งงานด้วยเสียงเพื่อนำทาง</strong>
                        <div class="cb-examples"><span>“พาไปหน้าสินค้า”</span><span>“เปิดหน้าจับคู่”</span><span>“ค้นหา กระเป๋า”</span><span>“เปิดตะกร้า”</span></div></div></li>
                    <li><span class="cb-feature-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg></span><strong>ตรวจสอบสถานะคำสั่งซื้อและพัสดุ</strong></li>
                    <li><span class="cb-feature-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="4" r="2"/><path d="M5 8h14M12 8v6M9 21l3-7 3 7"/></svg></span><strong>แนะนำการใช้งานเว็บไซต์ตามมาตรฐานการเข้าถึง</strong></li>
                </ul>
            </div>`;
        body.appendChild(msg);

        this.renderQuickChips([
            'พาไปหน้าสินค้า',
            'เปิดหน้าจับคู่ 5 คำถาม',
            'แนะนำของขวัญราคาไม่เกิน 500 บาท',
            'เช็กสถานะพัสดุ'
        ]);
    },

    // Navigation happens only for a clear command: "พาไป...", "ไปหน้า...", "เปิด...", "นำทาง...", "ค้นหา ...".
    // Everything else (e.g. "แนะนำของขวัญราคาไม่เกิน 500 บาท") is a question and goes to Gemini.
    NAV_VERB: /^(?:ช่วย|ขอ)?\s*(?:พา(?:ฉัน|ผม|หนู|เรา)?\s*ไป(?:ที่|หน้า)?|ไปที่|ไปหน้า|เปิด(?:หน้า)?|นำทาง(?:ไป)?|กลับไป(?:ที่)?|go to|open)\s*/,
    NAV_TARGETS: [
        [/หน้าแรก|home/, '/index.html', 'หน้าแรก'],
        [/จับคู่|matching|แบบสอบถาม|แบบประเมิน/, '/matching.html?fresh=1', 'หน้าจับคู่ผู้สนับสนุน 5 คำถาม'],
        [/3d|สามมิติ|3 มิติ|โมเดล/, '/products.html?has_3d=true', 'สินค้าที่มีโมเดล 3D 360°'],
        [/ตะกร้า|cart|เช็คเอาท์/, '/cart.html', 'ตะกร้าสินค้า'],
        [/แดชบอร์ด|จัดการร้าน|หลังบ้าน/, '/seller-dashboard.html', 'แดชบอร์ดร้านค้า'],
        [/โปรไฟล์|บัญชี|คำสั่งซื้อ|profile/, '/profile.html', 'หน้าบัญชีของฉัน'],
        [/แคมเปญ|กิจกรรม|บูธ/, '/campaigns.html', 'หน้ากิจกรรมและงานออกบูธ'],
        [/ร้านค้า|ช่างฝีมือ/, '/stores.html', 'หน้ารวมร้านค้า'],
        [/สินค้า|ช็อป|shop/, '/products.html', 'หน้ารวมสินค้า'],
        [/เข้าสู่ระบบ|ล็อกอิน|login|สมัคร/, '/login.html', 'หน้าเข้าสู่ระบบ']
    ],

    parseQuickVoiceAction(text) {
        const cmd = text.toLowerCase().trim();

        const searchMatch = cmd.match(/^(?:ค้นหา|ค้น)\s*(?:สินค้า|ผลงาน)?\s+(.+)/);
        if (searchMatch && searchMatch[1].trim()) {
            const query = searchMatch[1].trim();
            return {
                type: 'navigate',
                url: `/products.html?search=${encodeURIComponent(query)}`,
                label: `ค้นหา "${query}"`,
                reply: `กำลังพาไปค้นหาสินค้า **"${query}"** ครับ`,
                speak: `กำลังค้นหาสินค้า ${query} ให้ครับ`
            };
        }

        if (!this.NAV_VERB.test(cmd)) return null;
        const target = this.NAV_TARGETS.find(([pattern]) => pattern.test(cmd.replace(this.NAV_VERB, '')));
        if (!target) return null;
        const [, url, name] = target;
        return {
            type: 'navigate',
            url,
            label: `ไปที่${name}`,
            reply: `กำลังพาไปที่ **${name}** ครับ`,
            speak: `กำลังพาไปที่${name}ครับ`
        };
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

    // Bot_Sessions.assist_mode, guessed from the accessibility settings in use ('visual' when unknown)
    assistMode() {
        const s = (window.A11y && A11y.settings) || {};
        if (s.focusReading || s.voiceActive) return 'visual';
        if (s.contrast === 'high' || ['font-size-lg', 'font-size-xl', 'font-size-2xl'].includes(s.fontSize)) return 'low_vision';
        if (s.bigCursor) return 'motor';
        return 'visual';
    },

    async sendMessage(customText = null) {
        const inputEl = document.getElementById('chatbot-text-input');
        const text = customText || inputEl.value.trim();
        if (!text) return;
        const inputType = this.nextInputType === 'voice' ? 'voice' : 'text';
        this.nextInputType = 'text';

        inputEl.value = '';
        this.appendMessage('user', text);
        this.messages.push({ role: 'user', content: text });

        // Check for immediate voice / text command match
        const directAction = this.parseQuickVoiceAction(text);
        if (directAction) {
            this.appendMessage('assistant', directAction.reply, [], 'gemini_flash', directAction);
            // Answered in the browser, so tell the server for chatbot_logs (keepalive survives navigation)
            fetch('/api/chatbot/log', {
                method: 'POST',
                headers: window.API ? API.getHeaders() : { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, reply: directAction.reply, action_url: directAction.url, session_id: this.getSessionId(), page_path: location.pathname, assist_mode: this.assistMode(), input_type: inputType }),
                keepalive: true
            }).catch(() => {});
            this.executeAction(directAction);
            return;
        }

        const typingId = this.showTypingIndicator();

        try {
            const res = await API.post('/chatbot/message', {
                message: text,
                session_id: this.getSessionId(),
                page_path: location.pathname,
                history: this.messages.slice(-6),
                assist_mode: this.assistMode(),
                input_type: inputType
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
                    A11y.speak(res.reply.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_#•`]/g, ''));
                }
            }
        } catch (err) {
            this.removeTypingIndicator(typingId);
            this.appendMessage('assistant', 'ขออภัยครับ กำลังปรับปรุงการเชื่อมต่อกับเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง');
        }
    },

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    },

    // Safe Markdown: escape everything first, then allow **bold**, "- " lists, [text](/link) and bare /page.html paths
    renderMarkdown(text) {
        const inline = line => this.escapeHtml(line)
            .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\[([^\]]+)\]\((\/[\w\-./?=&%#]*|https?:\/\/[^\s)]+)\)/g, (m, label, url) =>
                `<a href="${url}"${url.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`)
            .replace(/(^|[\s(])(\/[\w\-]+\.html(?:\?[\w=&%-]*)?)(?=[\s).,]|$)/g, '$1<a href="$2">$2</a>');
        const html = [];
        let list = null;
        String(text || '').split('\n').forEach(raw => {
            const line = raw.trim();
            const item = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
            if (item) {
                if (!list) { list = []; }
                list.push(`<li>${inline(item[1])}</li>`);
                return;
            }
            if (list) { html.push(`<ul>${list.join('')}</ul>`); list = null; }
            if (line) html.push(`<p>${inline(line)}</p>`);
        });
        if (list) html.push(`<ul>${list.join('')}</ul>`);
        // Links to the matching page from the bot always start a new questionnaire
        return html.join('').replace(/href="\/matching\.html"/g, 'href="/matching.html?fresh=1"');
    },

    appendMessage(sender, text, suggestedProducts = [], source = 'gemini_flash', action = null, persist = true) {
        if (persist) this.saveHistoryEntry({ sender, text, suggestedProducts: (suggestedProducts || []).slice(0, 3), source, action });
        const body = document.getElementById('chatbot-messages-body');
        if (!body) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = `cb-msg${sender === 'user' ? ' is-user' : ''}`;

        const formattedText = sender === 'user' ? this.escapeHtml(text) : this.renderMarkdown(text);

        if (sender === 'assistant') {
            const label = document.createElement('div');
            label.className = 'cb-msg-label';
            label.innerHTML = source === 'gemini_flash' ? 'น้องใจดี' : 'น้องใจดี <span>· ระบบสำรอง</span>';
            msgDiv.appendChild(label);
        }

        const bubble = document.createElement('div');
        bubble.className = 'cb-bubble';
        bubble.innerHTML = formattedText;
        msgDiv.appendChild(bubble);

        if (action && action.url) {
            const link = document.createElement('a');
            link.className = 'cb-action';
            link.href = action.url;
            link.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg><span></span>`;
            link.querySelector('span').textContent = action.label || 'ไปยังหน้าเป้าหมาย';
            msgDiv.appendChild(link);
        }

        if (suggestedProducts && suggestedProducts.length > 0) {
            const prodList = document.createElement('div');
            prodList.className = 'cb-products';
            prodList.innerHTML = suggestedProducts.map(p => `
                <div class="cb-product">
                    <img loading="lazy" decoding="async" src="${this.escapeHtml(p.image_url)}" alt="">
                    <div class="cb-product-info">
                        <strong>${this.escapeHtml(p.name)}</strong>
                        <span>${TJFormat.money(Number(p.price))}</span>
                    </div>
                    <a href="/product-detail.html?id=${Number(p.id)}">ดูชิ้นงาน</a>
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
        document.getElementById('chatbot-suggest').hidden = chips.length === 0;
        chipsContainer.replaceChildren(...chips.map(text => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'cb-chip';
            chip.textContent = text;
            chip.addEventListener('click', () => this.sendMessage(text));
            return chip;
        }));
    },

    showTypingIndicator() {
        const body = document.getElementById('chatbot-messages-body');
        const id = 'typing-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.className = 'cb-typing';
        div.setAttribute('role', 'status');
        div.setAttribute('aria-label', 'น้องใจดีกำลังพิมพ์คำตอบ');
        div.innerHTML = '<i></i><i></i><i></i>';
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
