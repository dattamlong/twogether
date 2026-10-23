import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-display font-semibold transition-[transform,box-shadow,background-color,opacity] duration-150 disabled:pointer-events-none disabled:opacity-50 active:translate-y-[3px] active:shadow-none",
  {
    variants: {
      variant: {
        primary: "bg-sakura-400 text-white shadow-[0_4px_0_0_#c2527c] hover:bg-sakura-500",
        secondary: "bg-lavender-200 text-plum-700 shadow-[0_4px_0_0_#a995dc] hover:bg-lavender-300 hover:text-white",
        mint: "bg-mint-400 text-white shadow-[0_4px_0_0_#3a9474] hover:bg-mint-600",
        gold: "bg-gold-300 text-plum-900 shadow-[0_4px_0_0_#d9a440] hover:bg-gold-500",
        soft: "bg-white/80 text-plum-700 shadow-[0_3px_0_0_rgb(199_184_234/0.6)] hover:bg-white",
        ghost: "text-plum-700 hover:bg-white/60 active:translate-y-0",
        danger: "bg-rose-err text-white shadow-[0_4px_0_0_#b2405c] hover:brightness-95",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-base",
        lg: "h-14 px-7 text-lg",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean };

export function Button({ className, variant, size, asChild, loading, disabled, children, ...props }: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : null}
      {children}
    </button>
  );
}
