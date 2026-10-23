import type { Metadata } from "next";
import { LegendsPage } from "@/components/legends/legends-page";

export const metadata: Metadata = { title: "Love Legends" };
export const instant = false;

export default function Page() {
  return <LegendsPage />;
}
