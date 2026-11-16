import type { BudgetLevel, RoomKind } from '../../api';

/* Материалы изометрии по уровням бюджета. Цвета — не деньги, поэтому живут в UI. */

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255; const g = (n >> 8) & 255; const b = n & 255;
  const t = f >= 0 ? 255 : 0; const p = Math.abs(f);
  return `#${[r, g, b].map((c) => clamp(c + (t - c) * p).toString(16).padStart(2, '0')).join('')}`;
}
const tri = (hex: string): [string, string, string] => [shade(hex, 0.18), hex, shade(hex, -0.14)];

export interface Palette {
  line: string; lineDark: string;
  slab: string; slabL: string; slabR: string;
  wallBareTop: string; wallBareL: string; wallBareR: string;
  wallTop: string; wallL: string; wallR: string;
  fabric: [string, string, string]; accent: [string, string, string]; wood: [string, string, string];
  linen: [string, string, string]; pillow: [string, string, string]; cabinet: [string, string, string];
  stoneTop: [string, string, string]; metal: [string, string, string]; ceramic: [string, string, string];
  plant: [string, string, string];
  water: string; rug: string; glass: string; cable: string; heat: string; lamp: string;
}

const common = {
  line: 'rgba(35,33,30,0.42)', lineDark: '#23211E',
  slab: '#D2CBBF', slabL: '#BDB5A8', slabR: '#A69E91',
  wallBareTop: '#D8D1C6', wallBareL: '#C4BCB0', wallBareR: '#ADA498',
  ceramic: tri('#F4F2EE'), metal: tri('#B9B6B0'), water: '#D5DEDF', glass: '#E3E8E6',
  cable: '#AD4F2D', heat: '#C8643C',
};

export const PALETTES: Record<BudgetLevel, Palette> = {
  economy: {
    ...common,
    wallTop: '#FBFAF7', wallL: '#F1EEE8', wallR: '#DEDAD2',
    fabric: tri('#C9C6BF'), accent: tri('#8FA3A8'), wood: tri('#D8C3A0'), linen: tri('#F1EFEA'),
    pillow: tri('#FFFFFF'), cabinet: tri('#ECE9E3'), stoneTop: tri('#E1DDD6'), plant: tri('#8C9A7A'),
    rug: '#E2DED6', lamp: '#F4F2EE',
  },
  standard: {
    ...common,
    wallTop: '#F8F3EB', wallL: '#E9DFD0', wallR: '#D4C7B4',
    fabric: tri('#B9A58C'), accent: tri('#AD4F2D'), wood: tri('#C29A6B'), linen: tri('#EFE8DD'),
    pillow: tri('#F8F4EE'), cabinet: tri('#DCD2C3'), stoneTop: tri('#EDE9E3'), plant: tri('#71805F'),
    rug: '#D9CDBB', lamp: '#23211E',
  },
  premium: {
    ...common,
    wallTop: '#F4EEE5', wallL: '#D9CBB8', wallR: '#BFAE97',
    fabric: tri('#5E5A52'), accent: tri('#B8693F'), wood: tri('#8B6242'), linen: tri('#E9E1D5'),
    pillow: tri('#D8CDBE'), cabinet: tri('#6E655A'), stoneTop: tri('#EFEBE6'), plant: tri('#5E6E4D'),
    rug: '#B9A891', lamp: '#B08D57',
  },
};

export function floorMaterial(kind: RoomKind, level: BudgetLevel): string {
  if (kind === 'bath' || kind === 'wc') return `iso-tile-${level}`;
  if (kind === 'kitchen') return level === 'economy' ? 'iso-tile-economy' : `iso-wood-${level}`;
  if (kind === 'hall' || kind === 'storage') return level === 'premium' ? 'iso-tile-premium' : `iso-wood-${level}`;
  return `iso-wood-${level}`;
}

const C = Math.cos(Math.PI / 6);
const S = 0.5;
export const isoFloorMatrix = (k: number) => `matrix(${C * k} ${S * k} ${-C * k} ${S * k} 0 0)`;

/** Общие SVG-определения изометрии. Монтируются один раз на страницу. */
export function IsoDefs({ k = 34 }: { k?: number }) {
  const m = isoFloorMatrix(k);
  const sw = 0.012;
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        <radialGradient id="iso-glow">
          <stop offset="0" stopColor="#FFD9A0" stopOpacity="0.62" />
          <stop offset="0.6" stopColor="#FFE6BF" stopOpacity="0.22" />
          <stop offset="1" stopColor="#FFF1DC" stopOpacity="0" />
        </radialGradient>

        <pattern id="iso-screed" patternUnits="userSpaceOnUse" width="1" height="1" patternTransform={m}>
          <rect width="1" height="1" fill="#C3BCB0" />
          <line x1="0" y1="0.5" x2="1" y2="0.5" stroke="#9E978B" strokeWidth={0.018} />
          <circle cx="0.2" cy="0.2" r="0.012" fill="#A9A296" />
          <circle cx="0.72" cy="0.81" r="0.01" fill="#A9A296" />
          <circle cx="0.55" cy="0.3" r="0.008" fill="#B0A99D" />
        </pattern>

        {/* ламинат: светлый, широкие планки */}
        <pattern id="iso-wood-economy" patternUnits="userSpaceOnUse" width="1.3" height="0.4" patternTransform={m}>
          <rect width="1.3" height="0.4" fill="#E6D6BA" />
          <rect y="0.2" width="1.3" height="0.2" fill="#E1CFB0" />
          <line x1="0" y1="0" x2="1.3" y2="0" stroke="#C9B48F" strokeWidth={sw} />
          <line x1="0" y1="0.2" x2="1.3" y2="0.2" stroke="#C9B48F" strokeWidth={sw} />
          <line x1="0.5" y1="0" x2="0.5" y2="0.2" stroke="#C9B48F" strokeWidth={sw} />
          <line x1="1.05" y1="0.2" x2="1.05" y2="0.4" stroke="#C9B48F" strokeWidth={sw} />
        </pattern>
        {/* инженерная доска, дуб */}
        <pattern id="iso-wood-standard" patternUnits="userSpaceOnUse" width="1.8" height="0.36" patternTransform={m}>
          <rect width="1.8" height="0.36" fill="#CDA77A" />
          <rect y="0.18" width="1.8" height="0.18" fill="#C69F70" />
          <line x1="0" y1="0" x2="1.8" y2="0" stroke="#A47E52" strokeWidth={sw} />
          <line x1="0" y1="0.18" x2="1.8" y2="0.18" stroke="#A47E52" strokeWidth={sw} />
          <line x1="0.7" y1="0" x2="0.7" y2="0.18" stroke="#A47E52" strokeWidth={sw} />
          <line x1="1.5" y1="0.18" x2="1.5" y2="0.36" stroke="#A47E52" strokeWidth={sw} />
          <path d="M0.1 0.07 Q0.5 0.05 0.9 0.09 M0.9 0.27 Q1.2 0.25 1.6 0.28" stroke="#BB9466" strokeWidth={0.008} fill="none" />
        </pattern>
        {/* паркет ёлочкой */}
        <pattern id="iso-wood-premium" patternUnits="userSpaceOnUse" width="0.56" height="0.14" patternTransform={m}>
          <rect width="0.56" height="0.14" fill="#9C7149" />
          <path d="M0 0 L0.28 0.14 M0.28 0.14 L0.56 0 M0 -0.14 L0.28 0 L0.56 -0.14 M0 0.14 L0.28 0.28 L0.56 0.14" stroke="#6F4E31" strokeWidth={sw} fill="none" />
          <path d="M0 0.035 L0.07 0.07 L0 0.105" fill="#A77B52" />
          <path d="M0.28 0.035 L0.35 0.07 L0.28 0.105 Z M0.49 0.035 L0.56 0.0 L0.56 0.14 Z" fill="#94693F" opacity="0.5" />
        </pattern>

        <pattern id="iso-tile-economy" patternUnits="userSpaceOnUse" width="0.6" height="0.3" patternTransform={m}>
          <rect width="0.6" height="0.3" fill="#E7E5E0" />
          <path d="M0 0 H0.6 M0 0 V0.3" stroke="#C7C3BB" strokeWidth={sw} />
        </pattern>
        <pattern id="iso-tile-standard" patternUnits="userSpaceOnUse" width="1.2" height="0.6" patternTransform={m}>
          <rect width="1.2" height="0.6" fill="#D6D0C6" />
          <path d="M0 0 H1.2 M0 0 V0.6" stroke="#B6AFA3" strokeWidth={sw} />
        </pattern>
        <pattern id="iso-tile-premium" patternUnits="userSpaceOnUse" width="1.2" height="1.2" patternTransform={m}>
          <rect width="1.2" height="1.2" fill="#ECE8E2" />
          <path d="M0.05 0.3 C0.3 0.22 0.5 0.45 0.8 0.36 S1.1 0.5 1.2 0.44 M0.2 0.95 C0.45 0.8 0.7 1.0 1.0 0.86" stroke="#C9C1B5" strokeWidth={0.01} fill="none" />
          <path d="M0 0 H1.2 M0 0 V1.2" stroke="#BDB4A7" strokeWidth={sw} />
        </pattern>
      </defs>
    </svg>
  );
}
