import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";

export default function GameLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
