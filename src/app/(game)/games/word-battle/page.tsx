import type { Metadata } from "next";
import { WordBattle } from "@/components/games/word-battle";

export const metadata: Metadata = { title: "Word Battle" };
export const instant = false;

export default function Page() {
  return <WordBattle />;
}
