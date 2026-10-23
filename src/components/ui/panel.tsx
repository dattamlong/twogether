import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("panel p-5", className)} {...props} />;
}

export function PanelTitle({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <h2 className="text-xl font-semibold text-plum-700">{title}</h2>
          {subtitle ? <p className="text-sm text-cocoa-400">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Vi({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span lang="vi" className={cn("block text-sm font-medium text-cocoa-400", className)}>
      {children}
    </span>
  );
}
