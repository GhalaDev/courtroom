// In-game screens: intro, role reveal, courtroom (with evidence room, witness
// stand, record and secret files), jury room, verdict and truth reveal.
import { t, L, esc, roleName, phaseName, phaseCode, sideName, mmss } from './ui.js';
import { icon, caseArt, kindIcon } from './art.js';
import { PHASES, OBJECTION_REASONS } from '../shared/constants.js';
import { topBar, statusPill } from './views-home.js';

const ACTIVE = ['opening', 'evidence', 'witness', 'cross', 'closing'];
const J = (o) => esc(JSON.stringify(o));
export const A = (action, as = '') => `data-act="do" data-a="${J(action)}" data-as="${as}"`;

const HINTS = {
  intro: { ar: 'اقرؤوا ملف القضية معًا. لا أحد يعرف الحقيقة بعد.', en: 'Read the case together. Nobody knows the truth yet.' },
  roles: { ar: 'كل لاعب يستلم دوره وملفه السري بمفرده.', en: 'Each player receives their role and secret file alone.' },
  opening: { ar: 'القاضي يمنح الكلمة للادعاء ثم للدفاع. كل طرف يعرض روايته الأولى بصوته.', en: 'The judge gives the floor to the prosecution, then the defense, for their opening.' },
  evidence: { ar: 'القاضي يعرض أدلة المحكمة واحدًا تلو الآخر، وكل طرف يعرض أدلته الخاصة ويشرح علاقتها بالقضية.', en: 'The judge shows court exhibits one by one; each side presents its own evidence.' },
  witness: { ar: 'يستدعي القاضي كل شاهد. الطرف الذي استدعى الشاهد يستجوبه أولًا.', en: 'The judge calls each witness. The calling side examines first.' },
  cross: { ar: 'يستدعي القاضي الشهود مجددًا. الطرف الآخر يواجه الشاهد ويكشف التناقضات.', en: 'Witnesses return. The other side confronts them and exposes contradictions.' },
  closing: { ar: 'المرافعات الختامية. يمكن للقاضي منح فرصة أخيرة قصيرة لكل طرف.', en: 'Closing arguments. The judge may grant a short final chance.' },
  voting: { ar: 'هيئة المحلفين تصوّت بسرية.', en: 'The jury votes in secret.' },
  verdict: { ar: 'النطق بالحكم.', en: 'The verdict.' },
  truth: { ar: 'هذا ما حدث فعلًا.', en: 'This is what really happened.' },
};

// -------------------------------------------------------------- helpers

export const lead = (v, side) => v.players.find((p) => p.role === (side === 'prosecution' ? 'prosecutor' : 'defense'));
const charName = (v, ch) => v.case.characters[ch]?.name || ch;
const exNo = (v, ev) => v.exhibits.findIndex((x) => x.ev === ev) + 1;
const reasonName = (id) => L(OBJECTION_REASONS.find((r) => r.id === id) || { ar: id, en: id });

export function itemLabel(v, id) {
  const [k, ref] = id.split(':');
  if (k === 'ev') { const x = v.exhibits.find((e) => e.ev === ref); return `${t('exhibitNo')} ${exNo(v, ref)}: ${x?.name || ref}`; }
  if (k === 'st') return `${t('statement')}: ${charName(v, ref)}`;
  if (k === 'rv') { const r = v.reveals.find((e) => e.id === ref); return `${t('revealed')}: ${r?.label || ref}`; }
  return id;
}

export function feedText(f, v) {
  switch (f.type) {
    case 'PHASE': return `${t('f_PHASE')}: ${phaseName(f.phase)}`;
    case 'FLOOR': return `${t('floorTo')} ${esc(f.name || t('general'))}${f.role ? ` (${roleName(f.role)})` : ''} — ${mmss(f.seconds * 1000)}`;
    case 'OBJECTION': return `${esc(f.by)} (${sideName(f.side)}): ${reasonName(f.reason)}`;
    case 'RULING': return `${f.decision === 'accepted' ? t('accepted') : t('overruled')} — ${esc(f.by)}: ${reasonName(f.reason)}`;
    case 'NEW_EVIDENCE': case 'SURPRISE_WITNESS': return `${esc(f.title)} — ${esc(f.text)}`;
    case 'SECRET_MESSAGE': return `${t('secretTo')} ${f.toRoles.map(roleName).join('، ')}`;
    case 'CONTRADICTION': return `<b>${esc(f.title)}</b> — ${esc(f.text)} <small>(${esc(f.by)})</small>`;
    case 'CLAIM_REJECTED': return `${esc(f.by)}: ${f.items.map((i) => esc(itemLabel(v, i))).join(' ⟷ ')}`;
    case 'EXHIBIT': { const x = v.exhibits.find((e) => e.ev === f.ev); return `${t('exhibitNo')} ${exNo(v, f.ev)}: ${esc(x?.name || '')} — ${sideName(f.side)}${f.note ? `: «${esc(f.note)}»` : ''}`; }
    case 'CALL': return `${esc(f.name)} — ${f.mode === 'direct' ? t('direct') : t('crossM')}`;
    case 'DISMISS': return esc(f.name);
    case 'ANSWER': return `${esc(f.name)} ← «${esc(f.q)}»<br><b>«${esc(f.a)}»</b>`;
    case 'STATEMENT': return `${sideName(f.side)} — ${f.kind === 'opening' ? t('t_opening') : f.kind === 'closing' ? t('t_closing') : t('t_final')}${f.text ? `: «${esc(f.text)}»` : ''}`;
    case 'REVEAL': return `${esc(f.by)} — <b>${esc(f.label)}</b>: ${esc(f.text)}`;
    case 'NOTICE': return t(`n_${f.kind}`);
    case 'FINAL_CHANCE': return t('finalChanceText');
    case 'VOTE_CAST': return `${f.n} ${t('votesIn')} ${f.of}`;
    default: return '';
  }
}

function stepper(v) {
  const i = PHASES.indexOf(v.phase);
  return `<ol class="stepper" aria-label="${t('phase')}">${PHASES.map((p, k) => `<li class="${k < i ? 'past' : k === i ? 'now' : ''}" title="${esc(phaseName(p))}"><i></i><span>${esc(phaseName(p))}</span></li>`).join('')}</ol>`;
}

function phaseHead(v) {
  return `<div class="phase-head"><span class="phase-code">${phaseCode(v.phase)}</span><h2>${phaseName(v.phase)}</h2><p>${L(HINTS[v.phase])}</p></div>`;
}

function missingText(m, v) {
  switch (m.k) {
    case 'ackRole': return `${esc(m.name)} ${t('m_ackRole')}`;
    case 'statement': return `${sideName(m.side)} ${t(`m_statement_${v.phase}`)}`;
    case 'courtEvidence': return `${m.n} ${t('m_courtEvidence')}`;
    case 'present': return `${sideName(m.side)} ${t('m_present')}`;
    case 'examine': return `${esc(m.name)} ${t(v.phase === 'witness' ? 'm_examine_witness' : 'm_examine_cross')}`;
    case 'standBusy': return t('m_standBusy');
    case 'vote': return `${esc(m.name)} ${t('m_vote')}`;
    case 'objection': return t('m_objection');
    default: return t('m_end');
  }
}

function checklist(v) {
  if (v.can.ok) return `<div class="checklist ok">${icon.check}<span>${L({ ar: 'شروط المرحلة مكتملة. يمكن للقاضي الانتقال.', en: 'Phase complete. The judge may move on.' })}</span></div>`;
  return `<div class="checklist"><p class="label">${t('missing')}</p><ul>${v.can.missing.map((m) => `<li>${missingText(m, v)}</li>`).join('')}</ul></div>`;
}

function floorCard(v) {
  const f = v.floor;
  if (!f) return `<div class="floor idle"><span class="label">${t('floor')}</span><p class="muted">${t('noFloor')}</p></div>`;
  const sp = f.speaker ? v.players.find((p) => p.id === f.speaker) : null;
  const who = f.label === 'deliberation' ? t('deliberation') : sp ? esc(sp.name) : t('general');
  return `<div class="floor ${f.paused ? 'paused' : ''}">
    <div class="floor-who"><span class="label">${f.label === 'deliberation' ? t('deliberation') : t('floor')}</span><strong>${who}</strong>${sp ? `<span class="chip role-${sp.role}">${roleName(sp.role)}</span>` : ''}${f.paused ? `<span class="chip warn">${t('paused')}</span>` : ''}</div>
    <div class="floor-time" data-timer>--:--</div>
    <div class="bar"><i data-timer-bar></i></div>
  </div>`;
}

function objectionCard(v, judgeCan) {
  const o = v.objection;
  if (!o) return '';
  return `<div class="objection-card">
    <span class="obj-word">${t('objection')}</span>
    <p><b>${esc(o.name)}</b> · ${sideName(o.side)} — ${reasonName(o.reason)}</p>
    ${judgeCan ? `<div class="row center"><button class="btn accept" ${A({ type: 'rule', decision: 'accept' }, 'judge')}>${icon.check}<span>${t('accept')}</span></button>
      <button class="btn overrule" ${A({ type: 'rule', decision: 'overrule' }, 'judge')}>${icon.x}<span>${t('overrule')}</span></button></div>`
      : `<p class="muted small">${t('pending')}</p>`}
  </div>`;
}

function witnessCard(v, w, opts = {}) {
  const ch = v.case.characters[w.char];
  const onStand = v.stand?.char === w.char;
  const ex = w.examined || {};
  return `<article class="witness ${onStand ? 'on' : ''}">
    <div class="w-head">
      <span class="w-ic">${icon.witness}</span>
      <div><strong>${esc(ch.name)}</strong><small>${esc(ch.title)}</small></div>
      <div class="w-tags">
        <span class="chip side-${w.side}">${sideName(w.side)}</span>
        ${w.surprise ? `<span class="chip gold">${t('surprise')}</span>` : ''}
        ${w.optional ? `<span class="chip">${t('optionalW')}</span>` : ''}
        ${w.human ? `<span class="chip">${t('playedBy')} ${esc(w.humanName)}</span>` : `<span class="chip ghost">${t('virtual')}</span>`}
        <span class="chip ${ex.direct ? 'ok' : ''}">${t('direct')} ${ex.direct ? '✓' : ''}</span>
        <span class="chip ${ex.cross ? 'ok' : ''}">${t('crossM')} ${ex.cross ? '✓' : ''}</span>
      </div>
    </div>
    ${w.statement ? `<blockquote class="statement"><span class="label">${t('statement')}</span>${esc(w.statement)}</blockquote>` : `<p class="muted small">${t('notCalled')}</p>`}
    ${onStand && w.questions && opts.canAsk ? `<div class="qa"><p class="label">${t('askQ')}</p>${w.questions.map((q) => `<button class="q ${q.asked ? 'asked' : ''}" ${q.asked || q.locked ? 'disabled' : A({ type: 'ask', q: q.i }, opts.askAs || 'judge')}>${q.locked ? icon.lock : icon.arrow}<span>${esc(q.q)}</span>${q.locked ? `<small>${t('locked')}</small>` : ''}</button>`).join('')}</div>` : ''}
    ${w.answers?.length ? `<div class="answers"><p class="label">${t('answers')}</p>${w.answers.map((x) => `<p><span class="q-txt">«${esc(x.q)}»</span><b>«${esc(x.a)}»</b></p>`).join('')}</div>` : ''}
    ${opts.judgeCall && !v.stand && ['witness', 'cross'].includes(v.phase) ? `<button class="btn small" ${A({ type: 'call', char: w.char }, 'judge')}>${icon.gavel}<span>${t('callWitness')}</span></button>` : ''}
  </article>`;
}

function exhibitCard(v, x, i) {
  return `<button class="exhibit kind-${x.kind} ${x.event ? 'event' : ''}" data-act="inspect" data-ev="${esc(x.ev)}">
    <span class="tag">${t('exhibitNo')} ${i + 1}</span>
    <span class="ex-ic">${kindIcon(x.kind)}</span>
    <strong>${esc(x.name)}</strong>
    <span class="ex-desc">${esc(x.desc)}</span>
    <span class="ex-by">${x.event ? t('eventSubmitted') : x.side === 'court' ? t('courtSubmitted') : `${sideName(x.side)}${x.by ? ` · ${esc(x.by)}` : ''}`}</span>
  </button>`;
}

// -------------------------------------------------------------- secret file

export function fileHtml(me, v, opts = {}) {
  if (!me || !me.role) return '';
  const f = me.file || {};
  const ch = me.char ? v.case.characters[me.char] : null;
  const list = (k, arr) => (arr && arr.length ? `<section><h4>${t(k)}</h4><ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : '');
  const para = (k, s) => (s ? `<section><h4>${t(k)}</h4><p>${esc(s)}</p></section>` : '');
  const ev = me.evidence?.length ? `<section><h4>${t('f_evidence')}</h4><div class="file-ev">${me.evidence.map((e) => `<div class="fev ${e.presented ? 'done' : ''}">
      <span class="ex-ic">${kindIcon(e.kind)}</span><div><strong>${esc(e.name)}</strong><p>${esc(e.desc)}</p><p class="detail">${esc(e.detail)}</p></div>
      ${e.presented ? `<span class="chip ok">${t('presented')}</span>` : opts.present ? `<button class="btn small" data-act="presentPick" data-ev="${esc(e.ev)}">${t('present')}</button>` : `<span class="chip">${t('notPresented')}</span>`}
    </div>`).join('')}</div></section>` : '';
  const reveals = me.reveals?.length ? `<section><h4>${t('f_reveals')}</h4>${me.reveals.map((r) => `<div class="fev ${r.done ? 'done' : ''}"><div><strong>${esc(r.label)}</strong><p>${esc(r.text)}</p></div>
      ${r.done ? `<span class="chip ok">${t('revealed')}</span>` : ACTIVE.includes(v.phase) && opts.reveal ? `<button class="btn small" data-act="revealAsk" data-id="${esc(r.id)}" data-pid="${esc(me.id)}">${t('reveal')}</button>` : ''}</div>`).join('')}</section>` : '';
  const obj = me.objectives?.length && v.settings.scoring ? `<section><h4>${t('f_objectives')}</h4><ul>${me.objectives.map((o) => `<li>${esc(o.label)} <b class="pts">+${o.pts}</b></li>`).join('')}</ul></section>` : '';
  const msgs = me.messages?.length ? `<section class="msgs"><h4>${icon.mail}${t('f_messages')}</h4>${me.messages.map((m) => `<div class="msg"><strong>${esc(m.title)}</strong><p>${esc(m.text)}</p></div>`).join('')}</section>` : '';
  const guide = me.witnessGuide?.length ? `<section><h4>${t('f_guide')}</h4><dl class="guide">${me.witnessGuide.map((g) => `<dt>${esc(g.q)}</dt><dd>${esc(g.a)}</dd>`).join('')}</dl></section>` : '';
  const notes = opts.notes ? `<section><h4>${icon.note}${t('tab_notes')}</h4><textarea id="notes-${esc(me.id)}" data-notes="${esc(me.id)}" rows="5" placeholder="${t('notesPh')}">${esc(me.notes || '')}</textarea></section>` : '';
  return `<div class="dossier">
    <div class="dossier-top"><span class="stamp">${t('confidential')}</span><span class="file-no">CASE ${esc(v.case.num)}</span></div>
    <div class="dossier-id">
      <span class="role-emblem role-${me.role}">${roleIcon(me.role)}</span>
      <div><p class="label">${t('yourRole')}</p><h3>${roleName(me.role)}</h3>${ch ? `<p class="char"><b>${esc(ch.name)}</b> — ${esc(ch.title)}</p>` : ''}<p class="pname">${esc(me.name)}</p></div>
    </div>
    ${msgs}
    ${para('f_identity', f.identity)}${para('f_brief', f.brief)}${para('f_theory', f.theory)}
    ${list('f_knows', f.knows)}${list('f_saw', f.saw)}${list('f_hides', f.hides)}
    ${me.statement ? `<section><h4>${t('f_statement')}</h4><blockquote class="statement">${esc(me.statement)}</blockquote></section>` : ''}
    ${list('f_goals', f.goals)}${list('f_tips', f.tips)}${para('f_aide', f.aideNote)}${para('f_warning', f.warning)}
    ${ev}${reveals}${guide}${obj}${notes}
  </div>`;
}

export function roleIcon(r) {
  return ({ judge: icon.gavel, prosecutor: icon.scales, defense: icon.scales, defendant: icon.lock, witness: icon.witness, juror: icon.jury, aideP: icon.folder, aideD: icon.folder })[r] || icon.folder;
}

// -------------------------------------------------------------- intro

function introScreen(app, v) {
  const canGo = app.party || app.isHost;
  const chars = Object.entries(v.case.characters);
  return `${topBar(app, statusPill(app) + exitBtn())}
  <section class="intro">
    <div class="intro-visual art-${v.case.art}">${caseArt[v.case.art] || ''}</div>
    <p class="eyebrow">CASE ${esc(v.case.num)} · ${esc(v.case.title.en)}</p>
    <h1 class="intro-title">${esc(L(v.case.title))}</h1>
    <div class="intro-lines">${v.case.intro.map((l, i) => `<p style="--d:${0.4 + i * 1.1}s">${esc(l)}</p>`).join('')}</div>
    <div class="intro-files" style="--d:${0.6 + v.case.intro.length * 1.1}s">
      <div class="card"><h3>${t('incident')}</h3><p class="label">${esc(v.case.incident.place)} · ${esc(v.case.incident.when)}</p><p>${esc(v.case.incident.summary)}</p>
        <div class="dossier-line"><span class="label">${t('charge')}</span><p>${esc(v.case.charge)}</p></div></div>
      <div class="card"><h3>${t('timeline')}</h3><ol class="timeline">${v.case.timeline.map((x) => `<li><time>${esc(x.time)}</time><span>${esc(x.text)}</span></li>`).join('')}</ol></div>
      <div class="card"><h3>${t('charactersT')}</h3><ul class="people">${chars.map(([, c]) => `<li><strong>${esc(c.name)}</strong><small>${esc(c.title)}</small><p>${esc(c.bio)}</p></li>`).join('')}</ul></div>
    </div>
    <div class="row center sticky-cta">${canGo ? `<button class="btn primary big" ${A({ type: 'advance' }, 'host')}>${icon.folder}<span>${t('phase')}: ${phaseName('roles')}</span></button>` : `<p class="muted">${t('waitingHost')}</p>`}</div>
  </section>`;
}

const exitBtn = () => `<button class="icon-btn" data-act="exitGame" aria-label="${t('exit')}">${icon.door}</button>`;

// -------------------------------------------------------------- roles

function rolesScreen(app, v) {
  if (app.party) {
    const acked = new Set(v.acks.roles || []);
    const next = v.players.find((p) => !acked.has(p.id));
    return `${topBar(app, exitBtn())}
    <section class="page narrow roles-party">
      <p class="eyebrow">ROLE ASSIGNMENT</p>
      <h2 class="title">${t('tab_files')}</h2>
      <p class="muted">${t('onlyThem')}</p>
      <ol class="handoff">${v.players.map((p) => `<li class="${acked.has(p.id) ? 'done' : p === next ? 'next' : ''}"><span class="seat">${acked.has(p.id) ? icon.check : icon.lock}</span><span>${esc(p.name)}</span>${acked.has(p.id) ? `<small>${t('revealProgress')}</small>` : ''}</li>`).join('')}</ol>
      ${next ? `<button class="btn primary big full" data-act="gate" data-pid="${esc(next.id)}" data-purpose="role">${icon.eye}<span>${t('passTo')} ${esc(next.name)}</span></button>`
        : `<button class="btn primary big full" ${A({ type: 'advance' }, 'judge')}>${icon.gavel}<span>${L({ ar: 'افتتح الجلسة', en: 'Open the session' })}</span></button>`}
    </section>`;
  }
  const me = v.me;
  const acked = new Set(v.acks.roles || []);
  const isJudge = me?.role === 'judge';
  return `${topBar(app, statusPill(app) + exitBtn())}
  <section class="page narrow">
    <p class="eyebrow">ROLE ASSIGNMENT</p>
    <div class="flip-in">${fileHtml(me, v, { notes: false })}</div>
    ${!me.ackRole ? `<button class="btn primary big full" ${A({ type: 'ack' })}>${icon.check}<span>${t('understood')}</span></button>` : `<p class="muted center">${t('waitingOthers')} (${acked.size}/${v.players.length})</p>`}
    ${(isJudge || app.isHost) && v.can.ok ? `<button class="btn primary big full" ${A({ type: 'advance' })}>${icon.gavel}<span>${L({ ar: 'افتتح الجلسة', en: 'Open the session' })}</span></button>` : ''}
    ${app.isHost && !v.can.ok ? `<button class="btn ghost small" data-act="force">${t('forceAdvance')}</button>` : ''}
  </section>`;
}

// -------------------------------------------------------------- courtroom

function judgeDock(app, v) {
  const ph = v.phase, s = v.settings, parts = [];
  const as = 'judge';
  const give = (side, secs, label) => {
    const p = lead(v, side);
    return `<button class="btn small side-${side}" ${A({ type: 'floor', speaker: p?.id, seconds: secs, label }, as)}>${icon.timer}<span>${t('giveFloor')} ${side === 'prosecution' ? t('toProsecution') : t('toDefense')} · ${mmss(secs * 1000)}</span></button>`;
  };
  if (v.objection) {
    return `<div class="dock-group judge"><p class="dock-title">${icon.gavel}${t('judgePanel')}</p>${objectionCard(v, true)}</div>`;
  }
  if (ph === 'opening' || ph === 'closing') {
    const secs = ph === 'opening' ? s.opening : s.closing;
    for (const side of ['prosecution', 'defense']) {
      parts.push(give(side, secs, ph));
      if (!v.statements[ph][side]) parts.push(`<button class="btn small ghost" ${A({ type: 'statement', kind: ph, side }, as)}>${icon.check}<span>${t('markDone')}: ${sideName(side)}</span></button>`);
    }
    if (ph === 'closing') {
      if (!v.finalChance) parts.push(`<button class="btn small gold" ${A({ type: 'finalChance' }, as)}>${icon.bolt}<span>${t('finalChance')}</span></button>`);
      else for (const side of ['prosecution', 'defense']) parts.push(give(side, s.final, 'final'));
    }
  } else if (ph === 'evidence') {
    parts.push(`<button class="btn small gold" ${v.courtLeft ? A({ type: 'release' }, as) : 'disabled'}>${icon.evidence}<span>${t('releaseNext')} (${v.courtLeft} ${t('left')})</span></button>`);
    parts.push(give('prosecution', 90, 'evidence'), give('defense', 90, 'evidence'));
  } else if (ph === 'witness' || ph === 'cross') {
    if (v.stand) {
      const w = v.witnesses.find((x) => x.char === v.stand.char);
      const examSide = ph === 'witness' ? w.side : w.side === 'prosecution' ? 'defense' : 'prosecution';
      const other = examSide === 'prosecution' ? 'defense' : 'prosecution';
      const secs = ph === 'witness' ? s.exam : s.cross;
      parts.push(give(examSide, secs, ph), give(other, 60, ph));
      if (w.human) parts.push(`<button class="btn small" ${A({ type: 'floor', speaker: w.human, seconds: 90, label: 'witness' }, as)}>${icon.witness}<span>${t('giveFloor')} ${t('toWitness')}</span></button>`);
      parts.push(`<button class="btn small ghost" ${A({ type: 'dismiss' }, as)}>${icon.door}<span>${t('dismiss')}</span></button>`);
    } else {
      const mode = ph === 'witness' ? 'direct' : 'cross';
      parts.push(...v.witnesses.map((w) => `<button class="btn small ${w.examined?.[mode] ? 'ghost' : ''}" ${A({ type: 'call', char: w.char }, as)}>${icon.witness}<span>${t('callWitness')}: ${esc(charName(v, w.char))}${w.examined?.[mode] ? ' ✓' : ''}</span></button>`));
    }
  }
  const timer = v.floor && v.floor.label !== 'deliberation' ? `<div class="dock-row">
      ${v.floor.paused ? `<button class="btn small" ${A({ type: 'floorResume' }, as)}>${icon.play}<span>${t('resumeT')}</span></button>` : `<button class="btn small" ${A({ type: 'floorPause' }, as)}>${icon.pause}<span>${t('pause')}</span></button>`}
      <button class="btn small ghost" ${A({ type: 'floorEnd' }, as)}>${icon.stop}<span>${t('endFloor')}</span></button></div>` : '';
  const notices = `<div class="dock-row notices">${['rephrase', 'order', 'strike', 'recess'].map((k) => `<button class="btn tiny ghost" ${A({ type: 'notice', kind: k }, as)}>${t(k)}</button>`).join('')}</div>`;
  const adv = v.can.ok
    ? `<button class="btn primary" ${A({ type: 'advance' }, as)}>${icon.arrow}<span>${t('advance')}</span></button>`
    : `<button class="btn ghost" data-act="force">${icon.arrow}<span>${t('forceAdvance')}</span></button>`;
  return `<div class="dock-group judge"><p class="dock-title">${icon.gavel}${t('judgePanel')}</p>
    <div class="dock-row">${parts.join('')}</div>${timer}${notices}<div class="dock-row end">${adv}</div></div>`;
}

function counselDock(app, v, side, pid) {
  const ph = v.phase, out = [];
  const as = app.party ? side : '';
  const me = app.party ? null : v.me;
  const isLead = app.party || me?.role === 'prosecutor' || me?.role === 'defense';
  if (ACTIVE.includes(ph) && !v.objection) {
    out.push(`<button class="btn objection-btn" data-act="objectAsk" data-as="${as}">${icon.bolt}<span>${t('objection')}</span></button>`);
  }
  if (['evidence', 'witness', 'cross'].includes(ph)) {
    out.push(`<button class="btn small" data-act="presentAsk" data-as="${as}" data-pid="${esc(pid || '')}">${icon.evidence}<span>${t('present')}</span></button>`);
  }
  if (['evidence', 'witness', 'cross', 'closing'].includes(ph)) {
    out.push(`<button class="btn small" data-act="contraAsk" data-as="${as}" data-pid="${esc(pid || '')}">${icon.link}<span>${t('contradiction')}</span></button>`);
  }
  if (isLead && (ph === 'opening' || ph === 'closing') && !v.statements[ph][side]) {
    out.push(`<button class="btn small ghost" data-act="statementAsk" data-kind="${ph}" data-as="${as}">${icon.check}<span>${t(`statementDone_${ph}`)}</span></button>`);
  }
  if (isLead && ph === 'closing' && v.finalChance && !v.statements.final[side]) {
    out.push(`<button class="btn small ghost" data-act="statementAsk" data-kind="final" data-as="${as}">${icon.bolt}<span>${t('statementDone_final')}</span></button>`);
  }
  if (!out.length) return '';
  return `<div class="dock-group side-${side}"><p class="dock-title">${icon.scales}${sideName(side)}${app.party && lead(v, side) ? ` · ${esc(lead(v, side).name)}` : ''}</p><div class="dock-row">${out.join('')}</div></div>`;
}

function dock(app, v) {
  if (app.party) {
    return `<footer class="dock party">${judgeDock(app, v)}<div class="dock-sides">${counselDock(app, v, 'prosecution', lead(v, 'prosecution')?.id)}${counselDock(app, v, 'defense', lead(v, 'defense')?.id)}</div></footer>`;
  }
  const me = v.me;
  if (!me?.role) return '';
  if (me.role === 'judge') return `<footer class="dock">${judgeDock(app, v)}${app.isHost ? '' : ''}</footer>`;
  if (me.team) return `<footer class="dock">${counselDock(app, v, me.team, me.id)}</footer>`;
  const hostTools = app.isHost ? `<div class="dock-group"><p class="dock-title">${icon.crown}${t('host')}</p><div class="dock-row"><button class="btn small ghost" data-act="force">${t('forceAdvance')}</button></div></div>` : '';
  if ((me.role === 'defendant' || me.role === 'witness') && me.reveals?.some((r) => !r.done) && ACTIVE.includes(v.phase)) {
    return `<footer class="dock"><div class="dock-group"><p class="dock-title">${roleIcon(me.role)}${roleName(me.role)}</p><div class="dock-row"><button class="btn small gold" data-act="tab" data-tab="file">${icon.eye}<span>${t('reveal')}</span></button></div></div>${hostTools}</footer>`;
  }
  return hostTools ? `<footer class="dock">${hostTools}</footer>` : '';
}

function stage(app, v) {
  const judgeCan = app.party || v.me?.role === 'judge';
  const canAsk = app.party || v.me?.team || v.me?.role === 'judge';
  const stand = v.stand ? v.witnesses.find((w) => w.char === v.stand.char) : null;
  const recent = v.feed.filter((f) => !['VOTE_CAST'].includes(f.type)).slice(-4).reverse();
  return `<section class="stage">
    ${phaseHead(v)}
    ${floorCard(v)}
    ${judgeCan ? '' : objectionCard(v, false)}
    ${['witness', 'cross'].includes(v.phase) ? `<div class="stand-box"><p class="label">${icon.witness}${t('onStand')}${v.stand ? ` · ${v.stand.mode === 'direct' ? t('direct') : t('crossM')}` : ''}</p>
      ${stand ? witnessCard(v, stand, { canAsk, askAs: app.party ? 'judge' : '' }) : `<p class="muted">${t('emptyStand')}</p>`}</div>` : ''}
    ${v.phase === 'evidence' ? `<div class="mini-ex"><p class="label">${t('exhibits')} (${v.exhibits.length})</p>${v.exhibits.length ? `<div class="ex-strip">${v.exhibits.slice(-4).map((x) => exhibitCard(v, x, v.exhibits.indexOf(x))).join('')}</div>` : `<p class="muted">${t('noExhibits')}</p>`}</div>` : ''}
    ${checklist(v)}
    <div class="recent"><p class="label">${t('record')}</p><ul>${recent.map((f) => `<li class="f-${f.type}"><span class="f-type">${t(`f_${f.type}`)}</span><span>${feedText(f, v)}</span></li>`).join('')}</ul></div>
  </section>`;
}

function evidenceTab(app, v) {
  const me = v.me;
  return `<div class="tab-body">
    <h3>${icon.evidence}${t('tab_evidence')}</h3>
    ${v.exhibits.length ? `<div class="ex-grid">${v.exhibits.map((x, i) => exhibitCard(v, x, i)).join('')}</div>` : `<p class="muted">${t('noExhibits')}</p>`}
    ${!app.party && me?.evidence?.length ? `<h4 class="sub">${icon.lock}${t('f_evidence')}</h4><div class="file-ev">${me.evidence.map((e) => `<div class="fev ${e.presented ? 'done' : ''}"><span class="ex-ic">${kindIcon(e.kind)}</span><div><strong>${esc(e.name)}</strong><p>${esc(e.desc)}</p></div>
      ${e.presented ? `<span class="chip ok">${t('presented')}</span>` : ['evidence', 'witness', 'cross'].includes(v.phase) ? `<button class="btn small" data-act="presentPick" data-ev="${esc(e.ev)}">${t('present')}</button>` : ''}</div>`).join('')}</div>` : ''}
    ${v.contradictions.length ? `<h4 class="sub">${icon.link}${t('contraFound')}</h4>${v.contradictions.map((c) => `<div class="contra"><strong>${esc(c.title)}</strong><p>${esc(c.text)}</p><small>${c.items.map((i) => esc(itemLabel(v, i))).join(' ⟷ ')} · ${esc(c.by)}</small></div>`).join('')}` : ''}
  </div>`;
}

function witnessTab(app, v) {
  const judgeCall = app.party || v.me?.role === 'judge';
  const canAsk = app.party || v.me?.team || v.me?.role === 'judge';
  return `<div class="tab-body"><h3>${icon.witness}${t('witnessesTitle')}</h3>
    ${v.witnesses.map((w) => witnessCard(v, w, { judgeCall, canAsk, askAs: app.party ? 'judge' : '' })).join('')}</div>`;
}

function recordTab(app, v) {
  const items = v.feed.slice().reverse().filter((f) => f.type !== 'VOTE_CAST');
  return `<div class="tab-body">
    ${v.reveals.length ? `<h3>${icon.eye}${t('revealsTitle')}</h3>${v.reveals.map((r) => `<div class="contra reveal"><strong>${esc(r.label)}</strong><p>${esc(r.text)}</p><small>${esc(charName(v, r.char))} · ${esc(r.name)}</small></div>`).join('')}` : ''}
    <h3>${icon.note}${t('record')}</h3>
    <ul class="feed">${items.map((f) => `<li class="f-${f.type}"><span class="f-type">${t(`f_${f.type}`)}</span><span>${feedText(f, v)}</span></li>`).join('')}</ul>
    <details class="case-public"><summary>${icon.folder}${L({ ar: 'ملف القضية العام', en: 'Public case file' })}</summary>
      <div class="dossier-line"><span class="label">${t('charge')}</span><p>${esc(v.case.charge)}</p></div>
      <p>${esc(v.case.incident.summary)}</p>
      <ol class="timeline">${v.case.timeline.map((x) => `<li><time>${esc(x.time)}</time><span>${esc(x.text)}</span></li>`).join('')}</ol>
      <ul class="people">${Object.values(v.case.characters).map((c) => `<li><strong>${esc(c.name)}</strong><small>${esc(c.title)}</small></li>`).join('')}</ul>
    </details>
  </div>`;
}

function filesTab(app, v) {
  if (!app.party) return `<div class="tab-body">${fileHtml(v.me, v, { notes: true, reveal: true, present: ['evidence', 'witness', 'cross'].includes(v.phase) })}</div>`;
  const msgs = app.partyUnread || {};
  return `<div class="tab-body"><h3>${icon.lock}${t('tab_files')}</h3><p class="muted small">${t('onlyThem')}</p>
    <ul class="files-list">${v.players.map((p) => `<li><span class="role-emblem small role-${p.role}">${roleIcon(p.role)}</span><div><strong>${esc(p.name)}</strong><small>${roleName(p.role)}${p.char ? ` · ${esc(charName(v, p.char))}` : ''}</small></div>
      ${msgs[p.id] ? `<span class="chip gold">${icon.mail}${t('newMsg')}</span>` : ''}
      <button class="btn small" data-act="gate" data-pid="${esc(p.id)}" data-purpose="file">${icon.eye}<span>${t('openFile')}</span></button></li>`).join('')}</ul></div>`;
}

function courtScreen(app, v) {
  const tabs = [['court', icon.gavel], ['evidence', icon.evidence], ['witness', icon.witness], ['record', icon.note], [app.party ? 'files' : 'file', icon.lock]];
  let tab = app.tab;
  if (!tabs.some(([k]) => k === tab)) tab = 'court';
  const side = tab === 'court' ? 'record' : tab;
  const body = { evidence: evidenceTab, witness: witnessTab, record: recordTab, file: filesTab, files: filesTab };
  const unread = !app.party && v.me?.messages?.length > (app.readMsgs || 0);
  return `${topBar(app, statusPill(app) + exitBtn())}
  <div class="court tab-${tab}">
    <header class="court-top">
      <div class="court-case"><span class="case-num">CASE ${esc(v.case.num)}</span><strong>${esc(L(v.case.title))}</strong>${!app.party && v.me?.role ? `<span class="chip role-${v.me.role}">${roleName(v.me.role)}</span>` : ''}</div>
      ${stepper(v)}
    </header>
    <nav class="tabs" role="tablist">${tabs.map(([k, ic]) => `<button role="tab" class="${tab === k ? 'on' : ''} ${k === 'record' && tab === 'court' ? 'desk-on' : ''} ${k === 'court' ? 'mobile-only' : ''} ${(k === 'file' && unread) ? 'dot-new' : ''}" data-act="tab" data-tab="${k}">${ic}<span>${t(`tab_${k}`)}</span></button>`).join('')}</nav>
    <div class="court-body">
      <div class="main-col">${stage(app, v)}${dock(app, v)}</div>
      <aside class="side">${body[side](app, v)}</aside>
    </div>
  </div>`;
}

// -------------------------------------------------------------- jury

export function voteForm(v, me, pid) {
  const bench = v.plan.bench;
  return `<form class="vote-form" data-vote="${esc(pid)}">
    <fieldset><legend>${t('yourVerdict')}</legend>
      ${v.case.verdicts.map((x) => `<label class="opt"><input type="radio" name="verdict" value="${esc(x.id)}" required><span>${esc(x.label)}</span></label>`).join('')}</fieldset>
    ${v.exhibits.length ? `<fieldset><legend>${t('decisive')}</legend><div class="ev-pick">${v.exhibits.map((x, i) => `<label class="opt small"><input type="checkbox" name="ev" value="${esc(x.ev)}"><span>${t('exhibitNo')} ${i + 1}: ${esc(x.name)}</span></label>`).join('')}</div></fieldset>` : ''}
    ${bench ? '' : `<fieldset><legend>${t('fairness')}</legend><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="fair" value="${n}" ${n === 4 ? 'checked' : ''}><span>${icon.star}<b>${n}</b></span></label>`).join('')}</div></fieldset>`}
    <button class="btn primary big full" type="submit">${icon.gavel}<span>${t('castVote')}</span></button>
  </form>`;
}

function juryScreen(app, v) {
  const done = new Set(v.votes.done);
  let main;
  if (app.party) {
    const voters = v.players.filter((p) => v.votes.voters.includes(p.id));
    const next = voters.find((p) => !done.has(p.id));
    main = `<ol class="handoff">${voters.map((p) => `<li class="${done.has(p.id) ? 'done' : p === next ? 'next' : ''}"><span class="seat">${done.has(p.id) ? icon.check : icon.lock}</span><span>${esc(p.name)}</span></li>`).join('')}</ol>
      ${next ? `<button class="btn primary big full" data-act="gate" data-pid="${esc(next.id)}" data-purpose="vote">${icon.eye}<span>${t('passTo')} ${esc(next.name)}</span></button>` : ''}`;
  } else if (v.me?.canVote && !v.me.vote) {
    main = `${v.plan.bench ? `<p class="lead">${t('benchVote')}</p>` : ''}${voteForm(v, v.me, v.me.id)}`;
  } else if (v.me?.vote) {
    main = `<p class="lead center">${icon.check} ${t('voted')}</p>`;
  } else {
    main = `<p class="lead center">${t('notVoter')}</p>`;
  }
  return `${topBar(app, statusPill(app) + exitBtn())}
  <section class="page narrow jury">
    <p class="eyebrow">JURY VOTING</p>
    <h2 class="title">${icon.jury}${t('juryRoom')}</h2>
    <p class="muted">${t('juryIntro')}</p>
    ${floorCard(v)}
    <div class="vote-count"><b>${v.votes.cast}</b> ${t('votesIn')} <b>${v.votes.of}</b></div>
    ${main}
    ${(app.party || app.isHost || v.me?.role === 'judge') && !v.can.ok ? `<button class="btn ghost small" data-act="force">${t('forceAdvance')}</button>` : ''}
  </section>`;
}

// -------------------------------------------------------------- verdict

function verdictScreen(app, v) {
  const vd = v.verdict;
  const opt = v.case.verdicts.find((x) => x.id === vd.id);
  const max = Math.max(1, ...Object.values(vd.tally));
  const canGo = app.party || app.isHost || v.me?.role === 'judge';
  return `${topBar(app, statusPill(app) + exitBtn())}
  <section class="verdict">
    <div class="verdict-gavel">${icon.gavel}</div>
    <p class="eyebrow">VERDICT · CASE ${esc(v.case.num)}</p>
    <p class="verdict-pre">${t('courtRules')}</p>
    <h1 class="verdict-word">${esc(opt.label)}</h1>
    <div class="tally">${v.case.verdicts.map((x) => `<div class="tally-row ${x.id === vd.id ? 'win' : ''}"><span>${esc(x.label)}</span><div class="bar"><i style="width:${(vd.tally[x.id] / max) * 100}%"></i></div><b>${vd.tally[x.id]}</b></div>`).join('')}</div>
    ${vd.tie ? `<p class="muted small">${t('tieNote')}</p>` : ''}
    ${canGo ? `<button class="btn primary big" ${A({ type: 'advance' }, 'judge')}>${icon.eye}<span>${t('toTruth')}</span></button>` : `<p class="muted">${t('waitingHost')}</p>`}
  </section>`;
}

// -------------------------------------------------------------- truth

function scoreLine(l, v) {
  const k = l.label.k;
  const base = t(`s_${k}`);
  const extra = l.label.ev || l.label.title || l.label.text || (l.label.avg ? `${l.label.avg}/5` : l.label.n ? `×${l.label.n}` : '');
  return `<li><span>${base}${extra ? `: ${esc(extra)}` : ''}</span><b class="${l.pts < 0 ? 'neg' : ''}">${l.pts > 0 ? '+' : ''}${l.pts}</b></li>`;
}

function truthScreen(app, v) {
  const T = v.truth, vd = v.verdict;
  const opt = (id) => v.case.verdicts.find((x) => x.id === id)?.label || id;
  const culprit = T.culprit ? v.case.characters[T.culprit] : null;
  const scores = v.scores ? v.players.map((p) => ({ p, s: v.scores[p.id] })).sort((a, b) => b.s.total - a.s.total) : null;
  const canAgain = app.party || app.isHost;
  return `${topBar(app, statusPill(app))}
  <section class="truth">
    <p class="eyebrow">TRUTH REVEAL · CASE ${esc(v.case.num)}</p>
    <h1 class="truth-head">${esc(T.headline)}</h1>
    <div class="acc acc-${vd.accuracy}">
      <div><span class="label">${t('verdictT')}</span><strong>${esc(opt(vd.id))}</strong></div>
      <div><span class="label">${t('correctVerdict')}</span><strong>${esc(opt(T.verdict))}</strong></div>
      <div><span class="label">${t('culprit')}</span><strong>${culprit ? esc(culprit.name) : t('noCulprit')}</strong>${culprit ? `<small>${esc(culprit.title)}</small>` : ''}</div>
      <p class="acc-word">${t(`acc_${vd.accuracy}`)}</p>
    </div>
    <div class="truth-grid">
      <div class="card story"><h3>${t('truthT')}</h3>${T.story.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      <div class="card"><h3>${t('realTimeline')}</h3><ol class="timeline">${T.timeline.map((x) => `<li><time>${esc(x.time)}</time><span>${esc(x.text)}</span></li>`).join('')}</ol></div>
      <div class="card"><h3>${t('keyEvidence')}</h3><ul class="checks">${T.keyEvidence.map((e) => `<li class="${e.presented ? 'yes' : 'no'}">${e.presented ? icon.check : icon.x}<span>${esc(e.name)}</span><small>${e.presented ? t('presented') : t('notPresented')}</small></li>`).join('')}</ul></div>
      <div class="card"><h3>${t('contradictionsAll')}</h3>${T.contradictions.map((c) => `<div class="contra ${c.found ? 'yes' : 'no'}"><strong>${c.found ? icon.check : icon.x}${esc(c.title)}</strong><p>${esc(c.text)}</p><small>${c.found ? t('found') : t('missed')}</small></div>`).join('')}</div>
      <div class="card"><h3>${t('redHerrings')}</h3>${T.redHerrings.map((r) => `<div class="contra"><strong>${esc(r.item)}</strong><p>${esc(r.text)}</p></div>`).join('')}</div>
      <div class="card"><h3>${t('secretsT')}</h3><ul class="people">${T.secrets.map((s) => `<li><strong>${esc(charName(v, s.char))}</strong><p>${esc(s.text)}</p></li>`).join('')}</ul></div>
      ${T.votes.length ? `<div class="card"><h3>${t('howVoted')}</h3><ul class="people">${T.votes.map((x) => `<li><strong>${esc(x.name)}</strong><small>${esc(opt(x.verdict))}</small>${x.evidence.length ? `<p>${x.evidence.map(esc).join('، ')}</p>` : ''}</li>`).join('')}</ul></div>` : ''}
      ${T.unseen.length ? `<div class="card"><h3>${t('unseenEv')}</h3><ul class="people">${T.unseen.map((e) => `<li><strong>${esc(e.name)}</strong><p>${esc(e.desc)}</p></li>`).join('')}</ul></div>` : ''}
    </div>
    ${scores ? `<div class="card scores"><h3>${icon.star}${t('scoresT')}</h3><ol>${scores.map(({ p, s }, i) => `<li class="${i === 0 ? 'top' : ''}">
      <div class="sc-head"><span class="rank">${i + 1}</span><strong>${esc(p.name)}</strong><span class="chip role-${p.role}">${roleName(p.role)}</span><b class="total">${s.total} ${t('pts')}</b></div>
      ${s.lines.length ? `<ul>${s.lines.map((l) => scoreLine(l, v)).join('')}</ul>` : ''}</li>`).join('')}</ol></div>` : ''}
    <div class="card lesson"><h3>${t('lessonT')}</h3><p>${esc(T.lesson)}</p></div>
    <div class="row center">
      ${canAgain ? `<button class="btn primary big" data-act="playAgain">${icon.folder}<span>${app.party ? t('playAgain') : t('newRound')}</span></button>` : ''}
      <button class="btn big" data-act="home">${t('backHome')}</button>
    </div>
  </section>`;
}

// -------------------------------------------------------------- entry

export function gameScreen(app, v) {
  switch (v.phase) {
    case 'intro': return introScreen(app, v);
    case 'roles': return rolesScreen(app, v);
    case 'voting': return juryScreen(app, v);
    case 'verdict': return verdictScreen(app, v);
    case 'truth': return truthScreen(app, v);
    default: return courtScreen(app, v);
  }
}

// party privacy gate
export function gateScreen(app, v, pv) {
  const g = app.gate;
  const p = v.players.find((x) => x.id === g.pid);
  if (g.step === 'pass') {
    return `<section class="gate">
      <div class="gate-lock">${icon.lock}</div>
      <p class="eyebrow">${t('passTo')}</p>
      <h1 class="gate-name">${esc(p.name)}</h1>
      <p class="muted">${t('onlyThem')}</p>
      <button class="btn primary big" data-act="gateOpen">${icon.eye}<span>${t('iAm')} ${esc(p.name)} — ${t('showMine')}</span></button>
      <button class="link-btn" data-act="gateCancel">${t('cancel')}</button>
    </section>`;
  }
  let body = '';
  const me = pv.me;
  if (g.purpose === 'role') body = fileHtml(me, pv, {});
  else if (g.purpose === 'file') body = fileHtml(me, pv, { notes: true, reveal: true, present: ['evidence', 'witness', 'cross'].includes(v.phase) && !!me.team });
  else if (g.purpose === 'present') body = fileHtml({ ...me, file: {}, reveals: [], objectives: [], messages: [], statement: null, witnessGuide: null }, pv, { present: true });
  else if (g.purpose === 'vote') body = `<h2 class="title">${icon.jury}${t('juryRoom')}</h2>${pv.plan.bench ? `<p class="lead">${t('benchVote')}</p>` : ''}${voteForm(pv, me, me.id)}`;
  const doneLabel = g.purpose === 'role' ? t('hideDone') : t('hideDone');
  return `<section class="gate open">
    <div class="gate-bar"><span>${icon.lock}${esc(p.name)}</span><button class="btn small" data-act="gateDone">${icon.eye}<span>${doneLabel}</span></button></div>
    <div class="gate-body">${body}</div>
    ${g.purpose !== 'vote' ? `<button class="btn primary big full" data-act="gateDone">${icon.check}<span>${doneLabel}</span></button>` : ''}
  </section>`;
}
