import { cn } from "@/lib/utils";

const tones = {
  sakura: "from-sakura-300 to-sakura-400",
  lavender: "from-lavender-200 to-lavender-400",
  mint: "from-mint-200 to-mint-400",
  gold: "from-gold-200 to-gold-500",
  sky: "from-sky-200 to-sky-400",
};

export function ProgressBar({
  value,
  max = 1,
  tone = "sakura",
  className,
  label,
}: {
  value: number;
  max?: number;
  tone?: keyof typeof tones;
  className?: string;
  label: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className={cn("h-3 w-full overflow-hidden rounded-full bg-white/80 shadow-inner ring-1 ring-lavender-100", className)}
    >
      <div
        className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out", tones[tone])}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}
