// ==============================================================================
// UNIVERSAL ACCESSIBILITY ENGINE (WCAG 2.1 LEVEL AA)
// Web Speech API (TTS / STT Voice Commands), High-Contrast, Font Scalers,
// Keyboard Navigation & Cognitive Support Mode
// ==============================================================================

const A11y = {
    settings: {
        fontSize: 'font-size-md', // 'font-size-md', 'font-size-lg', 'font-size-xl', 'font-size-2xl'
        dyslexiaFont: false,
        easyMode: false,
        speechRate: 1.0,
        voiceActive: false
    },

    synth: window.speechSynthesis || null,
    recognition: null,

    init() {
        this.loadSettings();
        this.applySettings();
        this.initSpeechRecognition();
        this.initKeyboardShortcuts();
        // this.renderFloatingWidget(); // Temporarily removed per user request
        this.bindReadableElements();
    },

    loadSettings() {
        try {
            const saved = localStorage.getItem('a11y_settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn('Cannot load a11y settings from localStorage');
        }
    },

    saveSettings() {
        try {
            localStorage.setItem('a11y_settings', JSON.stringify(this.settings));
        } catch (e) {
            console.warn('Cannot save a11y settings');
        }
    },

    applySettings() {
        const body = document.body;

        // Clean up any residual theme classes
        body.classList.remove('theme-high-contrast-dark', 'theme-high-contrast-light');

        // Apply font size
        body.classList.remove('font-size-md', 'font-size-lg', 'font-size-xl', 'font-size-2xl');
        body.classList.add(this.settings.fontSize || 'font-size-md');

        // Apply Dyslexia font
        if (this.settings.dyslexiaFont) {
            body.classList.add('dyslexia-font');
        } else {
            body.classList.remove('dyslexia-font');
        }

        // Apply Easy Mode
        if (this.settings.easyMode) {
            body.classList.add('easy-mode');
        } else {
            body.classList.remove('easy-mode');
        }

        this.updateWidgetUI();
    },

    setTheme(themeName) {
        // Theme system removed per user request
    },

    setFontSize(sizeClass) {
        this.settings.fontSize = sizeClass;
        this.saveSettings();
        this.applySettings();
        this.announceToScreenReader(`ปรับขนาดตัวอักษรเรียบร้อยแล้ว`);
    },

    toggleDyslexiaFont() {
        this.settings.dyslexiaFont = !this.settings.dyslexiaFont;
        this.saveSettings();
        this.applySettings();
        this.announceToScreenReader(`โหมดฟอนต์ช่วยการอ่าน: ${this.settings.dyslexiaFont ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}`);
    },

    toggleEasyMode() {
        this.settings.easyMode = !this.settings.easyMode;
        this.saveSettings();
        this.applySettings();
        this.announceToScreenReader(`โหมดเข้าใจง่ายและขั้นตอนแบ่งย่อย: ${this.settings.easyMode ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}`);
        if (window.showToast) {
            window.showToast(`โหมดเข้าใจง่าย: ${this.settings.easyMode ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}`, 'info');
        }
    },

    // --------------------------------------------------------------------------
    // Text-to-Speech (TTS Engine) - Web Speech API
    // --------------------------------------------------------------------------
    speak(text, onEndCallback = null) {
        if (!this.synth) {
            console.warn('Speech Synthesis not supported by this browser.');
            return;
        }

        // Cancel existing speech
        this.synth.cancel();

        if (!text || text.trim() === '') return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = this.settings.speechRate || 1.0;
        utterance.pitch = 1.0;

        // Try to select Thai voice if available
        const voices = this.synth.getVoices();
        const thaiVoice = voices.find(v => v.lang === 'th-TH' || v.lang.includes('th'));
        if (thaiVoice) {
            utterance.voice = thaiVoice;
        } else {
            utterance.lang = 'th-TH';
        }

        if (onEndCallback) {
            utterance.onend = onEndCallback;
        }

        // Visual indicator in toast
        if (window.showToast) {
            window.showToast('กำลังอ่านออกเสียง...', 'info', 2000);
        }

        this.synth.speak(utterance);
    },

    stopSpeech() {
        if (this.synth) {
            this.synth.cancel();
            if (window.showToast) {
                window.showToast('หยุดการอ่านออกเสียงแล้ว', 'info', 1500);
            }
        }
    },

    // --------------------------------------------------------------------------
    // Speech-to-Text & Voice Command Navigation (STT)
    // --------------------------------------------------------------------------
    initSpeechRecognition() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            console.warn('SpeechRecognition not supported in this browser.');
            return;
        }

        this.recognition = new SpeechRec();
        this.recognition.lang = 'th-TH';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        this.recognition.onstart = () => {
            this.settings.voiceActive = true;
            this.showVoiceBanner('กำลังฟังคำสั่งเสียง... (เช่น "หน้าแรก", "ค้นหาสินค้า", "จับคู่", "ตะกร้า", "แชทบอท")');
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log('Voice command received:', transcript);
            this.handleVoiceCommand(transcript);
        };

        this.recognition.onerror = (event) => {
            console.warn('Speech recognition error:', event.error);
            this.hideVoiceBanner();
        };

        this.recognition.onend = () => {
            this.settings.voiceActive = false;
            this.hideVoiceBanner();
        };
    },

    startVoiceCommand() {
        if (!this.recognition) {
            if (window.showToast) {
                window.showToast('เบราว์เซอร์ของคุณยังไม่รองรับการสั่งงานด้วยเสียง (แนะนำ Google Chrome / Edge)', 'warning');
            }
            return;
        }
        try {
            this.recognition.start();
        } catch (e) {
            this.recognition.stop();
        }
    },

    handleVoiceCommand(transcript) {
        const cmd = transcript.toLowerCase().trim();
        this.showVoiceBanner(`คำสั่งที่ได้ยิน: "${transcript}"`);

        if (cmd.includes('หน้าแรก') || cmd.includes('home')) {
            this.speak('กำลังไปที่หน้าแรก');
            setTimeout(() => window.location.href = '/index.html', 1000);
        }
        else if (cmd.includes('สินค้า') || cmd.includes('ค้นหา') || cmd.includes('shop')) {
            this.speak('กำลังไปที่หน้าค้นหาสินค้า');
            setTimeout(() => window.location.href = '/products.html', 1000);
        }
        else if (cmd.includes('จับคู่') || cmd.includes('matching') || cmd.includes('แนะนำ')) {
            this.speak('กำลังเปิดระบบจับคู่ผู้สนับสนุน');
            setTimeout(() => window.location.href = '/matching.html', 1000);
        }
        else if (cmd.includes('ตะกร้า') || cmd.includes('สั่งซื้อ') || cmd.includes('cart')) {
            this.speak('กำลังไปที่ตะกร้าสินค้า');
            setTimeout(() => window.location.href = '/cart.html', 1000);
        }
        else if (cmd.includes('แคมเปญ') || cmd.includes('บูธ') || cmd.includes('งาน')) {
            this.speak('กำลังไปที่หน้ากิจกรรมและงานออกบูธ');
            setTimeout(() => window.location.href = '/campaigns.html', 1000);
        }
        else if (cmd.includes('แชท') || cmd.includes('บอท') || cmd.includes('ช่วย')) {
            this.speak('กำลังเปิดผู้ช่วยแชทบอท');
            if (window.ChatbotWidget) {
                window.ChatbotWidget.open();
            }
        }
        else if (cmd.includes('ขยาย') || cmd.includes('ตัวหนังสือ')) {
            this.setFontSize('font-size-xl');
            this.speak('ขยายขนาดตัวหนังสือแล้ว');
        }
        else if (cmd.includes('หยุด') || cmd.includes('stop')) {
            this.stopSpeech();
        }
        else {
            this.speak(`รับคำสั่ง "${transcript}" แต่ไม่พบรายการนำทาง แนะนำให้พูดคำว่า "หน้าแรก", "ค้นหาสินค้า", "จับคู่", หรือ "ตะกร้า" ครับ`);
        }
    },

    showVoiceBanner(text) {
        let banner = document.getElementById('voice-indicator-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'voice-indicator-banner';
            document.body.appendChild(banner);
        }
        banner.innerHTML = `<span style="font-size:0.95rem; font-weight:700;">[เสียง]</span> <span>${text}</span>`;
        banner.classList.add('active');
    },

    hideVoiceBanner() {
        const banner = document.getElementById('voice-indicator-banner');
        if (banner) {
            setTimeout(() => {
                banner.classList.remove('active');
            }, 2500);
        }
    },

    // --------------------------------------------------------------------------
    // Keyboard Shortcuts (WCAG 2.1 2.1.1 Keyboard Accessible)
    // --------------------------------------------------------------------------
    initKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            // Alt + A: Open Accessibility Panel
            if (e.altKey && (e.key === 'a' || e.key === 'A' || e.key === 'ฟ')) {
                e.preventDefault();
                this.toggleWidgetPanel();
            }
            // Alt + S: Stop Speech
            else if (e.altKey && (e.key === 's' || e.key === 'S' || e.key === 'ห')) {
                e.preventDefault();
                this.stopSpeech();
            }
            // Alt + B: Open Chatbot
            else if (e.altKey && (e.key === 'b' || e.key === 'B' || e.key === 'ิ')) {
                e.preventDefault();
                if (window.ChatbotWidget) {
                    window.ChatbotWidget.open();
                }
            }
            // Alt + H: Go Home
            else if (e.altKey && (e.key === 'h' || e.key === 'H' || e.key === '้')) {
                e.preventDefault();
                window.location.href = '/index.html';
            }
            // Escape: Close opened panels/modals
            else if (e.key === 'Escape') {
                const panel = document.getElementById('a11y-panel');
                if (panel && panel.classList.contains('active')) {
                    panel.classList.remove('active');
                }
                if (window.ChatbotWidget && window.ChatbotWidget.isOpen) {
                    window.ChatbotWidget.close();
                }
            }
        });
    },

    announceToScreenReader(message) {
        let liveRegion = document.getElementById('a11y-live-region');
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'a11y-live-region';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.className = 'sr-only';
            document.body.appendChild(liveRegion);
        }
        liveRegion.textContent = message;
    },

    bindReadableElements() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-tts-read]');
            if (btn) {
                e.preventDefault();
                const targetSelector = btn.getAttribute('data-tts-read');
                let textToRead = '';
                if (targetSelector === 'self') {
                    textToRead = btn.getAttribute('data-tts-text') || btn.innerText;
                } else {
                    const targetEl = document.querySelector(targetSelector);
                    textToRead = targetEl ? targetEl.innerText : btn.innerText;
                }
                this.speak(textToRead);
            }
        });
    },

    // --------------------------------------------------------------------------
    // Floating Accessibility Widget DOM Injection
    // --------------------------------------------------------------------------
    renderFloatingWidget() {
        return; // Disabled per user request
        if (document.getElementById('a11y-floating-widget')) return;

        const widget = document.createElement('div');
        widget.id = 'a11y-floating-widget';
        widget.setAttribute('role', 'region');
        widget.setAttribute('aria-label', 'เครื่องมือช่วยเหลือการเข้าถึง');

        widget.innerHTML = `
            <button id="a11y-trigger" class="a11y-trigger-btn" aria-label="เปิดเมนูช่วยเหลือการเข้าถึง (คีย์ลัด Alt+A)" title="เมนูการเข้าถึง (Alt+A)">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;"><circle cx="12" cy="4" r="2"></circle><path d="M18 9h-7l-2 13"></path><path d="M14 9v6l3 5"></path><path d="M5 9h5"></path></svg>
                <span>การเข้าถึง</span>
            </button>

            <div id="a11y-panel" class="a11y-panel" role="dialog" aria-modal="false" aria-label="ตั้งค่าการเข้าถึงเว็บไซต์">
                <div class="a11y-panel-header">
                    <div class="a11y-panel-title">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;"><circle cx="12" cy="4" r="2"></circle><path d="M18 9h-7l-2 13"></path><path d="M14 9v6l3 5"></path><path d="M5 9h5"></path></svg>
                        <span>เครื่องมือการเข้าถึง (WCAG)</span>
                    </div>
                    <button id="a11y-close" class="btn btn-sm btn-outline" style="padding:2px 8px; min-height:28px;" aria-label="ปิดเมนูการเข้าถึง">✕</button>
                </div>

                <!-- 1. Text-to-Speech & Voice -->
                <div class="a11y-option-group">
                    <div class="a11y-option-label">ระบบเสียงและการสั่งงาน</div>
                    <div class="a11y-btn-grid">
                        <button onclick="A11y.startVoiceCommand()" class="a11y-btn-pill" title="สั่งงานด้วยเสียง เช่น 'ค้นหาสินค้า', 'หน้าแรก'">สั่งด้วยเสียง</button>
                        <button onclick="A11y.stopSpeech()" class="a11y-btn-pill" title="หยุดเสียงอ่านทันที (Alt+S)">หยุดอ่านเสียง</button>
                    </div>
                </div>

                <!-- 3. Font Sizing -->
                <div class="a11y-option-group">
                    <div class="a11y-option-label">ขนาดตัวอักษร</div>
                    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:4px;">
                        <button onclick="A11y.setFontSize('font-size-md')" id="btn-font-md" class="a11y-btn-pill" title="ขนาดมาตรฐาน">A</button>
                        <button onclick="A11y.setFontSize('font-size-lg')" id="btn-font-lg" class="a11y-btn-pill" title="ใหญ่ขึ้น 20%">A+</button>
                        <button onclick="A11y.setFontSize('font-size-xl')" id="btn-font-xl" class="a11y-btn-pill" title="ใหญ่ขึ้น 40%">A++</button>
                        <button onclick="A11y.setFontSize('font-size-2xl')" id="btn-font-2xl" class="a11y-btn-pill" title="ใหญ่สุด 60%">A+++</button>
                    </div>
                </div>

                <!-- 4. Cognitive & Dyslexia Assistance -->
                <div class="a11y-option-group">
                    <div class="a11y-option-label">ฟังก์ชันช่วยเหลือพิเศษ</div>
                    <div class="a11y-btn-grid">
                        <button onclick="A11y.toggleEasyMode()" id="btn-easy-mode" class="a11y-btn-pill">โหมดเข้าใจง่าย</button>
                        <button onclick="A11y.toggleDyslexiaFont()" id="btn-dyslexia" class="a11y-btn-pill">ฟอนต์อ่านง่าย</button>
                    </div>
                </div>

                <div style="font-size:0.75rem; color:var(--text-muted); border-top:1px solid var(--border-color); padding-top:6px;">
                    <b>ปุ่มลัด:</b> <code>Alt+A</code> เมนูนี้ | <code>Alt+S</code> หยุดเสียง | <code>Alt+B</code> แชทบอท
                </div>
            </div>
        `;

        document.body.appendChild(widget);

        // Bind open/close clicks
        document.getElementById('a11y-trigger').addEventListener('click', () => {
            this.toggleWidgetPanel();
        });

        document.getElementById('a11y-close').addEventListener('click', () => {
            document.getElementById('a11y-panel').classList.remove('active');
        });
    },

    toggleWidgetPanel() {
        const panel = document.getElementById('a11y-panel');
        if (panel) {
            panel.classList.toggle('active');
        }
    },

    updateWidgetUI() {
        // Highlight active pills in widget
        ['md', 'lg', 'xl', '2xl'].forEach(sz => {
            const el = document.getElementById(`btn-font-${sz}`);
            if (el) {
                el.classList.toggle('active', this.settings.fontSize === `font-size-${sz}`);
            }
        });

        const easyBtn = document.getElementById('btn-easy-mode');
        if (easyBtn) easyBtn.classList.toggle('active', this.settings.easyMode);

        const dysBtn = document.getElementById('btn-dyslexia');
        if (dysBtn) dysBtn.classList.toggle('active', this.settings.dyslexiaFont);
    }
};

// Global helper for TTS reading
function speakStory(text) {
    A11y.speak(text);
}

if (typeof window !== 'undefined') {
    window.A11y = A11y;
}
