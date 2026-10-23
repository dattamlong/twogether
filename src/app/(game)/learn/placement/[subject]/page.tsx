import type { Metadata } from "next";
import { Suspense } from "react";
import { PlacementTest } from "@/components/universe/placement-test";
import { LoadingBlock } from "@/components/ui/states";

export const metadata: Metadata = { title: "Placement Test" };
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <PlacementTest />
    </Suspense>
  );
}
