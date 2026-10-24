import type { Metadata } from "next";
import { Suspense } from "react";
import { WorldPage } from "@/components/world/world-page";
import { LoadingBlock } from "@/components/ui/states";

export const metadata: Metadata = { title: "TWOGETHER World" };
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <WorldPage />
    </Suspense>
  );
}
