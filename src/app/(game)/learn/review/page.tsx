import type { Metadata } from "next";
import { ReviewSession } from "@/components/learning/review-session";

export const metadata: Metadata = { title: "Review" };
export const instant = false;

export default function Page() {
  return <ReviewSession />;
}
