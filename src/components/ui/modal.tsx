"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-plum-900/30 backdrop-blur-[2px] data-[state=open]:animate-[fadeIn_200ms_ease-out]" />
        <Dialog.Content
          className={cn(
            "panel fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-b-none p-5 pb-safe outline-none",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(560px,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-b-[1.5rem] sm:pb-6",
            "data-[state=open]:animate-[popIn_260ms_cubic-bezier(.2,1.4,.4,1)]",
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-2xl font-semibold text-plum-700">{title}</Dialog.Title>
              {subtitle ? <Dialog.Description className="text-sm text-cocoa-400">{subtitle}</Dialog.Description> : <Dialog.Description className="sr-only">{String(title)}</Dialog.Description>}
            </div>
            <Dialog.Close className="grid size-10 shrink-0 place-items-center rounded-full bg-white/80 text-plum-500 hover:bg-white" aria-label="Close">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
