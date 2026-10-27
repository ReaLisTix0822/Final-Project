// ==============================================================================
// UNIVERSAL ACCESSIBILITY ENGINE (WCAG 2.1 LEVEL AA)
// Web Speech API (TTS / STT Voice Commands), High-Contrast, Font Scalers,
// Keyboard Navigation & Cognitive Support Mode
// ==============================================================================

// Default of every option (also what "คืนค่าเริ่มต้นทั้งหมด" goes back to)
const A11Y_DEFAULTS = Object.freeze({
    fontSize: 'font-size-md',   // 'font-size-md' 100% | 'font-size-lg' 125% | 'font-size-xl' 150%
    dyslexiaFont: false,
    tooltips: false,            // a bubble with the name / hint of the control under the pointer or focus
    speechRate: 1.0,            // 0.75 | 1.0 | 1.5
    voiceEnabled: false,        // the user turned voice commands on (kept); the microphone itself needs a click
    contrast: 'normal',         // 'normal' | 'high' | 'grayscale'
    highlightLinks: false,
    textSpacing: false,
    bigCursor: false,
    stopMotion: false,
    focusReading: false         // read aloud only the element keyboard focus is on
});
const A11Y_FONT_SIZES = ['font-size-md', 'font-size-lg', 'font-size-xl'];
const A11Y_SPEECH_RATES = [0.75, 1, 1.5];
// Thai typeface with loops (heads) + a Latin face made for low vision; loaded only when the option is on
const A11Y_READABLE_FONT_URL = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Noto+Sans+Thai+Looped:wght@400;600;700&display=swap';

// Browser option <-> column of accessibility_settings (routes/accessibilitySettings.js)
const A11Y_SERVER_FIELDS = {
    fontSize: ['font_size', { 'font-size-md': 'normal', 'font-size-lg': 'large', 'font-size-xl': 'x-large' }],
    contrast: ['contrast_mode', { normal: 'default', high: 'high', grayscale: 'grayscale' }],
    voiceEnabled: ['voice_enabled'],
    stopMotion: ['reduce_motion'],
    dyslexiaFont: ['dyslexia_font'],
    highlightLinks: ['highlight_links'],
    textSpacing: ['text_spacing'],
    bigCursor: ['big_cursor'],
    tooltips: ['show_tooltips'],
    focusReading: ['focus_reading'],
    speechRate: ['speech_rate']
};

const A11y = {
    // voiceActive: the microphone is listening right now (not saved; read by chatbot.js)
    settings: { ...A11Y_DEFAULTS, voiceActive: false },

    synth: window.speechSynthesis || null,
    recognition: null,
    voiceUnavailable: '',     // why voice commands cannot work here ('' = they can)
    serverTimer: null,

    init() {
        this.loadSettings();
        this.applySettings();
        this.initSpeechRecognition();
        this.initKeyboardShortcuts();
        this.renderMenu();
        this.bindReadableElements();
        this.initFocusReading();
        this.initServerSync();
        this.initVoiceInputs();
        this.initTooltips();
    },

    // --------------------------------------------------------------------------
    // Speak instead of typing, for fields marked data-voice-input (long Thai text such as a
    // name or a store name; never email, password or phone). One field listens at a time.
    // --------------------------------------------------------------------------
    voiceInput: null,

    initVoiceInputs() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        const fields = document.querySelectorAll('[data-voice-input]');
        if (!SpeechRec || !fields.length) return;   // no button that cannot work
        document.querySelectorAll('[data-voice-input-note]').forEach(note => { note.hidden = false; });
        const noteId = document.querySelector('[data-voice-input-note]')?.id;
        const mic = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/></svg>';
        fields.forEach(field => {
            const label = (field.labels?.[0]?.textContent || field.getAttribute('aria-label') || 'ข้อความ').replace('*', '').trim();
            const wrap = document.createElement('span');
            wrap.className = 'voice-input-wrap';
            field.before(wrap);
            wrap.append(field);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'voice-input-btn';
            button.setAttribute('aria-pressed', 'false');
            button.dataset.label = label;
            button.setAttribute('aria-label', `พูดเพื่อกรอก ${label}`);
            button.title = `พูดเพื่อกรอก ${label}`;
            if (noteId) button.setAttribute('aria-describedby', noteId);
            button.innerHTML = `${mic}<span class="voice-input-dot" aria-hidden="true"></span>`;
            button.addEventListener('click', () => this.toggleVoiceInput(field, button));
            wrap.append(button);
        });
    },

    // --------------------------------------------------------------------------
    // Tooltips ("คำอธิบายปุ่ม"): a bubble with what a control is or does, shown on pointer hover or
    // keyboard focus. WCAG 1.4.13: Esc closes it, the pointer can move onto it, it stays until the
    // pointer / focus leaves. Shown only when it adds something (icon buttons, hints of fields).
    // --------------------------------------------------------------------------
    TOOLTIP_TARGETS: 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="link"], [tabindex]:not([tabindex="-1"])',
    tooltipFor: null,
    tooltipTimer: null,

    tooltipText(el) {
        const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
        const byIds = ids => clean(String(ids || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' '));
        // A hint that is already printed on the page is not repeated in a bubble (it would only cover it)
        const shown = node => node && node.offsetParent !== null && !node.closest('.sr-only, .visually-hidden') && node.getBoundingClientRect().width > 1;
        const hiddenHints = ids => clean(String(ids || '').split(/\s+/).map(id => document.getElementById(id)).filter(n => n && !shown(n)).map(n => n.textContent).join(' '));
        const isField = el.matches('input, select, textarea');
        // Words a sighted user can read on the control (screen-reader-only text does not count)
        const visibleText = node => {
            const copy = node.cloneNode(true);
            copy.querySelectorAll('.sr-only, .visually-hidden, [aria-hidden="true"], [hidden]').forEach(n => n.remove());
            return copy.textContent;
        };
        const visible = clean(isField ? '' : visibleText(el));
        const title = clean(el.dataset.tooltip || el.dataset.a11yTitle || el.getAttribute('title'));
        const label = clean(el.getAttribute('aria-label')) || byIds(el.getAttribute('aria-labelledby'));
        if (isField) {
            // Fields already show their label and hint; the bubble only adds a hint that is not printed on the page
            const name = clean(Array.from(el.labels || []).map(l => l.textContent).join(' ')).replace(/\*/g, '').trim() || label;
            const extra = hiddenHints(el.getAttribute('aria-describedby')) || title;
            return extra && extra !== name ? `${name ? name + ': ' : ''}${extra}` : '';
        }
        const name = label || title || visible;
        // Nothing new when the words on the control already say it all
        const parts = [];
        if (name && name !== visible) parts.push(name);
        const unseenHint = hiddenHints(el.getAttribute('aria-describedby'));
        if (unseenHint && unseenHint !== name && unseenHint !== visible) parts.push(unseenHint);
        if (title && !parts.includes(title) && title !== visible) parts.push(title);
        return parts.join(' — ');
    },

    showTooltip(el) {
        const text = this.tooltipText(el);
        if (!text) { this.hideTooltip(); return; }
        clearTimeout(this.tooltipTimer);
        if (this.tooltipFor && this.tooltipFor !== el) this.restoreTitle(this.tooltipFor);
        // The browser's own title bubble would appear on top of this one: keep it aside while shown
        if (el.hasAttribute('title')) { el.dataset.a11yTitle = el.getAttribute('title'); el.removeAttribute('title'); }
        let tip = document.getElementById('a11y-tooltip');
        if (!tip) {
            tip = document.createElement('div');
            tip.id = 'a11y-tooltip';
            tip.className = 'a11y-tooltip';
            // A visual aid: the same words are already the control's name / description for screen readers
            tip.setAttribute('aria-hidden', 'true');
            tip.addEventListener('pointerenter', () => clearTimeout(this.tooltipTimer));
            tip.addEventListener('pointerleave', () => this.queueHideTooltip());
            document.body.appendChild(tip);
        }
        tip.textContent = text;
        tip.hidden = false;
        this.tooltipFor = el;
        const r = el.getBoundingClientRect();
        const w = tip.offsetWidth, h = tip.offsetHeight;
        const below = r.bottom + 8 + h <= window.innerHeight || r.top - 8 - h < 0;
        tip.style.top = `${Math.round(below ? r.bottom + 8 : r.top - 8 - h)}px`;
        tip.style.left = `${Math.round(Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8))}px`;
        tip.dataset.side = below ? 'below' : 'above';
    },

    restoreTitle(el) {
        if (el && 'a11yTitle' in el.dataset) { el.setAttribute('title', el.dataset.a11yTitle); delete el.dataset.a11yTitle; }
    },

    hideTooltip() {
        clearTimeout(this.tooltipTimer);
        const tip = document.getElementById('a11y-tooltip');
        if (tip) tip.hidden = true;
        this.restoreTitle(this.tooltipFor);
        this.tooltipFor = null;
    },

    queueHideTooltip() {
        clearTimeout(this.tooltipTimer);
        this.tooltipTimer = setTimeout(() => this.hideTooltip(), 200);
    },

    initTooltips() {
        const target = node => (node instanceof Element ? node.closest(this.TOOLTIP_TARGETS) : null);
        document.addEventListener('pointerover', e => {
            if (!this.settings.tooltips || e.target.closest?.('#a11y-tooltip')) return;
            const el = target(e.target);
            if (el === this.tooltipFor) { if (el) clearTimeout(this.tooltipTimer); return; }
            // A control with nothing to explain does not take the bubble away from the focused control
            if (el && this.tooltipText(el)) this.showTooltip(el);
        });
        document.addEventListener('pointerout', e => {
            if (!this.settings.tooltips || !this.tooltipFor) return;
            const to = e.relatedTarget;
            if (to && (this.tooltipFor.contains(to) || to.closest?.('#a11y-tooltip'))) return;
            if (document.activeElement !== this.tooltipFor) this.queueHideTooltip();
        });
        document.addEventListener('focusin', e => {
            if (!this.settings.tooltips) return;
            const el = target(e.target);
            if (el) this.showTooltip(el); else this.hideTooltip();
        });
        document.addEventListener('focusout', () => { if (this.tooltipFor) this.queueHideTooltip(); });
        // Esc closes the bubble first (and does nothing else on that press)
        window.addEventListener('keydown', e => {
            if (e.key !== 'Escape' || !this.tooltipFor || document.getElementById('a11y-tooltip')?.hidden) return;
            e.stopPropagation();
            e.preventDefault();
            this.hideTooltip();
        }, true);
        // Scrolling (also the browser bringing a focused control into view) moves the bubble with its control
        let frame = 0;
        window.addEventListener('scroll', () => {
            if (!this.tooltipFor || frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                if (!this.tooltipFor) return;
                const r = this.tooltipFor.getBoundingClientRect();
                if (r.bottom < 0 || r.top > window.innerHeight) this.hideTooltip(); else this.showTooltip(this.tooltipFor);
            });
        }, { passive: true, capture: true });
        window.addEventListener('resize', () => this.hideTooltip());
    },

    setVoiceInputState(button, listening) {
        button.setAttribute('aria-pressed', String(listening));
        button.classList.toggle('is-listening', listening);
        const text = listening ? `กำลังฟัง กดอีกครั้งเพื่อหยุด (${button.dataset.label})` : `พูดเพื่อกรอก ${button.dataset.label}`;
        button.setAttribute('aria-label', text);
        button.title = text;
    },

    toggleVoiceInput(field, button) {
        if (this.voiceInput?.button === button) { this.voiceInput.recognition.stop(); return; }
        this.voiceInput?.recognition.stop();
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRec();
        recognition.lang = 'th-TH';
        recognition.continuous = false;
        recognition.interimResults = false;
        this.voiceInput = { recognition, button };
        let heard = false;
        recognition.onstart = () => {
            this.setVoiceInputState(button, true);
            this.announceToScreenReader(`เริ่มฟังแล้ว พูด${button.dataset.label}ได้เลย`);
        };
        recognition.onresult = event => {
            const text = String(event.results[0][0].transcript || '').trim();
            if (!text) return;
            heard = true;
            // Empty field: the words become its value; otherwise they are added after a space
            field.value = field.value.trim() ? `${field.value.trim()} ${text}` : text;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            this.announceToScreenReader(`ใส่ใน${button.dataset.label}แล้ว: ${field.value}`);
        };
        recognition.onerror = event => {
            if (['not-allowed', 'service-not-allowed'].includes(event.error)) this.announceToScreenReader(this.VOICE_MESSAGES.denied);
            else if (event.error === 'audio-capture') this.announceToScreenReader(this.VOICE_MESSAGES.nomic);
            else if (event.error === 'no-speech') this.announceToScreenReader('ไม่ได้ยินเสียง กดปุ่มไมค์แล้วลองพูดอีกครั้ง');
            if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)) {
                window.showToast?.(event.error === 'audio-capture' ? this.VOICE_MESSAGES.nomic : this.VOICE_MESSAGES.denied, 'warning', 8000);
            }
        };
        recognition.onend = () => {
            this.setVoiceInputState(button, false);
            if (this.voiceInput?.button === button) this.voiceInput = null;
            // Back to the field, so the user can check or fix what was written
            if (heard) field.focus();
        };
        try { recognition.start(); } catch (e) { this.voiceInput = null; }
    },

    // Keeps only known options with valid values (old or edited storage cannot break the page)
    cleanSettings(values) {
        const clean = { ...A11Y_DEFAULTS };
        for (const key of Object.keys(A11Y_DEFAULTS)) {
            if (!(key in (values || {}))) continue;
            const value = values[key];
            if (key === 'fontSize') clean.fontSize = value === 'font-size-2xl' ? 'font-size-xl' : (A11Y_FONT_SIZES.includes(value) ? value : A11Y_DEFAULTS.fontSize);
            else if (key === 'contrast') clean.contrast = ['high', 'grayscale'].includes(value) ? value : 'normal';
            else if (key === 'speechRate') clean.speechRate = A11Y_SPEECH_RATES.find(rate => Math.abs(rate - Number(value)) < 0.001) || 1;
            else clean[key] = !!value;
        }
        return clean;
    },

    loadSettings() {
        try {
            const saved = localStorage.getItem('a11y_settings');
            // Text size only started working in v2; a size saved before then was never seen
            // by the user, so start everyone from the normal size once.
            const parsed = saved ? JSON.parse(saved) : {};
            if (localStorage.getItem('a11y_font_v2') !== '1') {
                parsed.fontSize = 'font-size-md';
                localStorage.setItem('a11y_font_v2', '1');
            }
            this.settings = { ...this.cleanSettings(parsed), voiceActive: false };
            if (saved) this.saveLocal();
        } catch (e) {
            console.warn('Cannot load a11y settings from localStorage');
        }
    },

    saveLocal() {
        try {
            const { voiceActive, ...kept } = this.settings;
            localStorage.setItem('a11y_settings', JSON.stringify(kept));
        } catch (e) {
            console.warn('Cannot save a11y settings');
        }
    },

    // Every change: the browser right away, the account (if logged in) 0.5 s after the last change
    saveSettings() {
        this.saveLocal();
        this.queueServerSave();
    },

    // --------------------------------------------------------------------------
    // Settings on the account (table accessibility_settings)
    // Not logged in: browser only. Any failure is silent; the browser copy keeps working.
    // --------------------------------------------------------------------------
    isLoggedIn() {
        return typeof API !== 'undefined' && window.Auth?.isLoggedIn?.() === true;
    },

    toServer() {
        const body = {};
        for (const [key, [column, map]] of Object.entries(A11Y_SERVER_FIELDS)) {
            body[column] = map ? map[this.settings[key]] : this.settings[key];
        }
        return body;
    },

    fromServer(data) {
        const values = {};
        for (const [key, [column, map]] of Object.entries(A11Y_SERVER_FIELDS)) {
            if (!(column in data)) continue;
            values[key] = map ? Object.keys(map).find(option => map[option] === data[column]) : data[column];
        }
        return this.cleanSettings(values);
    },

    queueServerSave() {
        if (!this.isLoggedIn()) return;
        clearTimeout(this.serverTimer);
        this.serverTimer = setTimeout(() => this.pushToServer(), 500);
    },

    async pushToServer() {
        clearTimeout(this.serverTimer);
        this.serverTimer = null;
        if (!this.isLoggedIn()) return;
        try { await API.put('/accessibility-settings', this.toServer()); } catch (e) { console.warn('[A11y] Settings not saved to the account:', e.message); }
    },

    // Page load while logged in, and right after login: the account's settings win.
    // An account without settings yet gets the ones this browser already has.
    async syncFromServer() {
        if (!this.isLoggedIn()) return;
        try {
            const res = await API.get('/accessibility-settings');
            if (res?.data) {
                const fromAccount = this.fromServer(res.data);
                const { voiceActive, ...current } = this.settings;
                if (JSON.stringify(fromAccount) !== JSON.stringify(this.cleanSettings(current))) {
                    this.settings = { ...fromAccount, voiceActive: this.settings.voiceActive };
                    this.saveLocal();
                    this.applySettings();
                }
            } else if (localStorage.getItem('a11y_settings')) {
                await this.pushToServer();
            }
        } catch (e) {
            console.warn('[A11y] Using the settings saved in this browser:', e.message);
        }
    },

    initServerSync() {
        this.syncFromServer();
        document.addEventListener('auth:login', () => this.syncFromServer());
        // A change that is still waiting goes out before the page closes
        window.addEventListener('pagehide', () => this.flushServerSave());
    },

    // Sends a waiting change now (page closing, or logout: auth.js calls this before dropping the token)
    flushServerSave() {
        if (!this.serverTimer || !this.isLoggedIn()) return;
        clearTimeout(this.serverTimer);
        this.serverTimer = null;
        try {
            fetch('/api/accessibility-settings', { method: 'PUT', headers: { ...API.getHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(this.toServer()), keepalive: true });
        } catch (e) { /* the browser copy is already saved */ }
    },

    // Same classes as the small script in each page's <head> (it adds them before the first paint)
    applySettings() {
        const root = document.documentElement;
        // Older versions put these on <body>
        document.body?.classList.remove('font-size-md', 'font-size-lg', 'font-size-xl', 'font-size-2xl', 'dyslexia-font', 'easy-mode', 'theme-high-contrast-dark', 'theme-high-contrast-light');

        root.classList.remove('font-size-md', 'font-size-lg', 'font-size-xl', 'font-size-2xl');
        root.classList.add(this.settings.fontSize || 'font-size-md');
        root.classList.toggle('dyslexia-font', !!this.settings.dyslexiaFont);
        if (this.settings.dyslexiaFont) this.loadReadableFont();
        root.classList.toggle('a11y-tooltips', !!this.settings.tooltips);
        if (!this.settings.tooltips) this.hideTooltip?.();
        root.classList.toggle('a11y-contrast-high', this.settings.contrast === 'high');
        root.classList.toggle('a11y-grayscale', this.settings.contrast === 'grayscale');
        root.classList.toggle('a11y-highlight-links', !!this.settings.highlightLinks);
        root.classList.toggle('a11y-text-spacing', !!this.settings.textSpacing);
        root.classList.toggle('a11y-big-cursor', !!this.settings.bigCursor);
        root.classList.toggle('a11y-stop-motion', !!this.settings.stopMotion);
        root.classList.remove('easy-mode');   // the removed easy mode (pages cached with the old <head> script)

        this.updateWidgetUI();
        document.dispatchEvent(new CustomEvent('a11y:change', { detail: { ...this.settings } }));
    },

    loadReadableFont() {
        if (document.getElementById('a11y-readable-font')) return;
        const link = document.createElement('link');
        link.id = 'a11y-readable-font';
        link.rel = 'stylesheet';
        link.href = A11Y_READABLE_FONT_URL;
        document.head.appendChild(link);
    },

    setContrast(mode) {
        this.settings.contrast = ['high', 'grayscale'].includes(mode) ? mode : 'normal';
        this.saveSettings();
        this.applySettings();
        const labels = { normal: 'การแสดงผลปกติ', high: 'คอนทราสต์สูง', grayscale: 'ภาพขาวดำ' };
        this.announceToScreenReader(`เปลี่ยนเป็น${labels[this.settings.contrast]}แล้ว`);
    },

    toggleSetting(key, label) {
        this.settings[key] = !this.settings[key];
        this.saveSettings();
        this.applySettings();
        this.announceToScreenReader(`${label}: ${this.settings[key] ? 'เปิด' : 'ปิด'}`);
    },

    // --------------------------------------------------------------------------
    // Focus reading: speak only the element that keyboard navigation lands on
    // --------------------------------------------------------------------------
    toggleFocusReading() {
        this.settings.focusReading = !this.settings.focusReading;
        this.saveSettings();
        this.updateWidgetUI();
        if (this.settings.focusReading) {
            this.speak('เปิดอ่านออกเสียงตามโฟกัสแล้ว กดแท็บเพื่อเลื่อนไปทีละจุด ระบบจะอ่านเฉพาะจุดที่เลือกอยู่', null, { quiet: true });
        } else {
            this.synth?.cancel();
            this.announceToScreenReader('ปิดอ่านออกเสียงตามโฟกัสแล้ว');
        }
    },

    initFocusReading() {
        // Only keyboard focus is read; clicks with a mouse or touch stay silent
        let keyboardNav = false;
        document.addEventListener('keydown', e => { if (!e.metaKey && !e.ctrlKey) keyboardNav = true; }, true);
        document.addEventListener('pointerdown', () => { keyboardNav = false; }, true);
        document.addEventListener('focusin', e => {
            if (!this.settings.focusReading || !keyboardNav) return;
            const text = this.describeElement(e.target);
            if (text) this.speak(text, null, { quiet: true });
        });
        // Selects / checkboxes / radios: read the new state after it changes
        document.addEventListener('change', e => {
            if (!this.settings.focusReading || !keyboardNav || e.target !== document.activeElement) return;
            if (e.target.matches('select, input[type="checkbox"], input[type="radio"]')) {
                this.speak(this.describeElement(e.target), null, { quiet: true });
            }
        });
    },

    // Short spoken description of one element: name, what it is, and its state
    describeElement(el) {
        if (!(el instanceof Element)) return '';
        const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
        const textOf = ids => ids.split(/\s+/).map(id => document.getElementById(id)?.innerText || '').join(' ');
        const tag = el.tagName.toLowerCase();
        const type = (el.getAttribute('type') || '').toLowerCase();
        const role = el.getAttribute('role') || '';

        let name = clean(el.getAttribute('aria-label'));
        if (!name && el.getAttribute('aria-labelledby')) name = clean(textOf(el.getAttribute('aria-labelledby')));
        if (!name && el.labels && el.labels.length) name = clean(Array.from(el.labels).map(label => label.innerText).join(' '));
        if (!name && tag === 'img') name = clean(el.alt);
        if (!name && !['input', 'textarea', 'select'].includes(tag)) name = clean(el.innerText);
        if (!name) name = clean(el.getAttribute('title') || el.querySelector?.('img[alt]')?.alt || el.getAttribute('placeholder'));

        const parts = [];
        let kind = '';
        if (tag === 'a') kind = 'ลิงก์';
        else if (tag === 'select') {
            kind = 'ตัวเลือกแบบรายการ';
            parts.push(`เลือกอยู่ ${clean(el.options[el.selectedIndex]?.text) || 'ไม่มี'}`);
        } else if (type === 'checkbox' || role === 'checkbox' || role === 'switch') {
            kind = 'ช่องทำเครื่องหมาย';
            parts.push(el.checked || el.getAttribute('aria-checked') === 'true' ? 'เลือกแล้ว' : 'ยังไม่เลือก');
        } else if (type === 'radio' || role === 'radio') {
            kind = 'ตัวเลือก';
            parts.push(el.checked || el.getAttribute('aria-checked') === 'true' ? 'เลือกแล้ว' : 'ยังไม่เลือก');
        } else if (type === 'file') {
            kind = 'ปุ่มแนบไฟล์';
            if (el.files && el.files.length) parts.push(`แนบแล้ว ${Array.from(el.files).map(f => f.name).join(', ')}`);
        } else if (tag === 'button' || role === 'button' || ['submit', 'button', 'reset'].includes(type)) kind = 'ปุ่ม';
        else if (role === 'tab') kind = 'แท็บ';
        else if (tag === 'textarea' || tag === 'input') {
            kind = 'ช่องกรอกข้อมูล';
            if (type === 'password') parts.push(el.value ? 'กรอกแล้ว' : 'ว่างอยู่');
            else if (el.value) parts.push(`ข้อความ ${clean(el.value)}`);
            else if (el.placeholder && clean(el.placeholder) !== name) parts.push(`ตัวอย่าง ${clean(el.placeholder)}`);
            if (el.required) parts.push('จำเป็นต้องกรอก');
        } else if (/^h[1-6]$/.test(tag)) kind = 'หัวข้อ';

        if (el.getAttribute('aria-pressed') === 'true') parts.push('เปิดอยู่');
        if (el.hasAttribute('aria-expanded') && !['input', 'textarea'].includes(tag)) parts.push(el.getAttribute('aria-expanded') === 'true' ? 'เปิดอยู่' : 'ปิดอยู่');
        if (role === 'tab' && el.getAttribute('aria-selected') === 'true') parts.push('เลือกอยู่');
        if (el.getAttribute('aria-current') === 'page') parts.push('หน้าปัจจุบัน');
        if (el.disabled || el.getAttribute('aria-disabled') === 'true') parts.push('ใช้งานไม่ได้');

        return [name, kind, ...parts].filter(Boolean).join(', ').slice(0, 300);
    },

    readPage() {
        const main = document.querySelector('main') || document.body;
        const text = main.innerText.replace(/\s+/g, ' ').trim().slice(0, 4000);
        if (text) this.speak(text);
    },

    // Every option back to its default (speech rate and voice commands too), saved to the account as well
    resetSettings() {
        if (this.settings.voiceActive) this.recognition?.stop();
        this.settings = { ...A11Y_DEFAULTS, voiceActive: this.settings.voiceActive };
        this.saveSettings();
        this.applySettings();
        this.synth?.cancel();
        this.announceToScreenReader('คืนค่าการเข้าถึงทั้งหมดเป็นค่าเริ่มต้นแล้ว');
    },

    setTheme(themeName) {
        // Theme system removed per user request
    },

    // The "ก ก ก" buttons in the top strip and the menu both come here, so they always match
    setFontSize(sizeClass) {
        this.settings.fontSize = sizeClass === 'font-size-2xl' ? 'font-size-xl' : (A11Y_FONT_SIZES.includes(sizeClass) ? sizeClass : 'font-size-md');
        this.saveSettings();
        this.applySettings();
        const labels = { 'font-size-md': 'ปกติ 100%', 'font-size-lg': 'ใหญ่ 125%', 'font-size-xl': 'ใหญ่มาก 150%' };
        this.announceToScreenReader(`ขนาดตัวอักษร ${labels[this.settings.fontSize]}`);
    },

    toggleDyslexiaFont() {
        this.settings.dyslexiaFont = !this.settings.dyslexiaFont;
        this.saveSettings();
        this.applySettings();
        this.announceToScreenReader(`โหมดฟอนต์ช่วยการอ่าน: ${this.settings.dyslexiaFont ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}`);
    },

    // --------------------------------------------------------------------------
    // Text-to-Speech (TTS Engine) - Web Speech API
    // --------------------------------------------------------------------------
    speak(text, onEndCallback = null, { quiet = false } = {}) {
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
        // A Thai voice first (th-TH, then any th-*); the lang still asks for Thai when none is listed
        utterance.lang = 'th-TH';
        const thaiVoice = this.getThaiVoice();
        if (thaiVoice) utterance.voice = thaiVoice;

        if (onEndCallback) {
            utterance.onend = onEndCallback;
        }

        // Visual indicator in toast
        if (!quiet && window.showToast) {
            window.showToast('กำลังอ่านออกเสียง...', 'info', 2000);
        }

        this.synth.speak(utterance);
    },

    getThaiVoice() {
        const voices = this.synth?.getVoices() || [];
        const lang = voice => String(voice.lang || '').replace('_', '-').toLowerCase();
        return voices.find(voice => lang(voice) === 'th-th') || voices.find(voice => lang(voice).startsWith('th')) || null;
    },

    // Voices load a moment after the page in some browsers
    whenVoicesReady() {
        if (!this.synth) return Promise.resolve([]);
        const voices = this.synth.getVoices();
        if (voices.length) return Promise.resolve(voices);
        return new Promise(resolve => {
            const done = () => resolve(this.synth.getVoices());
            this.synth.addEventListener?.('voiceschanged', done, { once: true });
            setTimeout(done, 1500);
        });
    },

    // Slow 0.75 / normal 1.0 / fast 1.5, then a short sample at the new speed
    async setSpeechRate(rate) {
        this.settings.speechRate = A11Y_SPEECH_RATES.find(value => Math.abs(value - Number(rate)) < 0.001) || 1;
        this.saveSettings();
        this.updateWidgetUI();
        if (!this.synth) {
            this.announceToScreenReader('เบราว์เซอร์นี้ไม่รองรับการอ่านออกเสียง กรุณาใช้ Google Chrome, Microsoft Edge หรือ Safari');
            return;
        }
        const labels = { 0.75: 'ช้า', 1: 'ปกติ', 1.5: 'เร็ว' };
        const voices = await this.whenVoicesReady();
        if (voices.length && !this.getThaiVoice()) {
            const message = 'เครื่องนี้ยังไม่มีเสียงภาษาไทย เสียงอ่านอาจไม่ถูกต้อง ติดตั้งเสียงภาษาไทยได้ที่การตั้งค่าของเครื่อง (Windows: เวลาและภาษา > คำพูด, macOS: การช่วยการเข้าถึง > เนื้อหาที่พูด)';
            this.setVoiceNote(message);
            this.announceToScreenReader(message);
        } else {
            this.announceToScreenReader(`ความเร็วเสียงอ่าน: ${labels[this.settings.speechRate]}`);
        }
        this.speak('ทดสอบความเร็วเสียงอ่าน', null, { quiet: true });
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
    VOICE_MESSAGES: {
        unsupported: 'เบราว์เซอร์นี้ยังไม่รองรับการสั่งงานด้วยเสียง กรุณาเปิดเว็บด้วย Google Chrome หรือ Microsoft Edge',
        denied: 'ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน กดไอคอนแม่กุญแจข้างช่องที่อยู่เว็บ เลือก "อนุญาต" ที่ไมโครโฟน แล้วโหลดหน้านี้ใหม่',
        nomic: 'ไม่พบไมโครโฟน กรุณาต่อไมโครโฟนหรือหูฟังที่มีไมค์ แล้วโหลดหน้านี้ใหม่'
    },

    initSpeechRecognition() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            this.voiceUnavailable = this.VOICE_MESSAGES.unsupported;
            return;
        }

        this.recognition = new SpeechRec();
        this.recognition.lang = 'th-TH';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        this.recognition.onstart = () => {
            this.settings.voiceActive = true;
            this.updateVoiceButton();
            this.announceToScreenReader('เปิดไมโครโฟนแล้ว');
            this.showVoiceBanner('กำลังฟังคำสั่งเสียง... (เช่น "หน้าแรก", "ค้นหาสินค้า", "จับคู่", "ตะกร้า", "แชทบอท")');
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            this.handleVoiceCommand(transcript);
        };

        this.recognition.onerror = (event) => {
            // Permission refused or no microphone: say how to fix it and turn the button off
            if (['not-allowed', 'service-not-allowed'].includes(event.error)) this.setVoiceUnavailable(this.VOICE_MESSAGES.denied);
            else if (event.error === 'audio-capture') this.setVoiceUnavailable(this.VOICE_MESSAGES.nomic);
            else console.warn('Speech recognition error:', event.error);
            this.hideVoiceBanner();
        };

        this.recognition.onend = () => {
            const wasListening = this.settings.voiceActive;
            this.settings.voiceActive = false;
            this.updateVoiceButton();
            if (wasListening) this.announceToScreenReader('ปิดไมโครโฟนแล้ว');
            this.hideVoiceBanner();
        };
    },

    setVoiceUnavailable(message) {
        this.voiceUnavailable = message;
        this.updateVoiceButton();
        this.announceToScreenReader(message);
        window.showToast?.(message, 'warning', 8000);
    },

    // The menu button: start listening, or stop when it is listening already
    toggleVoiceCommand() {
        if (this.voiceUnavailable) {
            this.announceToScreenReader(this.voiceUnavailable);
            window.showToast?.(this.voiceUnavailable, 'warning', 8000);
            return;
        }
        if (this.settings.voiceActive) {
            this.settings.voiceEnabled = false;
            this.saveSettings();
            this.recognition.stop();
            return;
        }
        this.settings.voiceEnabled = true;
        this.saveSettings();
        this.startVoiceCommand();
    },

    // Also used by the microphone buttons on the pages (search box, footer)
    startVoiceCommand() {
        if (!this.recognition) {
            this.setVoiceUnavailable(this.voiceUnavailable || this.VOICE_MESSAGES.unsupported);
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

        // 1. Search Query with Keyword (e.g. "ค้นหากระเป๋า", "ค้นผ้าไหม", "หางานไม้")
        const searchMatch = cmd.match(/(?:ค้นหา|ค้น|หา|สืบค้น)\s*(?:สินค้า|ผลงาน|ของ)?\s*(.+)/);
        if (searchMatch && searchMatch[1] && searchMatch[1].trim() && !cmd.includes('หน้าแรก') && !cmd.includes('ร้านค้า') && !cmd.includes('ตะกร้า')) {
            const query = encodeURIComponent(searchMatch[1].trim());
            if (window.SearchLog) SearchLog.markVoice(searchMatch[1].trim());
            this.speak(`กำลังค้นหาสินค้า "${searchMatch[1].trim()}" ให้คุณครับ`);
            setTimeout(() => window.location.href = `/products.html?search=${query}`, 1100);
            return;
        }

        // 2. 3D Model Products ("ดูสินค้า 3D", "ดูงานสามมิติ")
        if (cmd.includes('3d') || cmd.includes('สามมิติ') || cmd.includes('โมเดล') || cmd.includes('3 มิติ')) {
            this.speak('กำลังนำทางไปชมผลงานที่มีโมเดล 3 มิติครับ');
            setTimeout(() => window.location.href = '/products.html?has_3d=true', 1100);
            return;
        }

        // Sign up: "สมัครสมาชิก" opens the register form; "สมัครเป็นผู้ขาย" (or ช่างฝีมือ / เปิดร้าน) has the seller card chosen
        if (cmd.includes('สมัคร')) {
            const seller = ['ผู้ขาย', 'ขาย', 'ช่าง', 'ร้าน'].some(word => cmd.includes(word));
            this.speak(seller ? 'เปิดฟอร์มสมัครเป็นผู้ขาย เลือกช่างฝีมือไว้ให้แล้วครับ' : 'เปิดฟอร์มสมัครสมาชิกครับ');
            // Already on the login page: switch the form here, without reloading
            if (typeof setAuthTab === 'function' && document.getElementById('register-form')) {
                setAuthTab('register');
                if (typeof onRoleChange === 'function') onRoleChange(seller ? 'seller' : 'buyer');
                setTimeout(() => document.getElementById(seller ? 'reg-role-seller' : 'reg-role-buyer')?.focus(), 200);
            } else {
                setTimeout(() => window.location.href = `/login.html?tab=register${seller ? '&role=seller' : ''}`, 1000);
            }
            return;
        }

        // 3. Navigation intents
        if (cmd.includes('หน้าแรก') || cmd.includes('กลับหน้าแรก') || cmd.includes('home')) {
            this.speak('กำลังนำคุณไปที่หน้าแรกครับ');
            setTimeout(() => window.location.href = '/index.html', 1000);
        }
        else if (cmd.includes('สินค้า') || cmd.includes('ร้าน') && cmd.includes('ของ') || cmd.includes('ช็อป') || cmd.includes('shop') || cmd.includes('ซื้อของ')) {
            this.speak('กำลังนำทางไปที่หน้ารวมสินค้าทั้งหมดครับ');
            setTimeout(() => window.location.href = '/products.html', 1000);
        }
        else if (cmd.includes('จับคู่') || cmd.includes('matching') || cmd.includes('แนะนำ')) {
            this.speak('กำลังเปิดระบบแบบประเมินจับคู่ผู้สนับสนุน 5 คำถามครับ');
            setTimeout(() => window.location.href = '/matching.html', 1000);
        }
        else if (cmd.includes('ร้านค้า') || cmd.includes('ช่างฝีมือ') || cmd.includes('คนพิการ') || cmd.includes('stores')) {
            this.speak('กำลังนำคุณไปที่หน้ารวมร้านค้าช่างฝีมือครับ');
            setTimeout(() => window.location.href = '/stores.html', 1000);
        }
        else if (cmd.includes('แดชบอร์ด') || cmd.includes('จัดการร้าน') || cmd.includes('ขายของ') || cmd.includes('seller') || cmd.includes('หลังบ้าน')) {
            this.speak('กำลังเปิดแดชบอร์ดจัดการร้านค้าสำหรับช่างฝีมือครับ');
            setTimeout(() => window.location.href = '/seller-dashboard.html', 1000);
        }
        else if (cmd.includes('ตะกร้า') || cmd.includes('สั่งซื้อ') || cmd.includes('cart') || cmd.includes('เช็คเอาท์')) {
            this.speak('กำลังนำทางไปที่ตะกร้าสินค้าของคุณครับ');
            setTimeout(() => window.location.href = '/cart.html', 1000);
        }
        else if (cmd.includes('โปรไฟล์') || cmd.includes('บัญชี') || cmd.includes('ข้อมูลส่วนตัว') || cmd.includes('profile')) {
            this.speak('กำลังเปิดหน้าข้อมูลโปรไฟล์และคำสั่งซื้อครับ');
            setTimeout(() => window.location.href = '/profile.html', 1000);
        }
        else if (cmd.includes('แคมเปญ') || cmd.includes('บูธ') || cmd.includes('กิจกรรม') || cmd.includes('งานออกร้าน')) {
            this.speak('กำลังไปที่หน้ากิจกรรมและงานออกบูธครับ');
            setTimeout(() => window.location.href = '/campaigns.html', 1000);
        }
        else if (cmd.includes('เข้าสู่ระบบ') || cmd.includes('ล็อกอิน') || cmd.includes('login')) {
            this.speak('กำลังเปิดหน้าเข้าสู่ระบบครับ');
            setTimeout(() => window.location.href = '/login.html', 1000);
        }
        else if (cmd.includes('แชท') || cmd.includes('บอท') || cmd.includes('ใจดี') || cmd.includes('ช่วย')) {
            this.speak('เปิดแชทบอทน้องใจดี AI เรียบร้อยครับ มีอะไรให้ช่วยสอบถามได้เลยครับ');
            if (window.ChatbotWidget) {
                window.ChatbotWidget.open();
            }
        }
        else if (cmd.includes('ขยาย') || cmd.includes('ตัวหนังสือใหญ่') || cmd.includes('ตัวอักษรใหญ่')) {
            this.setFontSize('font-size-xl');
            this.speak('ขยายขนาดตัวหนังสือเป็นขนาดใหญ่พิเศษเรียบร้อยครับ');
        }
        else if (cmd.includes('ตัวหนังสือปกติ') || cmd.includes('ตัวหนังสือเดิม') || cmd.includes('รีเซ็ต')) {
            this.setFontSize('font-size-md');
            this.speak('ปรับขนาดตัวหนังสือกลับสู่ขนาดปกติเรียบร้อยครับ');
        }
        else if (cmd.includes('หยุด') || cmd.includes('stop') || cmd.includes('เงียบ')) {
            this.stopSpeech();
        }
        else {
            this.speak(`รับคำสั่ง "${transcript}" เรียบร้อยครับ หากต้องการนำทาง สามารถสั่งว่า "หน้าแรก", "ดูสินค้า", "จับคู่", "ร้านค้า", "แดชบอร์ด", "ตะกร้า", "สมัครสมาชิก", "สมัครเป็นผู้ขาย" หรือ "ค้นหา ตามด้วยชื่อสินค้า" ได้เลยครับ`);
        }
    },

    showVoiceBanner(text) {
        let banner = document.getElementById('voice-indicator-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'voice-indicator-banner';
            // A status message: screen readers hear the command that was understood
            banner.setAttribute('role', 'status');
            document.body.appendChild(banner);
        }
        banner.innerHTML = `<span style="font-size: 1rem; font-weight:700;">[เสียง]</span> <span>${text}</span>`;
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
                this.toggleWidgetPanel(document.querySelector('[data-a11y-open]'));
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
                this.closeWidgetPanel(true);
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
        // The same words twice in a row are read again (a changed node is announced)
        liveRegion.textContent = '';
        requestAnimationFrame(() => { liveRegion.textContent = message; });
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
    // Accessibility menu (opened from the top strip, or a small corner button on
    // pages without it). Shortcut: Alt+A
    // --------------------------------------------------------------------------
    menuTrigger: null,

    renderMenu() {
        if (document.getElementById('a11y-panel')) return;
        const icon = d => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
        const opt = (id, label, d) => `<button type="button" class="a11y-opt" id="${id}" aria-pressed="false">${icon(d)}<span>${label}</span></button>`;

        const panel = document.createElement('div');
        panel.id = 'a11y-panel';
        panel.className = 'a11y-menu';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'a11y-menu-title');
        panel.hidden = true;
        panel.innerHTML = `
            <div class="a11y-menu-head">
                <h2 id="a11y-menu-title" tabindex="-1">เมนูช่วยการเข้าถึง</h2>
                <button type="button" class="a11y-menu-close" id="a11y-close" aria-label="ปิดเมนูช่วยการเข้าถึง">${icon('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
            </div>
            <div class="a11y-menu-body">
                <section class="a11y-group" aria-labelledby="a11y-g-size">
                    <h3 id="a11y-g-size">ขนาดตัวอักษร</h3>
                    <div class="a11y-seg" role="group" aria-labelledby="a11y-g-size">
                        <button type="button" data-a11y-size="font-size-md" aria-pressed="false">ปกติ</button>
                        <button type="button" data-a11y-size="font-size-lg" aria-pressed="false">ใหญ่</button>
                        <button type="button" data-a11y-size="font-size-xl" aria-pressed="false">ใหญ่มาก</button>
                    </div>
                </section>
                <section class="a11y-group" aria-labelledby="a11y-g-display">
                    <h3 id="a11y-g-display">การแสดงผล</h3>
                    <div class="a11y-seg" role="group" aria-labelledby="a11y-g-display">
                        <button type="button" data-a11y-contrast="normal" aria-pressed="false">ปกติ</button>
                        <button type="button" data-a11y-contrast="high" aria-pressed="false">คอนทราสต์สูง</button>
                        <button type="button" data-a11y-contrast="grayscale" aria-pressed="false">ขาวดำ</button>
                    </div>
                </section>
                <section class="a11y-group" aria-labelledby="a11y-g-read">
                    <h3 id="a11y-g-read">ช่วยการอ่านและการมองเห็น</h3>
                    <div class="a11y-grid">
                        ${opt('a11y-links', 'เน้นลิงก์', '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>')}
                        ${opt('a11y-spacing', 'ระยะห่างตัวอักษร', '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>')}
                        ${opt('btn-dyslexia', 'ฟอนต์อ่านง่าย', '<path d="M4 20 10 4h1l6 16M6.5 14h8"/>')}
                        ${opt('a11y-cursor', 'เคอร์เซอร์ใหญ่', '<path d="m4 4 7 17 2-7 7-2L4 4Z"/>')}
                        ${opt('a11y-motion', 'หยุดภาพเคลื่อนไหว', '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>')}
                        ${opt('a11y-tooltips', 'คำอธิบายปุ่ม (Tooltips)', '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 8h.01M12 11v3"/>')}
                    </div>
                </section>
                <section class="a11y-group" aria-labelledby="a11y-g-voice">
                    <h3 id="a11y-g-voice">เสียง</h3>
                    <div class="a11y-grid">
                        <button type="button" class="a11y-opt" id="a11y-read" aria-pressed="false">${icon('<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>')}<span>อ่านออกเสียงตามโฟกัส</span></button>
                        <button type="button" class="a11y-opt" id="a11y-stop">${icon('<rect x="6" y="6" width="12" height="12" rx="2"/>')}<span>หยุดเสียงอ่าน</span></button>
                        <button type="button" class="a11y-opt a11y-voice" id="a11y-voice" aria-pressed="false" aria-describedby="a11y-voice-note">
                            <span class="a11y-voice-icon" aria-hidden="true">${icon('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>')}<span class="a11y-voice-dot"></span></span>
                            <span class="a11y-voice-text">สั่งงานด้วยเสียง</span>
                        </button>
                    </div>
                    <p class="a11y-note" id="a11y-voice-note" hidden></p>
                    <h4 class="a11y-subhead" id="a11y-g-rate">ความเร็วเสียงอ่าน</h4>
                    <div class="a11y-seg" role="group" aria-label="ความเร็วเสียงอ่าน">
                        <button type="button" data-a11y-rate="0.75" aria-pressed="false">ช้า</button>
                        <button type="button" data-a11y-rate="1" aria-pressed="false">ปกติ</button>
                        <button type="button" data-a11y-rate="1.5" aria-pressed="false">เร็ว</button>
                    </div>
                </section>
                <p class="a11y-keys"><b>ปุ่มลัด:</b> <kbd>Alt</kbd>+<kbd>A</kbd> เมนูนี้ · <kbd>Alt</kbd>+<kbd>S</kbd> หยุดเสียง · <kbd>Alt</kbd>+<kbd>B</kbd> แชทบอท · <kbd>Alt</kbd>+<kbd>H</kbd> หน้าแรก · เปิด "อ่านออกเสียงตามโฟกัส" แล้วกด <kbd>Tab</kbd> เพื่อฟังทีละจุด</p>
            </div>
            <div class="a11y-menu-foot">
                <button type="button" class="a11y-reset" id="a11y-reset">คืนค่าเริ่มต้นทั้งหมด</button>
            </div>`;
        document.body.appendChild(panel);
        this.announceToScreenReader('');   // the live region exists before the page behind the menu is made inert

        // Pages without the top strip (dashboards) get a small corner button
        if (!document.querySelector('.site-topbar') && !document.querySelector('[data-a11y-open]')) {
            const corner = document.createElement('button');
            corner.type = 'button';
            corner.className = 'a11y-corner-btn';
            corner.setAttribute('data-a11y-open', '');
            corner.setAttribute('aria-controls', 'a11y-panel');
            corner.setAttribute('aria-expanded', 'false');
            corner.setAttribute('aria-label', 'เปิดเมนูช่วยการเข้าถึง (Alt+A)');
            corner.title = 'เมนูช่วยการเข้าถึง (Alt+A)';
            corner.innerHTML = icon('<circle cx="12" cy="4" r="2"/><path d="M5 8h14M12 8v6M9 21l3-7 3 7"/>');
            document.body.appendChild(corner);
            panel.classList.add('is-corner');
        }

        document.addEventListener('click', event => {
            const opener = event.target.closest('[data-a11y-open]');
            if (opener && panel.hidden) { event.preventDefault(); this.toggleWidgetPanel(opener); return; }
            // A click outside the menu closes it and puts focus back on the button that opened it
            if (!panel.hidden && !panel.contains(event.target)) { event.preventDefault(); this.closeWidgetPanel(true); }
        });
        // Focus trap: Tab from the last control goes to the first, Shift+Tab from the first goes to the last
        panel.addEventListener('keydown', event => {
            if (event.key !== 'Tab') return;
            const items = this.menuFocusables();
            if (!items.length) return;
            const first = items[0], last = items[items.length - 1];
            const active = document.activeElement;
            if (event.shiftKey && (active === first || active === panel.querySelector('#a11y-menu-title') || !panel.contains(active))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
                event.preventDefault();
                first.focus();
            }
        });
        // Focus that lands outside while the menu is open (e.g. from the address bar) comes back in
        document.addEventListener('focusin', event => {
            if (!panel.hidden && !panel.contains(event.target)) panel.querySelector('#a11y-menu-title').focus();
        });
        panel.querySelector('#a11y-close').addEventListener('click', () => this.closeWidgetPanel(true));
        panel.querySelectorAll('[data-a11y-size]').forEach(b => b.addEventListener('click', () => this.setFontSize(b.dataset.a11ySize)));
        panel.querySelectorAll('[data-a11y-contrast]').forEach(b => b.addEventListener('click', () => this.setContrast(b.dataset.a11yContrast)));
        panel.querySelectorAll('[data-a11y-rate]').forEach(b => b.addEventListener('click', () => this.setSpeechRate(b.dataset.a11yRate)));
        panel.querySelector('#a11y-links').addEventListener('click', () => this.toggleSetting('highlightLinks', 'เน้นลิงก์'));
        panel.querySelector('#a11y-spacing').addEventListener('click', () => this.toggleSetting('textSpacing', 'ระยะห่างตัวอักษร'));
        panel.querySelector('#a11y-cursor').addEventListener('click', () => this.toggleSetting('bigCursor', 'เคอร์เซอร์ใหญ่'));
        panel.querySelector('#a11y-motion').addEventListener('click', () => this.toggleSetting('stopMotion', 'หยุดภาพเคลื่อนไหว'));
        panel.querySelector('#btn-dyslexia').addEventListener('click', () => this.toggleDyslexiaFont());
        panel.querySelector('#a11y-tooltips').addEventListener('click', () => this.toggleSetting('tooltips', 'คำอธิบายปุ่ม (Tooltips)'));
        panel.querySelector('#a11y-read').addEventListener('click', () => this.toggleFocusReading());
        panel.querySelector('#a11y-stop').addEventListener('click', () => this.stopSpeech());
        panel.querySelector('#a11y-voice').addEventListener('click', () => this.toggleVoiceCommand());
        panel.querySelector('#a11y-reset').addEventListener('click', () => this.resetSettings());
        // Shadow at the edge while there is more to scroll
        const body = panel.querySelector('.a11y-menu-body');
        const edges = () => {
            panel.classList.toggle('has-more-below', body.scrollTop + body.clientHeight < body.scrollHeight - 2);
            panel.classList.toggle('has-more-above', body.scrollTop > 2);
        };
        body.addEventListener('scroll', edges, { passive: true });
        window.addEventListener('resize', edges);
        document.addEventListener('a11y:change', () => requestAnimationFrame(edges));
        this.menuEdges = edges;
        this.updateOpeners(false);
        this.updateWidgetUI();
    },

    menuFocusables() {
        const panel = document.getElementById('a11y-panel');
        return [...panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
            .filter(el => !el.disabled && !el.hidden && el.offsetParent !== null);
    },

    // While the menu is open the page behind it cannot be reached (it covers most of a phone screen)
    setBackgroundInert(on) {
        const panel = document.getElementById('a11y-panel');
        for (const el of document.body.children) {
            if (el === panel || el.id === 'a11y-live-region' || el.id === 'toast-container' || el.tagName === 'SCRIPT') continue;
            if (on && !el.inert) { el.inert = true; el.dataset.a11yInert = ''; }
            else if (!on && 'a11yInert' in el.dataset) { el.inert = false; delete el.dataset.a11yInert; }
        }
    },

    // Openers say what a press will do: open or close (only those that already carry an aria-label;
    // a link with its own visible words keeps them as its name). When the button shows words, they stay
    // a separate word in the name ("เปิด เมนูช่วยการเข้าถึง") so voice control finds it (WCAG 2.5.3).
    updateOpeners(open) {
        document.querySelectorAll('[data-a11y-open], [aria-controls="a11y-panel"]').forEach(button => {
            button.setAttribute('aria-expanded', String(open));
            if (!button.hasAttribute('aria-label')) return;
            const shown = button.textContent.trim();
            button.setAttribute('aria-label', `${open ? 'ปิด' : 'เปิด'}${shown ? ' ' : ''}เมนูช่วยการเข้าถึง (Alt+A)`);
        });
    },

    toggleWidgetPanel(trigger = null) {
        const panel = document.getElementById('a11y-panel');
        if (!panel) return;
        if (!panel.hidden) { this.closeWidgetPanel(true); return; }
        this.menuTrigger = trigger || document.activeElement;
        panel.hidden = false;
        this.setBackgroundInert(true);
        this.updateOpeners(true);
        this.menuEdges?.();
        panel.querySelector('#a11y-menu-title').focus();
    },

    closeWidgetPanel(returnFocus = true) {
        const panel = document.getElementById('a11y-panel');
        if (!panel || panel.hidden) return;
        panel.hidden = true;
        this.setBackgroundInert(false);
        this.updateOpeners(false);
        if (returnFocus && this.menuTrigger?.isConnected) this.menuTrigger.focus();
    },

    setVoiceNote(message) {
        const note = document.getElementById('a11y-voice-note');
        if (!note) return;
        note.textContent = message || '';
        note.hidden = !message;
    },

    // Microphone button: pressed while listening, its words and icon change too (not only the colour)
    updateVoiceButton() {
        const button = document.getElementById('a11y-voice');
        if (!button) return;
        const listening = !!this.settings.voiceActive;
        button.setAttribute('aria-pressed', String(listening));
        button.classList.toggle('is-listening', listening);
        button.querySelector('.a11y-voice-text').textContent = listening ? 'กำลังฟัง… (กดเพื่อหยุด)' : 'สั่งงานด้วยเสียง';
        if (this.voiceUnavailable) {
            button.setAttribute('aria-disabled', 'true');
            this.setVoiceNote(this.voiceUnavailable);
        } else {
            button.removeAttribute('aria-disabled');
        }
    },

    updateWidgetUI() {
        const set = (el, on) => { if (el) { el.setAttribute('aria-pressed', String(!!on)); el.classList.toggle('active', !!on); } };
        document.querySelectorAll('[data-a11y-size]').forEach(b => set(b, b.dataset.a11ySize === this.settings.fontSize));
        document.querySelectorAll('[data-a11y-contrast]').forEach(b => set(b, b.dataset.a11yContrast === (this.settings.contrast || 'normal')));
        document.querySelectorAll('[data-a11y-rate]').forEach(b => set(b, Math.abs(Number(b.dataset.a11yRate) - this.settings.speechRate) < 0.001));
        set(document.getElementById('a11y-links'), this.settings.highlightLinks);
        set(document.getElementById('a11y-spacing'), this.settings.textSpacing);
        set(document.getElementById('a11y-cursor'), this.settings.bigCursor);
        set(document.getElementById('a11y-motion'), this.settings.stopMotion);
        set(document.getElementById('btn-dyslexia'), this.settings.dyslexiaFont);
        set(document.getElementById('a11y-tooltips'), this.settings.tooltips);
        set(document.getElementById('a11y-read'), this.settings.focusReading);
        this.updateVoiceButton();
    }
};

// Global helper for TTS reading
function speakStory(text) {
    A11y.speak(text);
}

if (typeof window !== 'undefined') {
    window.A11y = A11y;
}
