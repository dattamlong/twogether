import type { Metadata } from "next";
import { LoveSmash } from "@/components/games/love-smash/love-smash";

export const metadata: Metadata = { title: "Love Smash!" };
export const instant = false;

export default function Page() {
  return <LoveSmash />;
}
