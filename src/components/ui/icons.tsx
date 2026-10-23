import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = ({ size = 24, ...props }: IconProps) => ({
  width: size,
  height: size,
  viewBox: "0 0 32 32",
  "aria-hidden": true as const,
  ...props,
});

export function CoinIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <ellipse cx="16" cy="17.5" rx="12" ry="11.5" fill="#d9a440" />
      <circle cx="16" cy="15.5" r="12" fill="#f5cb78" />
      <circle cx="16" cy="15.5" r="9" fill="#fbe3b1" />
      <path d="M16 21.5c-4.2-2.6-6-4.6-6-6.8 0-1.8 1.4-3.2 3.1-3.2 1.2 0 2.2.6 2.9 1.6.7-1 1.7-1.6 2.9-1.6 1.7 0 3.1 1.4 3.1 3.2 0 2.2-1.8 4.2-6 6.8z" fill="#e7779f" />
      <path d="M8.5 10.5a9 9 0 0 1 5-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".8" />
    </svg>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M16 28C6 21.5 3 16.6 3 11.8 3 7.5 6.3 4 10.4 4c2.4 0 4.3 1.2 5.6 3.1C17.3 5.2 19.2 4 21.6 4 25.7 4 29 7.5 29 11.8c0 4.8-3 9.7-13 16.2z" fill="#e7779f" />
      <path d="M16 25.5C8.5 20.4 6 16.4 6 12.3 6 9 8.4 6.8 11 6.8c2 0 3.6 1.2 5 3.4 1.4-2.2 3-3.4 5-3.4" fill="none" stroke="#f8bbd0" strokeWidth="2" strokeLinecap="round" />
      <circle cx="10" cy="11" r="2" fill="#fff" opacity=".85" />
    </svg>
  );
}

export function FlameIcon({ lit = true, ...props }: IconProps & { lit?: boolean }) {
  return (
    <svg {...base(props)}>
      <path d="M16 29c-6.1 0-10-4.1-10-9.6 0-5.3 4.3-8.2 5.6-13.4.3-1 1.6-1.3 2.2-.4 1 1.6 1.4 3.4 1.2 5.2 1.6-1.1 2.8-2.7 3.2-4.6.2-1 1.5-1.3 2.1-.5C23.6 9.6 26 14 26 19.4 26 24.9 22.1 29 16 29z" fill={lit ? "#f6a88a" : "#d7cfe3"} />
      <path d="M16 27c-3.4 0-5.6-2.3-5.6-5.4 0-3.3 2.6-5 3.6-8 .2-.6 1-.7 1.3-.2 1.6 2.4 2.4 2.6 3.6 1.4.4-.4 1.1-.2 1.2.4.5 1.6 1.5 3.4 1.5 6.4 0 3.1-2.2 5.4-5.6 5.4z" fill={lit ? "#f5cb78" : "#ece7f4"} />
      <ellipse cx="16" cy="23" rx="2.2" ry="2.8" fill={lit ? "#fff7ed" : "#fff"} />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M16 3.5l3.6 7.6 8.3 1-6.1 5.7 1.6 8.2L16 22l-7.4 4 1.6-8.2-6.1-5.7 8.3-1z" fill="#c7b8ea" stroke="#8a73c8" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12.5 12.5l2-1" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function EnergyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="16" cy="16" r="13" fill="#bce5d5" />
      <path d="M16 24c-5-3.3-7-5.8-7-8.5C9 13.5 10.6 12 12.5 12c1.4 0 2.6.7 3.5 1.9.9-1.2 2.1-1.9 3.5-1.9 1.9 0 3.5 1.5 3.5 3.5 0 2.7-2 5.2-7 8.5z" fill="#3a9474" />
      <path d="M24 6l1 2.4 2.4 1-2.4 1L24 13l-1-2.6-2.4-1 2.4-1z" fill="#fff" />
    </svg>
  );
}

export function SnowflakeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="16" cy="16" r="13" fill="#e5f3fc" />
      <g stroke="#6fb5e3" strokeWidth="2.2" strokeLinecap="round">
        <path d="M16 7v18M8.2 11.5l15.6 9M8.2 20.5l15.6-9" />
        <path d="M13.5 8.5L16 11l2.5-2.5M13.5 23.5L16 21l2.5 2.5" fill="none" />
      </g>
    </svg>
  );
}

export function HouseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 15L16 5l11 10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" fill="#ffd6c2" />
      <path d="M3 15.5L16 4l13 11.5" fill="none" stroke="#e7779f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="12.5" y="18" width="7" height="10" rx="2" fill="#c7b8ea" />
      <path d="M16 15.5c-1.8-1.1-2.6-2-2.6-3 0-.8.6-1.4 1.3-1.4.5 0 1 .3 1.3.7.3-.4.8-.7 1.3-.7.7 0 1.3.6 1.3 1.4 0 1-.8 1.9-2.6 3z" fill="#e7779f" />
    </svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7c4-1.6 8-1.2 12 1.4V27c-4-2.6-8-3-12-1.4z" fill="#c7b8ea" />
      <path d="M28 7c-4-1.6-8-1.2-12 1.4V27c4-2.6 8-3 12-1.4z" fill="#bce5d5" />
      <path d="M16 8.4V27" stroke="#45365b" strokeWidth="1.5" opacity=".3" />
      <path d="M7 11.5c2-.4 4-.2 6 .8M7 15.5c2-.4 4-.2 6 .8M19 12.3c2-1 4-1.2 6-.8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function GamepadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 9h14c3.9 0 6.5 3.6 6 8.4l-.5 4.6c-.4 3.4-4.4 4.6-6.5 2l-2.4-3H12.4L10 24c-2.1 2.6-6.1 1.4-6.5-2L3 17.4C2.5 12.6 5.1 9 9 9z" fill="#b8ddf5" />
      <path d="M9.5 13v6M6.5 16h6" stroke="#45365b" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="21.5" cy="14" r="1.8" fill="#e7779f" />
      <circle cx="24.5" cy="17.5" r="1.8" fill="#f5cb78" />
    </svg>
  );
}

export function GiftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="13" width="22" height="15" rx="2.5" fill="#f8bbd0" />
      <rect x="3.5" y="9" width="25" height="6" rx="2" fill="#e7779f" />
      <rect x="14" y="9" width="4" height="19" fill="#f5cb78" />
      <path d="M16 9c-2-4-7-5-7-2s4 2 7 2c3 0 7 1 7-2s-5-2-7 2z" fill="none" stroke="#d9a440" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function AlbumIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="4" width="22" height="25" rx="3" fill="#c7b8ea" />
      <rect x="9" y="8" width="14" height="11" rx="2" fill="#fff7ed" />
      <path d="M9 17l4-4 3 3 2-2 5 5H9z" fill="#bce5d5" />
      <circle cx="19.5" cy="11.5" r="1.6" fill="#f5cb78" />
      <path d="M16 26c-2.3-1.4-3.2-2.5-3.2-3.7 0-1 .8-1.7 1.6-1.7.7 0 1.2.4 1.6.9.4-.5.9-.9 1.6-.9.9 0 1.6.7 1.6 1.7 0 1.2-.9 2.3-3.2 3.7z" fill="#e7779f" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M16 3c1 6.5 3.5 9 10 10-6.5 1-9 3.5-10 10-1-6.5-3.5-9-10-10 6.5-1 9-3.5 10-10z" fill="#f5cb78" />
      <path d="M26 21c.4 2.4 1.3 3.3 3.7 3.7-2.4.4-3.3 1.3-3.7 3.7-.4-2.4-1.3-3.3-3.7-3.7 2.4-.4 3.3-1.3 3.7-3.7z" fill="#f8bbd0" />
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 4h14v7a7 7 0 0 1-14 0z" fill="#f5cb78" />
      <path d="M9 7H5c0 4 2 6 4.5 6.5M23 7h4c0 4-2 6-4.5 6.5" fill="none" stroke="#d9a440" strokeWidth="2" />
      <rect x="14" y="17" width="4" height="6" fill="#d9a440" />
      <rect x="9" y="23" width="14" height="5" rx="2" fill="#c7b8ea" />
      <path d="M12.5 7.5v3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="7" width="26" height="19" rx="3" fill="#fff7ed" stroke="#c7b8ea" strokeWidth="2" />
      <path d="M4 9l12 9 12-9" fill="none" stroke="#c7b8ea" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 23c-1.8-1.1-2.6-2-2.6-3 0-.8.6-1.4 1.3-1.4.5 0 1 .3 1.3.7.3-.4.8-.7 1.3-.7.7 0 1.3.6 1.3 1.4 0 1-.8 1.9-2.6 3z" fill="#e7779f" />
    </svg>
  );
}
