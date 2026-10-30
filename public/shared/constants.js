// Shared constants: imported by the browser (both modes) and by the server.
// No case content lives here, so the online client can load it safely.

export const PHASES = [
  'intro', 'roles', 'opening', 'evidence', 'witness',
  'cross', 'closing', 'voting', 'verdict', 'truth',
];

export const PHASE_INFO = {
  intro:    { code: 'CASE INTRODUCTION',    ar: 'افتتاح القضية',       en: 'Case Introduction' },
  roles:    { code: 'ROLE ASSIGNMENT',      ar: 'توزيع الأدوار',       en: 'Role Assignment' },
  opening:  { code: 'OPENING STATEMENTS',   ar: 'البيانات الافتتاحية', en: 'Opening Statements' },
  evidence: { code: 'EVIDENCE PRESENTATION',ar: 'عرض الأدلة',          en: 'Evidence Presentation' },
  witness:  { code: 'WITNESS EXAMINATION',  ar: 'استجواب الشهود',      en: 'Witness Examination' },
  cross:    { code: 'CROSS EXAMINATION',    ar: 'الاستجواب المضاد',    en: 'Cross Examination' },
  closing:  { code: 'CLOSING ARGUMENTS',    ar: 'المرافعات الختامية',  en: 'Closing Arguments' },
  voting:   { code: 'JURY VOTING',          ar: 'مداولة المحلفين',     en: 'Jury Voting' },
  verdict:  { code: 'VERDICT',              ar: 'النطق بالحكم',        en: 'Verdict' },
  truth:    { code: 'TRUTH REVEAL',         ar: 'كشف الحقيقة',         en: 'Truth Reveal' },
};

export const ROLE_INFO = {
  judge:      { ar: 'القاضي',          en: 'Judge',              team: 'court' },
  prosecutor: { ar: 'المدعي العام',    en: 'Prosecutor',         team: 'prosecution' },
  defense:    { ar: 'محامي الدفاع',    en: 'Defense Attorney',   team: 'defense' },
  defendant:  { ar: 'المتهم',          en: 'Defendant',          team: 'defendant' },
  witness:    { ar: 'شاهد',            en: 'Witness',            team: 'witness' },
  juror:      { ar: 'عضو هيئة المحلفين', en: 'Juror',            team: 'jury' },
  aideP:      { ar: 'مساعد الادعاء',   en: 'Prosecution Aide',   team: 'prosecution' },
  aideD:      { ar: 'مساعد الدفاع',    en: 'Defense Aide',       team: 'defense' },
};

export const OBJECTION_REASONS = [
  { id: 'irrelevant',    ar: 'سؤال غير ذي صلة',        en: 'Irrelevant' },
  { id: 'repetitive',    ar: 'تكرار السؤال',            en: 'Asked and answered' },
  { id: 'leading',       ar: 'سؤال مضلل أو إيحائي',     en: 'Leading / misleading' },
  { id: 'assumes',       ar: 'افتراض غير مثبت',         en: 'Assumes facts not in evidence' },
  { id: 'hearsay',       ar: 'سماع غير مباشر',          en: 'Hearsay' },
  { id: 'argumentative', ar: 'سؤال جدلي أو استفزازي',   en: 'Argumentative' },
  { id: 'speculation',   ar: 'يطلب من الشاهد التخمين',  en: 'Calls for speculation' },
];

export const DEFAULT_SETTINGS = {
  opening: 120,        // seconds per opening statement
  exam: 180,           // direct examination per witness
  cross: 150,          // cross examination per witness
  closing: 120,        // closing argument
  final: 45,           // FINAL CHANCE per side
  deliberation: 120,   // jury deliberation countdown
  scoring: true,
  witnesses: null,     // null = automatic by player count
  aides: null,         // null = automatic (2 from 12 players)
  attempts: 3,         // wrong contradiction claims allowed per player
};

export const LIMITS = { minPlayers: 4, maxPlayers: 16 };

// Automatic role plan by player count. Overrides come from settings.
export function planRoles(n, regularWitnesses = 3, s = {}) {
  let w = s.witnesses ?? (n >= 10 ? 3 : n >= 6 ? 2 : n >= 5 ? 1 : 0);
  w = Math.max(0, Math.min(w, regularWitnesses, n - 4));
  let a = s.aides ?? (n >= 12 ? 2 : 0);
  a = a >= 2 && n - 4 - w >= 2 ? 2 : 0;
  const j = n - 4 - w - a;
  return { witnesses: w, aides: a, jurors: j, bench: j === 0 };
}
