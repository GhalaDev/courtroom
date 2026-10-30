// THE COURTROOM game engine.
// Pure state machine shared by Party Mode (runs in the browser) and the
// online server (authoritative). State is plain JSON so it can be saved.
//
//   createGame({ caseId, players, settings })  -> state
//   act(state, actor, action, now)             -> { ok } | { ok:false, err, missing? }
//   viewFor(state, playerId | null, now)       -> what that player may see
//
// Secret material (role files, private evidence, truth) is only ever copied
// into a view for the player allowed to see it.

import { PHASES, ROLE_INFO, OBJECTION_REASONS, DEFAULT_SETTINGS, LIMITS, planRoles } from './constants.js';
import { getCase } from './cases/index.js';

const TEAM_OF = { prosecutor: 'prosecution', aideP: 'prosecution', defense: 'defense', aideD: 'defense' };
const LEAD_OF = { prosecution: 'prosecutor', defense: 'defense' };
const OTHER = { prosecution: 'defense', defense: 'prosecution' };
const ACTIVE_PHASES = ['opening', 'evidence', 'witness', 'cross', 'closing'];

function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const uid = (s) => `${s.seq = (s.seq || 0) + 1}`;
const str = (v, max) => String(v ?? '').trim().slice(0, max);

export function regularWitnesses(c) {
  return c.witnesses.filter((w) => !w.surprise && !w.optional);
}

// ---------------------------------------------------------------- create

export function createGame({ caseId, players, settings = {}, rng = Math.random, now = Date.now() }) {
  const c = getCase(caseId);
  if (!c) throw new Error('unknown case');
  const n = players.length;
  if (n < LIMITS.minPlayers || n > LIMITS.maxPlayers) throw new Error('player count');
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const plan = planRoles(n, regularWitnesses(c).length, s);

  const roles = ['judge', 'prosecutor', 'defense', 'defendant'];
  for (let i = 0; i < plan.witnesses; i++) roles.push('witness');
  if (plan.aides) roles.push('aideP', 'aideD');
  for (let i = 0; i < plan.jurors; i++) roles.push('juror');

  const order = shuffle(players, rng);
  const humanWitnessChars = shuffle(regularWitnesses(c).map((w) => w.char), rng).slice(0, plan.witnesses);
  let wi = 0;
  const ps = order.map((p, i) => {
    const role = roles[i];
    const out = { id: p.id, name: str(p.name, 24), role };
    if (role === 'defendant') out.char = c.defendant;
    if (role === 'witness') out.char = humanWitnessChars[wi++];
    return out;
  });
  // keep the original seating order for display
  ps.sort((a, b) => players.findIndex((p) => p.id === a.id) - players.findIndex((p) => p.id === b.id));

  const state = {
    v: 1, caseId, settings: s, plan, players: ps,
    phase: 'intro', startedAt: now, phaseAt: now, seq: 0,
    acks: {}, forced: 0,
    floor: null, floorLog: { prosecution: 0, defense: 0 },
    objection: null, objections: [],
    statements: { opening: {}, closing: {}, final: {} }, finalChance: false,
    exhibits: [], stand: null, called: [], examined: {}, asked: {},
    surprise: [], firedEvents: [], messages: {},
    contradictions: [], attempts: {}, reveals: [],
    notes: {}, votes: {}, verdict: null, scores: null,
    feed: [],
  };
  pushFeed(state, now, { type: 'PHASE', phase: 'intro' });
  return state;
}

// ---------------------------------------------------------------- helpers

function pushFeed(state, now, entry) {
  state.feed.push({ id: uid(state), at: now, ...entry });
  if (state.feed.length > 300) state.feed.splice(0, state.feed.length - 300);
}
const playerOf = (state, pid) => state.players.find((p) => p.id === pid);
const byRole = (state, role) => state.players.filter((p) => p.role === role);
const teamOf = (p) => (p ? TEAM_OF[p.role] : null);

function standList(state, c) {
  const list = c.witnesses.filter((w) => !w.surprise || state.surprise.includes(w.char));
  return list.map((w) => {
    const human = state.players.find((p) => p.char === w.char && (p.role === 'witness' || p.role === 'defendant'));
    return { ...w, human: human ? human.id : null };
  });
}

function teamEvidence(c, team) {
  return (c.files[LEAD_OF[team]].evidence || []);
}
const isPublicEv = (state, ev) => state.exhibits.some((x) => x.ev === ev);

export function publicItems(state, c) {
  const items = [];
  for (const x of state.exhibits) items.push({ id: `ev:${x.ev}`, kind: 'ev', ref: x.ev, label: c.evidence[x.ev].name });
  const def = c.characters[c.defendant];
  if (PHASES.indexOf(state.phase) >= PHASES.indexOf('opening')) {
    items.push({ id: `st:${c.defendant}`, kind: 'st', ref: c.defendant, label: def.name });
  }
  for (const ch of state.called) {
    if (ch === c.defendant) continue;
    items.push({ id: `st:${ch}`, kind: 'st', ref: ch, label: c.characters[ch].name });
  }
  for (const r of state.reveals) items.push({ id: `rv:${r.id}`, kind: 'rv', ref: r.id, label: r.label });
  return items;
}

function allReveals(c) {
  const out = {};
  for (const r of c.files.defendant.reveals || []) out[r.id] = { ...r, owner: { role: 'defendant', char: c.defendant } };
  for (const [ch, f] of Object.entries(c.files.witness || {})) {
    for (const r of f.reveals || []) out[r.id] = { ...r, owner: { role: 'witness', char: ch } };
  }
  return out;
}

function ownsReveal(state, c, pid, rid) {
  const r = allReveals(c)[rid];
  if (!r) return false;
  const p = playerOf(state, pid);
  return !!p && p.char === r.owner.char;
}

function voters(state) {
  if (state.plan.bench) return byRole(state, 'judge');
  return byRole(state, 'juror');
}

function pauseFloor(state, now) {
  const f = state.floor;
  if (f && !f.paused) { f.remaining = Math.max(0, f.endsAt - now); f.paused = true; f.pausedAt = now; return true; }
  return false;
}
function resumeFloor(state, now) {
  const f = state.floor;
  if (f && f.paused) { f.endsAt = now + f.remaining; f.pausedFor = (f.pausedFor || 0) + (now - f.pausedAt); f.paused = false; f.remaining = null; }
}
function closeFloor(state, now) {
  const f = state.floor;
  if (!f) return;
  const sp = playerOf(state, f.speaker);
  const team = teamOf(sp);
  if (team) {
    const used = f.paused ? f.total * 1000 - f.remaining : Math.min(f.total * 1000, now - f.startedAt - (f.pausedFor || 0));
    state.floorLog[team] += Math.max(0, used);
  }
  state.floor = null;
}

// ---------------------------------------------------------------- phases

export function canAdvance(state, c = getCase(state.caseId)) {
  const missing = [];
  const ph = state.phase;
  if (ph === 'roles') {
    for (const p of state.players) if (!state.acks.roles?.[p.id]) missing.push({ k: 'ackRole', name: p.name });
  } else if (ph === 'opening' || ph === 'closing') {
    for (const side of ['prosecution', 'defense']) if (!state.statements[ph][side]) missing.push({ k: 'statement', side });
  } else if (ph === 'evidence') {
    const left = c.courtEvidence.filter((e) => !isPublicEv(state, e)).length;
    if (left) missing.push({ k: 'courtEvidence', n: left });
    for (const side of ['prosecution', 'defense']) {
      if (teamEvidence(c, side).length && !state.exhibits.some((x) => x.side === side)) missing.push({ k: 'present', side });
    }
  } else if (ph === 'witness' || ph === 'cross') {
    const mode = ph === 'witness' ? 'direct' : 'cross';
    if (state.stand) missing.push({ k: 'standBusy' });
    for (const w of regularWitnesses(c)) {
      if (!state.examined[w.char]?.[mode]) missing.push({ k: 'examine', char: w.char, name: c.characters[w.char].name });
    }
  } else if (ph === 'voting') {
    for (const p of voters(state)) if (!state.votes[p.id]) missing.push({ k: 'vote', name: p.name });
  } else if (ph === 'truth') {
    missing.push({ k: 'end' });
  }
  if (state.objection) missing.push({ k: 'objection' });
  return { ok: missing.length === 0, missing };
}

function fireEvents(state, c, now, trigger) {
  for (const ev of c.events || []) {
    if (state.firedEvents.includes(ev.id)) continue;
    const t = ev.trigger || {};
    const hit = (trigger.phase && t.phase === trigger.phase && !t.after)
      || (trigger.after && t.after === trigger.after && (!t.phase || t.phase === state.phase));
    if (!hit) continue;
    state.firedEvents.push(ev.id);
    if (ev.type === 'NEW_EVIDENCE') {
      state.exhibits.push({ ev: ev.evidence, side: 'court', by: null, note: '', at: now, event: true });
      pushFeed(state, now, { type: 'NEW_EVIDENCE', title: ev.title, text: ev.text, ev: ev.evidence });
    } else if (ev.type === 'SURPRISE_WITNESS') {
      state.surprise.push(ev.witness);
      pushFeed(state, now, { type: 'SURPRISE_WITNESS', title: ev.title, text: ev.text, char: ev.witness });
    } else if (ev.type === 'SECRET_MESSAGE') {
      const targets = state.players.filter((p) => matchTarget(p, ev.to));
      for (const p of targets) (state.messages[p.id] ||= []).push({ id: ev.id, at: now, title: ev.title, text: ev.text });
      const toRoles = [...new Set(targets.map((p) => p.role))];
      if (targets.length) pushFeed(state, now, { type: 'SECRET_MESSAGE', toRoles, toNames: targets.map((p) => p.name) });
    }
  }
}
function matchTarget(p, to) {
  if (!to) return false;
  if (to === 'prosecution') return TEAM_OF[p.role] === 'prosecution';
  if (to === 'defense') return TEAM_OF[p.role] === 'defense';
  if (to.startsWith('char:')) return p.char === to.slice(5);
  return p.role === to;
}

function goPhase(state, c, phase, now) {
  if (state.floor) closeFloor(state, now);
  state.stand = null;
  state.objection = null;
  state.phase = phase;
  state.phaseAt = now;
  pushFeed(state, now, { type: 'PHASE', phase });
  if (phase === 'voting') {
    state.floor = { speaker: null, label: 'deliberation', total: state.settings.deliberation, startedAt: now, endsAt: now + state.settings.deliberation * 1000, paused: false, remaining: null };
  }
  if (phase === 'verdict') computeVerdict(state, c, now);
  if (phase === 'truth') state.scores = computeScores(state, c);
  fireEvents(state, c, now, { phase });
}

// ---------------------------------------------------------------- actions

export function act(state, actor, a, now = Date.now()) {
  const c = getCase(state.caseId);
  const pid = actor?.pid;
  const me = playerOf(state, pid);
  const host = !!actor?.host;
  const isJudge = me?.role === 'judge';
  const ph = state.phase;
  const fail = (err, extra) => ({ ok: false, err, ...extra });
  const myTeam = teamOf(me);

  switch (a?.type) {
    case 'advance': {
      if (!isJudge && !host) return fail('notAllowed');
      if (ph === 'truth') return fail('end');
      const chk = canAdvance(state, c);
      if (!chk.ok && !a.force) return fail('conditions', { missing: chk.missing });
      if (!chk.ok) state.forced++;
      if (state.objection) { state.objection.status = 'void'; state.objections.push(state.objection); state.objection = null; }
      goPhase(state, c, PHASES[PHASES.indexOf(ph) + 1], now);
      return { ok: true };
    }
    case 'ack': {
      if (!me) return fail('notAllowed');
      (state.acks[ph] ||= {})[pid] = true;
      return { ok: true };
    }
    case 'floor': {
      if (!isJudge) return fail('notAllowed');
      if (!ACTIVE_PHASES.includes(ph)) return fail('phase');
      if (state.objection) return fail('objectionPending');
      const sp = a.speaker ? playerOf(state, a.speaker) : null;
      if (a.speaker && !sp) return fail('badInput');
      if (state.floor) closeFloor(state, now);
      const secs = clamp(Math.round(+a.seconds || 60), 10, 1200);
      state.floor = { speaker: sp?.id ?? null, label: str(a.label, 40) || ph, total: secs, startedAt: now, endsAt: now + secs * 1000, paused: false, remaining: null, pausedFor: 0 };
      pushFeed(state, now, { type: 'FLOOR', speaker: sp?.id ?? null, name: sp?.name, role: sp?.role, seconds: secs });
      return { ok: true };
    }
    case 'floorPause': {
      if (!isJudge || !state.floor || state.objection) return fail('notAllowed');
      pauseFloor(state, now); state.floor.manual = true;
      return { ok: true };
    }
    case 'floorResume': {
      if (!isJudge || !state.floor || state.objection) return fail('notAllowed');
      resumeFloor(state, now); state.floor && (state.floor.manual = false);
      return { ok: true };
    }
    case 'floorEnd': {
      if (!isJudge || !state.floor) return fail('notAllowed');
      closeFloor(state, now);
      return { ok: true };
    }
    case 'statement': {
      const kind = a.kind;
      if (!['opening', 'closing', 'final'].includes(kind)) return fail('badInput');
      const needPhase = kind === 'final' ? 'closing' : kind;
      if (ph !== needPhase) return fail('phase');
      if (kind === 'final' && !state.finalChance) return fail('phase');
      let side = null;
      if (me && (me.role === 'prosecutor' || me.role === 'defense')) side = myTeam;
      else if (isJudge && (a.side === 'prosecution' || a.side === 'defense')) side = a.side;
      if (!side) return fail('notAllowed');
      if (state.statements[kind][side]) return fail('already');
      state.statements[kind][side] = { at: now, text: str(a.text, 700), by: pid };
      pushFeed(state, now, { type: 'STATEMENT', kind, side, text: str(a.text, 700) });
      return { ok: true };
    }
    case 'release': {
      if (!isJudge) return fail('notAllowed');
      if (!['evidence', 'witness', 'cross'].includes(ph)) return fail('phase');
      const next = c.courtEvidence.find((e) => !isPublicEv(state, e));
      if (!next) return fail('none');
      state.exhibits.push({ ev: next, side: 'court', by: pid, note: '', at: now });
      pushFeed(state, now, { type: 'EXHIBIT', ev: next, side: 'court' });
      return { ok: true };
    }
    case 'present': {
      if (!myTeam) return fail('notAllowed');
      if (!['evidence', 'witness', 'cross'].includes(ph)) return fail('phase');
      if (!teamEvidence(c, myTeam).includes(a.ev)) return fail('notAllowed');
      if (isPublicEv(state, a.ev)) return fail('already');
      state.exhibits.push({ ev: a.ev, side: myTeam, by: pid, note: str(a.note, 300), at: now });
      pushFeed(state, now, { type: 'EXHIBIT', ev: a.ev, side: myTeam, by: me.name, note: str(a.note, 300) });
      return { ok: true };
    }
    case 'call': {
      if (!isJudge) return fail('notAllowed');
      if (ph !== 'witness' && ph !== 'cross') return fail('phase');
      if (state.stand) return fail('standBusy');
      const w = standList(state, c).find((x) => x.char === a.char);
      if (!w) return fail('badInput');
      const mode = ph === 'witness' ? 'direct' : 'cross';
      state.stand = { char: w.char, mode, since: now };
      if (!state.called.includes(w.char)) state.called.push(w.char);
      pushFeed(state, now, { type: 'CALL', char: w.char, name: c.characters[w.char].name, mode, side: w.side });
      return { ok: true };
    }
    case 'ask': {
      if (!myTeam && !isJudge) return fail('notAllowed');
      if (!state.stand) return fail('phase');
      const w = standList(state, c).find((x) => x.char === state.stand.char);
      if (!w || w.human) return fail('notAllowed');
      const qi = +a.q;
      if (!w.qa?.[qi]) return fail('badInput');
      if (w.qa[qi].requires && !publicItems(state, c).some((x) => x.id === w.qa[qi].requires)) return fail('locked');
      const done = (state.asked[w.char] ||= []);
      if (done.includes(qi)) return fail('already');
      done.push(qi);
      pushFeed(state, now, { type: 'ANSWER', char: w.char, name: c.characters[w.char].name, q: w.qa[qi].q, a: w.qa[qi].a, by: me?.name });
      return { ok: true };
    }
    case 'dismiss': {
      if (!isJudge || !state.stand) return fail('notAllowed');
      if (state.objection) return fail('objectionPending');
      const { char, mode } = state.stand;
      (state.examined[char] ||= {})[mode] = true;
      state.stand = null;
      if (state.floor) closeFloor(state, now);
      pushFeed(state, now, { type: 'DISMISS', char, name: c.characters[char].name, mode });
      fireEvents(state, c, now, { after: char });
      return { ok: true };
    }
    case 'object': {
      if (!myTeam) return fail('notAllowed');
      if (!ACTIVE_PHASES.includes(ph)) return fail('phase');
      if (state.objection) return fail('objectionPending');
      if (!OBJECTION_REASONS.some((r) => r.id === a.reason)) return fail('badInput');
      const paused = pauseFloor(state, now);
      state.objection = { id: uid(state), by: pid, name: me.name, side: myTeam, reason: a.reason, status: 'pending', at: now, paused, phase: ph };
      pushFeed(state, now, { type: 'OBJECTION', by: me.name, side: myTeam, reason: a.reason });
      return { ok: true };
    }
    case 'rule': {
      if (!isJudge || !state.objection) return fail('notAllowed');
      if (a.decision !== 'accept' && a.decision !== 'overrule') return fail('badInput');
      const o = state.objection;
      o.status = a.decision === 'accept' ? 'accepted' : 'overruled';
      o.ruledAt = now;
      state.objections.push(o);
      state.objection = null;
      if (o.paused && state.floor && !state.floor.manual) resumeFloor(state, now);
      pushFeed(state, now, { type: 'RULING', decision: o.status, side: o.side, by: o.name, reason: o.reason });
      return { ok: true };
    }
    case 'notice': {
      if (!isJudge) return fail('notAllowed');
      if (!['rephrase', 'order', 'recess', 'strike'].includes(a.kind)) return fail('badInput');
      pushFeed(state, now, { type: 'NOTICE', kind: a.kind });
      return { ok: true };
    }
    case 'finalChance': {
      if (!isJudge || ph !== 'closing' || state.finalChance) return fail('notAllowed');
      state.finalChance = true;
      pushFeed(state, now, { type: 'FINAL_CHANCE', seconds: state.settings.final });
      return { ok: true };
    }
    case 'contradiction': {
      if (!myTeam) return fail('notAllowed');
      if (!['evidence', 'witness', 'cross', 'closing'].includes(ph)) return fail('phase');
      const used = state.attempts[pid] || 0;
      if (used >= state.settings.attempts) return fail('noAttempts');
      const ids = publicItems(state, c).map((x) => x.id);
      if (!ids.includes(a.a) || !ids.includes(a.b) || a.a === a.b) return fail('badInput');
      const match = c.contradictions.find((k) => k.items.includes(a.a) && k.items.includes(a.b));
      if (match && state.contradictions.some((x) => x.id === match.id)) return fail('already');
      if (match) {
        state.contradictions.push({ id: match.id, by: pid, name: me.name, side: myTeam, at: now });
        pushFeed(state, now, { type: 'CONTRADICTION', id: match.id, title: match.title, text: match.text, by: me.name, side: myTeam, items: match.items });
      } else {
        state.attempts[pid] = used + 1;
        pushFeed(state, now, { type: 'CLAIM_REJECTED', by: me.name, side: myTeam, items: [a.a, a.b], left: state.settings.attempts - used - 1 });
      }
      return { ok: true, found: !!match };
    }
    case 'reveal': {
      if (!me || !ownsReveal(state, c, pid, a.id)) return fail('notAllowed');
      if (!ACTIVE_PHASES.includes(ph)) return fail('phase');
      if (state.reveals.some((r) => r.id === a.id)) return fail('already');
      const r = allReveals(c)[a.id];
      state.reveals.push({ id: a.id, by: pid, name: me.name, char: me.char, label: r.label, text: r.text, at: now });
      pushFeed(state, now, { type: 'REVEAL', id: a.id, by: me.name, char: me.char, label: r.label, text: r.text });
      return { ok: true };
    }
    case 'note': {
      if (!me) return fail('notAllowed');
      state.notes[pid] = str(a.text, 4000);
      return { ok: true, silent: true };
    }
    case 'vote': {
      if (ph !== 'voting') return fail('phase');
      if (!voters(state).some((p) => p.id === pid)) return fail('notAllowed');
      if (state.votes[pid]) return fail('already');
      if (!c.verdicts.some((v) => v.id === a.verdict)) return fail('badInput');
      const pub = state.exhibits.map((x) => x.ev);
      const evs = [...new Set((a.evidence || []).filter((e) => pub.includes(e)))].slice(0, 2);
      const fairness = state.plan.bench ? null : clamp(Math.round(+a.fairness || 3), 1, 5);
      state.votes[pid] = { verdict: a.verdict, evidence: evs, fairness, at: now };
      pushFeed(state, now, { type: 'VOTE_CAST', n: Object.keys(state.votes).length, of: voters(state).length });
      if (voters(state).every((p) => state.votes[p.id])) goPhase(state, c, 'verdict', now);
      return { ok: true };
    }
    default:
      return fail('badInput');
  }
}

// ---------------------------------------------------------------- verdict & scoring

function computeVerdict(state, c, now) {
  const tally = Object.fromEntries(c.verdicts.map((v) => [v.id, 0]));
  for (const v of Object.values(state.votes)) tally[v.verdict]++;
  const max = Math.max(...Object.values(tally));
  const top = c.verdicts.filter((v) => tally[v.id] === max);
  // tie or no votes: the most lenient leading option wins (benefit of the doubt)
  const pick = top.sort((a, b) => (b.lenient || 0) - (a.lenient || 0))[0];
  const votesCast = Object.keys(state.votes).length;
  const accuracy = pick.id === c.truth.verdict ? 'exact' : (c.truth.close || []).includes(pick.id) ? 'close' : 'wrong';
  state.verdict = { id: pick.id, tally, tie: top.length > 1, votesCast, accuracy, at: now };
}

function evalObjective(state, c, o, p) {
  switch (o.type) {
    case 'verdictIn': return state.verdict && o.values.includes(state.verdict.id);
    case 'truthVerdict': return state.verdict && state.verdict.id === c.truth.verdict;
    case 'revealed': return state.reveals.some((r) => r.id === o.id);
    case 'notRevealed': return !state.reveals.some((r) => r.id === o.id);
    case 'contraFound': return state.contradictions.some((x) => x.id === o.id);
    case 'contraNotFound': return !state.contradictions.some((x) => x.id === o.id);
    case 'revealedIf': return state.reveals.some((r) => r.id === o.id) && state.contradictions.some((x) => x.id === o.contra);
    case 'examined': return !!(p?.char && state.examined[p.char] && (state.examined[p.char].direct || state.examined[p.char].cross));
    case 'presented': return isPublicEv(state, o.ev);
    default: return false;
  }
}

export function objectivesFor(c, p) {
  if (!p) return [];
  if (p.role === 'defendant') return c.files.defendant.objectives || [];
  if (p.role === 'witness') return c.files.witness[p.char]?.objectives || [];
  return [];
}

export function computeScores(state, c) {
  const key = new Set(c.truth.keyEvidence);
  const truthSide = c.truth.favors; // 'prosecution' | 'defense'
  const v = state.verdict;
  const out = {};
  for (const p of state.players) {
    const lines = [];
    const add = (pts, label) => lines.push({ pts, label });
    const team = teamOf(p);
    if (team) {
      for (const x of state.exhibits.filter((e) => e.by === p.id)) {
        if (key.has(x.ev)) add(2, { k: 'keyEvidence', ev: c.evidence[x.ev].name });
      }
      for (const x of state.contradictions.filter((e) => e.by === p.id)) {
        add(3, { k: 'contradiction', title: c.contradictions.find((k) => k.id === x.id).title });
      }
      const acc = state.objections.filter((o) => o.by === p.id && o.status === 'accepted').length;
      if (acc) add(Math.min(acc, 3), { k: 'objections', n: acc });
      if (v && team === truthSide && v.accuracy !== 'wrong') add(v.accuracy === 'exact' ? 4 : 2, { k: 'truthSide' });
    }
    if (p.role === 'juror' || (p.role === 'judge' && state.plan.bench)) {
      const mv = state.votes[p.id];
      if (mv) {
        if (mv.verdict === c.truth.verdict) add(3, { k: 'juryExact' });
        else if ((c.truth.close || []).includes(mv.verdict)) add(1, { k: 'juryClose' });
        const hits = mv.evidence.filter((e) => key.has(e)).length;
        if (hits) add(hits, { k: 'juryEvidence', n: hits });
      }
    }
    if (p.role === 'judge') {
      const fs = Object.values(state.votes).map((x) => x.fairness).filter(Boolean);
      if (fs.length) {
        const avg = fs.reduce((s, x) => s + x, 0) / fs.length;
        add(Math.round(avg) - 1, { k: 'fairness', avg: Math.round(avg * 10) / 10 });
      }
      const { prosecution: tp, defense: td } = state.floorLog;
      if (tp + td > 0 && Math.abs(tp - td) / Math.max(tp, td) <= 0.35) add(2, { k: 'balance' });
      const ruled = state.objections.filter((o) => o.status === 'accepted' || o.status === 'overruled').length;
      if (ruled) add(1, { k: 'ruled' });
      if (state.forced) add(-Math.min(state.forced, 2), { k: 'forced', n: state.forced });
    }
    if (p.role === 'defendant' || p.role === 'witness') {
      for (const o of objectivesFor(c, p)) if (evalObjective(state, c, o, p)) add(o.pts, { k: 'objective', text: o.label });
      if (p.role === 'witness' && evalObjective(state, c, { type: 'examined' }, p)) add(1, { k: 'testified' });
    }
    out[p.id] = { total: lines.reduce((s, l) => s + l.pts, 0), lines };
  }
  return out;
}

// ---------------------------------------------------------------- views

function exhibitView(c, x, state) {
  const e = c.evidence[x.ev];
  const by = x.by ? playerOf(state, x.by) : null;
  return { ev: x.ev, side: x.side, by: by?.name ?? null, note: x.note, at: x.at, event: !!x.event, name: e.name, kind: e.kind, desc: e.desc, detail: e.detail };
}

export function caseSummary(c) {
  return {
    id: c.id, num: c.num, title: c.title, tagline: c.tagline, genre: c.genre,
    difficulty: c.difficulty, duration: c.duration, art: c.art, charge: c.charge,
  };
}

export function viewFor(state, pid, now = Date.now()) {
  const c = getCase(state.caseId);
  const me = pid ? playerOf(state, pid) : null;
  const idx = PHASES.indexOf(state.phase);
  const rolesOut = idx >= PHASES.indexOf('roles');
  const stand = standList(state, c);
  const itemIds = publicItems(state, c).map((x) => x.id);
  const view = {
    now, phase: state.phase, phaseAt: state.phaseAt, settings: state.settings, plan: state.plan,
    case: {
      ...caseSummary(c),
      intro: c.intro, incident: c.incident, timeline: c.timeline, verdicts: c.verdicts,
      characters: Object.fromEntries(Object.entries(c.characters).map(([k, v]) => [k, { name: v.name, title: v.title, bio: v.bio, kind: v.kind }])),
      defendant: c.defendant,
    },
    players: state.players.map((p) => ({ id: p.id, name: p.name, role: rolesOut ? p.role : null, char: rolesOut ? p.char ?? null : null })),
    acks: Object.fromEntries(Object.entries(state.acks).map(([k, v]) => [k, Object.keys(v)])),
    can: canAdvance(state, c),
    floor: state.floor, objection: state.objection,
    objections: state.objections.map((o) => ({ name: o.name, side: o.side, reason: o.reason, status: o.status })),
    statements: state.statements, finalChance: state.finalChance,
    exhibits: state.exhibits.map((x) => exhibitView(c, x, state)),
    courtLeft: c.courtEvidence.filter((e) => !isPublicEv(state, e)).length,
    stand: state.stand,
    witnesses: stand.map((w) => ({
      char: w.char, side: w.side, surprise: !!w.surprise, optional: !!w.optional,
      human: w.human, humanName: w.human ? playerOf(state, w.human).name : null,
      statement: (state.called.includes(w.char) || (w.char === c.defendant && idx >= PHASES.indexOf('opening'))) ? w.statement : null,
      questions: !w.human && state.stand?.char === w.char ? w.qa.map((q, i) => ({ i, q: q.q, asked: (state.asked[w.char] || []).includes(i), locked: !!q.requires && !itemIds.includes(q.requires) })) : null,
      answers: (state.asked[w.char] || []).map((i) => w.qa[i]),
      examined: state.examined[w.char] || {},
    })),
    items: publicItems(state, c),
    contradictions: state.contradictions.map((x) => {
      const k = c.contradictions.find((y) => y.id === x.id);
      return { id: x.id, title: k.title, text: k.text, items: k.items, by: x.name, side: x.side };
    }),
    reveals: state.reveals.map((r) => ({ id: r.id, name: r.name, char: r.char, label: r.label, text: r.text })),
    feed: state.feed,
    votes: { cast: Object.keys(state.votes).length, of: voters(state).length, voters: voters(state).map((p) => p.id), done: Object.keys(state.votes) },
    verdict: idx >= PHASES.indexOf('verdict') ? state.verdict : null,
    me: null, truth: null, scores: null,
  };

  if (state.phase === 'truth') {
    view.truth = {
      ...c.truth,
      keyEvidence: c.truth.keyEvidence.map((e) => ({ ev: e, name: c.evidence[e].name, presented: isPublicEv(state, e) })),
      contradictions: c.contradictions.map((k) => ({ ...k, found: state.contradictions.some((x) => x.id === k.id) })),
      roleFiles: state.players.map((p) => ({ id: p.id, name: p.name, role: p.role, char: p.char ?? null })),
      votes: Object.entries(state.votes).map(([id, v]) => ({ name: playerOf(state, id).name, verdict: v.verdict, evidence: v.evidence.map((e) => c.evidence[e].name) })),
      unseen: Object.keys(c.evidence).filter((e) => !isPublicEv(state, e)).map((e) => ({ ev: e, name: c.evidence[e].name, desc: c.evidence[e].desc, source: c.evidence[e].source })),
    };
    view.scores = state.settings.scoring ? state.scores : null;
  }

  if (me && rolesOut) {
    const team = teamOf(me);
    const f = privateFile(c, me);
    const pool = team ? teamEvidence(c, team) : [];
    const reveals = Object.values(allReveals(c)).filter((r) => r.owner.char && r.owner.char === me.char)
      .map((r) => ({ id: r.id, label: r.label, text: r.text, done: state.reveals.some((x) => x.id === r.id) }));
    view.me = {
      id: me.id, name: me.name, role: me.role, char: me.char ?? null, team,
      file: f,
      evidence: pool.map((e) => ({ ev: e, ...c.evidence[e], presented: isPublicEv(state, e) })),
      reveals,
      objectives: objectivesFor(c, me).map((o) => ({ label: o.label, pts: o.pts })),
      messages: state.messages[me.id] || [],
      notes: state.notes[me.id] || '',
      attemptsLeft: team ? state.settings.attempts - (state.attempts[me.id] || 0) : 0,
      canVote: voters(state).some((p) => p.id === me.id),
      vote: state.votes[me.id] || null,
      ackRole: !!state.acks.roles?.[me.id],
      // virtual witness Q&A is shown to the human playing that witness as guidance
      witnessGuide: me.role === 'witness' ? (c.witnesses.find((w) => w.char === me.char)?.qa || []) : null,
      statement: me.char ? (c.witnesses.find((w) => w.char === me.char)?.statement || null) : null,
    };
  } else if (me) {
    view.me = { id: me.id, name: me.name, role: null };
  }
  return view;
}

function privateFile(c, me) {
  const F = c.files;
  switch (me.role) {
    case 'judge': return F.judge;
    case 'prosecutor': return F.prosecutor;
    case 'defense': return F.defense;
    case 'aideP': return { ...F.prosecutor, aideNote: F.aides?.prosecution };
    case 'aideD': return { ...F.defense, aideNote: F.aides?.defense };
    case 'defendant': return F.defendant;
    case 'witness': return F.witness[me.char];
    case 'juror': return F.juror;
    default: return null;
  }
}

export { ROLE_INFO, PHASES };
