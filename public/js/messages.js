(() => {
    const user = Auth.getUser();
    if (!user || !API.getToken()) { location.replace('/login.html?redirect=' + encodeURIComponent(location.pathname + location.search)); return; }
    const el = id => document.getElementById(id);
    if (user.role === 'seller') { el('account-back').href = '/seller-dashboard.html'; el('account-back').textContent = '‹ กลับแดชบอร์ดร้านค้า'; }
    let active = null, lastId = 0, generation = 0, refreshing = false;
    const key = thread => `${thread.store_id}:${thread.contact_user_id}`;
    function renderChatAvatar(container, thread) {
        const initial = Array.from(thread.name.trim())[0] || '?';
        container.textContent = initial;
        if (!thread.avatar_url) return;
        const image = document.createElement('img');
        image.alt = '';
        image.onerror = () => { if (container.contains(image)) container.textContent = initial; };
        container.replaceChildren(image);
        image.src = thread.avatar_url;
    }
    let threads = [], threadSignature = '', sending = false;
    const layout = document.querySelector('.messages-layout');
    function updateComposer() {
        el('message-count').textContent = `${el('message-input').value.length.toLocaleString('th-TH')} / 2,000`;
        el('message-send').disabled = !active || sending || !el('message-input').value.trim();
    }
    el('message-input').addEventListener('input', updateComposer);
    el('conversation-search').addEventListener('input', renderThreads);
    el('conversation-back').onclick = () => {
        layout.classList.remove('has-conversation');
        el('conversation-search').focus();
    };
    function renderThreads() {
        const focusedKey = document.activeElement?.dataset?.threadKey;
        const query = el('conversation-search').value.trim().toLocaleLowerCase('th-TH');
        const visible = threads.filter(thread => thread.name.toLocaleLowerCase('th-TH').includes(query));
        const fragment = document.createDocumentFragment();
        el('conversation-count').textContent = threads.length;
        if (!visible.length) {
            const p = document.createElement('p'); p.className = 'conversation-empty';
            p.textContent = query ? 'ไม่พบการสนทนาที่ค้นหา' : user.role === 'seller' ? 'ข้อความจากลูกค้าจะแสดงที่นี่เมื่อมีผู้ติดต่อร้านของคุณ' : 'ยังไม่มีการสนทนา เริ่มทักร้านค้าจากหน้าร้านได้เลย';
            fragment.append(p);
        }
        for (const thread of visible) {
            const button = document.createElement('button'); button.className = 'conversation'; button.type = 'button'; button.dataset.threadKey = key(thread);
            button.setAttribute('aria-pressed', String(!!active && key(active) === key(thread)));
            const avatar = document.createElement('span'); avatar.className = 'chat-avatar'; avatar.textContent = Array.from(thread.name.trim())[0] || '?'; avatar.setAttribute('aria-hidden', 'true');
            renderChatAvatar(avatar, thread);
            const copy = document.createElement('span'); copy.className = 'conversation-copy';
            const name = document.createElement('strong'); name.textContent = thread.name;
            const preview = document.createElement('small'); preview.textContent = thread.last_message;
            copy.append(name, preview); button.append(avatar, copy);
            if (thread.unread) { const badge = document.createElement('span'); badge.className = 'conversation-unread'; badge.textContent = thread.unread; badge.setAttribute('aria-label', `${thread.unread} ข้อความยังไม่อ่าน`); button.append(badge); }
            button.onclick = () => selectThread(thread); fragment.append(button);
        }
        el('conversation-list').replaceChildren(fragment);
        if (focusedKey) [...el('conversation-list').children].find(node => node.dataset.threadKey === focusedKey)?.focus({preventScroll: true});
    }
    async function listThreads() {
        const result = await API.get('/chat/conversations');
        const signature = JSON.stringify(result.data);
        threads = result.data;
        const updated = active && threads.find(thread => key(thread) === key(active));
        if (updated && updated.avatar_url !== active.avatar_url) {
            active.avatar_url = updated.avatar_url;
            renderChatAvatar(el('conversation-avatar'), active);
        }
        if (signature !== threadSignature) { threadSignature = signature; renderThreads(); }
    }
    async function loadMessages() {
        if (!active) return;
        const current = generation, thread = active;
        const result = await API.get('/chat/messages', {store_id: thread.store_id, receiver_id: thread.contact_user_id, after: lastId});
        if (current !== generation) return;
        const list = el('message-list'); const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
        for (const message of result.data) {
            if (Number(message.id) <= lastId) continue;
            const bubble = document.createElement('div'); bubble.className = 'message-bubble' + (Number(message.sender_id) === Number(user.id) ? ' mine' : '');
            const text = document.createElement('span'); text.textContent = message.message;
            const time = document.createElement('time'); time.textContent = new Date(message.created_at).toLocaleString('th-TH');
            bubble.append(text, time); list.append(bubble); lastId = Number(message.id);
        }
        el('chat-empty').hidden = lastId > 0;
        if (atBottom) list.scrollTop = list.scrollHeight;
        if (lastId && !document.hidden) await API.post('/chat/read', {store_id: thread.store_id, receiver_id: thread.contact_user_id, through_id: lastId});
        if (result.data.length === 200 && current === generation) await loadMessages();
    }
    async function selectThread(thread) {
        active = thread; generation++; lastId = 0; el('message-list').replaceChildren(); el('message-input').value = '';
        layout.classList.add('has-conversation');
        el('chat-empty').hidden = false;
        el('chat-empty-title').textContent = 'เริ่มต้นบทสนทนา';
        el('chat-empty-description').textContent = 'ทักทายหรือฝากคำถามไว้ได้เลย';
        el('conversation-title').textContent = thread.name;
        renderChatAvatar(el('conversation-avatar'), thread);
        el('conversation-subtitle').textContent = 'บทสนทนาระหว่างลูกค้าและร้านค้า';
        el('conversation-store').href = `/store-detail.html?id=${encodeURIComponent(thread.store_id)}`;
        el('conversation-store').hidden = false;
        el('message-input').disabled = false; updateComposer(); renderThreads();
        history.replaceState(null, '', `?store_id=${thread.store_id}&receiver_id=${thread.contact_user_id}`);
        try { await loadMessages(); await listThreads(); el('chat-status').textContent = ''; } catch (err) { el('chat-status').textContent = err.message; }
    }
    el('message-form').onsubmit = async event => {
        event.preventDefault(); if (sending || !active || !el('message-input').value.trim()) return;
        const thread = active, current = generation, message = el('message-input').value;
        sending = true; updateComposer(); el('message-send').querySelector('span').textContent = 'กำลังส่ง…';
        try {
            await API.post('/chat/messages', {store_id: thread.store_id, receiver_id: thread.contact_user_id, message});
            if (current === generation) { el('message-input').value = ''; await loadMessages(); el('message-list').scrollTop = el('message-list').scrollHeight; }
            await listThreads(); el('chat-status').textContent = '';
        } catch (err) { el('chat-status').textContent = 'ส่งไม่สำเร็จ: ' + err.message; }
        finally { sending = false; updateComposer(); el('message-send').querySelector('span').textContent = 'ส่งข้อความ'; }
    };
    async function init() {
        try {
            await listThreads(); const params = new URLSearchParams(location.search); const storeId = params.get('store_id');
            if (storeId) {
                const response = await API.get(`/stores/${encodeURIComponent(storeId)}`); const store = response.data;
                if (Number(store.user_id) === Number(user.id)) {
                    const threads = await API.get('/chat/conversations'); const thread = threads.data.find(t => String(t.store_id) === storeId && String(t.contact_user_id) === params.get('receiver_id'));
                    if (thread) await selectThread(thread); else el('chat-status').textContent = 'เลือกลูกค้าจากรายการสนทนา';
                } else await selectThread({store_id: store.id, contact_user_id: store.user_id, name: store.store_name, avatar_url: store.owner_avatar_url});
            }
        } catch (err) { el('chat-status').textContent = err.message; }
        setInterval(async () => {
            if (document.hidden || refreshing) return; refreshing = true;
            try { await loadMessages(); await listThreads(); } catch (err) { el('chat-status').textContent = 'เชื่อมต่อไม่สำเร็จ กำลังลองใหม่: ' + err.message; } finally { refreshing = false; }
        }, 5000);
    }
    init();
})();
