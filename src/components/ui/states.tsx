import type { ReactNode } from "react";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Vi } from "./panel";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-6", className)} aria-hidden />;
}

export function LoadingBlock({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
  );
}

export function ErrorBlock({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message = friendlyError(error);
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 rounded-3xl bg-sakura-50 p-6 text-center", className)}>
      <p className="font-display text-lg text-plum-700">{message.en}</p>
      <Vi>{message.vi}</Vi>
      {onRetry ? (
        <Button variant="soft" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, vi, art, action }: { title: string; vi?: string; art?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-lavender-200 bg-white/50 p-8 text-center">
      {art}
      <p className="font-display text-lg text-plum-700">{title}</p>
      {vi ? <Vi>{vi}</Vi> : null}
      {action}
    </div>
  );
}
