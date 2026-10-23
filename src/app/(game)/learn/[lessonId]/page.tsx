import type { Metadata } from "next";
import { Suspense } from "react";
import { LessonPlayer } from "@/components/learning/lesson-player";
import { LoadingBlock } from "@/components/ui/states";

export const metadata: Metadata = { title: "Lesson" };
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <LessonPlayer />
    </Suspense>
  );
}
