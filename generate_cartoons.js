const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'public', 'stickers', 'cartoons');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const cartoons = {
  'shinchan.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#fecaca"/>
    <ellipse cx="50" cy="58" rx="38" ry="32" fill="#fed7aa"/>
    <path d="M 18 45 C 25 15, 75 15, 82 45 Z" fill="#1e1b4b"/>
    <path d="M 22 42 C 32 30, 48 38, 48 42" stroke="#000" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M 52 42 C 52 38, 68 30, 78 42" stroke="#000" stroke-width="6" stroke-linecap="round" fill="none"/>
    <circle cx="36" cy="52" r="5" fill="#000"/>
    <circle cx="64" cy="52" r="5" fill="#000"/>
    <ellipse cx="25" cy="62" rx="7" ry="5" fill="#f87171" opacity="0.6"/>
    <ellipse cx="75" cy="62" rx="7" ry="5" fill="#f87171" opacity="0.6"/>
    <path d="M 38 70 Q 50 82 62 70" stroke="#b91c1c" stroke-width="4" fill="#ef4444" stroke-linecap="round"/>
  </svg>`,

  'tom.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#475569"/>
    <path d="M 15 25 L 32 40 L 12 48 Z" fill="#64748b"/>
    <path d="M 85 25 L 68 40 L 88 48 Z" fill="#64748b"/>
    <path d="M 18 28 L 30 40 L 15 45 Z" fill="#f472b6"/>
    <path d="M 82 28 L 70 40 L 85 45 Z" fill="#f472b6"/>
    <ellipse cx="50" cy="65" rx="26" ry="20" fill="#f8fafc"/>
    <ellipse cx="34" cy="48" rx="9" ry="12" fill="#fef08a"/>
    <ellipse cx="66" cy="48" rx="9" ry="12" fill="#fef08a"/>
    <ellipse cx="35" cy="48" rx="4" ry="8" fill="#000"/>
    <ellipse cx="65" cy="48" rx="4" ry="8" fill="#000"/>
    <polygon points="50,56 44,62 56,62" fill="#f43f5e"/>
    <path d="M 44 65 Q 50 72 56 65" stroke="#000" stroke-width="2" fill="none"/>
  </svg>`,

  'jerry.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#b45309"/>
    <circle cx="20" cy="25" r="18" fill="#92400e"/>
    <circle cx="80" cy="25" r="18" fill="#92400e"/>
    <circle cx="20" cy="25" r="11" fill="#fbcfe8"/>
    <circle cx="80" cy="25" r="11" fill="#fbcfe8"/>
    <ellipse cx="50" cy="62" rx="24" ry="18" fill="#fde68a"/>
    <ellipse cx="36" cy="46" rx="8" ry="10" fill="#fff"/>
    <ellipse cx="64" cy="46" rx="8" ry="10" fill="#fff"/>
    <circle cx="37" cy="46" r="5" fill="#000"/>
    <circle cx="63" cy="46" r="5" fill="#000"/>
    <ellipse cx="50" cy="56" rx="5" ry="4" fill="#1e293b"/>
    <path d="M 42 64 Q 50 74 58 64" stroke="#000" stroke-width="3" fill="#ef4444"/>
  </svg>`,

  'pikachu.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M 10 35 L 32 10 L 35 32 Z" fill="#eab308"/>
    <path d="M 10 35 L 20 20 L 25 28 Z" fill="#1e293b"/>
    <path d="M 90 35 L 68 10 L 65 32 Z" fill="#eab308"/>
    <path d="M 90 35 L 80 20 L 75 28 Z" fill="#1e293b"/>
    <circle cx="50" cy="54" r="42" fill="#facc15"/>
    <circle cx="34" cy="48" r="7" fill="#1e293b"/>
    <circle cx="66" cy="48" r="7" fill="#1e293b"/>
    <circle cx="36" cy="46" r="2.5" fill="#fff"/>
    <circle cx="68" cy="46" r="2.5" fill="#fff"/>
    <circle cx="24" cy="62" r="9" fill="#dc2626"/>
    <circle cx="76" cy="62" r="9" fill="#dc2626"/>
    <polygon points="50,54 47,57 53,57" fill="#000"/>
    <path d="M 44 60 Q 50 66 56 60" stroke="#000" stroke-width="2.5" fill="none"/>
  </svg>`,

  'spiderman.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <ellipse cx="50" cy="50" rx="42" ry="46" fill="#dc2626"/>
    <path d="M 50 4 L 50 96 M 8 50 L 92 50 M 18 20 L 82 80 M 18 80 L 82 20" stroke="#7f1d1d" stroke-width="1.5"/>
    <path d="M 22 45 Q 38 25 50 25 Q 62 25 78 45 Q 60 48 50 48 Q 40 48 22 45 Z" fill="#000"/>
    <path d="M 25 43 Q 38 28 50 28 Q 62 28 75 43 Q 60 45 50 45 Q 40 45 25 43 Z" fill="#f8fafc"/>
  </svg>`,

  'shaktimaan.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#991b1b"/>
    <polygon points="50,10 62,38 92,38 68,56 78,86 50,68 22,86 32,56 8,38 38,38" fill="#facc15"/>
    <circle cx="50" cy="50" r="18" fill="#b91c1c"/>
    <circle cx="50" cy="50" r="12" fill="#fef08a"/>
    <text x="50" y="56" font-size="16" font-weight="900" text-anchor="middle" fill="#991b1b">S</text>
  </svg>`,

  'doraemon.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="46" fill="#0284c7"/>
    <ellipse cx="50" cy="58" rx="36" ry="32" fill="#fff"/>
    <ellipse cx="41" cy="34" rx="8" ry="12" fill="#fff" stroke="#000" stroke-width="2"/>
    <ellipse cx="59" cy="34" rx="8" ry="12" fill="#fff" stroke="#000" stroke-width="2"/>
    <circle cx="43" cy="36" r="3" fill="#000"/>
    <circle cx="57" cy="36" r="3" fill="#000"/>
    <circle cx="50" cy="45" r="6" fill="#dc2626"/>
    <line x1="50" y1="51" x2="50" y2="72" stroke="#000" stroke-width="2"/>
    <path d="M 28 65 Q 50 82 72 65" stroke="#000" stroke-width="3" fill="#ef4444"/>
    <line x1="15" y1="45" x2="38" y2="48" stroke="#000" stroke-width="2"/>
    <line x1="12" y1="54" x2="38" y2="54" stroke="#000" stroke-width="2"/>
    <line x1="15" y1="63" x2="38" y2="60" stroke="#000" stroke-width="2"/>
    <line x1="85" y1="45" x2="62" y2="48" stroke="#000" stroke-width="2"/>
    <line x1="88" y1="54" x2="62" y2="54" stroke="#000" stroke-width="2"/>
    <line x1="85" y1="63" x2="62" y2="60" stroke="#000" stroke-width="2"/>
  </svg>`,

  'goku.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M 10 40 L 25 15 L 35 30 L 50 5 L 65 30 L 75 15 L 90 40 L 75 50 L 85 75 L 50 95 L 15 75 L 25 50 Z" fill="#facc15" stroke="#ca8a04" stroke-width="2"/>
    <ellipse cx="50" cy="55" rx="26" ry="24" fill="#fed7aa"/>
    <polygon points="32,44 46,48 34,50" fill="#000"/>
    <polygon points="68,44 54,48 66,50" fill="#000"/>
    <circle cx="40" cy="52" r="3" fill="#0284c7"/>
    <circle cx="60" cy="52" r="3" fill="#0284c7"/>
    <path d="M 40 68 Q 50 62 60 68" stroke="#9a3412" stroke-width="3" fill="none"/>
  </svg>`,

  'bheem.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="46" fill="#d97706"/>
    <ellipse cx="50" cy="55" rx="34" ry="30" fill="#fde047"/>
    <path d="M 20 40 C 30 15, 70 15, 80 40 Z" fill="#451a03"/>
    <path d="M 50 28 L 50 48 M 46 32 L 54 32" stroke="#dc2626" stroke-width="4" stroke-linecap="round"/>
    <circle cx="36" cy="50" r="4" fill="#000"/>
    <circle cx="64" cy="50" r="4" fill="#000"/>
    <path d="M 36 65 Q 50 76 64 65" stroke="#b45309" stroke-width="4" fill="#ef4444"/>
  </svg>`,

  'batman.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M 15 15 L 30 40 C 40 36, 60 36, 70 40 L 85 15 L 80 60 C 80 80, 20 80, 20 60 Z" fill="#0f172a"/>
    <polygon points="30,48 45,52 32,56" fill="#f8fafc"/>
    <polygon points="70,48 55,52 68,56" fill="#f8fafc"/>
    <ellipse cx="50" cy="68" rx="14" ry="10" fill="#fed7aa"/>
    <path d="M 42 70 Q 50 75 58 70" stroke="#9a3412" stroke-width="2" fill="none"/>
  </svg>`,

  'ironman.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M 20 20 L 50 10 L 80 20 L 85 60 L 50 92 L 15 60 Z" fill="#991b1b"/>
    <path d="M 30 30 L 50 24 L 70 30 L 72 58 L 50 82 L 28 58 Z" fill="#facc15"/>
    <polygon points="32,46 46,46 44,50 32,50" fill="#38bdf8"/>
    <polygon points="68,46 54,46 56,50 68,50" fill="#38bdf8"/>
  </svg>`,

  'captain-america.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#1e3a8a"/>
    <path d="M 20 20 L 50 10 L 80 20 L 82 65 C 82 85, 18 85, 18 65 Z" fill="#1d4ed8"/>
    <text x="50" y="42" font-size="28" font-weight="900" text-anchor="middle" fill="#fff">A</text>
    <polygon points="32,52 44,55 34,58" fill="#fff"/>
    <polygon points="68,52 56,55 66,58" fill="#fff"/>
  </svg>`,

  'naruto.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M 10 30 L 25 10 L 38 25 L 50 5 L 62 25 L 75 10 L 90 30 L 82 50 L 18 50 Z" fill="#facc15"/>
    <rect x="22" y="32" width="56" height="18" rx="4" fill="#334155"/>
    <rect x="34" y="35" width="32" height="12" rx="2" fill="#94a3b8"/>
    <ellipse cx="50" cy="62" rx="30" ry="26" fill="#fed7aa"/>
    <circle cx="38" cy="58" r="4" fill="#0284c7"/>
    <circle cx="62" cy="58" r="4" fill="#0284c7"/>
    <line x1="24" y1="58" x2="32" y2="58" stroke="#000" stroke-width="2"/>
    <line x1="24" y1="62" x2="32" y2="62" stroke="#000" stroke-width="2"/>
    <line x1="24" y1="66" x2="32" y2="66" stroke="#000" stroke-width="2"/>
    <line x1="76" y1="58" x2="68" y2="58" stroke="#000" stroke-width="2"/>
    <line x1="76" y1="62" x2="68" y2="62" stroke="#000" stroke-width="2"/>
    <line x1="76" y1="66" x2="68" y2="66" stroke="#000" stroke-width="2"/>
  </svg>`,

  'ben10.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#15803d"/>
    <circle cx="50" cy="50" r="36" fill="#1e293b"/>
    <circle cx="50" cy="50" r="28" fill="#22c55e"/>
    <polygon points="50,22 32,50 50,78 68,50" fill="#000"/>
  </svg>`,

  'minion.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect x="18" y="10" width="64" height="80" rx="32" fill="#facc15"/>
    <rect x="10" y="32" width="80" height="12" fill="#1e293b"/>
    <circle cx="50" cy="38" r="18" fill="#94a3b8"/>
    <circle cx="50" cy="38" r="13" fill="#fff"/>
    <circle cx="50" cy="38" r="6" fill="#854d0e"/>
    <circle cx="50" cy="38" r="3" fill="#000"/>
    <path d="M 36 68 Q 50 78 64 68" stroke="#000" stroke-width="3" fill="none"/>
  </svg>`,

  'mario.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M 12 35 C 20 10, 80 10, 88 35 Z" fill="#dc2626"/>
    <rect x="8" y="32" width="84" height="10" rx="4" fill="#b91c1c"/>
    <circle cx="50" cy="24" r="10" fill="#fff"/>
    <text x="50" y="30" font-size="14" font-weight="900" text-anchor="middle" fill="#dc2626">M</text>
    <ellipse cx="50" cy="58" rx="32" ry="26" fill="#fed7aa"/>
    <ellipse cx="50" cy="54" rx="10" ry="8" fill="#f87171"/>
    <path d="M 24 62 C 38 52, 62 52, 76 62 C 60 70, 40 70, 24 62 Z" fill="#451a03"/>
  </svg>`,

  'sonic.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M 20 20 L 50 10 L 80 20 L 95 45 L 80 75 L 50 95 L 20 75 L 5 45 Z" fill="#2563eb"/>
    <ellipse cx="50" cy="62" rx="26" ry="20" fill="#fed7aa"/>
    <ellipse cx="38" cy="46" rx="10" ry="16" fill="#fff"/>
    <ellipse cx="62" cy="46" rx="10" ry="16" fill="#fff"/>
    <ellipse cx="40" cy="46" rx="5" ry="9" fill="#16a34a"/>
    <ellipse cx="60" cy="46" rx="5" ry="9" fill="#16a34a"/>
    <circle cx="41" cy="44" r="2" fill="#fff"/>
    <circle cx="61" cy="44" r="2" fill="#fff"/>
    <ellipse cx="50" cy="56" rx="4" ry="3" fill="#000"/>
  </svg>`
};

for (const [filename, content] of Object.entries(cartoons)) {
  fs.writeFileSync(path.join(targetDir, filename), content);
}
console.log('✅ Successfully created 17 vector cartoon character face SVG assets!');
