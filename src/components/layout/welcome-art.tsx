export function WelcomeArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 260" className={className} role="img" aria-label="Two chibi characters sitting together by a window at sunset">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c7b8ea" />
          <stop offset=".55" stopColor="#f8bbd0" />
          <stop offset="1" stopColor="#ffd6c2" />
        </linearGradient>
        <radialGradient id="glow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff7ed" stopOpacity=".9" />
          <stop offset="1" stopColor="#fff7ed" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="60" y="14" width="240" height="150" rx="26" fill="#fff7ed" />
      <rect x="74" y="28" width="212" height="122" rx="18" fill="url(#sky)" />
      <circle cx="232" cy="96" r="26" fill="#fff0e8" />
      <circle cx="232" cy="96" r="60" fill="url(#glow)" />
      <path d="M74 120c30-14 52-10 80 0s58 10 80-4 40-8 52 0v34H74z" fill="#bce5d5" opacity=".8" />
      <path d="M74 132c40-10 70-6 106 4s70 4 106-6v20H74z" fill="#6cc3a2" opacity=".55" />
      <g fill="#fff" opacity=".9">
        <circle cx="110" cy="52" r="2" />
        <circle cx="150" cy="40" r="1.5" />
        <circle cx="190" cy="58" r="1.8" />
      </g>
      <rect x="176" y="28" width="8" height="122" fill="#fff7ed" />
      <rect x="74" y="86" width="212" height="6" fill="#fff7ed" />
      <path d="M40 196h280l-14 40H54z" fill="#c7b8ea" />
      <rect x="44" y="176" width="272" height="30" rx="15" fill="#a995dc" />
      <rect x="54" y="150" width="252" height="36" rx="18" fill="#c7b8ea" />
      <g>
        <ellipse cx="138" cy="200" rx="34" ry="8" fill="#45365b" opacity=".12" />
        <rect x="114" y="150" width="46" height="44" rx="18" fill="#f8bbd0" />
        <circle cx="137" cy="122" r="34" fill="#ffe3d3" />
        <path d="M103 122c0-24 16-38 34-38s34 14 34 38c-6-12-18-18-34-18s-28 6-34 18z" fill="#5b4256" />
        <path d="M104 120c-4 18 0 36 8 44 2-14 0-30-8-44zM170 120c4 18 0 36-8 44-2-14 0-30 8-44z" fill="#5b4256" />
        <ellipse cx="126" cy="128" rx="4.5" ry="6" fill="#45365b" />
        <ellipse cx="149" cy="128" rx="4.5" ry="6" fill="#45365b" />
        <circle cx="127.5" cy="125.5" r="1.8" fill="#fff" />
        <circle cx="150.5" cy="125.5" r="1.8" fill="#fff" />
        <ellipse cx="118" cy="139" rx="6" ry="3.5" fill="#f39bbb" opacity=".6" />
        <ellipse cx="157" cy="139" rx="6" ry="3.5" fill="#f39bbb" opacity=".6" />
        <path d="M132 141c3 3 8 3 11 0" stroke="#45365b" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M160 92c4-6 12-6 14 0-2 6-10 6-14 0z" fill="#e7779f" />
      </g>
      <g>
        <ellipse cx="222" cy="200" rx="34" ry="8" fill="#45365b" opacity=".12" />
        <rect x="198" y="150" width="46" height="44" rx="18" fill="#bce5d5" />
        <circle cx="221" cy="122" r="34" fill="#f6d2bf" />
        <path d="M187 120c0-22 14-36 34-36s34 14 34 36l-8-8-6 6-8-10-8 8-8-10-8 10-6-6z" fill="#3e3550" />
        <path d="M210 128c0-3 2-5 5-5s5 2 5 5M224 128c0-3 2-5 5-5s5 2 5 5" stroke="#45365b" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <ellipse cx="203" cy="139" rx="6" ry="3.5" fill="#f39bbb" opacity=".55" />
        <ellipse cx="240" cy="139" rx="6" ry="3.5" fill="#f39bbb" opacity=".55" />
        <path d="M215 141c3 3 8 3 11 0" stroke="#45365b" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
      <path d="M180 66c-7-4.4-10-7.6-10-11 0-2.8 2.2-5 4.8-5 2 0 3.8 1 5.2 2.8 1.4-1.8 3.2-2.8 5.2-2.8 2.6 0 4.8 2.2 4.8 5 0 3.4-3 6.6-10 11z" fill="#e7779f" className="origin-center animate-[float_3s_ease-in-out_infinite]" />
    </svg>
  );
}
