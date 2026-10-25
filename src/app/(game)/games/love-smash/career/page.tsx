import type { Metadata } from "next";
import { CareerHub } from "@/components/games/love-smash/career-hub";

export const metadata: Metadata = { title: "Road to Legend" };
export const instant = false;

export default function Page() {
  return <CareerHub />;
}
