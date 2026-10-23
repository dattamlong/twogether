import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type WorldTheme = { sky: [string, string]; ground: string; accent: string; ink: string; chip: string };

export const WORLD_THEMES: Record<string, WorldTheme> = {
  english: { sky: ["#fde4ee", "#c7b8ea"], ground: "#bce5d5", accent: "#e7779f", ink: "#45365b", chip: "bg-sakura-100" },
  chinese: { sky: ["#fff0e8", "#f6a88a"], ground: "#9fd8c2", accent: "#d45a5a", ink: "#5b2b2b", chip: "bg-peach-100" },
  brain: { sky: ["#efeafb", "#8fb7f0"], ground: "#c7b8ea", accent: "#8a73c8", ink: "#2c2140", chip: "bg-lavender-100" },
  explorer: { sky: ["#e5f3fc", "#8fcaf0"], ground: "#f5cb78", accent: "#3a9474", ink: "#1f4b5a", chip: "bg-sky-100" },
  science: { sky: ["#e3f5ee", "#6cc3a2"], ground: "#b8ddf5", accent: "#3a9474", ink: "#1f3f3a", chip: "bg-mint-100" },
  money: { sky: ["#fff7e0", "#f5cb78"], ground: "#bce5d5", accent: "#d9a440", ink: "#5a4214", chip: "bg-gold-200" },
  tech: { sky: ["#2c2140", "#6a5583"], ground: "#45365b", accent: "#6fb5e3", ink: "#e5f3fc", chip: "bg-sky-100" },
};

function Cloud({ x, y, s = 1, delay = 0 }: { x: number; y: number; s?: number; delay?: number }) {
  return (
    <g style={{ animation: `legend-float ${6 + delay}s ease-in-out ${delay}s infinite`, transformBox: "fill-box" }}>
      <g transform={`translate(${x} ${y}) scale(${s})`} fill="#ffffff" opacity=".85">
        <ellipse cx="0" cy="0" rx="22" ry="10" />
        <ellipse cx="14" cy="-6" rx="14" ry="10" />
        <ellipse cx="-12" cy="-4" rx="12" ry="8" />
      </g>
    </g>
  );
}

function Sparkles({ color = "#fff" }: { color?: string }) {
  return (
    <g fill={color}>
      {[
        [40, 30, 0],
        [250, 22, 0.8],
        [180, 52, 1.6],
        [90, 64, 2.2],
      ].map(([x, y, d]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y - 5}l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z`} style={{ animation: `legend-twinkle 2.6s ease-in-out ${d}s infinite`, transformBox: "fill-box", transformOrigin: "center" }} />
      ))}
    </g>
  );
}

const SCENES: Record<string, ReactNode> = {
  english: (
    <>
      <path d="M0 150 Q70 120 140 140 T300 130 V200 H0z" fill="#bce5d5" />
      <path d="M0 165 Q90 145 180 160 T300 155 V200 H0z" fill="#9fd8c2" />
      <g transform="translate(150 58)">
        <rect x="-34" y="30" width="68" height="62" rx="4" fill="#fff7ed" stroke="#c7b8ea" strokeWidth="2" />
        <rect x="-46" y="10" width="20" height="82" rx="3" fill="#fff7ed" stroke="#c7b8ea" strokeWidth="2" />
        <rect x="26" y="10" width="20" height="82" rx="3" fill="#fff7ed" stroke="#c7b8ea" strokeWidth="2" />
        <path d="M-50 12 L-36 -14 L-22 12z M22 12 L36 -14 L50 12z M-38 32 L0 0 L38 32z" fill="#e7779f" />
        <path d="M-8 92 v-22 a8 8 0 0 1 16 0 v22z" fill="#c7b8ea" />
        <rect x="-4" y="40" width="8" height="12" rx="4" fill="#fbe3b1" />
        <path d="M36 -14 v-14 l10 4 -10 4" fill="none" stroke="#45365b" strokeWidth="1.5" />
      </g>
      {[[40, 132], [262, 128], [92, 150]].map(([x, y]) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <rect x="-2" y="-4" width="4" height="22" fill="#9a8288" />
          <circle cx="0" cy="-10" r="16" fill="#f8bbd0" />
          <circle cx="-9" cy="-4" r="10" fill="#f39bbb" />
          <circle cx="9" cy="-6" r="10" fill="#fde4ee" />
        </g>
      ))}
    </>
  ),
  chinese: (
    <>
      <path d="M0 120 L50 70 L90 110 L140 50 L200 115 L250 80 L300 120 V200 H0z" fill="#c9e7dc" opacity=".8" />
      <path d="M0 155 Q80 135 160 150 T300 145 V200 H0z" fill="#9fd8c2" />
      <g transform="translate(160 70)">
        <rect x="-30" y="52" width="60" height="44" fill="#fff0e8" stroke="#d45a5a" strokeWidth="2" />
        <path d="M-46 54 Q0 30 46 54 L36 44 Q0 26 -36 44z" fill="#d45a5a" />
        <rect x="-22" y="20" width="44" height="26" fill="#fff0e8" stroke="#d45a5a" strokeWidth="2" />
        <path d="M-36 22 Q0 0 36 22 L28 14 Q0 -2 -28 14z" fill="#d45a5a" />
        <rect x="-8" y="70" width="16" height="26" fill="#d45a5a" />
      </g>
      {[[60, 70], [250, 64]].map(([x, y], i) => (
        <g key={x} transform={`translate(${x} ${y})`} style={{ animation: `legend-float ${4 + i}s ease-in-out infinite`, transformBox: "fill-box" }}>
          <path d="M0 -12 v6" stroke="#5b2b2b" strokeWidth="1.5" />
          <ellipse cx="0" cy="4" rx="10" ry="12" fill="#e7554f" />
          <rect x="-6" y="-8" width="12" height="3" fill="#f5cb78" />
          <rect x="-6" y="15" width="12" height="3" fill="#f5cb78" />
        </g>
      ))}
      {[24, 34, 270, 282].map((x, i) => (
        <g key={x}>
          <rect x={x} y={90 + (i % 2) * 10} width="5" height="90" fill="#6cc3a2" />
          <path d={`M${x + 2} ${100 + i * 4} q12 -6 20 0`} stroke="#3a9474" strokeWidth="3" fill="none" />
        </g>
      ))}
    </>
  ),
  brain: (
    <>
      {[[70, 120, 60], [210, 100, 70], [150, 150, 50]].map(([x, y, w], i) => (
        <g key={x} style={{ animation: `legend-float ${5 + i}s ease-in-out ${i * 0.6}s infinite`, transformBox: "fill-box" }}>
          <ellipse cx={x} cy={y} rx={w / 2} ry="10" fill="#c7b8ea" />
          <path d={`M${x - w / 2} ${y} Q${x} ${y + 34} ${x + w / 2} ${y}z`} fill="#a995dc" />
        </g>
      ))}
      <g transform="translate(210 50)">
        <rect x="-16" y="0" width="32" height="50" fill="#efeafb" stroke="#8a73c8" strokeWidth="2" />
        <path d="M-22 2 L0 -22 L22 2z" fill="#8a73c8" />
        <circle cx="0" cy="18" r="7" fill="#f5cb78" />
      </g>
      <g transform="translate(70 92)">
        {[0, 1, 2].map((i) => (
          <rect key={i} x={-18 + i * 4} y={-4 - i * 7} width="30" height="7" rx="2" fill={["#e7779f", "#6fb5e3", "#f5cb78"][i]} />
        ))}
      </g>
      <g transform="translate(150 128)" fill="none" stroke="#45365b" strokeWidth="1.5">
        <rect x="-10" y="-10" width="20" height="20" rx="3" fill="#fff7ed" />
        <path d="M-10 -3h20M-10 3h20M-3 -10v20M3 -10v20" opacity=".4" />
      </g>
    </>
  ),
  explorer: (
    <>
      <path d="M0 140 Q60 130 120 142 T300 136 V200 H0z" fill="#8fcaf0" />
      <path d="M0 158 Q75 150 150 160 T300 156 V200 H0z" fill="#6fb5e3" />
      <ellipse cx="70" cy="140" rx="46" ry="14" fill="#f5cb78" />
      <path d="M60 140 v-34" stroke="#9a6b4f" strokeWidth="4" />
      <path d="M60 106 q-20 -6 -26 6 M60 106 q18 -10 28 2 M60 110 q-12 8 -18 18" stroke="#3a9474" strokeWidth="6" fill="none" strokeLinecap="round" />
      <g transform="translate(200 120)" style={{ animation: "legend-float 4s ease-in-out infinite", transformBox: "fill-box" }}>
        <path d="M-34 12 h68 l-10 14 h-48z" fill="#c49a83" />
        <path d="M0 10 v-48" stroke="#745d64" strokeWidth="3" />
        <path d="M2 -36 q28 18 0 40z" fill="#fff7ed" />
        <path d="M-2 -30 q-22 14 0 32z" fill="#fde4ee" />
        <path d="M0 -38 l12 4 -12 4" fill="#e7779f" />
      </g>
      <g transform="translate(250 50)">
        <circle r="18" fill="#fff7ed" stroke="#3a9474" strokeWidth="2" />
        <path d="M0 -14 l4 14 -4 14 -4 -14z" fill="#e7779f" />
      </g>
    </>
  ),
  science: (
    <>
      <path d="M0 150 Q90 132 180 150 T300 145 V200 H0z" fill="#b8ddf5" />
      <g transform="translate(150 60)" fill="none" stroke="#3a9474" strokeWidth="2.5">
        <ellipse rx="40" ry="14" />
        <ellipse rx="40" ry="14" transform="rotate(60)" />
        <ellipse rx="40" ry="14" transform="rotate(120)" />
        <circle r="6" fill="#f39bbb" stroke="none" />
      </g>
      <g transform="translate(70 120)">
        <path d="M-8 -30 h16 v14 l14 28 a6 6 0 0 1 -6 8 h-32 a6 6 0 0 1 -6 -8 l14 -28z" fill="#e3f5ee" stroke="#3a9474" strokeWidth="2" />
        <path d="M-16 8 h32 l4 6 h-40z" fill="#6cc3a2" />
      </g>
      <circle cx="240" cy="40" r="14" fill="#f5cb78" />
    </>
  ),
  money: (
    <>
      <path d="M0 150 Q90 135 180 150 T300 146 V200 H0z" fill="#bce5d5" />
      {[[80, 100], [150, 90], [220, 104]].map(([x, y], i) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <rect x="-24" y="0" width="48" height="50" fill="#fff7ed" stroke="#d9a440" strokeWidth="2" />
          <path d="M-30 2 L0 -24 L30 2z" fill={["#e7779f", "#d9a440", "#6fb5e3"][i]} />
        </g>
      ))}
      {[[60, 60], [240, 50], [150, 40]].map(([x, y], i) => (
        <g key={x} style={{ animation: `legend-float ${3 + i}s ease-in-out ${i * 0.5}s infinite`, transformBox: "fill-box" }}>
          <circle cx={x} cy={y} r="10" fill="#f5cb78" stroke="#d9a440" strokeWidth="2" />
          <path d={`M${x - 3} ${y - 4} h6 M${x} ${y - 6} v12 M${x - 3} ${y + 4} h6`} stroke="#d9a440" strokeWidth="1.5" />
        </g>
      ))}
    </>
  ),
  tech: (
    <>
      {[30, 70, 120, 170, 220, 260].map((x, i) => (
        <rect key={x} x={x} y={150 - (40 + ((i * 37) % 60))} width="34" height={40 + ((i * 37) % 60) + 50} fill={i % 2 ? "#6a5583" : "#45365b"} />
      ))}
      {[38, 80, 128, 178, 228, 268].map((x, i) =>
        [0, 1, 2].map((r) => <rect key={`${x}-${r}`} x={x} y={130 - r * 14 - ((i * 37) % 30)} width="6" height="5" fill={r % 2 ? "#6fb5e3" : "#f5cb78"} opacity=".9" />),
      )}
      <path d="M0 175 H300" stroke="#6fb5e3" strokeWidth="2" strokeDasharray="6 6" />
      <circle cx="240" cy="36" r="12" fill="#e5f3fc" />
    </>
  ),
};

export function WorldScene({ subject, className, locked }: { subject: string; className?: string; locked?: boolean }) {
  const theme = WORLD_THEMES[subject] ?? WORLD_THEMES.english;
  const id = `sky-${subject}`;
  return (
    <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" className={cn("h-full w-full", locked && "grayscale-[0.55]", className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.sky[0]} />
          <stop offset="1" stopColor={theme.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="300" height="200" fill={`url(#${id})`} />
      <Cloud x={60} y={36} delay={0} />
      <Cloud x={230} y={60} s={0.8} delay={1.2} />
      <Sparkles color={subject === "tech" ? "#f5cb78" : "#ffffff"} />
      {SCENES[subject]}
    </svg>
  );
}

const LOCATION_COLORS: Record<string, [string, string]> = {
  village: ["#ffd6c2", "#e7779f"],
  garden: ["#bce5d5", "#3a9474"],
  library: ["#efeafb", "#8a73c8"],
  cafe: ["#fbe3b1", "#c49a83"],
  forest: ["#bce5d5", "#3a9474"],
  castle: ["#efeafb", "#a995dc"],
  mountain: ["#e5f3fc", "#6fb5e3"],
  temple: ["#fff0e8", "#d45a5a"],
  harbor: ["#e5f3fc", "#3a7fb5"],
  island: ["#fbe3b1", "#3a9474"],
  lab: ["#e3f5ee", "#3a9474"],
  market: ["#fff7e0", "#d9a440"],
  city: ["#e5f3fc", "#45365b"],
  observatory: ["#efeafb", "#45365b"],
  bamboo: ["#e3f5ee", "#3a9474"],
  lantern_street: ["#fff0e8", "#d45a5a"],
};

export function LocationArt({ location, className }: { location: string; className?: string }) {
  const [bg, fg] = LOCATION_COLORS[location] ?? LOCATION_COLORS.village;
  const roof = <path d="M-16 0 L0 -14 L16 0z" fill={fg} />;
  const shapes: Record<string, ReactNode> = {
    village: (
      <>
        {[-22, 0, 22].map((x, i) => (
          <g key={x} transform={`translate(${x} ${8 - (i % 2) * 6})`}>
            <rect x="-10" y="0" width="20" height="16" fill="#fff7ed" />
            {roof}
          </g>
        ))}
      </>
    ),
    garden: (
      <>
        {[-20, 0, 20].map((x, i) => (
          <g key={x} transform={`translate(${x} 10)`}>
            <rect x="-1.5" y="0" width="3" height="12" fill="#3a9474" />
            <circle cy="-2" r="6" fill={["#f39bbb", "#f5cb78", "#c7b8ea"][i]} />
          </g>
        ))}
      </>
    ),
    library: (
      <g transform="translate(0 6)">
        <rect x="-24" y="-12" width="48" height="26" fill="#fff7ed" stroke={fg} strokeWidth="2" />
        {[-18, -10, -2, 6, 14].map((x, i) => (
          <rect key={x} x={x} y="-8" width="5" height="18" fill={["#e7779f", "#8a73c8", "#6cc3a2", "#f5cb78", "#6fb5e3"][i]} />
        ))}
      </g>
    ),
    cafe: (
      <g transform="translate(0 6)">
        <rect x="-20" y="-6" width="40" height="22" fill="#fff7ed" />
        <path d="M-24 -6 h48 l-4 -8 h-40z" fill={fg} />
        <path d="M-8 6 h12 v6 a6 6 0 0 1 -12 0z M4 8 q6 0 4 4" fill="#c49a83" stroke="#c49a83" />
      </g>
    ),
    forest: (
      <>
        {[-20, 0, 20].map((x, i) => (
          <path key={x} d={`M${x} ${-14 + (i % 2) * 6} l12 26 h-24z`} fill={i % 2 ? "#6cc3a2" : fg} />
        ))}
      </>
    ),
    castle: (
      <g transform="translate(0 4)">
        <rect x="-18" y="-6" width="36" height="22" fill="#fff7ed" stroke={fg} strokeWidth="2" />
        <rect x="-24" y="-16" width="10" height="32" fill="#fff7ed" stroke={fg} strokeWidth="2" />
        <rect x="14" y="-16" width="10" height="32" fill="#fff7ed" stroke={fg} strokeWidth="2" />
        <path d="M-26 -16 l7 -10 7 10z M12 -16 l7 -10 7 10z" fill="#e7779f" />
      </g>
    ),
    mountain: (
      <>
        <path d="M-30 16 L-8 -16 L8 6 L16 -6 L32 16z" fill={fg} />
        <path d="M-14 -7 L-8 -16 L-2 -7z" fill="#fff" />
      </>
    ),
    temple: (
      <g transform="translate(0 6)">
        <rect x="-14" y="-4" width="28" height="18" fill="#fff0e8" stroke={fg} strokeWidth="2" />
        <path d="M-24 -2 Q0 -18 24 -2 L18 -8 Q0 -20 -18 -8z" fill={fg} />
      </g>
    ),
    harbor: (
      <>
        <path d="M-30 12 h60 v8 h-60z" fill="#6fb5e3" />
        <path d="M-12 8 h24 l-4 6 h-16z" fill="#c49a83" />
        <path d="M0 8 v-22" stroke="#745d64" strokeWidth="2" />
        <path d="M1 -12 q12 8 0 18z" fill="#fff7ed" />
      </>
    ),
    island: (
      <>
        <ellipse cy="14" rx="28" ry="7" fill="#f5cb78" />
        <path d="M-4 12 v-22" stroke="#9a6b4f" strokeWidth="3" />
        <path d="M-4 -10 q-14 -4 -18 4 M-4 -10 q12 -8 20 2" stroke={fg} strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
    lab: (
      <g transform="translate(0 4)">
        <path d="M-6 -16 h12 v10 l10 20 h-32 l10 -20z" fill="#e3f5ee" stroke={fg} strokeWidth="2" />
        <circle cx="-2" cy="8" r="3" fill="#f39bbb" />
      </g>
    ),
    market: (
      <>
        {[-18, 18].map((x) => (
          <g key={x} transform={`translate(${x} 4)`}>
            <rect x="-12" y="0" width="24" height="14" fill="#fff7ed" />
            <path d="M-14 0 h28 l-3 -8 h-22z" fill={fg} />
          </g>
        ))}
      </>
    ),
    city: (
      <>
        {[-24, -10, 4, 18].map((x, i) => (
          <rect key={x} x={x} y={-10 + (i % 2) * 8} width="12" height={28 - (i % 2) * 8} fill={i % 2 ? "#6a5583" : fg} />
        ))}
      </>
    ),
    observatory: (
      <g transform="translate(0 6)">
        <rect x="-16" y="0" width="32" height="14" fill="#efeafb" />
        <path d="M-16 0 a16 16 0 0 1 32 0z" fill={fg} />
        <path d="M2 -10 l12 -10" stroke="#f5cb78" strokeWidth="3" />
      </g>
    ),
    bamboo: (
      <>
        {[-16, -6, 6, 16].map((x, i) => (
          <g key={x}>
            <rect x={x} y={-16 + (i % 2) * 4} width="4" height="34" fill={i % 2 ? "#6cc3a2" : fg} />
            <path d={`M${x + 2} ${-6 + i * 2} q8 -4 12 0`} stroke="#3a9474" strokeWidth="2" fill="none" />
          </g>
        ))}
      </>
    ),
    lantern_street: (
      <>
        <path d="M-30 -10 Q0 4 30 -10" stroke="#5b2b2b" strokeWidth="1" fill="none" />
        {[-18, 0, 18].map((x) => (
          <g key={x} transform={`translate(${x} ${x === 0 ? -2 : -6})`}>
            <ellipse cy="6" rx="6" ry="8" fill={fg} />
            <rect x="-4" y="-3" width="8" height="2" fill="#f5cb78" />
          </g>
        ))}
        <rect x="-26" y="12" width="52" height="6" rx="3" fill="#c49a83" />
      </>
    ),
  };
  return (
    <svg viewBox="-36 -30 72 56" className={className} aria-hidden>
      <rect x="-36" y="-30" width="72" height="56" rx="14" fill={bg} />
      {shapes[location] ?? shapes.village}
    </svg>
  );
}

export function WorldIcon({ subject, size = 28 }: { subject: string; size?: number }) {
  const theme = WORLD_THEMES[subject] ?? WORLD_THEMES.english;
  const glyph: Record<string, ReactNode> = {
    english: <path d="M9 22V10h7a4 4 0 0 1 0 8H9m0-4h8" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />,
    chinese: <path d="M16 7v18M9 12h14M10 20h12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />,
    brain: <path d="M12 10a4 4 0 0 1 8 0c3 0 4 3 3 5 2 2 1 6-3 6h-8c-4 0-5-4-3-6-1-2 0-5 3-5z" fill="#fff" />,
    explorer: <path d="M16 7l3 9-3 9-3-9z M7 16h18" stroke="#fff" strokeWidth="2" fill="#fff" />,
    science: <path d="M13 7h6M14 7v6l-5 9h14l-5-9V7" stroke="#fff" strokeWidth="2" fill="none" strokeLinejoin="round" />,
    money: <path d="M16 8v16M20 11h-6a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-6" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />,
    tech: <path d="M12 11l-5 5 5 5M20 11l5 5-5 5M18 9l-4 14" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />,
  };
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <circle cx="16" cy="16" r="15" fill={theme.accent} />
      {glyph[subject]}
    </svg>
  );
}
