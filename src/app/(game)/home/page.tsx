import type { Metadata } from "next";
import { HomeScreen } from "@/components/room/home-screen";

export const metadata: Metadata = { title: "Our Home" };
export const instant = false;

export default function HomePage() {
  return <HomeScreen />;
}
