// Small synthesized sound effects (no audio files). Kept soft on purpose.
let ctx = null;
let enabled = true;
try { enabled = localStorage.getItem('court-sound') !== 'off'; } catch {}

export const soundOn = () => enabled;
export function toggleSound() {
  enabled = !enabled;
  try { localStorage.setItem('court-sound', enabled ? 'on' : 'off'); } catch {}
  return enabled;
}
function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone({ f = 440, type = 'sine', at = 0, dur = 0.2, vol = 0.15, to = null }) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise({ at = 0, dur = 0.12, vol = 0.2, freq = 900, q = 1 }) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + at;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t0);
}

const SOUNDS = {
  gavel() { noise({ freq: 380, q: 2, vol: 0.5, dur: 0.09 }); tone({ f: 120, type: 'triangle', dur: 0.18, vol: 0.25 }); },
  gavel3() { for (let i = 0; i < 3; i++) { noise({ at: i * 0.22, freq: 380, q: 2, vol: 0.5, dur: 0.09 }); tone({ at: i * 0.22, f: 120, type: 'triangle', dur: 0.18, vol: 0.25 }); } },
  paper() { noise({ freq: 2400, q: 0.6, vol: 0.12, dur: 0.25 }); noise({ at: 0.12, freq: 3200, q: 0.6, vol: 0.08, dur: 0.2 }); },
  objection() { tone({ f: 196, type: 'sawtooth', dur: 0.35, vol: 0.09 }); tone({ f: 233, type: 'sawtooth', at: 0.02, dur: 0.33, vol: 0.07 }); noise({ freq: 500, vol: 0.25, dur: 0.08 }); },
  reveal() { tone({ f: 330, dur: 0.5, vol: 0.08 }); tone({ f: 494, at: 0.12, dur: 0.6, vol: 0.07 }); tone({ f: 659, at: 0.24, dur: 0.8, vol: 0.05 }); },
  contradiction() { tone({ f: 110, type: 'triangle', dur: 0.6, vol: 0.22 }); tone({ f: 104, type: 'triangle', at: 0.05, dur: 0.6, vol: 0.18 }); noise({ freq: 300, vol: 0.2, dur: 0.15 }); },
  secret() { tone({ f: 880, dur: 0.12, vol: 0.05 }); tone({ f: 1175, at: 0.1, dur: 0.18, vol: 0.04 }); },
  tick() { tone({ f: 1400, type: 'square', dur: 0.03, vol: 0.03 }); },
  verdict() { tone({ f: 73, type: 'triangle', dur: 1.4, vol: 0.3 }); tone({ f: 110, at: 0.05, dur: 1.2, vol: 0.12 }); noise({ freq: 200, vol: 0.4, dur: 0.3 }); },
  soft() { tone({ f: 520, dur: 0.12, vol: 0.04 }); },
};

export function play(name) {
  if (!enabled) return;
  try { SOUNDS[name]?.(); } catch {}
}
