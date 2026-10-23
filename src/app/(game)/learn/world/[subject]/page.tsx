import type { Metadata } from "next";
import { Suspense } from "react";
import { WorldView } from "@/components/universe/world-view";
import { LoadingBlock } from "@/components/ui/states";

export const metadata: Metadata = { title: "Adventure Map" };
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <WorldView />
    </Suspense>
  );
}
