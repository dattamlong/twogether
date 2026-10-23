import type { Metadata } from "next";
import { SentencePuzzle } from "@/components/games/sentence-puzzle";

export const metadata: Metadata = { title: "Sentence Puzzle" };
export const instant = false;

export default function Page() {
  return <SentencePuzzle />;
}
