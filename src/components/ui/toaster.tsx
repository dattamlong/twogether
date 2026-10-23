"use client";

import { AnimatePresence, motion } from "motion/react";
import { useToasts } from "@/stores/toast-store";
import { cn } from "@/lib/utils";
import { HeartIcon, SparkleIcon } from "./icons";

const toneStyles = {
  info: "bg-white text-plum-700",
  success: "bg-mint-100 text-plum-700",
  error: "bg-sakura-100 text-plum-700",
  love: "bg-gradient-to-r from-sakura-100 to-lavender-100 text-plum-700",
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+0.75rem)] z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            className={cn("pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl px-4 py-3 shadow-[var(--shadow-soft)] ring-2 ring-white", toneStyles[t.tone])}
            role={t.tone === "error" ? "alert" : "status"}
          >
            {t.tone === "love" ? <HeartIcon size={26} /> : <SparkleIcon size={24} />}
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold leading-tight">{t.title}</p>
              {t.vi ? <p lang="vi" className="text-xs text-cocoa-400">{t.vi}</p> : null}
            </div>
            {t.action ? (
              <button
                className="rounded-xl bg-sakura-400 px-3 py-1.5 font-display text-sm font-semibold text-white"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            ) : (
              <button className="text-xs text-cocoa-400" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                ✕
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
