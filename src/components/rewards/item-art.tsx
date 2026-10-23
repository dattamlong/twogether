import type { ReactNode } from "react";
import { GiftIcon, HeartIcon, SparkleIcon } from "@/components/ui/icons";

const Pot = ({ color = "#ffd6c2" }: { color?: string }) => (
  <>
    <ellipse cx="32" cy="58" rx="14" ry="3" fill="#45365b" opacity=".12" />
    <path d="M20 40h24l-3 17H23z" fill={color} stroke="#45365b" strokeOpacity=".3" />
    <ellipse cx="32" cy="40" rx="12" ry="3" fill="#00000018" />
  </>
);

const Block = ({ top, left, right, y = 30, h = 18 }: { top: string; left: string; right: string; y?: number; h?: number }) => (
  <>
    <path d={`M12 ${y} L32 ${y + 10} L32 ${y + 10 + h} L12 ${y + h} Z`} fill={left} />
    <path d={`M52 ${y} L32 ${y + 10} L32 ${y + 10 + h} L52 ${y + h} Z`} fill={right} />
    <path d={`M12 ${y} L32 ${y - 10} L52 ${y} L32 ${y + 10} Z`} fill={top} />
  </>
);

const ART: Record<string, ReactNode> = {
  floor_lamp: (
    <>
      <ellipse cx="32" cy="58" rx="9" ry="3" fill="#8a73c8" />
      <path d="M32 58V22" stroke="#45365b" strokeWidth="2.5" opacity=".7" />
      <circle cx="32" cy="16" r="16" fill="#fbe3b1" opacity=".5" />
      <path d="M18 24h28l-6-16H24z" fill="#fff0e8" stroke="#45365b" strokeOpacity=".3" />
    </>
  ),
  golden_lamp: (
    <>
      <ellipse cx="32" cy="58" rx="9" ry="3" fill="#8a73c8" />
      <path d="M32 58V22" stroke="#45365b" strokeWidth="2.5" opacity=".7" />
      <circle cx="32" cy="16" r="18" fill="#f5cb78" opacity=".45" />
      <path d="M18 24h28l-6-16H24z" fill="#f5cb78" stroke="#d9a440" />
    </>
  ),
  magic_bookshelf: (
    <>
      <circle cx="32" cy="30" r="26" fill="#c7b8ea" opacity=".3" />
      <rect x="14" y="8" width="36" height="50" rx="3" fill="#8a73c8" />
      <rect x="18" y="12" width="28" height="19" fill="#6a5583" />
      <rect x="18" y="35" width="28" height="19" fill="#6a5583" />
      {["#f39bbb", "#f5cb78", "#6fb5e3", "#6cc3a2"].map((c, i) => (
        <rect key={c} x={20 + i * 6.5} y={15 + (i % 2) * 2} width="5" height={16 - (i % 2) * 2} fill={c} />
      ))}
      {["#6cc3a2", "#f39bbb", "#f5cb78"].map((c, i) => (
        <rect key={c} x={21 + i * 8} y={38 + (i % 2) * 2} width="6" height={16 - (i % 2) * 2} fill={c} />
      ))}
      <path d="M50 6l1.5 3.5L55 11l-3.5 1.5L50 16l-1.5-3.5L45 11l3.5-1.5z" fill="#f5cb78" />
    </>
  ),
  vintage_lamp: (
    <>
      <circle cx="36" cy="22" r="20" fill="#fbe3b1" opacity=".5" />
      <ellipse cx="28" cy="56" rx="12" ry="3.5" fill="#b3866f" />
      <path d="M28 54L36 28" stroke="#d9a440" strokeWidth="3" />
      <path d="M26 30l24-6-6-14-16 6z" fill="#6cc3a2" stroke="#3a9474" />
    </>
  ),
  fantasy_globe: (
    <>
      <ellipse cx="32" cy="57" rx="12" ry="3.5" fill="#b3866f" />
      <rect x="30" y="44" width="4" height="12" fill="#d9a440" />
      <circle cx="32" cy="26" r="18" fill="#6fb5e3" stroke="#d9a440" strokeWidth="2.5" />
      <path d="M22 20c4-4 10-2 10 3s-6 4-8 8M38 30c3-2 6 0 5 4" fill="#6cc3a2" />
      <circle cx="42" cy="16" r="2.5" fill="#fff" />
    </>
  ),
  vintage_typewriter: (
    <>
      <path d="M20 14h24l2 20H18z" fill="#fff7ed" stroke="#45365b" strokeOpacity=".3" />
      <path d="M24 20h16M24 25h12" stroke="#a995dc" strokeWidth="1.5" />
      <rect x="10" y="32" width="44" height="20" rx="5" fill="#45365b" />
      {[16, 23, 30, 37, 44].map((x) => (
        <circle key={x} cx={x + 2} cy="42" r="2.5" fill="#fff7ed" />
      ))}
    </>
  ),
  paper_lantern: (
    <>
      <circle cx="32" cy="32" r="22" fill="#fbe3b1" opacity=".5" />
      <path d="M32 4v8" stroke="#9a6b4f" strokeWidth="2" />
      <rect x="24" y="10" width="16" height="5" rx="1" fill="#d9a440" />
      <ellipse cx="32" cy="32" rx="16" ry="18" fill="#e7553f" />
      <path d="M32 14v36M24 16c-4 10-4 22 0 32M40 16c4 10 4 22 0 32" stroke="#b2405c" strokeWidth="1" fill="none" />
      <rect x="24" y="48" width="16" height="5" rx="1" fill="#d9a440" />
      <path d="M32 53v8" stroke="#d9a440" strokeWidth="2" />
    </>
  ),
  bamboo_pot: (
    <>
      <path d="M26 42V10M32 42V4M38 42V14" stroke="#6cc3a2" strokeWidth="4" />
      <path d="M24 20h4M30 16h4M36 26h4M24 32h4M30 28h4" stroke="#3a9474" strokeWidth="1.5" />
      <path d="M38 14c6-2 9 0 12 3M32 6c-6-2-10 0-12 4" stroke="#3a9474" strokeWidth="3" fill="none" strokeLinecap="round" />
      <Pot color="#fff7ed" />
    </>
  ),
  scroll_stand: (
    <>
      <path d="M14 58V6M50 58V6" stroke="#9a6b4f" strokeWidth="3" />
      <rect x="10" y="54" width="44" height="5" rx="2" fill="#9a6b4f" />
      <rect x="17" y="10" width="30" height="40" fill="#fff7ed" stroke="#d9a440" />
      <circle cx="32" cy="30" r="8" fill="none" stroke="#e7553f" strokeWidth="2.5" />
      <path d="M26 30h12" stroke="#45365b" strokeWidth="2" />
    </>
  ),
  puzzle_cube: <Block top="#f5cb78" left="#c7b8ea" right="#6fb5e3" y={22} h={26} />,
  treasure_map_table: (
    <>
      <path d="M16 36v20M48 36v20" stroke="#9a6b4f" strokeWidth="4" />
      <Block top="#c49a83" left="#b3866f" right="#9a6b4f" y={30} h={4} />
      <path d="M20 30l12-6 12 6-12 6z" fill="#fbe3b1" />
      <path d="M25 30q6-4 12 0" stroke="#e7553f" strokeWidth="1.4" fill="none" />
      <path d="M35 27l3 3M38 27l-3 3" stroke="#e7553f" strokeWidth="1.6" />
    </>
  ),
  love_letter_box: (
    <>
      <circle cx="32" cy="34" r="24" fill="#f8bbd0" opacity=".3" />
      <rect x="18" y="12" width="28" height="20" rx="2" fill="#fff7ed" stroke="#e7779f" transform="rotate(-6 32 22)" />
      <rect x="12" y="28" width="40" height="26" rx="5" fill="#f8bbd0" stroke="#e7779f" />
      <path d="M32 48c-6-4-8-7-8-10 0-2.5 2-4.5 4-4.5 1.6 0 3 .8 4 2.3 1-1.5 2.4-2.3 4-2.3 2 0 4 2 4 4.5 0 3-2 6-8 10z" fill="#e7779f" />
    </>
  ),
  armchair: (
    <>
      <Block top="#e3f5ee" left="#bce5d5" right="#9fd8c2" y={34} h={14} />
      <path d="M14 18h36v16H14z" fill="#6cc3a2" rx="4" />
      <rect x="22" y="30" width="20" height="8" rx="3" fill="#fff7ed" />
    </>
  ),
  side_table: (
    <>
      <rect x="30" y="34" width="4" height="22" fill="#c49a83" />
      <ellipse cx="32" cy="32" rx="18" ry="7" fill="#e8c6a8" stroke="#45365b" strokeOpacity=".25" />
      <rect x="22" y="22" width="6" height="8" rx="2" fill="#fff" />
      <rect x="34" y="22" width="6" height="8" rx="2" fill="#f8bbd0" />
    </>
  ),
  beanbag: (
    <>
      <ellipse cx="32" cy="56" rx="22" ry="5" fill="#45365b" opacity=".12" />
      <ellipse cx="32" cy="42" rx="22" ry="15" fill="#ffd6c2" stroke="#45365b" strokeOpacity=".25" />
      <ellipse cx="28" cy="36" rx="12" ry="6" fill="#fff0e8" />
    </>
  ),
  aquarium: (
    <>
      <rect x="6" y="44" width="52" height="10" rx="2" fill="#c49a83" />
      <rect x="8" y="16" width="48" height="28" rx="3" fill="#b8ddf5" stroke="#6fb5e3" strokeWidth="2" />
      <ellipse cx="24" cy="30" rx="5" ry="3" fill="#f6a88a" />
      <path d="M19 30l-4-3v6z" fill="#f6a88a" />
      <ellipse cx="40" cy="24" rx="5" ry="3" fill="#f8bbd0" />
      <path d="M45 24l4-3v6z" fill="#f8bbd0" />
    </>
  ),
  cactus: (
    <>
      <Pot color="#c7b8ea" />
      <rect x="27" y="14" width="10" height="27" rx="5" fill="#6cc3a2" stroke="#3a9474" />
      <rect x="36" y="22" width="8" height="5" rx="2.5" fill="#6cc3a2" />
      <circle cx="32" cy="13" r="3" fill="#f39bbb" />
    </>
  ),
  monstera: (
    <>
      <Pot color="#fff7ed" />
      <ellipse cx="24" cy="26" rx="9" ry="14" transform="rotate(-30 24 26)" fill="#3a9474" />
      <ellipse cx="40" cy="24" rx="9" ry="14" transform="rotate(30 40 24)" fill="#3a9474" />
      <ellipse cx="32" cy="16" rx="8" ry="13" fill="#6cc3a2" />
    </>
  ),
  sunflower_pot: (
    <>
      <Pot color="#fde4ee" />
      <path d="M32 40V18" stroke="#3a9474" strokeWidth="3" />
      {Array.from({ length: 10 }, (_, i) => (
        <ellipse key={i} cx={32 + Math.cos((i / 10) * Math.PI * 2) * 8} cy={16 + Math.sin((i / 10) * Math.PI * 2) * 8} rx="4" ry="2.6" fill="#f5cb78" transform={`rotate(${i * 36} ${32 + Math.cos((i / 10) * Math.PI * 2) * 8} ${16 + Math.sin((i / 10) * Math.PI * 2) * 8})`} />
      ))}
      <circle cx="32" cy="16" r="5" fill="#9a6b4f" />
    </>
  ),
  bonsai: (
    <>
      <Pot color="#c7b8ea" />
      <path d="M32 40c-6-8 6-12 0-20" stroke="#745d64" strokeWidth="4" fill="none" />
      <circle cx="24" cy="18" r="9" fill="#6cc3a2" />
      <circle cx="40" cy="16" r="10" fill="#3a9474" />
      <circle cx="32" cy="10" r="8" fill="#6cc3a2" />
    </>
  ),
  teddy_bear: (
    <>
      <circle cx="22" cy="14" r="5" fill="#d8a985" />
      <circle cx="42" cy="14" r="5" fill="#d8a985" />
      <ellipse cx="32" cy="46" rx="14" ry="13" fill="#d8a985" />
      <circle cx="32" cy="24" r="12" fill="#d8a985" />
      <ellipse cx="32" cy="28" rx="5" ry="4" fill="#fff0e8" />
      <circle cx="27" cy="22" r="1.6" fill="#45365b" />
      <circle cx="37" cy="22" r="1.6" fill="#45365b" />
      <path d="M28 37l4 4 4-4z" fill="#e7779f" />
    </>
  ),
  star_lamp: (
    <>
      <circle cx="32" cy="28" r="22" fill="#fbe3b1" opacity=".5" />
      <path d="M32 10l5 11 12 1-9 8 3 12-11-7-11 7 3-12-9-8 12-1z" fill="#f5cb78" stroke="#d9a440" />
      <rect x="24" y="50" width="16" height="6" rx="2" fill="#c7b8ea" />
    </>
  ),
  heart_lantern: (
    <>
      <circle cx="32" cy="28" r="22" fill="#f8bbd0" opacity=".5" />
      <HeartGlyph />
      <rect x="24" y="50" width="16" height="6" rx="2" fill="#c7b8ea" />
    </>
  ),
  photo_stand: (
    <>
      <rect x="16" y="12" width="32" height="38" rx="3" fill="#fff7ed" stroke="#c49a83" strokeWidth="4" />
      <rect x="21" y="17" width="22" height="28" fill="#fde4ee" />
      <circle cx="28" cy="28" r="4" fill="#e7779f" />
      <circle cx="36" cy="28" r="4" fill="#8a73c8" />
      <rect x="20" y="52" width="24" height="4" rx="2" fill="#c49a83" />
    </>
  ),
  cat_bed: (
    <>
      <ellipse cx="32" cy="46" rx="24" ry="12" fill="#c7b8ea" />
      <ellipse cx="32" cy="42" rx="18" ry="8" fill="#efeafb" />
      <ellipse cx="30" cy="38" rx="13" ry="8" fill="#f6a88a" />
      <circle cx="41" cy="32" r="7" fill="#f6a88a" />
      <path d="M36 27l2-7 4 5zM42 25l4-6 1 7z" fill="#f6a88a" />
      <path d="M38 32q2 1.5 4 0" stroke="#45365b" strokeWidth="1.2" fill="none" />
    </>
  ),
  cushion_pile: (
    <>
      <rect x="10" y="40" width="44" height="14" rx="7" fill="#f8bbd0" />
      <rect x="16" y="28" width="32" height="14" rx="7" fill="#bce5d5" />
      <rect x="22" y="17" width="20" height="13" rx="6" fill="#fbe3b1" />
    </>
  ),
  hoodie_lavender: <Shirt color="#c7b8ea" accent="#a995dc" />,
  sweater_mint: <Shirt color="#bce5d5" accent="#6cc3a2" />,
  yukata_sakura: <Shirt color="#fde4ee" accent="#e7779f" />,
  bow: <path d="M32 32 L12 18 V46 Z M32 32 L52 18 V46 Z" fill="#e7779f" stroke="#d45a86" strokeWidth="2" strokeLinejoin="round" />,
  glasses: (
    <g stroke="#45365b" strokeWidth="3" fill="#e5f3fc">
      <circle cx="20" cy="32" r="11" />
      <circle cx="44" cy="32" r="11" />
      <path d="M31 32h2" fill="none" />
    </g>
  ),
  flower_crown: (
    <>
      <path d="M8 40 Q32 22 56 40" stroke="#6cc3a2" strokeWidth="3" fill="none" />
      {[10, 20, 32, 44, 54].map((x, i) => (
        <circle key={x} cx={x} cy={38 - (i === 2 ? 8 : i % 4 === 0 ? 0 : 5)} r="6" fill={i % 2 ? "#f8bbd0" : "#fbe3b1"} />
      ))}
    </>
  ),
  beanie: (
    <>
      <path d="M12 42a20 20 0 0 1 40 0z" fill="#a995dc" />
      <rect x="10" y="40" width="44" height="10" rx="4" fill="#8a73c8" />
      <circle cx="32" cy="18" r="6" fill="#fff7ed" />
    </>
  ),
};

function HeartGlyph() {
  return <path d="M32 46c-12-8-16-14-16-20 0-5 4-9 8-9 3 0 6 2 8 5 2-3 5-5 8-5 4 0 8 4 8 9 0 6-4 12-16 20z" fill="#f39bbb" stroke="#e7779f" strokeWidth="1.5" />;
}

function Shirt({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <path d="M22 10 L12 16 L6 30 L14 33 L16 26 V56 H48 V26 L50 33 L58 30 L52 16 L42 10 Q32 18 22 10Z" fill={color} stroke="#45365b" strokeOpacity=".3" strokeWidth="1.5" />
      <path d="M22 10 Q32 18 42 10" stroke={accent} strokeWidth="3" fill="none" />
      <rect x="16" y="44" width="32" height="5" fill={accent} opacity=".6" />
    </>
  );
}

const TROPHY_COLORS: Record<string, string> = {
  legend_trophy: "#f5cb78",
  tier_trophy_gold: "#f5cb78",
  tier_trophy_diamond: "#b8ddf5",
  tier_trophy_sakura: "#f39bbb",
  tier_trophy_eternal: "#c7b8ea",
};

export function ItemArt({ itemId, size = 64, className }: { itemId: string; size?: number; className?: string }) {
  if (TROPHY_COLORS[itemId]) {
    return (
      <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
        <circle cx="32" cy="26" r="24" fill={TROPHY_COLORS[itemId]} opacity=".25" />
        <path d="M18 10h28c0 14-6 22-14 22S18 24 18 10z" fill={TROPHY_COLORS[itemId]} stroke="#45365b" strokeOpacity=".3" strokeWidth="1.5" />
        <path d="M18 14h-6c0 7 4 10 8 11M46 14h6c0 7-4 10-8 11" fill="none" stroke={TROPHY_COLORS[itemId]} strokeWidth="3" />
        <rect x="29" y="32" width="6" height="10" fill={TROPHY_COLORS[itemId]} />
        <rect x="20" y="42" width="24" height="10" rx="3" fill="#8a73c8" />
        <path d="M32 24c-4-2.5-5.5-4.5-5.5-6.4 0-1.6 1.3-2.8 2.7-2.8 1.1 0 2.1.6 2.8 1.6.7-1 1.7-1.6 2.8-1.6 1.4 0 2.7 1.2 2.7 2.8 0 1.9-1.5 3.9-5.5 6.4z" fill="#fff" />
      </svg>
    );
  }
  if (itemId.startsWith("gift_")) {
    const glyph = itemId === "gift_rose" ? <HeartIcon size={size} /> : <GiftIcon size={size} />;
    return <span className={className}>{glyph}</span>;
  }
  if (itemId.startsWith("emote_")) return <span className={className}>{itemId === "emote_heart_burst" ? <HeartIcon size={size} /> : <SparkleIcon size={size} />}</span>;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
      {ART[itemId] ?? <Block top="#efeafb" left="#c7b8ea" right="#a995dc" />}
    </svg>
  );
}
