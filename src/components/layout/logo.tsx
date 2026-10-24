import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden
      unoptimized
      priority
      draggable={false}
      className={cn("select-none drop-shadow-[0_6px_14px_rgba(138,115,200,0.25)]", className)}
    />
  );
}
