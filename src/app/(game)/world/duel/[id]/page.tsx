import type { Metadata } from "next";
import { Suspense } from "react";
import { DuelScreen } from "@/components/world/duel-screen";
import { LoadingBlock } from "@/components/ui/states";

export const metadata: Metadata = { title: "Word Duel" };
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <DuelScreen />
    </Suspense>
  );
}
