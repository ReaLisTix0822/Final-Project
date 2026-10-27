// ==============================================================================
// STORE STORY VIDEOS (table store_videos, one row per store)
// The video, its transcript and its auto captions live in their own table instead
// of on stores. API responses still expose the old flat field names
// (story_video_url, story_video_transcript, ...) so the pages did not have to change.
// ==============================================================================
const db = require('../config/database');

const videoSource = url => /youtube\.com|youtu\.be/.test(url) ? 'youtube'
    : url.startsWith('/videos/stories/') ? 'sample' : 'upload';

const getStoreVideo = storeId => db.get('SELECT * FROM store_videos WHERE store_id = ?', [storeId]);

// Copy the video fields onto a store object (for API responses)
async function withStoreVideo(store) {
    if (!store) return store;
    const video = await getStoreVideo(store.id);
    return {
        ...store,
        story_video_url: video?.video_url || null,
        story_video_transcript: video?.transcript || null,
        story_video_captions_url: video?.captions_url || null,
        story_video_captions_status: video?.captions_status || null
    };
}

// Set or remove a store's video. Returns true when the video file/link changed.
async function saveStoreVideo(storeId, videoUrl, transcript) {
    const current = await getStoreVideo(storeId);
    if (!videoUrl) {
        if (current) await db.run('DELETE FROM store_videos WHERE store_id = ?', [storeId]);
        return Boolean(current);
    }
    if (!current) {
        await db.run('INSERT INTO store_videos (store_id, video_url, source, transcript) VALUES (?, ?, ?, ?)',
            [storeId, videoUrl, videoSource(videoUrl), transcript || null]);
        return true;
    }
    const changed = current.video_url !== videoUrl;
    // New video: old captions no longer match, so they are cleared
    await db.run(`UPDATE store_videos SET video_url = ?, source = ?, transcript = ?,
                  captions_url = ${changed ? 'NULL' : 'captions_url'}, captions_status = ${changed ? 'NULL' : 'captions_status'},
                  updated_at = CURRENT_TIMESTAMP WHERE store_id = ?`,
        [videoUrl, videoSource(videoUrl), transcript || null, storeId]);
    return changed;
}

module.exports = { getStoreVideo, withStoreVideo, saveStoreVideo, videoSource };
