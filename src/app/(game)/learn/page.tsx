import type { Metadata } from "next";
import { UniversePage } from "@/components/universe/universe-page";

export const metadata: Metadata = { title: "Learning Universe" };
export const instant = false;

export default function Page() {
  return <UniversePage />;
}
