import type { Metadata } from "next";
import { LoveShop } from "@/components/rewards/love-shop";

export const metadata: Metadata = { title: "Love Shop" };
export const instant = false;

export default function Page() {
  return <LoveShop />;
}
