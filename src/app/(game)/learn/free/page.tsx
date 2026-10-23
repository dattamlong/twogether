import type { Metadata } from "next";
import { LearnHub } from "@/components/learning/learn-hub";

export const metadata: Metadata = { title: "Free Learning" };
export const instant = false;

export default function Page() {
  return <LearnHub />;
}
