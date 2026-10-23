import type { Avatar } from "@/features/session/types";
import { cn } from "@/lib/utils";

const HAIR_FRONT: Record<Avatar["hair"], string> = {
  bob: "M14 32 L15 18 L49 18 L50 32 L45 26 L41 29 L36 25 L31 29 L26 25 L21 28 L18 25 Z",
  long: "M14 32 L15 18 L49 18 L50 32 L45 26 L41 29 L36 25 L31 29 L26 25 L21 28 L18 25 Z",
  twintails: "M14 32 L15 18 L49 18 L50 32 L45 26 L41 29 L36 25 L31 29 L26 25 L21 28 L18 25 Z",
  bun: "M14 32 L15 18 L49 18 L50 32 L45 26 L41 29 L36 25 L31 29 L26 25 L21 28 L18 25 Z",
  spiky: "M14 30 L18 14 L24 22 L29 11 L34 21 L40 12 L44 22 L50 17 L50 29 L42 26 L36 31 L30 26 L23 30 L18 25 Z",
  short: "M14 31 L16 18 L48 18 L50 31 L44 27 L38 30 L32 26 L26 30 L20 27 Z",
};

export function AvatarFace({ avatar, size = 48, className, sleeping }: { avatar: Avatar; size?: number; className?: string; sleeping?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={cn("shrink-0", className)} aria-hidden>
      <circle cx="32" cy="32" r="31" fill="#fff7ed" />
      {avatar.hair === "long" ? <rect x="12" y="24" width="40" height="34" rx="14" fill={avatar.hairColor} /> : null}
      {avatar.hair === "bob" ? <rect x="12" y="22" width="40" height="24" rx="11" fill={avatar.hairColor} /> : null}
      {avatar.hair === "twintails" ? (
        <>
          <ellipse cx="9" cy="40" rx="6" ry="13" fill={avatar.hairColor} />
          <ellipse cx="55" cy="40" rx="6" ry="13" fill={avatar.hairColor} />
        </>
      ) : null}
      {avatar.hair === "bun" ? <circle cx="32" cy="12" r="8" fill={avatar.hairColor} /> : null}
      <rect x="20" y="48" width="24" height="16" rx="8" fill={avatar.outfitColor} />
      <ellipse cx="32" cy="34" rx="18" ry="16.5" fill={avatar.skin} stroke="#45365b" strokeOpacity=".35" strokeWidth="1.5" />
      <ellipse cx="32" cy="24" rx="19" ry="12" fill={avatar.hairColor} />
      <path d={HAIR_FRONT[avatar.hair]} fill={avatar.hairColor} />
      {sleeping ? (
        <>
          <path d="M21 36 q4 3 8 0 M35 36 q4 3 8 0" stroke="#45365b" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="25" cy="36" rx="3.4" ry="4.6" fill={avatar.eyes} />
          <ellipse cx="39" cy="36" rx="3.4" ry="4.6" fill={avatar.eyes} />
          <circle cx="26.3" cy="34.3" r="1.4" fill="#fff" />
          <circle cx="40.3" cy="34.3" r="1.4" fill="#fff" />
        </>
      )}
      <ellipse cx="21" cy="41" rx="3.6" ry="2.2" fill="#f39bbb" opacity=".55" />
      <ellipse cx="43" cy="41" rx="3.6" ry="2.2" fill="#f39bbb" opacity=".55" />
      <path d="M29 43 q3 2.8 6 0" stroke="#45365b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {avatar.accessory === "bow" ? <path d="M38 17 l9 -6 v13 z M38 17 l-9 -6 v13 z" fill="#e7779f" /> : null}
      {avatar.accessory === "glasses" ? (
        <g stroke="#45365b" strokeWidth="1.6" fill="none">
          <circle cx="25" cy="36" r="5" />
          <circle cx="39" cy="36" r="5" />
          <path d="M30 36 h4" />
        </g>
      ) : null}
      {avatar.accessory === "flower_crown" ? (
        <g>
          {[16, 24, 32, 40, 48].map((x, i) => (
            <circle key={x} cx={x} cy={16 + Math.abs(i - 2) * 1.5} r="3.2" fill={i % 2 ? "#f8bbd0" : "#fbe3b1"} />
          ))}
        </g>
      ) : null}
      {avatar.accessory === "beanie" ? (
        <g>
          <rect x="13" y="10" width="38" height="14" rx="7" fill="#a995dc" />
          <circle cx="32" cy="9" r="4" fill="#fff7ed" />
        </g>
      ) : null}
    </svg>
  );
}
