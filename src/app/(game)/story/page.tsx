import type { Metadata } from "next";
import { OurStory } from "@/components/couple/our-story";

export const metadata: Metadata = { title: "Our Story" };
export const instant = false;

export default function Page() {
  return <OurStory />;
}
