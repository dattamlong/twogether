import type { Metadata } from "next";
import { Suspense } from "react";
import { VisitScreen } from "@/components/world/visit-screen";
import { LoadingBlock } from "@/components/ui/states";

export const metadata: Metadata = { title: "Visiting" };
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <VisitScreen />
    </Suspense>
  );
}
