import type { Metadata } from "next";
import { WordBank } from "@/components/learning/word-bank";

export const metadata: Metadata = { title: "Word Bank" };
export const instant = false;

export default function Page() {
  return <WordBank />;
}
