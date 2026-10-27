const db = require('../config/database');

const clip = (value, max) => (value == null ? null : String(value).slice(0, max));
const cleanSessionId = value => (typeof value === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : null);
const cleanPath = value => (typeof value === 'string' && value.startsWith('/') ? value.slice(0, 255) : null);

const ASSIST_MODES = ['visual', 'motor', 'cognitive', 'low_vision', 'hearing'];

// Bot_Sessions / Bot_Messages (report #27, #28): the same turn as one user message and one assistant message
async function logBotTurn({ sessionId, userId, assistMode, inputType, pagePath, userMessage, botReply }) {
    const key = cleanSessionId(sessionId);
    const mode = ASSIST_MODES.includes(assistMode) ? assistMode : 'visual';
    let session = key ? await db.get('SELECT session_id FROM bot_sessions WHERE client_session_key = ?', [key]) : null;
    if (session) {
        await db.run('UPDATE bot_sessions SET user_id = COALESCE(user_id, ?), assist_mode = ?, ended_at = CURRENT_TIMESTAMP WHERE session_id = ?',
            [userId || null, mode, session.session_id]);
    } else {
        const created = await db.run(
            'INSERT INTO bot_sessions (client_session_key, user_id, assist_mode, page_context, ended_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [key, userId || null, mode, clip(cleanPath(pagePath), 100)]
        );
        session = { session_id: created.insertId };
    }
    await db.run("INSERT INTO bot_messages (session_id, sender, input_type, content) VALUES (?, 'user', ?, ?)",
        [session.session_id, inputType === 'voice' ? 'voice' : 'text', clip(userMessage, 2000) || '']);
    if (botReply) {
        await db.run("INSERT INTO bot_messages (session_id, sender, input_type, content) VALUES (?, 'assistant', 'text', ?)",
            [session.session_id, clip(botReply, 8000)]);
    }
}

// Store one question / answer of the chatbot. Never throws: logging must not break the chat.
async function logChat({ sessionId, userId, userMessage, botReply, source, model, actionUrl, pagePath, responseMs, errorMessage, assistMode, inputType }) {
    try {
        await db.run(
            `INSERT INTO chatbot_logs (session_id, user_id, user_message, bot_reply, source, model, action_url, page_path, response_ms, error_message)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                cleanSessionId(sessionId),
                userId || null,
                clip(userMessage, 2000) || '',
                clip(botReply, 8000),
                clip(source, 30) || 'unknown',
                clip(model, 60),
                clip(actionUrl, 255),
                cleanPath(pagePath),
                Number.isFinite(responseMs) ? Math.round(responseMs) : null,
                clip(errorMessage, 500)
            ]
        );
    } catch (err) {
        console.warn('[ChatbotLog] Save failed:', err.message);
    }
    try {
        await logBotTurn({ sessionId, userId, assistMode, inputType, pagePath, userMessage, botReply });
    } catch (err) {
        console.warn('[ChatbotLog] Bot session save failed:', err.message);
    }
}

module.exports = { logChat };
