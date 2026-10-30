// Inline SVG: icons and case illustrations (gold line art on dark).

const S = (body, vb = '0 0 24 24', cls = 'ic') =>
  `<svg class="${cls}" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icon = {
  gavel: S('<path d="M14.5 3.5l6 6M12 6l6 6M13.2 4.8l-6.4 6.4 6 6 6.4-6.4M9.8 14.2L3 21"/><path d="M14 21h7"/>'),
  scales: S('<path d="M12 3v18M7 21h10M4 7h16"/><path d="M4 7l-2.5 6h5zM20 7l-2.5 6h5z"/><path d="M1.5 13a2.5 1.4 0 0 0 5 0M17.5 13a2.5 1.4 0 0 0 5 0"/>'),
  folder: S('<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/>'),
  evidence: S('<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v3h3M9 11h6M9 14h6M9 17h4"/>'),
  witness: S('<circle cx="12" cy="7.5" r="3.5"/><path d="M5 21c.5-4.2 3.3-6.5 7-6.5s6.5 2.3 7 6.5"/>'),
  jury: S('<circle cx="6" cy="8" r="2.4"/><circle cx="12" cy="7" r="2.6"/><circle cx="18" cy="8" r="2.4"/><path d="M2 19c.4-3 2-4.5 4-4.5M22 19c-.4-3-2-4.5-4-4.5M7 20c.4-3.3 2.4-5 5-5s4.6 1.7 5 5"/>'),
  timer: S('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M10 2h4"/>'),
  eye: S('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  lock: S('<rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  bolt: S('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  link: S('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  mail: S('<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 7l9 6 9-6"/>'),
  note: S('<path d="M5 3h10l4 4v14H5z"/><path d="M8 12h8M8 16h5"/>'),
  sound: S('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: S('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 5M22 9l-5 5"/>'),
  globe: S('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>'),
  door: S('<path d="M14 3H6v18h8M10 12h11M17 8l4 4-4 4"/>'),
  play: S('<path d="M7 4l13 8-13 8z"/>'),
  pause: S('<path d="M8 5v14M16 5v14"/>'),
  stop: S('<rect x="6" y="6" width="12" height="12" rx="1"/>'),
  check: S('<path d="M4 12.5l5 5L20 6.5"/>'),
  x: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  plus: S('<path d="M12 5v14M5 12h14"/>'),
  devices: S('<rect x="2" y="5" width="13" height="10" rx="1.2"/><path d="M6 19h5M8.5 15v4"/><rect x="16" y="8" width="6" height="12" rx="1.2"/>'),
  phone: S('<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>'),
  star: S('<path d="M12 3l2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.8z"/>'),
  crown: S('<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>'),
  copy: S('<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>'),
  arrow: S('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  info: S('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  photo: S('<rect x="3" y="5" width="18" height="14" rx="1.5"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 8"/>'),
  object: S('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>'),
  digital: S('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M7 20h10M12 16v4M7 8h4M7 11h7"/>'),
  audio: S('<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4"/>'),
  document: S('<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v3h3M9 11h6M9 14h6M9 17h4"/>'),
};

export const kindIcon = (k) => icon[k] || icon.evidence;

const A = (body) => `<svg class="case-art" viewBox="0 0 320 200" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const caseArt = {
  heist: A(`
    <rect x="96" y="30" width="128" height="120" rx="2" stroke-width="2.4"/>
    <rect x="106" y="40" width="108" height="100" stroke-dasharray="4 5" opacity=".7"/>
    <path d="M106 140l40-38 22 20 18-14 28 32" opacity=".25"/>
    <path d="M150 20h20M160 20v10" opacity=".6"/>
    <path d="M60 170h200" opacity=".5"/><path d="M40 182h240" opacity=".25"/>
    <path d="M232 64l26-8M236 90l30 2M228 116l24 14" opacity=".35"/>
    <circle cx="160" cy="88" r="3" fill="currentColor"/>`),
  will: A(`
    <path d="M100 38h110a14 14 0 0 1 0 28H100z" stroke-width="2"/>
    <path d="M100 52v104a12 12 0 0 0 24 0V66"/>
    <path d="M124 66h86v90h-86"/>
    <path d="M138 86h58M138 100h58M138 114h40M138 128h52" opacity=".6"/>
    <circle cx="196" cy="146" r="16" stroke-width="2"/><path d="M188 146l6 6 10-12" opacity=".8"/>
    <path d="M212 160l8 22-10-6-6 10-4-22" opacity=".7"/>
    <path d="M240 140c10-16 22-20 34-14" stroke-dasharray="3 4" opacity=".5"/>`),
  insider: A(`
    <rect x="92" y="40" width="136" height="88" rx="6" stroke-width="2.2"/>
    <path d="M72 140h176l-14 16H86z" stroke-width="2"/>
    <path d="M110 62h40M110 76h70M110 90h54M110 104h80" opacity=".55"/>
    <circle cx="200" cy="74" r="12"/><path d="M200 86v14M194 100h12"/>
    <path d="M232 60c18 0 30 8 38 22M244 48c22 2 38 14 46 32" stroke-dasharray="3 5" opacity=".5"/>
    <path d="M40 90h30M30 104h40" opacity=".3"/>`),
  vanish: A(`
    <path d="M60 170h200" opacity=".6"/>
    <path d="M96 170V84l64-40 64 40v86" stroke-width="2.2"/>
    <rect x="116" y="100" width="18" height="22"/><rect x="151" y="100" width="18" height="22" opacity=".45"/><rect x="186" y="100" width="18" height="22"/>
    <rect x="116" y="136" width="18" height="22" opacity=".45"/><rect x="186" y="136" width="18" height="22" opacity=".45"/>
    <path d="M151 170v-30h18v30"/>
    <path d="M40 60c20-10 40-10 60 0M220 46c20-10 40-10 60 0" opacity=".35"/>
    <path d="M70 120l-12 8M250 126l12 8" opacity=".3"/>`),
  decision: A(`
    <path d="M40 170h240" opacity=".6"/>
    <path d="M56 170v-50h24v50M86 170V96h28v74M120 170v-60h22v60M180 170V86h30v84M216 170v-40h22v40M244 170v-64h20v64" stroke-width="1.8"/>
    <path d="M150 30l-14 34h16l-10 30 26-40h-16l12-24z" stroke-width="2.2"/>
    <path d="M92 108h4M104 108h4M92 124h4M188 100h4M198 100h4M188 116h4" opacity=".35"/>
    <circle cx="160" cy="62" r="46" stroke-dasharray="2 6" opacity=".35"/>`),
  witness: A(`
    <circle cx="160" cy="70" r="26" stroke-width="2.2" stroke-dasharray="6 6"/>
    <path d="M112 170c4-38 22-58 48-58s44 20 48 58" stroke-width="2.2" stroke-dasharray="6 6"/>
    <path d="M152 62c0-8 16-8 16 0 0 6-8 7-8 14M160 84v2" stroke-width="2"/>
    <path d="M60 170h200" opacity=".5"/>
    <path d="M70 60l20 6M250 60l-20 6M74 96h18M228 96h18" opacity=".35"/>`),
};

// small gold seal used on the landing page
export const seal = `<svg class="seal" viewBox="0 0 200 200" aria-hidden="true">
  <defs><path id="sealPath" d="M100 100m-74 0a74 74 0 1 1 148 0a74 74 0 1 1-148 0"/></defs>
  <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".5"/>
  <circle cx="100" cy="100" r="84" fill="none" stroke="currentColor" stroke-width="2"/>
  <circle cx="100" cy="100" r="62" fill="none" stroke="currentColor" stroke-width="1" opacity=".6"/>
  <text font-size="11" letter-spacing="5" fill="currentColor" font-family="Cinzel, serif"><textPath href="#sealPath">THE COURTROOM · JUSTICE · TRUTH · EVIDENCE ·</textPath></text>
  <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" transform="translate(64 62) scale(3)">
    <path d="M12 3v18M7 21h10M4 7h16"/><path d="M4 7l-2.5 6h5zM20 7l-2.5 6h5z"/><path d="M1.5 13a2.5 1.4 0 0 0 5 0M17.5 13a2.5 1.4 0 0 0 5 0"/>
  </g>
</svg>`;
