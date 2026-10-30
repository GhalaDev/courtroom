// Landing, mode, setup, case gallery, join and lobby screens.
import { t, L, esc, roleName, dots } from './ui.js';
import { icon, caseArt, seal } from './art.js';
import { planRoles, LIMITS, DEFAULT_SETTINGS } from '../shared/constants.js';

export function topBar(app, extra = '') {
  return `<div class="topbar">
    <button class="brand-mini" data-act="home" aria-label="${t('backHome')}">${icon.scales}<span>${t('brand')}</span></button>
    <div class="topbar-tools">${extra}
      <button class="icon-btn" data-act="sound" aria-label="${t('sound')}">${app.sound ? icon.sound : icon.mute}</button>
      <button class="icon-btn lang" data-act="lang" aria-label="language">${icon.globe}<span>${t('lang')}</span></button>
    </div>
  </div>`;
}

export function landing(app) {
  const resume = [];
  if (app.savedParty) resume.push(`<button class="btn ghost" data-act="resumeParty">${icon.play}<span>${t('resume')}</span><small>${esc(app.savedParty.title)}</small></button>`);
  if (app.savedOnline) resume.push(`<button class="btn ghost" data-act="resumeOnline">${icon.door}<span>${t('resumeRoom')}</span><small>${esc(app.savedOnline.code)}</small></button>`);
  return `${topBar(app)}
  <section class="landing">
    <div class="landing-seal">${seal}</div>
    <p class="eyebrow">THE COURTROOM</p>
    <h1 class="brand">${t('brand') === 'THE COURTROOM' ? 'The Courtroom' : 'المحكمة'}</h1>
    <p class="lead">${t('brandSub')}</p>
    <div class="cta">
      <button class="btn primary big" data-act="go" data-to="mode">${icon.gavel}<span>${t('start')}</span></button>
      <button class="btn big" data-act="go" data-to="join" ${app.server ? '' : 'disabled'}>${icon.devices}<span>${t('join')}</span></button>
    </div>
    ${resume.length ? `<div class="cta resume">${resume.join('')}</div>` : ''}
    <button class="link-btn" data-act="go" data-to="how">${icon.info}<span>${t('howTo')}</span></button>
    <ul class="facts">
      <li><b>6</b><span>${L({ ar: 'قضايا كاملة', en: 'full cases' })}</span></li>
      <li><b>4–16</b><span>${L({ ar: 'لاعبًا', en: 'players' })}</span></li>
      <li><b>10</b><span>${L({ ar: 'مراحل محاكمة', en: 'trial phases' })}</span></li>
    </ul>
  </section>`;
}

export function how(app) {
  const steps = ['how1', 'how2', 'how3', 'how4', 'how5', 'how6'];
  return `${topBar(app)}
  <section class="page narrow">
    <button class="back" data-act="go" data-to="landing">${icon.arrow}<span>${t('back')}</span></button>
    <h2 class="title">${t('howTo')}</h2>
    <ol class="how">${steps.map((k, i) => `<li><span class="num">${String(i + 1).padStart(2, '0')}</span><p>${t(k)}</p></li>`).join('')}</ol>
    <div class="card plain">
      <h3>${t('roleplan')}</h3>
      <ul class="plain-list">
        <li>${L({ ar: '4 لاعبين: القاضي، المدعي العام، محامي الدفاع، المتهم. القاضي يصدر الحكم.', en: '4: judge, prosecutor, defense, defendant. The judge decides.' })}</li>
        <li>${L({ ar: '5–6 لاعبين: إضافة شاهد أو شاهدين.', en: '5–6: one or two witnesses join.' })}</li>
        <li>${L({ ar: '7–9 لاعبين: إضافة هيئة محلفين (1–3).', en: '7–9: a jury of 1–3.' })}</li>
        <li>${L({ ar: '10 فأكثر: ثلاثة شهود ومحلفون أكثر، ومن 12 لاعبًا: مساعد للادعاء ومساعد للدفاع.', en: '10+: three witnesses and more jurors; from 12, two aides.' })}</li>
        <li>${t('virtualW')}</li>
      </ul>
    </div>
    <button class="btn primary" data-act="go" data-to="mode">${t('start')}</button>
  </section>`;
}

export function mode(app) {
  return `${topBar(app)}
  <section class="page">
    <button class="back" data-act="go" data-to="landing">${icon.arrow}<span>${t('back')}</span></button>
    <h2 class="title">${t('modeTitle')}</h2>
    <div class="mode-grid">
      <button class="mode-card" data-act="pickMode" data-mode="party">
        <span class="mode-ic">${icon.phone}</span>
        <span class="mode-code">PARTY MODE</span>
        <strong>${t('party')}</strong>
        <p>${t('partyDesc')}</p>
      </button>
      <button class="mode-card" data-act="pickMode" data-mode="online" ${app.server ? '' : 'disabled'}>
        <span class="mode-ic">${icon.devices}</span>
        <span class="mode-code">ONLINE MODE</span>
        <strong>${t('online')}</strong>
        <p>${app.server ? t('onlineDesc') : t('onlineOff')}</p>
      </button>
    </div>
  </section>`;
}

function rolePlanHtml(n, settings) {
  if (n < LIMITS.minPlayers) return `<p class="muted">${t('needPlayers')}</p>`;
  const p = planRoles(n, 3, settings);
  const chips = [
    ['judge', 1], ['prosecutor', 1], ['defense', 1], ['defendant', 1],
    ['witness', p.witnesses], ['aideP', p.aides ? 1 : 0], ['aideD', p.aides ? 1 : 0], ['juror', p.jurors],
  ].filter(([, k]) => k > 0);
  return `<div class="plan">${chips.map(([r, k]) => `<span class="chip role-${r}">${roleName(r)}${k > 1 ? ` ×${k}` : ''}</span>`).join('')}</div>
    ${p.bench ? `<p class="muted small">${t('bench')}</p>` : ''}
    ${p.witnesses < 3 ? `<p class="muted small">${t('virtualW')}</p>` : ''}`;
}

export function settingsHtml(s, n, editable = true) {
  const num = (k, min, max, step = 15) => `<label class="field num"><span>${t(`t_${k}`)}</span>
    <input type="number" inputmode="numeric" min="${min}" max="${max}" step="${step}" value="${s[k]}" data-setting="${k}" ${editable ? '' : 'disabled'}></label>`;
  const sel = (k, opts) => `<select data-setting="${k}" ${editable ? '' : 'disabled'}>${opts.map(([v, lab]) => `<option value="${v}" ${String(s[k]) === String(v) ? 'selected' : ''}>${lab}</option>`).join('')}</select>`;
  return `<details class="settings" ${editable ? '' : 'open'}>
    <summary>${icon.timer}<span>${t('settings')}</span></summary>
    <div class="settings-body">
      <p class="label">${t('timers')}</p>
      <div class="grid-3">${num('opening', 30, 600)}${num('exam', 30, 900)}${num('cross', 30, 900)}${num('closing', 30, 600)}${num('final', 15, 180, 5)}${num('deliberation', 30, 900)}</div>
      <div class="grid-3">
        <label class="field"><span>${t('scoring')}</span>${sel('scoring', [['true', t('on')], ['false', t('off')]])}</label>
        <label class="field"><span>${t('wCount')}</span>${sel('witnesses', [['null', t('auto')], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3']])}</label>
        <label class="field"><span>${t('aides')}</span>${sel('aides', [['null', t('auto')], ['0', t('off')], ['2', t('on')]])}</label>
        <label class="field"><span>${t('attempts')}</span>${sel('attempts', [['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']])}</label>
      </div>
      <div class="plan-box"><p class="label">${t('roleplan')} (${n})</p>${rolePlanHtml(n, s)}</div>
    </div>
  </details>`;
}

export function partySetup(app) {
  const names = app.setup.names;
  const n = names.filter((x) => x.trim()).length;
  return `${topBar(app)}
  <section class="page narrow">
    <button class="back" data-act="go" data-to="mode">${icon.arrow}<span>${t('back')}</span></button>
    <p class="eyebrow">PARTY MODE</p>
    <h2 class="title">${t('players')} <small class="count">${n}/${LIMITS.maxPlayers}</small></h2>
    <p class="muted">${t('noPersonal')}</p>
    <ol class="names">
      ${names.map((nm, i) => `<li><span class="seat">${i + 1}</span>
        <input type="text" maxlength="24" placeholder="${t('playerName')} ${i + 1}" value="${esc(nm)}" data-name="${i}" id="name-${i}" autocomplete="off">
        ${names.length > LIMITS.minPlayers ? `<button class="icon-btn" data-act="delName" data-i="${i}" aria-label="remove">${icon.x}</button>` : ''}
      </li>`).join('')}
    </ol>
    ${names.length < LIMITS.maxPlayers ? `<button class="btn ghost" data-act="addName">${icon.plus}<span>${t('addPlayer')}</span></button>` : ''}
    ${settingsHtml(app.setup.settings, n)}
    <div class="row end"><button class="btn primary" data-act="partyNext">${t('chooseCase')}${icon.arrow}</button></div>
  </section>`;
}

export function onlineSetup(app) {
  return `${topBar(app)}
  <section class="page narrow">
    <button class="back" data-act="go" data-to="mode">${icon.arrow}<span>${t('back')}</span></button>
    <p class="eyebrow">ONLINE MODE</p>
    <h2 class="title">${t('createRoom')}</h2>
    <label class="field"><span>${t('nickname')}</span>
      <input type="text" maxlength="24" id="nick" data-nick value="${esc(app.setup.nickname)}" autocomplete="off"></label>
    <p class="muted small">${t('noPersonal')}</p>
    ${settingsHtml(app.setup.settings, 8)}
    <div class="row end"><button class="btn primary" data-act="onlineNext">${t('chooseCase')}${icon.arrow}</button></div>
  </section>`;
}

export function join(app) {
  return `${topBar(app)}
  <section class="page narrow">
    <button class="back" data-act="go" data-to="landing">${icon.arrow}<span>${t('back')}</span></button>
    <p class="eyebrow">ONLINE MODE</p>
    <h2 class="title">${t('joinTitle')}</h2>
    <label class="field"><span>${t('enterCode')}</span>
      <input type="text" id="joinCode" class="code-input" maxlength="6" value="${esc(app.joinCode || '')}" autocomplete="off" autocapitalize="characters" dir="ltr"></label>
    <label class="field"><span>${t('nickname')}</span>
      <input type="text" id="joinNick" maxlength="24" data-nick value="${esc(app.setup.nickname)}" autocomplete="off"></label>
    <p class="muted small">${t('noPersonal')}</p>
    <div class="row end"><button class="btn primary" data-act="doJoin">${t('joinBtn')}${icon.arrow}</button></div>
  </section>`;
}

const diff = (n) => `<span class="diff" title="${t('difficulty')}">${dots(n)}</span>`;

export function cases(app) {
  const list = app.catalog;
  const backTo = app.casesFor === 'lobby' ? 'lobby' : app.setup.mode === 'online' ? 'onlineSetup' : 'partySetup';
  return `${topBar(app)}
  <section class="page wide">
    <button class="back" data-act="go" data-to="${backTo}">${icon.arrow}<span>${t('back')}</span></button>
    <p class="eyebrow">CASE FILES</p>
    <h2 class="title">${t('caseGallery')}</h2>
    <div class="case-grid">
      ${list.map((c) => `<article class="case-card ${app.setup.caseId === c.id ? 'sel' : ''}" data-act="openCase" data-id="${c.id}" tabindex="0" role="button">
        <div class="case-visual art-${c.art}">${caseArt[c.art] || ''}<span class="case-num">CASE ${c.num}</span></div>
        <div class="case-text">
          <p class="case-en">${esc(c.title.en)}</p>
          <h3>${esc(L(c.title))}</h3>
          <p>${esc(L(c.tagline))}</p>
          <div class="case-meta"><span class="chip">${esc(c.genre)}</span>${diff(c.difficulty)}<span class="muted small">${esc(c.duration)}</span></div>
        </div>
      </article>`).join('')}
    </div>
  </section>`;
}

export function caseModal(app, c) {
  const action = app.casesFor === 'lobby' ? 'lobbyCase' : app.setup.mode === 'online' ? 'createRoom' : 'startParty';
  const label = app.casesFor === 'lobby' ? t('changeCase') : app.setup.mode === 'online' ? t('createRoom') : t('startTrial');
  return `<div class="modal-card case-detail">
    <button class="icon-btn modal-x" data-act="closeModal" aria-label="${t('close')}">${icon.x}</button>
    <div class="case-visual art-${c.art} tall">${caseArt[c.art] || ''}<span class="case-num">CASE ${c.num}</span></div>
    <p class="case-en">${esc(c.title.en)}</p>
    <h3 class="title">${esc(L(c.title))}</h3>
    <p class="lead">${esc(L(c.tagline))}</p>
    <div class="dossier-line"><span class="label">${t('charge')}</span><p>${esc(c.charge)}</p></div>
    <div class="case-meta"><span class="chip">${esc(c.genre)}</span>${diff(c.difficulty)}<span class="muted small">${t('duration')}: ${esc(c.duration)}</span></div>
    <div class="row end"><button class="btn primary" data-act="${action}" data-id="${c.id}">${icon.gavel}<span>${label}</span></button></div>
  </div>`;
}

export function lobby(app) {
  const d = app.online?.data;
  if (!d) return `${topBar(app)}<section class="page narrow"><p class="muted center">${t('connecting')}</p></section>`;
  const r = d.room;
  const me = r.players.find((p) => p.id === r.me);
  const isHost = r.hostId === r.me;
  const c = app.catalog.find((x) => x.id === r.caseId);
  const n = r.players.length;
  const allReady = r.players.every((p) => p.ready);
  const canStart = isHost && n >= LIMITS.minPlayers && allReady;
  const link = `${location.origin}${location.pathname}#join=${r.code}`;
  return `${topBar(app, statusPill(app))}
  <section class="page wide lobby">
    <div class="lobby-head">
      <div>
        <p class="eyebrow">${t('lobby')}</p>
        <div class="room-code" dir="ltr"><span>${t('roomCode')}</span><b>${esc(r.code)}</b></div>
        <button class="btn ghost small" data-act="copyLink" data-link="${esc(link)}">${icon.copy}<span>${t('shareLink')}</span></button>
      </div>
      ${c ? `<div class="lobby-case art-${c.art}">${caseArt[c.art] || ''}<div><p class="case-en">CASE ${c.num} · ${esc(c.title.en)}</p><h3>${esc(L(c.title))}</h3>
        ${isHost ? `<button class="btn ghost small" data-act="lobbyPickCase">${t('changeCase')}</button>` : ''}</div></div>` : ''}
    </div>
    <div class="lobby-body">
      <div class="card">
        <h3>${t('players')} <small class="count">${n}/${LIMITS.maxPlayers}</small></h3>
        <ul class="lobby-players">
          ${r.players.map((p) => `<li class="${p.ready ? 'is-ready' : ''}">
            <span class="dot ${p.online ? 'on' : ''}" title="${p.online ? t('onlineNow') : t('offline')}"></span>
            <span class="pname">${esc(p.name)}${p.id === r.me ? ` <small>(${t('you')})</small>` : ''}</span>
            ${p.id === r.hostId ? `<span class="chip gold">${icon.crown}${t('host')}</span>` : ''}
            <span class="ready-tag">${p.ready ? t('ready') : t('notReady')}</span>
            ${isHost && p.id !== r.me ? `<button class="icon-btn" data-act="kick" data-id="${p.id}" aria-label="${t('kick')}">${icon.x}</button>` : ''}
          </li>`).join('')}
        </ul>
        <div class="row">
          <button class="btn ${me?.ready ? 'ghost' : 'primary'}" data-act="ready">${me?.ready ? t('unready') : t('imReady')}</button>
          <button class="btn ghost" data-act="leaveRoom">${icon.door}<span>${t('leaveRoom')}</span></button>
        </div>
      </div>
      <div class="card">
        ${settingsHtml(r.settings, n, isHost)}
        ${isHost
          ? `<button class="btn primary big full" data-act="startOnline" ${canStart ? '' : 'disabled'}>${icon.gavel}<span>${t('startTrial')}</span></button>
             ${!canStart ? `<p class="muted small center">${n < LIMITS.minPlayers ? t('needPlayers') : t('allReady')}</p>` : ''}`
          : `<p class="muted center">${t('waitingHost')}</p>`}
      </div>
    </div>
  </section>`;
}

export function statusPill(app) {
  const s = app.online?.status;
  if (!s || s === 'live') return '';
  return `<span class="pill warn">${s === 'reconnecting' ? t('reconnecting') : t('connecting')}</span>`;
}

export { DEFAULT_SETTINGS };
