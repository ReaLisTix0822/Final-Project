const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../public/js/home-search.js'), 'utf8');

// Exercise speech lifecycle events without requesting a real microphone.
function setup({ supported = true, secure = true, prefixed = false, startThrows = false } = {}) {
    class Element {
        constructor() { this.listeners = {}; this.attributes = {}; this.value = ''; }
        addEventListener(event, handler) { this.listeners[event] = handler; }
        emit(event, detail = {}) { this.listeners[event]?.(detail); }
        setAttribute(name, value) { this.attributes[name] = value; }
        setCustomValidity(message) { this.validationMessage = message; }
        reportValidity() { this.reported = true; }
        focus() { this.focused = true; }
    }
    const elements = Object.fromEntries(['form', 'input', 'voice', 'status'].map(name => [name, new Element()]));
    const label = new Element();
    elements.voice.querySelector = () => label;
    const sessions = [];
    class Recognition {
        constructor() { sessions.push(this); }
        start() { if (startThrows) throw new Error('Unavailable'); this.started = true; }
        abort() { this.aborted = true; this.onend?.(); }
    }
    const window = {
        isSecureContext: secure,
        addEventListener(event, handler) { this[event] = handler; }
    };
    if (supported) window[prefixed ? 'webkitSpeechRecognition' : 'SpeechRecognition'] = Recognition;
    const document = {
        addEventListener(event, handler) { handler(); },
        getElementById(id) { return elements[id.replace('home-search-', '')]; }
    };
    vm.runInNewContext(source, { document, window });
    return { ...elements, sessions, window, label };
}

test('typed search trims text, preserves Thai and special characters, and uses the existing catalog GET route', () => {
    const { input, form } = setup();
    input.value = '  ผ้าไหม & งานสาน+  ';
    let prevented = false;
    form.emit('submit', { preventDefault() { prevented = true; } });
    assert.equal(prevented, false);
    assert.equal(input.value, 'ผ้าไหม & งานสาน+');
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    assert.match(html, /<form[^>]*id="home-search-form"[^>]*action="\/products.html"[^>]*method="get"/);
    assert.match(html, /<input[^>]*id="home-search-input"[^>]*name="search"[^>]*type="search"/);
    const query = new URLSearchParams({ search: input.value });
    assert.equal(new URLSearchParams(query.toString()).get('search'), input.value);
});

test('whitespace-only search is blocked and a subsequent edit clears validation', () => {
    const { input, form } = setup();
    input.value = '   ';
    let prevented = false;
    form.emit('submit', { preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.ok(input.validationMessage);
    assert.equal(input.focused, true);
    input.emit('input');
    assert.equal(input.validationMessage, '');
});

test('voice capture starts only on click and fills editable text without submitting', () => {
    const { voice, sessions, input, status } = setup({ prefixed: true });
    assert.equal(sessions.length, 0);
    voice.emit('click');
    const session = sessions[0];
    assert.equal(session.started, true);
    assert.equal(session.lang, 'th-TH');
    session.onstart();
    assert.match(status.textContent, /กำลังฟัง/);
    session.onresult({ resultIndex: 0, results: [[{ transcript: '  กระเป๋าสาน  ' }]] });
    session.onend();
    assert.equal(input.value, 'กระเป๋าสาน');
    assert.equal(input.focused, true);
    assert.match(status.textContent, /แล้วกดค้นหา/);
    assert.equal(voice.attributes['aria-pressed'], 'false');
});

test('cancellation ignores late speech results and permits another recording', () => {
    const { voice, sessions, input } = setup();
    input.value = 'ข้อความเดิม';
    voice.emit('click');
    voice.emit('click');
    const oldSession = sessions[0];
    assert.equal(oldSession.aborted, true);
    voice.emit('click');
    oldSession.onresult({ results: [[{ transcript: 'ผลเก่า' }]] });
    oldSession.onend();
    assert.equal(input.value, 'ข้อความเดิม');
    assert.equal(voice.attributes['aria-pressed'], 'true');
    assert.equal(sessions.length, 2);
});

for (const error of ['not-allowed', 'audio-capture', 'no-speech', 'network', 'service-not-allowed']) {
    test(`speech error ${error} leaves typed search available and permits retry`, () => {
        const { voice, sessions, status, input } = setup();
        input.value = 'ผ้าไหม';
        voice.emit('click');
        sessions[0].onerror({ error });
        const message = status.textContent;
        sessions[0].onend();
        assert.equal(status.textContent, message);
        assert.match(message, /พิมพ์คำค้นหา/);
        assert.equal(voice.attributes['aria-pressed'], 'false');
        assert.equal(input.value, 'ผ้าไหม');
        voice.emit('click');
        assert.equal(sessions.length, 2);
    });
}

test('no result and synchronous start failure both provide visible feedback', () => {
    const silent = setup();
    silent.voice.emit('click');
    silent.sessions[0].onend();
    assert.match(silent.status.textContent, /ยังไม่มีคำค้นหา/);
    const failed = setup({ startThrows: true });
    failed.voice.emit('click');
    assert.match(failed.status.textContent, /เปิดไมโครโฟนไม่สำเร็จ/);
    assert.equal(failed.voice.attributes['aria-pressed'], 'false');
});

test('unsupported and insecure browsers retain the typed search form', () => {
    for (const options of [{ supported: false }, { secure: false }]) {
        const { voice, status, input, form, sessions } = setup(options);
        assert.equal(voice.disabled, true);
        assert.match(status.textContent, /พิมพ์คำค้นหาแทน/);
        input.value = 'ผ้าไหม';
        form.emit('submit', { preventDefault() { assert.fail('Typed search should work'); } });
        assert.equal(sessions.length, 0);
    }
});

test('Escape, submit, and leaving the page stop an active recording', () => {
    for (const action of ['escape', 'submit', 'pagehide']) {
        const { voice, input, form, sessions, window } = setup();
        input.value = 'ผ้าไหม';
        voice.emit('click');
        if (action === 'escape') voice.emit('keydown', { key: 'Escape' });
        if (action === 'submit') form.emit('submit');
        if (action === 'pagehide') window.pagehide();
        assert.equal(sessions[0].aborted, true);
        assert.equal(voice.attributes['aria-pressed'], 'false');
    }
});
