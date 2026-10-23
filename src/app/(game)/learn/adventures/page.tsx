import type { Metadata } from "next";
import { Suspense } from "react";
import { CoupleAdventures } from "@/components/universe/couple-adventures";
import { LoadingBlock } from "@/components/ui/states";

export const metadata: Metadata = { title: "Couple Adventures" };
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <CoupleAdventures />
    </Suspense>
  );
}
