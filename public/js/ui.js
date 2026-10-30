// Small rendering helpers shared by all screens.
import { t, L, getLang } from './i18n.js';
import { ROLE_INFO, PHASE_INFO } from '../shared/constants.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const attr = esc;

export const roleName = (r) => (r ? (getLang() === 'en' ? ROLE_INFO[r]?.en : ROLE_INFO[r]?.ar) : '—');
export const phaseName = (p) => (getLang() === 'en' ? PHASE_INFO[p]?.en : PHASE_INFO[p]?.ar);
export const phaseCode = (p) => PHASE_INFO[p]?.code || '';
export const sideName = (s) => t(`side_${s}`);

export function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function toast(msg, kind = '') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}

export function errText(r) {
  if (!r || r.ok) return '';
  return t(`e_${r.err}`) === `e_${r.err}` ? t('e_badInput') : t(`e_${r.err}`);
}

export const dots = (n, max = 3) => Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');

export { t, L };
