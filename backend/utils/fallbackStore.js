const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'offline-submissions.json');

async function ensureStoreFile() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
        await fs.access(STORE_PATH);
    } catch {
        await fs.writeFile(STORE_PATH, '[]', 'utf8');
    }
}

async function readOfflineSubmissions() {
    await ensureStoreFile();
    try {
        const raw = await fs.readFile(STORE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function appendOfflineSubmission(submission) {
    const entries = await readOfflineSubmissions();
    const record = {
        ...submission,
        id: `offline-${Date.now()}`,
        created_at: new Date().toISOString(),
        _source: 'offline-fallback',
    };
    entries.push(record);
    await fs.writeFile(STORE_PATH, JSON.stringify(entries, null, 2), 'utf8');
    return record;
}

async function getOfflineCount() {
    const entries = await readOfflineSubmissions();
    return entries.length;
}

module.exports = {
    appendOfflineSubmission,
    getOfflineCount,
};
