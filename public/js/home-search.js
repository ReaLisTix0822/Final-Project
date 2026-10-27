// Homepage search progressively enhances a native GET form.
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('home-search-form');
    if (!form) return;

    const input = document.getElementById('home-search-input');
    const voiceButton = document.getElementById('home-search-voice');
    const voiceLabel = voiceButton.querySelector('span');
    const status = document.getElementById('home-search-status');
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let activeRecognition = null;

    function resetVoiceButton() {
        voiceButton.setAttribute('aria-pressed', 'false');
        voiceLabel.textContent = 'ค้นหาด้วยเสียง';
    }

    function cancelVoice() {
        const recognition = activeRecognition;
        activeRecognition = null;
        resetVoiceButton();
        if (recognition) recognition.abort();
    }

    input.addEventListener('input', () => input.setCustomValidity(''));
    const history = initSearchHistory(form, input);
    form.addEventListener('submit', (event) => {
        input.value = input.value.trim();
        if (!input.value) {
            event.preventDefault();
            input.setCustomValidity('กรุณาพิมพ์คำที่ต้องการค้นหา');
            input.reportValidity();
            input.focus();
            return;
        }
        history.remember(input.value);
        cancelVoice();
        // Native form submission encodes Thai text and query delimiters safely.
    });

    voiceButton.hidden = false;
    if (!Recognition || window.isSecureContext === false) {
        voiceButton.disabled = true;
        status.textContent = !Recognition
            ? 'เบราว์เซอร์นี้ไม่รองรับการค้นหาด้วยเสียง กรุณาพิมพ์คำค้นหาแทน'
            : 'ค้นหาด้วยเสียงต้องเปิดเว็บผ่าน HTTPS กรุณาพิมพ์คำค้นหาแทน';
        return;
    }

    status.textContent = 'พิมพ์คำค้นหา หรือกดไมโครโฟนแล้วพูดภาษาไทย ตรวจสอบคำก่อนกดค้นหา';
    voiceButton.addEventListener('click', () => {
        if (activeRecognition) {
            cancelVoice();
            status.textContent = 'ยกเลิกการฟังแล้ว คุณสามารถพิมพ์คำค้นหาได้';
            return;
        }

        let recognition;
        try {
            recognition = new Recognition();
            recognition.lang = 'th-TH';
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;
            let receivedResult = false;
            let failed = false;

            recognition.onstart = () => {
                if (activeRecognition !== recognition) return;
                status.textContent = 'กำลังฟัง… พูดชื่อสินค้าหรือร้านค้า กดปุ่มอีกครั้งเพื่อยกเลิก';
            };
            recognition.onresult = (event) => {
                if (activeRecognition !== recognition) return;
                const transcript = event.results[event.resultIndex || 0]?.[0]?.transcript?.trim();
                if (!transcript) return;
                receivedResult = true;
                input.value = transcript;
                if (window.SearchLog) SearchLog.markVoice(transcript);
                input.setCustomValidity('');
                status.textContent = `ได้ยินว่า “${transcript}” ตรวจสอบหรือแก้ไขคำ แล้วกดค้นหา`;
                input.focus();
            };
            recognition.onerror = (event) => {
                if (activeRecognition !== recognition) return;
                failed = true;
                const messages = {
                    'not-allowed': 'ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน กรุณาอนุญาตในการตั้งค่าเบราว์เซอร์ หรือพิมพ์คำค้นหาแทน',
                    'service-not-allowed': 'บริการค้นหาด้วยเสียงไม่พร้อมใช้งาน กรุณาพิมพ์คำค้นหาแทน',
                    'audio-capture': 'ไม่พบไมโครโฟนที่ใช้งานได้ กรุณาตรวจสอบอุปกรณ์ หรือพิมพ์คำค้นหาแทน',
                    'no-speech': 'ไม่ได้ยินเสียง กรุณากดไมโครโฟนเพื่อลองใหม่ หรือพิมพ์คำค้นหา',
                    'network': 'เชื่อมต่อบริการเสียงไม่ได้ กรุณาลองใหม่ หรือพิมพ์คำค้นหาแทน',
                    'aborted': 'หยุดการฟังแล้ว คุณสามารถพิมพ์คำค้นหาได้'
                };
                status.textContent = messages[event.error] || 'ค้นหาด้วยเสียงไม่สำเร็จ กรุณาลองใหม่ หรือพิมพ์คำค้นหาแทน';
                activeRecognition = null;
                resetVoiceButton();
            };
            recognition.onend = () => {
                if (activeRecognition !== recognition) return;
                activeRecognition = null;
                resetVoiceButton();
                if (!receivedResult && !failed) {
                    status.textContent = 'ยังไม่มีคำค้นหา กรุณากดไมโครโฟนเพื่อลองใหม่ หรือพิมพ์คำค้นหา';
                }
            };

            // Request the microphone only after an explicit user click.
            window.speechSynthesis?.cancel();
            activeRecognition = recognition;
            voiceButton.setAttribute('aria-pressed', 'true');
            voiceLabel.textContent = 'ยกเลิกการฟัง';
            status.textContent = 'กำลังเปิดไมโครโฟน… หากมีข้อความขออนุญาต กรุณาอนุญาตใช้ไมโครโฟน';
            recognition.start();
        } catch (error) {
            cancelVoice();
            status.textContent = 'เปิดไมโครโฟนไม่สำเร็จ กรุณาลองใหม่ หรือพิมพ์คำค้นหาแทน';
        }
    });

    voiceButton.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && activeRecognition) {
            cancelVoice();
            status.textContent = 'ยกเลิกการฟังแล้ว';
        }
    });
    window.addEventListener('pagehide', cancelVoice);
});


// ==============================================================================
// Search history dropdown (like Google): recent searches under the search box.
// Signed-in users: search_history table via /api/search-history/mine.
// Guests: this browser only (localStorage).
// ==============================================================================
function initSearchHistory(form, input) {
    const LOCAL_KEY = 'taladjai_recent_searches';
    const MAX_SHOWN = 8;
    const loggedIn = () => !!localStorage.getItem('token');
    let terms = [];
    let shown = [];
    let active = -1;
    let loaded = false;

    input.setAttribute('autocomplete', 'off');      // hide the browser's own autofill list
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', 'search-history-list');

    const panel = document.createElement('div');
    panel.className = 'search-history';
    panel.hidden = true;
    panel.innerHTML = `
        <div class="search-history-head">
            <span id="search-history-title">ประวัติการค้นหา</span>
            <button type="button" class="search-history-clear">ลบทั้งหมด</button>
        </div>
        <ul id="search-history-list" role="listbox" aria-labelledby="search-history-title"></ul>`;
    form.appendChild(panel);
    const list = panel.querySelector('ul');

    const readLocal = () => {
        try { const v = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
    };
    const writeLocal = v => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(v.slice(0, 20))); } catch {} };
    const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });
    const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    async function load() {
        terms = readLocal();
        if (loggedIn()) {
            try {
                const res = await fetch('/api/search-history/mine', { headers: authHeaders() });
                const data = await res.json();
                if (data.success) {
                    const server = data.data;
                    terms = [...server, ...terms.filter(t => !server.some(s => s.toLowerCase() === t.toLowerCase()))];
                }
            } catch {}
        }
        loaded = true;
    }

    function close() {
        panel.hidden = true;
        active = -1;
        form.classList.remove('has-search-history');
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
    }

    function render() {
        const typed = input.value.trim().toLowerCase();
        shown = typed
            ? terms.filter(t => t.toLowerCase().includes(typed) && t.toLowerCase() !== typed)
                .sort((a, b) => Number(!a.toLowerCase().startsWith(typed)) - Number(!b.toLowerCase().startsWith(typed)))
            : [...terms];
        shown = shown.slice(0, MAX_SHOWN);
        if (!shown.length || document.activeElement !== input) { close(); return; }

        list.innerHTML = shown.map((term, i) => {
            const lower = term.toLowerCase();
            const at = typed ? lower.indexOf(typed) : -1;
            const label = at >= 0
                ? `${esc(term.slice(0, at))}<b>${esc(term.slice(at, at + typed.length))}</b>${esc(term.slice(at + typed.length))}`
                : esc(term);
            return `<li id="search-history-${i}" role="option" aria-selected="${i === active}" class="search-history-item${i === active ? ' is-active' : ''}" data-index="${i}">
                <svg class="search-history-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                <span class="search-history-text">${label}</span>
                <button type="button" class="search-history-remove" tabindex="-1" data-index="${i}" aria-label="ลบ ${esc(term)} ออกจากประวัติ" title="ลบออกจากประวัติ">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
            </li>`;
        }).join('');
        panel.querySelector('.search-history-head').hidden = !!typed;
        panel.hidden = false;
        form.classList.add('has-search-history');
        input.setAttribute('aria-expanded', 'true');
        if (active >= 0) input.setAttribute('aria-activedescendant', `search-history-${active}`);
        else input.removeAttribute('aria-activedescendant');
    }

    function choose(index) {
        const term = shown[index];
        if (!term) return;
        input.value = term;
        close();
        form.requestSubmit ? form.requestSubmit() : form.submit();
    }

    async function remove(index) {
        const term = shown[index];
        if (!term) return;
        terms = terms.filter(t => t !== term);
        writeLocal(readLocal().filter(t => t !== term));
        if (active >= shown.length - 1) active = shown.length - 2;
        render();
        input.focus();
        if (loggedIn()) {
            fetch('/api/search-history/mine', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ query: term }) }).catch(() => {});
        }
    }

    async function clearAll() {
        terms = [];
        writeLocal([]);
        close();
        input.focus();
        if (loggedIn()) {
            fetch('/api/search-history/mine', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ all: true }) }).catch(() => {});
        }
    }

    const open = async () => { if (!loaded) await load(); render(); };
    input.addEventListener('focus', open);
    input.addEventListener('click', () => { if (panel.hidden) open(); });
    input.addEventListener('input', () => { active = -1; render(); });
    input.addEventListener('keydown', event => {
        if (panel.hidden) {
            if (event.key === 'ArrowDown') { render(); }
            return;
        }
        if (event.key === 'ArrowDown') { event.preventDefault(); active = (active + 1) % shown.length; render(); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); active = active <= 0 ? shown.length - 1 : active - 1; render(); }
        else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); choose(active); }
        else if (event.key === 'Delete' && active >= 0 && event.shiftKey) { event.preventDefault(); remove(active); }
        else if (event.key === 'Escape') { event.preventDefault(); close(); }
    });
    // mousedown keeps focus in the input while picking an item
    list.addEventListener('mousedown', event => {
        event.preventDefault();
        const removeBtn = event.target.closest('.search-history-remove');
        if (removeBtn) { remove(Number(removeBtn.dataset.index)); return; }
        const item = event.target.closest('.search-history-item');
        if (item) choose(Number(item.dataset.index));
    });
    panel.querySelector('.search-history-clear').addEventListener('mousedown', event => { event.preventDefault(); clearAll(); });
    input.addEventListener('blur', () => setTimeout(close, 120));

    return {
        remember(term) {
            const clean = term.trim();
            if (!clean) return;
            writeLocal([clean, ...readLocal().filter(t => t.toLowerCase() !== clean.toLowerCase())]);
        }
    };
}
