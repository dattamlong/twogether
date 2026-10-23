import type { Metadata } from "next";
import { GamesHub } from "@/components/games/games-hub";

export const metadata: Metadata = { title: "Games" };
export const instant = false;

export default function Page() {
  return <GamesHub />;
}
