// THE COURTROOM — online server.
// Zero dependencies: node:http for REST + Server-Sent Events, node:sqlite for
// persistence (falls back to a JSON file on older Node versions).
//
// The server is authoritative: it holds the full game state and sends each
// connected player only viewFor(state, thatPlayer). Secret role files,
// private evidence and the truth never leave the server for anyone else.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createGame, act, viewFor, caseSummary } from '../public/shared/engine.js';
import { CASES, getCase } from '../public/shared/cases/index.js';
import { DEFAULT_SETTINGS, LIMITS } from '../public/shared/constants.js';
import { openStore } from './store.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = +process.env.PORT || 3000;
const ROOM_TTL = 1000 * 60 * 60 * 24;      // rooms expire after 24h idle
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const store = await openStore(process.env.DB_PATH || path.join(ROOT, 'data', 'courtroom.db'));
const rooms = new Map();                    // code -> room
for (const r of store.all()) if (Date.now() - r.updatedAt < ROOM_TTL) rooms.set(r.code, r);
const streams = new Map();                  // code -> Set<{ res, pid }>

// ------------------------------------------------------------ helpers

const newCode = () => {
  for (;;) {
    const c = Array.from(crypto.randomBytes(5), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
    if (!rooms.has(c)) return c;
  }
};
const newToken = () => crypto.randomBytes(24).toString('base64url');
const newId = () => crypto.randomBytes(6).toString('hex');
const cleanName = (s) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24);

function cleanSettings(s = {}) {
  const out = { ...DEFAULT_SETTINGS };
  for (const k of ['opening', 'exam', 'cross', 'closing', 'final', 'deliberation']) {
    if (Number.isFinite(+s[k])) out[k] = Math.max(15, Math.min(900, Math.round(+s[k])));
  }
  out.scoring = s.scoring !== false;
  out.witnesses = s.witnesses == null ? null : Math.max(0, Math.min(3, +s.witnesses | 0));
  out.aides = s.aides == null ? null : (+s.aides >= 2 ? 2 : 0);
  out.attempts = Math.max(1, Math.min(6, +s.attempts || 3));
  return out;
}

function persist(room) {
  room.updatedAt = Date.now();
  store.put(room);
}

const online = (code, pid) => [...(streams.get(code) || [])].some((s) => s.pid === pid);

function roomView(room, pid) {
  return {
    room: {
      code: room.code, hostId: room.hostId, me: pid, caseId: room.caseId, settings: room.settings,
      started: !!room.game,
      players: room.players.map((p) => ({ id: p.id, name: p.name, ready: !!p.ready, online: online(room.code, p.id) })),
    },
    game: room.game ? viewFor(room.game, pid) : null,
  };
}

function send(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function broadcast(room) {
  for (const s of streams.get(room.code) || []) send(s.res, 'state', roomView(room, s.pid));
}

function json(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > 32 * 1024) throw new Error('too large');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// simple per-IP rate limit for room creation and joins
const hits = new Map();
function limited(req, key, max, windowMs) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  const k = `${key}:${ip}`;
  const now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(k, arr);
  return arr.length > max;
}

const playerByToken = (room, token) => (token ? room.players.find((p) => p.token === token) : null);

// ------------------------------------------------------------ API

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const method = req.method;

  if (parts[1] === 'health') return json(res, 200, { ok: true, app: 'the-courtroom', rooms: rooms.size });
  if (parts[1] === 'catalog') return json(res, 200, { ok: true, cases: CASES.map(caseSummary) });

  if (parts[1] === 'rooms' && parts.length === 2 && method === 'POST') {
    if (limited(req, 'create', 20, 60 * 60 * 1000)) return json(res, 429, { ok: false, err: 'rate' });
    const body = await readBody(req);
    const name = cleanName(body.name);
    if (!name) return json(res, 400, { ok: false, err: 'badInput' });
    const caseId = getCase(body.caseId) ? body.caseId : CASES[0].id;
    const host = { id: newId(), token: newToken(), name, ready: false, joinedAt: Date.now() };
    const room = { code: newCode(), hostId: host.id, caseId, settings: cleanSettings(body.settings), players: [host], kicked: [], game: null, createdAt: Date.now(), updatedAt: Date.now() };
    rooms.set(room.code, room);
    persist(room);
    return json(res, 200, { ok: true, code: room.code, token: host.token, playerId: host.id });
  }

  const code = String(parts[2] || '').toUpperCase();
  const room = rooms.get(code);
  const sub = parts[3];
  if (!room) {
    if (sub === 'stream') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
      send(res, 'gone', { reason: 'roomGone' }); return res.end();
    }
    return json(res, 404, { ok: false, err: 'notFound' });
  }

  if (sub === 'stream' && method === 'GET') {
    const me = playerByToken(room, url.searchParams.get('token'));
    if (!me) {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
      send(res, 'gone', { reason: room.kicked.includes(url.searchParams.get('token')) ? 'kicked' : 'roomGone' });
      return res.end();
    }
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    res.write('retry: 2000\n\n');
    const entry = { res, pid: me.id };
    if (!streams.has(code)) streams.set(code, new Set());
    const set = streams.get(code);
    const wasOnline = online(code, me.id);
    set.add(entry);
    send(res, 'state', roomView(room, me.id));
    if (!wasOnline) broadcast(room);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(ping);
      set.delete(entry);
      if (!online(code, me.id) && rooms.has(code)) broadcast(room);
    });
    return;
  }

  if (method !== 'POST') return json(res, 405, { ok: false, err: 'badInput' });
  const body = await readBody(req);
  const token = req.headers['x-court-token'] || body.token;

  if (sub === 'check') {
    if (room.kicked.includes(body.token)) return json(res, 403, { ok: false, err: 'kicked' });
    return playerByToken(room, body.token) ? json(res, 200, { ok: true }) : json(res, 404, { ok: false, err: 'notFound' });
  }

  if (sub === 'join') {
    if (limited(req, 'join', 60, 10 * 60 * 1000)) return json(res, 429, { ok: false, err: 'rate' });
    const back = playerByToken(room, body.token);
    if (back) return json(res, 200, { ok: true, token: back.token, playerId: back.id, rejoined: true });
    if (room.game) return json(res, 409, { ok: false, err: 'started' });
    if (room.players.length >= LIMITS.maxPlayers) return json(res, 409, { ok: false, err: 'full' });
    const name = cleanName(body.name);
    if (!name) return json(res, 400, { ok: false, err: 'badInput' });
    if (room.players.some((p) => p.name === name)) return json(res, 409, { ok: false, err: 'name' });
    const p = { id: newId(), token: newToken(), name, ready: false, joinedAt: Date.now() };
    room.players.push(p);
    persist(room); broadcast(room);
    return json(res, 200, { ok: true, token: p.token, playerId: p.id });
  }

  const me = playerByToken(room, token);
  if (!me) return json(res, 403, { ok: false, err: 'notAllowed' });
  const isHost = me.id === room.hostId;

  if (sub === 'lobby') {
    switch (body.op) {
      case 'ready':
        if (room.game) return json(res, 409, { ok: false, err: 'started' });
        me.ready = !!body.ready; break;
      case 'settings':
        if (!isHost || room.game) return json(res, 403, { ok: false, err: 'notAllowed' });
        room.settings = cleanSettings(body.settings); break;
      case 'case':
        if (!isHost || room.game || !getCase(body.caseId)) return json(res, 403, { ok: false, err: 'notAllowed' });
        room.caseId = body.caseId; room.players.forEach((p) => (p.ready = false)); break;
      case 'kick': {
        if (!isHost || body.id === me.id) return json(res, 403, { ok: false, err: 'notAllowed' });
        if (room.game) return json(res, 409, { ok: false, err: 'started' });
        const k = room.players.find((p) => p.id === body.id);
        if (!k) return json(res, 404, { ok: false, err: 'badInput' });
        room.players = room.players.filter((p) => p !== k);
        room.kicked.push(k.token);
        for (const s of streams.get(code) || []) if (s.pid === k.id) { send(s.res, 'gone', { reason: 'kicked' }); s.res.end(); }
        break;
      }
      case 'leave':
        if (room.game) return json(res, 200, { ok: true }); // stay seated during a trial; can come back
        room.players = room.players.filter((p) => p !== me);
        if (!room.players.length) { rooms.delete(code); store.del(code); return json(res, 200, { ok: true }); }
        if (isHost) room.hostId = room.players[0].id;
        break;
      case 'start':
        if (!isHost || room.game) return json(res, 403, { ok: false, err: 'notAllowed' });
        if (room.players.length < LIMITS.minPlayers) return json(res, 409, { ok: false, err: 'conditions' });
        if (!room.players.every((p) => p.ready)) return json(res, 409, { ok: false, err: 'conditions' });
        room.game = createGame({ caseId: room.caseId, players: room.players.map((p) => ({ id: p.id, name: p.name })), settings: room.settings });
        break;
      case 'rematch':
        if (!isHost || !room.game || room.game.phase !== 'truth') return json(res, 403, { ok: false, err: 'notAllowed' });
        room.game = null; room.players.forEach((p) => (p.ready = false));
        break;
      default:
        return json(res, 400, { ok: false, err: 'badInput' });
    }
    persist(room); broadcast(room);
    return json(res, 200, { ok: true });
  }

  if (sub === 'act') {
    if (!room.game) return json(res, 409, { ok: false, err: 'phase' });
    const r = act(room.game, { pid: me.id, host: isHost }, body.action || {}, Date.now());
    if (!r.ok) return json(res, 400, r);
    persist(room);
    if (!r.silent) broadcast(room);
    return json(res, 200, { ok: true, found: r.found });
  }

  return json(res, 404, { ok: false, err: 'badInput' });
}

// ------------------------------------------------------------ static files

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    const ext = path.extname(file);
    res.writeHead(200, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'cache-control': ext === '.woff2' ? 'public, max-age=604800' : 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    serveStatic(req, res, url);
  } catch (e) {
    if (!res.headersSent) json(res, 400, { ok: false, err: 'badInput' });
    else res.end();
  }
});

// expire idle rooms
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.updatedAt > ROOM_TTL && !(streams.get(code)?.size)) { rooms.delete(code); store.del(code); }
  }
}, 10 * 60 * 1000).unref();

server.listen(PORT, () => console.log(`THE COURTROOM running on http://localhost:${PORT} (${store.kind}, ${rooms.size} rooms restored)`));
