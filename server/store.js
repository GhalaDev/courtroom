// Room persistence: SQLite (node:sqlite, Node 22.5+) with a JSON-file fallback.
import fs from 'node:fs';
import path from 'node:path';

export async function openStore(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(dbPath);
    db.exec(`PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL);`);
    const put = db.prepare('INSERT INTO rooms (code, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at');
    const del = db.prepare('DELETE FROM rooms WHERE code = ?');
    const all = db.prepare('SELECT data FROM rooms');
    return {
      kind: 'sqlite',
      put: (room) => put.run(room.code, JSON.stringify(room), room.updatedAt),
      del: (code) => del.run(code),
      all: () => all.all().map((r) => JSON.parse(r.data)),
    };
  } catch {
    const file = dbPath.replace(/\.db$/, '') + '.json';
    let data = {};
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
    let timer = null;
    const flush = () => { timer = null; fs.writeFileSync(file + '.tmp', JSON.stringify(data)); fs.renameSync(file + '.tmp', file); };
    const later = () => { if (!timer) timer = setTimeout(flush, 200); };
    return {
      kind: 'json',
      put: (room) => { data[room.code] = room; later(); },
      del: (code) => { delete data[code]; later(); },
      all: () => Object.values(data),
    };
  }
}
