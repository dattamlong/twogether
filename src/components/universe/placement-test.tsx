"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Compass } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel, Vi } from "@/components/ui/panel";
import { ErrorBlock } from "@/components/ui/states";
import { useSetLearning } from "@/features/learning/queries";
import { LANGUAGE_INFO, LEVEL_LABELS } from "@/features/learning/types";
import { finishPlacement, startPlacement, universeKeys } from "@/features/universe/queries";
import type { ChallengeStart, PlacementResult } from "@/features/universe/types";
import { ChallengeRunner } from "./challenge-runner";
import { WorldIcon } from "./world-art";

const LANGUAGE_FOR: Record<string, "en" | "zh"> = { english: "en", chinese: "zh" };

export function PlacementTest() {
  const { subject } = useParams<{ subject: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const setLearning = useSetLearning();
  const [test, setTest] = useState<Omit<ChallengeStart, "unit"> | null>(null);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const language = LANGUAGE_FOR[subject];

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      setTest(await startPlacement(subject));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!test) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await finishPlacement(test.sessionId));
      client.invalidateQueries({ queryKey: universeKeys.all });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function apply(level: string) {
    const supported = language ? LANGUAGE_INFO[language].levels : [];
    const target = supported.includes(level) ? level : supported.at(-1);
    if (language && target) await setLearning.mutateAsync({ language, level: target });
    client.invalidateQueries({ queryKey: universeKeys.all });
    router.push(`/learn/world/${subject}?level=${level}`);
  }

  if (!language) return <ErrorBlock error="placement_not_available" />;

  if (result) {
    const levels = Object.entries(result.byLevel ?? {});
    return (
      <Panel className="mx-auto flex max-w-xl flex-col gap-4 text-center">
        <Compass size={56} className="mx-auto text-lavender-400" />
        <h1 className="text-3xl font-bold">We suggest starting at {result.recommendedLevel.replace("HSK", "HSK ")}</h1>
        <p className="text-plum-500">{LEVEL_LABELS[result.recommendedLevel]?.name}</p>
        <Vi>Gợi ý bắt đầu ở cấp {result.recommendedLevel}. Đây chỉ là gợi ý trong app, không phải chứng chỉ CEFR/HSK chính thức.</Vi>
        <ul className="grid grid-cols-3 gap-2 text-sm sm:grid-cols-4">
          {levels.map(([level, s]) => (
            <li key={level} className="rounded-2xl bg-white/80 p-2">
              <p className="font-display font-semibold">{level.replace("HSK", "HSK ")}</p>
              <p className="text-xs text-cocoa-400">
                {s.correct}/{s.total}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-cocoa-400">
          {result.correct}/{result.total} correct overall. Units still unlock in order on each level&apos;s map — this only changes which level you see first.
        </p>
        {setLearning.error ? <ErrorBlock error={setLearning.error} /> : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="soft" className="flex-1" asChild>
            <Link href={`/learn/world/${subject}`}>Keep my level</Link>
          </Button>
          <Button className="flex-1" onClick={() => apply(result.recommendedLevel)} loading={setLearning.isPending}>
            Start at {result.recommendedLevel.replace("HSK", "HSK ")}
          </Button>
        </div>
      </Panel>
    );
  }

  if (test) {
    return (
      <ChallengeRunner key={test.sessionId} sessionId={test.sessionId} questions={test.questions} onLeave={() => router.push(`/learn/world/${subject}`)} onFinish={finish} finishing={busy} error={error} />
    );
  }

  return (
    <Panel className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <WorldIcon subject={subject} size={52} />
        <div>
          <h1 className="text-3xl font-bold">Placement Test</h1>
          <Vi>Bài kiểm tra xếp lớp</Vi>
        </div>
      </div>
      <p className="text-plum-500">
        A short mix of vocabulary, grammar and listening questions from each level. We&apos;ll suggest where to start. It takes about 5–8 minutes and doesn&apos;t give XP or affect your reviews.
      </p>
      <p className="rounded-2xl bg-sky-100 px-4 py-2 text-xs text-plum-500">
        This is an in-app recommendation only — it is not an official CEFR or HSK certification.
        <span lang="vi" className="block text-cocoa-400">Kết quả chỉ để gợi ý, không phải chứng chỉ chính thức.</span>
      </p>
      {error ? <ErrorBlock error={error} /> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="soft" className="flex-1" asChild>
          <Link href={`/learn/world/${subject}`}>Not now</Link>
        </Button>
        <Button size="lg" className="flex-1" onClick={begin} loading={busy}>
          Start the test
        </Button>
      </div>
    </Panel>
  );
}
