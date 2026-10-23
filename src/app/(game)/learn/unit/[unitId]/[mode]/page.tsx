import type { Metadata } from "next";
import { Suspense } from "react";
import { UnitChallenge } from "@/components/universe/unit-challenge";
import { LoadingBlock } from "@/components/ui/states";

export const metadata: Metadata = { title: "Unit Challenge" };
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <UnitChallenge />
    </Suspense>
  );
}
