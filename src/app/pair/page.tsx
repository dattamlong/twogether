import type { Metadata } from "next";
import { Suspense } from "react";
import { PairingScreen } from "@/components/couple/pairing-screen";

export const metadata: Metadata = { title: "Pair with your partner" };

export default function PairPage() {
  return (
    <Suspense>
      <PairingScreen />
    </Suspense>
  );
}
