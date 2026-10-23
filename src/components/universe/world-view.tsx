"use client";

import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel, Vi } from "@/components/ui/panel";
import { ErrorBlock, LoadingBlock, Skeleton } from "@/components/ui/states";
import { useAdventureMap, useUniverse } from "@/features/universe/queries";
import { cn } from "@/lib/utils";
import { AdventureMap } from "./adventure-map";
import { WorldIcon, WORLD_THEMES } from "./world-art";

function levelName(subject: string, level: string) {
  if (subject === "chinese") return level.replace("HSK", "HSK ");
  if (subject === "english") return level;
  return `Level ${level.replace("L", "")}`;
}

export function WorldView() {
  const { subject } = useParams<{ subject: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const universe = useUniverse();
  const info = universe.data?.find((s) => s.id === subject);
  const playable = info?.levels.filter((l) => l.availableUnits > 0) ?? [];
  const requested = search.get("level");
  const fallback = playable.find((l) => l.level === info?.currentLevel)?.level ?? playable[0]?.level ?? null;
  const level = requested && info?.levels.some((l) => l.level === requested) ? requested : fallback;
  const map = useAdventureMap(subject, level);
  const [dismissedPlacement, setDismissedPlacement] = useState(false);
  const theme = WORLD_THEMES[subject] ?? WORLD_THEMES.english;

  if (universe.isLoading) return <LoadingBlock />;
  if (universe.error) return <ErrorBlock error={universe.error} onRetry={() => universe.refetch()} />;
  if (!info) return <ErrorBlock error="subject_not_found" />;
  if (info.status !== "available") {
    return (
      <Panel className="mx-auto flex max-w-lg flex-col items-center gap-3 text-center">
        <WorldIcon subject={subject} size={64} />
        <h1 className="text-2xl font-bold">{info.name} is coming soon</h1>
        <Vi>Thế giới này đang được xây dựng — bài học sẽ sớm có.</Vi>
        <Button asChild variant="soft">
          <Link href="/learn">Back to the Universe</Link>
        </Button>
      </Panel>
    );
  }

  const isLanguage = info.language !== null;
  const showPlacement = isLanguage && !info.placement && info.lessonsDone === 0 && !dismissedPlacement;
  const active = info.levels.find((l) => l.level === level);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 pb-24 lg:pb-4">
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back to the Learning Universe">
          <Link href="/learn">
            <ArrowLeft />
          </Link>
        </Button>
        <WorldIcon subject={subject} size={44} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold sm:text-3xl" style={{ color: theme.accent }}>
            {info.name}
          </h1>
          <p lang="vi" className="truncate text-xs text-cocoa-400">{info.nameVi}</p>
        </div>
        {isLanguage ? (
          <Button asChild variant="soft" size="sm">
            <Link href={`/learn/placement/${subject}`}>
              <Compass size={16} /> Placement
            </Link>
          </Button>
        ) : null}
      </header>

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={`${info.name} levels`}>
        {info.levels.map((l) => {
          const open = l.availableUnits > 0;
          return (
            <button
              key={l.level}
              role="tab"
              aria-selected={l.level === level}
              onClick={() => router.replace(`/learn/world/${subject}?level=${l.level}`, { scroll: false })}
              className={cn(
                "shrink-0 rounded-2xl px-3 py-1.5 text-left ring-2 transition",
                l.level === level ? "bg-plum-700 text-white ring-plum-700" : open ? "bg-white/80 ring-white hover:ring-lavender-200" : "bg-white/40 text-cocoa-400 ring-white/60",
              )}
            >
              <span className="block font-display text-sm font-semibold">{levelName(subject, l.level)}</span>
              <span className={cn("block text-[10px]", l.level === level ? "text-white/80" : "text-cocoa-400")}>{open ? l.title : "Coming soon"}</span>
            </button>
          );
        })}
      </div>

      {showPlacement ? (
        <Panel className="flex flex-col gap-3 bg-gradient-to-br from-sakura-50 to-lavender-100">
          <p className="font-display text-lg font-semibold">Where would you like to start?</p>
          <Vi>Bạn muốn bắt đầu từ đâu? Bài kiểm tra xếp lớp chỉ để gợi ý, không phải chứng chỉ chính thức.</Vi>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="soft" onClick={() => setDismissedPlacement(true)}>
              Start from the beginning
            </Button>
            <Button variant="soft" onClick={() => setDismissedPlacement(true)}>
              I&apos;ll pick a level
            </Button>
            <Button asChild>
              <Link href={`/learn/placement/${subject}`}>Take a placement test</Link>
            </Button>
          </div>
        </Panel>
      ) : null}

      {active ? (
        <p className="px-1 text-sm text-plum-500">
          <b>{levelName(subject, active.level)}</b> · {active.title} <span lang="vi" className="text-cocoa-400">· {active.titleVi}</span>
        </p>
      ) : null}

      {!level ? <ErrorBlock error="no_playable_levels" /> : null}
      {map.isLoading ? <Skeleton className="h-[70vh] rounded-[2rem]" /> : null}
      {map.error ? <ErrorBlock error={map.error} onRetry={() => map.refetch()} /> : null}
      {map.data && level ? (
        map.data.units.length ? (
          <AdventureMap key={`${subject}:${level}`} data={map.data} subject={subject} level={level} />
        ) : (
          <Panel className="text-center text-plum-500">
            This level&apos;s units are still being written — they&apos;ll appear here as &quot;Coming soon&quot; first.
            <Vi>Các unit của cấp độ này đang được biên soạn.</Vi>
          </Panel>
        )
      ) : null}
    </div>
  );
}
