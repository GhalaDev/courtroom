// THE COURTROOM — client application (both modes).
import { t, L, esc, roleName, phaseName, phaseCode, sideName, toast, errText, mmss } from './ui.js';
import { getLang, setLang } from './i18n.js';
import { play, toggleSound, soundOn } from './sfx.js';
import { icon, kindIcon } from './art.js';
import { DEFAULT_SETTINGS, LIMITS, OBJECTION_REASONS } from '../shared/constants.js';
import * as H from './views-home.js';
import * as G from './views-game.js';
import { api, connect, loadSession, saveSession, serverAvailable } from './net.js';

const $app = document.getElementById('app');
const $modal = document.getElementById('modal');
const $overlay = document.getElementById('overlay');
const PARTY_KEY = 'court-party';

const app = {
  screen: 'landing',
  server: false,
  sound: soundOn(),
  catalog: [],
  setup: { mode: null, names: ['', '', '', ''], settings: { ...DEFAULT_SETTINGS }, caseId: null, nickname: '' },
  casesFor: null,
  party: false,
  engine: null,       // party engine module (loaded on demand)
  state: null,        // party game state
  online: null,       // { code, token, data, status, conn }
  isHost: false,
  tab: 'court',
  gate: null,
  modal: null,
  seenFeed: null,
  partyUnread: {},
  readMsgs: 0,
  savedParty: null,
  savedOnline: null,
  joinCode: '',
};
window.__court = app; // handy for debugging

// ------------------------------------------------------------ persistence

function loadParty() {
  try { return JSON.parse(localStorage.getItem(PARTY_KEY) || 'null'); } catch { return null; }
}
function saveParty() {
  try {
    if (app.state) localStorage.setItem(PARTY_KEY, JSON.stringify({ state: app.state, unread: app.partyUnread, title: currentTitle() }));
    else localStorage.removeItem(PARTY_KEY);
  } catch {}
}
function currentTitle() {
  const v = view();
  return v ? `${L(v.case.title)} — ${phaseName(v.phase)}` : '';
}

// ------------------------------------------------------------ views

function view(pid = null) {
  if (app.party && app.state) return app.engine.viewFor(app.state, pid);
  if (app.online?.data?.game) return app.online.data.game;
  return null;
}

let clockOffset = 0;
function render() {
  const keep = captureFocus();
  const v = view();
  let html = '';
  if (app.gate && app.party && v) {
    html = G.gateScreen(app, v, app.engine.viewFor(app.state, app.gate.pid));
  } else if (app.screen === 'game' && v) {
    html = G.gameScreen(app, v);
  } else {
    const fn = { landing: H.landing, how: H.how, mode: H.mode, partySetup: H.partySetup, onlineSetup: H.onlineSetup, join: H.join, cases: H.cases, lobby: H.lobby }[app.screen] || H.landing;
    html = fn(app);
  }
  $app.innerHTML = html;
  try {
    if (app.screen === 'game' || app.screen === 'lobby') sessionStorage.setItem('court-active', app.party ? 'party' : 'online');
    else if (app.booted && ['landing', 'mode', 'partySetup', 'onlineSetup', 'join', 'how'].includes(app.screen)) sessionStorage.removeItem('court-active');
  } catch {}
  $app.dataset.screen = app.gate ? 'gate' : app.screen === 'game' && v ? `game-${v.phase}` : app.screen;
  renderModal();
  restoreFocus(keep);
  tickTimers();
}

function captureFocus() {
  const el = document.activeElement;
  if (!el || !el.id || !$app.contains(el)) return null;
  return { id: el.id, s: el.selectionStart, e: el.selectionEnd, value: el.value };
}
function restoreFocus(k) {
  if (!k) return;
  const el = document.getElementById(k.id);
  if (!el) return;
  if (el.tagName === 'TEXTAREA' && k.value != null) el.value = k.value;
  el.focus();
  try { el.setSelectionRange(k.s, k.e); } catch {}
}

// ------------------------------------------------------------ timers

function tickTimers() {
  const v = app.screen === 'game' ? view() : null;
  const f = v?.floor;
  const els = $app.querySelectorAll('[data-timer]');
  if (!els.length) return;
  if (!f) { els.forEach((el) => (el.textContent = '--:--')); return; }
  const now = Date.now() + clockOffset;
  const left = f.paused ? f.remaining : f.endsAt - now;
  els.forEach((el) => {
    el.textContent = left <= 0 ? t('timeUp') : mmss(left);
    el.classList.toggle('low', left > 0 && left < 15000);
    el.classList.toggle('over', left <= 0);
  });
  $app.querySelectorAll('[data-timer-bar]').forEach((el) => { el.style.width = `${Math.max(0, Math.min(1, left / (f.total * 1000))) * 100}%`; });
  const sec = Math.ceil(left / 1000);
  if (!f.paused && sec > 0 && sec <= 5 && sec !== tickTimers.last) { tickTimers.last = sec; play('tick'); }
}
setInterval(tickTimers, 250);

// ------------------------------------------------------------ cinematic overlays

const overlayQueue = [];
let overlayBusy = false;
function processFeed(v, initial) {
  if (!v) return;
  const last = v.feed.length ? +v.feed[v.feed.length - 1].id : 0;
  if (app.seenFeed == null || initial) { app.seenFeed = last; return; }
  const fresh = v.feed.filter((f) => +f.id > app.seenFeed);
  app.seenFeed = last;
  for (const f of fresh) {
    if (f.type === 'SECRET_MESSAGE' && app.party) for (const n of f.toNames) { const p = v.players.find((x) => x.name === n); if (p) app.partyUnread[p.id] = true; }
    const big = ['OBJECTION', 'RULING', 'NEW_EVIDENCE', 'SURPRISE_WITNESS', 'CONTRADICTION', 'SECRET_MESSAGE', 'FINAL_CHANCE', 'REVEAL', 'PHASE'];
    if (big.includes(f.type)) {
      if (f.type === 'PHASE' && ['intro', 'verdict', 'truth', 'roles'].includes(f.phase)) { play(f.phase === 'verdict' ? 'verdict' : 'gavel'); continue; }
      overlayQueue.push(f);
    } else {
      const quiet = { EXHIBIT: 'paper', CALL: 'soft', ANSWER: 'soft', NOTICE: 'gavel', CLAIM_REJECTED: 'soft', STATEMENT: 'soft', FLOOR: 'soft' }[f.type];
      if (quiet) play(quiet);
      if (['EXHIBIT', 'CALL', 'NOTICE', 'CLAIM_REJECTED', 'STATEMENT'].includes(f.type)) toast(stripTags(`${t(`f_${f.type}`)} · ${G.feedText(f, v)}`), f.type === 'CLAIM_REJECTED' ? 'bad' : '');
    }
  }
  if (!app.party && v.me?.messages?.length > app.readMsgs && app.tab === 'file') app.readMsgs = v.me.messages.length;
  runOverlay();
}
const stripTags = (s) => s.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '');

function runOverlay() {
  if (overlayBusy || !overlayQueue.length) return;
  overlayBusy = true;
  const f = overlayQueue.shift();
  const v = view();
  const kinds = {
    OBJECTION: () => ['obj', 'objection', t('objection'), `${esc(f.by)} · ${sideName(f.side)}<br>${esc(L(OBJECTION_REASONS.find((r) => r.id === f.reason)))}`],
    RULING: () => [f.decision === 'accepted' ? 'ok' : 'no', 'gavel', f.decision === 'accepted' ? t('accept') : t('overrule'), f.decision === 'accepted' ? t('accepted') : t('overruled')],
    NEW_EVIDENCE: () => ['ev', 'paper', 'NEW EVIDENCE', `<b>${esc(f.title)}</b><br>${esc(f.text)}`],
    SURPRISE_WITNESS: () => ['sw', 'reveal', 'SURPRISE WITNESS', `<b>${esc(f.title)}</b><br>${esc(f.text)}`],
    CONTRADICTION: () => ['ct', 'contradiction', 'CONTRADICTION', `<b>${esc(f.title)}</b><br>${esc(f.text)}`],
    SECRET_MESSAGE: () => ['sm', 'secret', 'SECRET MESSAGE', `${t('secretTo')}: ${f.toRoles.map(roleName).join('، ')}${!app.party && v?.me && f.toNames.includes(v.me.name) ? `<br><b>${L({ ar: 'افتح ملفك السري', en: 'Open your secret file' })}</b>` : app.party ? `<br><b>${f.toNames.map(esc).join('، ')}: ${L({ ar: 'افتحوا ملفاتكم السرية', en: 'check your files' })}</b>` : ''}`],
    FINAL_CHANCE: () => ['fc', 'gavel3', 'FINAL CHANCE', t('finalChanceText')],
    REVEAL: () => ['rv', 'reveal', L({ ar: 'كشف', en: 'REVELATION' }), `<b>${esc(f.label)}</b><br>${esc(f.text)}`],
    PHASE: () => ['ph', 'gavel', phaseName(f.phase), ''],
  }[f.type]?.();
  if (!kinds) { overlayBusy = false; return runOverlay(); }
  const [cls, snd, word, text] = kinds;
  if (f.type === 'PHASE') {
    $overlay.innerHTML = `<div class="ov ov-ph" data-act="ovClose"><div class="ov-in"><span class="ov-code">${esc(phaseCode(f.phase))}</span><h2>${esc(word)}</h2></div></div>`;
  } else {
    $overlay.innerHTML = `<div class="ov ov-${cls}" data-act="ovClose"><div class="ov-in"><h2>${esc(word)}</h2><p>${text}</p><small>${L({ ar: 'اضغط للمتابعة', en: 'Tap to continue' })}</small></div></div>`;
  }
  play(snd);
  const dur = f.type === 'PHASE' ? 1500 : f.type === 'RULING' ? 1800 : 3600;
  clearTimeout(runOverlay.timer);
  runOverlay.timer = setTimeout(closeOverlay, dur);
}
function closeOverlay() {
  clearTimeout(runOverlay.timer);
  $overlay.innerHTML = '';
  overlayBusy = false;
  setTimeout(runOverlay, 150);
}

// ------------------------------------------------------------ dispatch

function resolveActor(as) {
  const v = view();
  if (!v) return null;
  if (as === 'judge') return v.players.find((p) => p.role === 'judge')?.id;
  if (as === 'prosecution') return v.players.find((p) => p.role === 'prosecutor')?.id;
  if (as === 'defense') return v.players.find((p) => p.role === 'defense')?.id;
  if (as === 'host') return v.players[0]?.id;
  return as || null;
}

async function dispatch(action, as = '') {
  if (app.party) {
    const pid = resolveActor(as) || resolveActor('judge');
    const r = app.engine.act(app.state, { pid, host: true }, action, Date.now());
    if (!r.ok) { toast(errText(r), 'bad'); return r; }
    saveParty();
    processFeed(view());
    render();
    return r;
  }
  const o = app.online;
  if (!o) return { ok: false };
  const r = await api(`api/rooms/${o.code}/act`, { action }, o.token);
  if (!r.ok) toast(errText(r), 'bad');
  return r;
}

// ------------------------------------------------------------ modals

function openModal(m) { app.modal = m; renderModal(); }
function closeModal() { app.modal = null; renderModal(); }

function renderModal() {
  const m = app.modal;
  if (!m) { $modal.innerHTML = ''; $modal.className = ''; return; }
  const v = view();
  let body = '';
  if (m.type === 'case') body = H.caseModal(app, app.catalog.find((c) => c.id === m.id));
  else if (m.type === 'objection') {
    body = `<div class="modal-card"><h3 class="title">${icon.bolt}${t('objectionTitle')}</h3><p class="label">${t('objReason')}</p>
      <div class="reasons">${OBJECTION_REASONS.map((r) => `<button class="btn reason" data-act="objectGo" data-reason="${r.id}" data-as="${esc(m.as)}">${esc(L(r))}</button>`).join('')}</div>
      <button class="link-btn" data-act="closeModal">${t('cancel')}</button></div>`;
  } else if (m.type === 'contra') {
    const items = v.items;
    const sel = m.sel || [];
    body = `<div class="modal-card wide"><h3 class="title">${icon.link}${t('contradiction')}</h3><p class="muted small">${t('contraHelp')}</p>
      ${m.left != null ? `<p class="chip">${m.left} ${t('attemptsLeft')}</p>` : ''}
      <div class="items">${items.map((it) => `<button class="item ${sel.includes(it.id) ? 'on' : ''} k-${it.kind}" data-act="contraToggle" data-id="${esc(it.id)}">${it.kind === 'ev' ? icon.evidence : it.kind === 'st' ? icon.witness : icon.eye}<span>${esc(G.itemLabel(v, it.id))}</span></button>`).join('')}</div>
      <div class="row end"><button class="link-btn" data-act="closeModal">${t('cancel')}</button>
      <button class="btn primary" data-act="contraGo" ${sel.length === 2 ? '' : 'disabled'}>${icon.link}<span>${t('claim')}</span></button></div></div>`;
  } else if (m.type === 'statement') {
    body = `<div class="modal-card"><h3 class="title">${t(`statementDone_${m.kind}`)}</h3>
      <label class="field"><span>${t('summaryOpt')}</span><textarea id="stmtText" rows="4" maxlength="700"></textarea></label>
      <div class="row end"><button class="link-btn" data-act="closeModal">${t('cancel')}</button><button class="btn primary" data-act="statementGo">${t('confirm')}</button></div></div>`;
  } else if (m.type === 'present') {
    const e = m.evData;
    body = `<div class="modal-card"><h3 class="title">${icon.evidence}${t('present')}</h3>
      <div class="fev"><span class="ex-ic">${kindIcon(e.kind)}</span><div><strong>${esc(e.name)}</strong><p>${esc(e.desc)}</p></div></div>
      <label class="field"><span>${t('presentNote')}</span><textarea id="presentNote" rows="3" maxlength="300"></textarea></label>
      <div class="row end"><button class="link-btn" data-act="closeModal">${t('cancel')}</button><button class="btn primary" data-act="presentGo">${t('present')}</button></div></div>`;
  } else if (m.type === 'reveal') {
    body = `<div class="modal-card"><h3 class="title">${icon.eye}${t('reveal')}</h3><p class="lead">${esc(m.r.label)}</p><blockquote class="statement">${esc(m.r.text)}</blockquote>
      <p class="warn-text">${t('revealWarn')}</p>
      <div class="row end"><button class="link-btn" data-act="closeModal">${t('cancel')}</button><button class="btn gold" data-act="revealGo">${t('reveal')}</button></div></div>`;
  } else if (m.type === 'inspect') {
    const x = v.exhibits.find((e) => e.ev === m.ev);
    if (!x) { app.modal = null; $modal.innerHTML = ''; return; }
    const n = v.exhibits.indexOf(x) + 1;
    body = `<div class="modal-card exhibit-detail kind-${x.kind}"><button class="icon-btn modal-x" data-act="closeModal" aria-label="${t('close')}">${icon.x}</button>
      <p class="eyebrow">${t('inspectTitle')} · ${t('exhibitNo')} ${n}</p>
      <div class="ex-big">${kindIcon(x.kind)}<span>${t(`k_${x.kind}`)}</span></div>
      <h3 class="title">${esc(x.name)}</h3><p class="lead">${esc(x.desc)}</p>
      ${x.detail ? `<div class="paper"><p>${esc(x.detail)}</p></div>` : ''}
      ${x.note ? `<blockquote class="statement"><span class="label">${t('submittedBy')}: ${esc(x.by || sideName(x.side))}</span>${esc(x.note)}</blockquote>` : `<p class="muted small">${x.event ? t('eventSubmitted') : x.side === 'court' ? t('courtSubmitted') : `${t('submittedBy')}: ${sideName(x.side)}${x.by ? ` · ${esc(x.by)}` : ''}`}</p>`}
    </div>`;
  } else if (m.type === 'force') {
    body = `<div class="modal-card"><h3 class="title">${t('forceAdvance')}</h3><p>${t('forceWarn')}</p>
      ${v ? `<ul class="plain-list">${v.can.missing.map((x) => `<li>${esc(stripTags(missingLine(x, v)))}</li>`).join('')}</ul>` : ''}
      <div class="row end"><button class="link-btn" data-act="closeModal">${t('cancel')}</button><button class="btn gold" data-act="forceGo">${t('confirm')}</button></div></div>`;
  } else if (m.type === 'confirmExit') {
    body = `<div class="modal-card"><h3 class="title">${t('exit')}</h3><p>${app.party ? t('exitConfirm') : L({ ar: 'ستبقى في الغرفة ويمكنك العودة من الشاشة الرئيسية.', en: 'You stay in the room and can come back from the home screen.' })}</p>
      <div class="row end"><button class="link-btn" data-act="closeModal">${t('cancel')}</button><button class="btn gold" data-act="exitGo">${t('exit')}</button></div></div>`;
  }
  $modal.className = 'open';
  $modal.innerHTML = `<div class="modal-back" data-act="closeModal"></div>${body}`;
}
function missingLine(m, v) {
  const map = { ackRole: 'm_ackRole', vote: 'm_vote', present: 'm_present', courtEvidence: 'm_courtEvidence', standBusy: 'm_standBusy', objection: 'm_objection' };
  if (m.k === 'statement') return `${sideName(m.side)} ${t(`m_statement_${v.phase}`)}`;
  if (m.k === 'examine') return `${m.name} ${t(v.phase === 'witness' ? 'm_examine_witness' : 'm_examine_cross')}`;
  if (m.k === 'courtEvidence') return `${m.n} ${t('m_courtEvidence')}`;
  if (m.k === 'present') return `${sideName(m.side)} ${t('m_present')}`;
  return `${m.name ? `${m.name} ` : ''}${t(map[m.k] || 'm_end')}`;
}

// ------------------------------------------------------------ catalog

async function loadCatalog() {
  if (app.server) {
    const r = await api('api/catalog');
    if (r.ok) { app.catalog = r.cases; return; }
  }
  await ensureEngine();
}
async function ensureEngine() {
  if (app.engine) return app.engine;
  const [engine, reg] = await Promise.all([import('../shared/engine.js'), import('../shared/cases/index.js')]);
  app.engine = engine;
  if (!app.catalog.length) app.catalog = reg.CASES.map(engine.caseSummary);
  return engine;
}

// ------------------------------------------------------------ party flow

async function startParty(caseId) {
  const names = app.setup.names.map((n) => n.trim()).filter(Boolean);
  await ensureEngine();
  const players = names.map((name, i) => ({ id: `p${i + 1}`, name }));
  app.state = app.engine.createGame({ caseId, players, settings: app.setup.settings });
  app.party = true; app.online = null; app.screen = 'game'; app.tab = 'court';
  app.partyUnread = {};
  app.seenFeed = null;
  processFeed(view(), true);
  saveParty();
  closeModal();
  play('gavel3');
  render();
}

async function resumeParty() {
  const saved = loadParty();
  if (!saved) return;
  await ensureEngine();
  app.state = saved.state;
  app.partyUnread = saved.unread || {};
  app.party = true; app.screen = 'game'; app.gate = null;
  processFeed(view(), true);
  render();
}

// ------------------------------------------------------------ online flow

function onOnlineData(d) {
  const o = app.online;
  if (!o) return;
  const first = !o.data;
  const hadGame = !!o.data?.game;
  o.data = d;
  app.isHost = d.room.hostId === d.room.me;
  if (d.game) {
    clockOffset = d.game.now - Date.now();
    if (app.screen !== 'game' && app.screen !== 'cases') { app.screen = 'game'; }
    processFeed(d.game, first || !hadGame);
    if (!hadGame) { app.tab = 'court'; play('gavel3'); }
  } else {
    if (hadGame || app.screen === 'game') app.screen = 'lobby';
    if (app.screen !== 'cases') app.screen = 'lobby';
    app.seenFeed = null;
  }
  render();
}

function startConnection(code, token) {
  app.online?.conn?.close();
  app.online = { code, token, data: null, status: 'connecting' };
  app.party = false; app.state = null;
  saveSession({ code, token });
  app.online.conn = connect({
    code, token,
    onData: onOnlineData,
    onStatus: (s) => { if (app.online) { const prev = app.online.status; app.online.status = s; if (prev !== s) render(); } },
    onGone: (why) => {
      saveSession(null);
      app.online = null;
      app.screen = 'landing';
      toast(why === 'kicked' ? t('kicked') : t('roomGone'), 'bad');
      refreshSaved();
      render();
    },
  });
  app.screen = 'lobby';
  render();
}

async function createRoom(caseId) {
  const name = app.setup.nickname.trim();
  if (!name) { toast(t('nickname'), 'bad'); return; }
  const r = await api('api/rooms', { name, caseId, settings: app.setup.settings });
  if (!r.ok) { toast(errText(r), 'bad'); return; }
  closeModal();
  startConnection(r.code, r.token);
}

async function joinRoom() {
  const code = (document.getElementById('joinCode')?.value || '').trim().toUpperCase();
  const name = (document.getElementById('joinNick')?.value || '').trim();
  app.setup.nickname = name; app.joinCode = code;
  if (!code || !name) { toast(t('enterCode'), 'bad'); return; }
  const saved = loadSession();
  const r = await api(`api/rooms/${encodeURIComponent(code)}/join`, { name, token: saved?.code === code ? saved.token : undefined });
  if (!r.ok) { toast(errText(r), 'bad'); return; }
  startConnection(code, r.token);
}

const lobbyOp = (op, extra = {}) => api(`api/rooms/${app.online.code}/lobby`, { op, ...extra }, app.online.token).then((r) => { if (!r.ok) toast(errText(r), 'bad'); return r; });

// ------------------------------------------------------------ events

function readSetting(el) {
  const k = el.dataset.setting;
  let val = el.value;
  if (k === 'scoring') val = val === 'true';
  else if (k === 'witnesses' || k === 'aides') val = val === 'null' ? null : +val;
  else val = Math.max(+el.min || 0, Math.min(+el.max || 9999, +val || DEFAULT_SETTINGS[k]));
  return [k, val];
}

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.name != null) { app.setup.names[+el.dataset.name] = el.value; return; }
  if (el.dataset.nick != null) { app.setup.nickname = el.value; return; }
  if (el.dataset.notes != null) {
    const pid = el.dataset.notes;
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      if (app.party) { app.engine.act(app.state, { pid, host: true }, { type: 'note', text: el.value }); saveParty(); }
      else dispatch({ type: 'note', text: el.value });
    }, 500);
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.setting) {
    const [k, val] = readSetting(el);
    if (app.screen === 'lobby' && app.online) { lobbyOp('settings', { settings: { ...app.online.data.room.settings, [k]: val } }); return; }
    app.setup.settings[k] = val;
    render();
  }
  if (el.name === 'ev' && el.form) {
    const checked = [...el.form.querySelectorAll('input[name=ev]:checked')];
    if (checked.length > 2) el.checked = false;
  }
});

document.addEventListener('submit', async (e) => {
  const f = e.target;
  if (f.dataset.vote == null) return;
  e.preventDefault();
  const fd = new FormData(f);
  const action = { type: 'vote', verdict: fd.get('verdict'), evidence: fd.getAll('ev'), fairness: +(fd.get('fair') || 3) };
  if (!action.verdict) return;
  const r = await dispatch(action, f.dataset.vote);
  if (r?.ok) {
    toast(t('voted'));
    if (app.party) { app.gate = null; render(); }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (app.modal) closeModal(); else if ($overlay.innerHTML) closeOverlay(); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('case-card')) { e.preventDefault(); e.target.click(); }
});

const actions = {
  go: (d) => { app.screen = d.to; render(); window.scrollTo(0, 0); },
  home: () => { app.gate = null; app.screen = 'landing'; refreshSaved(); closeModal(); render(); },
  sound: () => { app.sound = toggleSound(); render(); },
  lang: () => { setLang(getLang() === 'ar' ? 'en' : 'ar'); render(); },
  pickMode: (d) => { app.setup.mode = d.mode; app.casesFor = null; app.screen = d.mode === 'party' ? 'partySetup' : 'onlineSetup'; render(); },
  addName: () => { if (app.setup.names.length < LIMITS.maxPlayers) app.setup.names.push(''); render(); document.getElementById(`name-${app.setup.names.length - 1}`)?.focus(); },
  delName: (d) => { app.setup.names.splice(+d.i, 1); render(); },
  partyNext: async () => {
    const names = app.setup.names.map((n) => n.trim()).filter(Boolean);
    if (names.length < LIMITS.minPlayers) return toast(t('needPlayers'), 'bad');
    if (new Set(names).size !== names.length) return toast(t('dupNames'), 'bad');
    await ensureEngine();
    app.screen = 'cases'; render(); window.scrollTo(0, 0);
  },
  onlineNext: () => {
    if (!app.setup.nickname.trim()) return toast(t('nickname'), 'bad');
    app.screen = 'cases'; render();
  },
  openCase: (d) => openModal({ type: 'case', id: d.id }),
  closeModal: () => closeModal(),
  startParty: (d) => startParty(d.id),
  createRoom: (d) => createRoom(d.id),
  lobbyPickCase: () => { app.casesFor = 'lobby'; app.screen = 'cases'; render(); },
  lobbyCase: async (d) => { await lobbyOp('case', { caseId: d.id }); app.casesFor = null; closeModal(); app.screen = 'lobby'; render(); },
  resumeParty: () => resumeParty(),
  resumeOnline: () => { const s = loadSession(); if (s) startConnection(s.code, s.token); },
  doJoin: () => joinRoom(),
  ready: () => { const me = app.online.data.room.players.find((p) => p.id === app.online.data.room.me); lobbyOp('ready', { ready: !me.ready }); },
  kick: (d) => lobbyOp('kick', { id: d.id }),
  startOnline: () => lobbyOp('start'),
  leaveRoom: async () => { await lobbyOp('leave'); app.online?.conn?.close(); app.online = null; saveSession(null); app.screen = 'landing'; refreshSaved(); render(); },
  copyLink: async (d) => { try { await navigator.clipboard.writeText(d.link); toast(t('copied')); } catch { prompt(t('shareLink'), d.link); } },

  do: (d) => dispatch(JSON.parse(d.a), d.as),
  tab: (d) => { app.tab = d.tab; if (d.tab === 'file' && !app.party) app.readMsgs = view()?.me?.messages?.length || 0; render(); },
  inspect: (d) => openModal({ type: 'inspect', ev: d.ev }),
  ovClose: () => closeOverlay(),
  force: () => openModal({ type: 'force' }),
  forceGo: async () => { closeModal(); await dispatch({ type: 'advance', force: true }, 'judge'); },
  exitGame: () => openModal({ type: 'confirmExit' }),
  exitGo: () => { closeModal(); app.gate = null; app.screen = 'landing'; refreshSaved(); render(); },

  objectAsk: (d) => openModal({ type: 'objection', as: d.as }),
  objectGo: async (d) => { closeModal(); await dispatch({ type: 'object', reason: d.reason }, d.as); },
  contraAsk: (d) => {
    const pid = d.pid || resolveActor(d.as);
    const pv = app.party ? app.engine.viewFor(app.state, pid) : view();
    openModal({ type: 'contra', as: d.as, sel: [], left: pv?.me?.attemptsLeft });
  },
  contraToggle: (d) => {
    const m = app.modal; const s = m.sel || [];
    m.sel = s.includes(d.id) ? s.filter((x) => x !== d.id) : [...s, d.id].slice(-2);
    renderModal();
  },
  contraGo: async () => { const m = app.modal; closeModal(); await dispatch({ type: 'contradiction', a: m.sel[0], b: m.sel[1] }, m.as); },
  statementAsk: (d) => openModal({ type: 'statement', kind: d.kind, as: d.as }),
  statementGo: async () => { const m = app.modal; const text = document.getElementById('stmtText')?.value || ''; closeModal(); await dispatch({ type: 'statement', kind: m.kind, text }, m.as); },
  presentAsk: (d) => {
    if (app.party) { const pid = d.pid || resolveActor(d.as); app.gate = { pid, step: 'pass', purpose: 'present' }; render(); return; }
    app.tab = 'evidence'; render();
  },
  presentPick: (d) => {
    const pid = app.party ? app.gate?.pid : null;
    const pv = app.party ? app.engine.viewFor(app.state, pid) : view();
    const e = pv.me.evidence.find((x) => x.ev === d.ev);
    openModal({ type: 'present', ev: d.ev, evData: e, pid });
  },
  presentGo: async () => {
    const m = app.modal; const note = document.getElementById('presentNote')?.value || '';
    closeModal();
    const r = await dispatch({ type: 'present', ev: m.ev, note }, m.pid || '');
    if (r?.ok && app.party) { app.gate = null; render(); }
  },
  revealAsk: (d) => {
    const pv = app.party ? app.engine.viewFor(app.state, d.pid) : view();
    const r = pv.me.reveals.find((x) => x.id === d.id);
    openModal({ type: 'reveal', r, pid: d.pid });
  },
  revealGo: async () => {
    const m = app.modal; closeModal();
    const r = await dispatch({ type: 'reveal', id: m.r.id }, app.party ? m.pid : '');
    if (r?.ok && app.party) { app.gate = null; render(); }
  },

  gate: (d) => { app.gate = { pid: d.pid, step: 'pass', purpose: d.purpose }; render(); window.scrollTo(0, 0); },
  gateOpen: () => { document.getElementById('toasts').innerHTML = ''; app.gate.step = 'open'; delete app.partyUnread[app.gate.pid]; saveParty(); render(); window.scrollTo(0, 0); play('paper'); },
  gateCancel: () => { app.gate = null; render(); },
  gateDone: () => {
    const g = app.gate;
    if (g.purpose === 'role') app.engine.act(app.state, { pid: g.pid, host: true }, { type: 'ack' });
    app.gate = null; saveParty();
    $app.innerHTML = `<section class="gate"><div class="gate-lock">${icon.check}</div><p class="lead">${t('hidden')}</p></section>`;
    setTimeout(render, 600);
  },

  playAgain: async () => {
    if (app.party) {
      app.setup.names = app.state.players.map((p) => p.name);
      app.state = null; saveParty(); app.party = false;
      app.screen = 'cases'; app.setup.mode = 'party'; render(); return;
    }
    await lobbyOp('rematch');
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (el.classList.contains('modal-back') && e.target !== el) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset, el); }
});

// ------------------------------------------------------------ boot

function refreshSaved() {
  const p = loadParty();
  app.savedParty = p?.state && p.state.phase !== 'truth' ? p : null;
  app.savedOnline = app.server ? loadSession() : null;
}

async function boot() {
  render();
  app.server = await serverAvailable();
  refreshSaved();
  await loadCatalog().catch(() => {});
  const m = location.hash.match(/join=([A-Z0-9]{4,6})/i);
  if (m && app.server) {
    app.joinCode = m[1].toUpperCase();
    const s = loadSession();
    history.replaceState(null, '', location.pathname);
    if (s && s.code === app.joinCode) { startConnection(s.code, s.token); return; }
    app.screen = 'join';
    app.booted = true;
    render();
    return;
  }
  // a refresh in the middle of a session goes straight back to it
  let active = null;
  try { active = sessionStorage.getItem('court-active'); } catch {}
  app.booted = true;
  if (active === 'party' && app.savedParty) return resumeParty();
  if (active === 'online' && app.savedOnline) return startConnection(app.savedOnline.code, app.savedOnline.token);
  render();
}
boot();
