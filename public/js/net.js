// Online Mode client: REST for actions, Server-Sent Events for live state.
// The server sends each player only their own filtered view.

const SESSION_KEY = 'court-online';

export function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
export function saveSession(s) {
  try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch {}
}

export async function api(path, body, token) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(token ? { 'x-court-token': token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) return { ok: false, err: data?.err || 'network', missing: data?.missing };
  return data || { ok: true };
}

export async function serverAvailable() {
  if (location.protocol === 'file:') return false;
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch('api/health', { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(to);
    if (!r.ok) return false;
    const j = await r.json();
    return j && j.app === 'the-courtroom';
  } catch { return false; }
}

// Live connection with automatic reconnect. onData receives {room, game}.
export function connect({ code, token, onData, onStatus, onGone }) {
  let es = null, closed = false, retry = 0, timer = null;
  const open = () => {
    if (closed) return;
    onStatus?.('connecting');
    es = new EventSource(`api/rooms/${encodeURIComponent(code)}/stream?token=${encodeURIComponent(token)}`);
    es.addEventListener('state', (e) => {
      retry = 0;
      onStatus?.('live');
      try { onData(JSON.parse(e.data)); } catch {}
    });
    es.addEventListener('gone', (e) => {
      closed = true; es.close();
      let why = 'roomGone';
      try { why = JSON.parse(e.data).reason || why; } catch {}
      onGone?.(why);
    });
    es.onerror = () => {
      es.close();
      if (closed) return;
      onStatus?.('reconnecting');
      // check whether the room still exists before retrying forever
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const r = await api(`api/rooms/${encodeURIComponent(code)}/check`, { token });
        if (r && r.ok === false && (r.err === 'notFound' || r.err === 'kicked')) {
          closed = true; onGone?.(r.err === 'kicked' ? 'kicked' : 'roomGone'); return;
        }
        open();
      }, Math.min(8000, 800 * 2 ** retry++));
    };
  };
  open();
  return { close() { closed = true; clearTimeout(timer); es?.close(); } };
}
