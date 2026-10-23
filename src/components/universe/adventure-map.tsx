"use client";

import { Check, Lock, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { ItemArt } from "@/components/rewards/item-art";
import { Button } from "@/components/ui/button";
import { BookIcon, SparkleIcon, StarIcon, TrophyIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Vi } from "@/components/ui/panel";
import type { AdventureMapData, MapNode, MapUnit } from "@/features/universe/types";
import { readAvatar } from "@/features/session/types";
import { useRequiredSession } from "@/features/session/use-session";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toast-store";
import { LocationArt, WORLD_THEMES } from "./world-art";

const HEADER_H = 150;
const NODE_H = 108;
const TOP_PAD = 24;

type Placed = { key: string; unit: MapUnit; node: MapNode | null; index: number; x: number; y: number; ghost: boolean };

function nodeX(i: number) {
  return 50 + 27 * Math.sin(i * 0.95);
}

function layout(units: MapUnit[]) {
  const headers: { unit: MapUnit; y: number }[] = [];
  const nodes: Placed[] = [];
  let y = TOP_PAD;
  let i = 0;
  for (const unit of units) {
    headers.push({ unit, y });
    y += HEADER_H;
    const list: (MapNode | null)[] = unit.status === "planned" ? [null, null] : unit.nodes;
    list.forEach((node, n) => {
      nodes.push({ key: `${unit.id}:${n}`, unit, node, index: i, x: nodeX(i), y: y + NODE_H / 2, ghost: node === null });
      y += NODE_H;
      i++;
    });
  }
  return { headers, nodes, height: y + 40 };
}

function sideOffset(p: { x: number }) {
  return p.x > 50 ? -62 : 62;
}

function pathFor(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let k = 1; k < points.length; k++) {
    const p = points[k - 1];
    const c = points[k];
    const midY = (p.y + c.y) / 2;
    d += ` C ${p.x} ${midY}, ${c.x} ${midY}, ${c.x} ${c.y}`;
  }
  return d;
}

function NodeGlyph({ node }: { node: MapNode }) {
  if (node.kind === "review") return <SparkleIcon size={30} />;
  if (node.kind === "boss") return <TrophyIcon size={34} />;
  if (node.category === "listening") return <Volume2 size={26} className="text-sky-400" />;
  return <BookIcon size={30} />;
}

function Decor({ subject, side, y }: { subject: string; side: "left" | "right"; y: number }) {
  const theme = WORLD_THEMES[subject] ?? WORLD_THEMES.english;
  const kind = subject === "chinese" ? "bamboo" : subject === "explorer" ? "palm" : subject === "brain" ? "crystal" : "tree";
  return (
    <svg viewBox="0 0 40 48" className={cn("pointer-events-none absolute h-12 w-10 opacity-80", side === "left" ? "left-[3%]" : "right-[3%]")} style={{ top: y - 24 }} aria-hidden>
      {kind === "tree" ? (
        <>
          <rect x="18" y="26" width="4" height="18" fill="#9a8288" />
          <circle cx="20" cy="20" r="14" fill="#f8bbd0" />
          <circle cx="12" cy="24" r="8" fill="#f39bbb" />
        </>
      ) : kind === "bamboo" ? (
        <>
          <rect x="12" y="4" width="4" height="42" fill="#6cc3a2" />
          <rect x="22" y="10" width="4" height="36" fill="#3a9474" />
          <path d="M14 14 q10 -4 14 0" stroke="#3a9474" strokeWidth="2" fill="none" />
        </>
      ) : kind === "palm" ? (
        <>
          <path d="M20 46 v-26" stroke="#9a6b4f" strokeWidth="3" />
          <path d="M20 20 q-12 -6 -16 4 M20 20 q10 -10 16 0 M20 20 q-2 -12 -10 -14" stroke={theme.accent} strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <path d="M20 4 l10 16 -10 24 -10 -24z" fill="#c7b8ea" stroke="#8a73c8" strokeWidth="1.5" style={{ animation: "legend-float 4s ease-in-out infinite", transformBox: "fill-box" }} />
      )}
    </svg>
  );
}

function UnitHeader({ unit, y, accent }: { unit: MapUnit; y: number; accent: string }) {
  const planned = unit.status === "planned";
  return (
    <div className="absolute inset-x-2 sm:inset-x-6" style={{ top: y, height: HEADER_H - 18 }}>
      <div className={cn("flex h-full items-center gap-3 rounded-[1.5rem] bg-white/90 p-3 shadow-[var(--shadow-soft)] ring-2", unit.bossCleared ? "ring-gold-300" : "ring-white", planned && "opacity-70")}>
        <LocationArt location={unit.location} className="h-20 w-24 shrink-0 sm:h-24 sm:w-28" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
            Unit {unit.number} {planned ? "· Coming soon" : !unit.unlocked ? "· Locked" : unit.bossCleared ? "· Cleared" : ""}
          </p>
          <p className="truncate font-display text-lg font-semibold leading-tight text-plum-700">{unit.title}</p>
          <p lang="vi" className="truncate text-xs text-cocoa-400">{unit.titleVi}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-plum-500 sm:line-clamp-2">{unit.description}</p>
          {!planned ? (
            <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-cocoa-400">
              <span>
                {unit.lessonsDone}/{unit.lessonsTotal} lessons
              </span>
              <span className="flex" aria-label={`${unit.stars} of 3 stars`}>
                {[1, 2, 3].map((s) => (
                  <StarIcon key={s} size={14} className={s <= unit.stars ? "" : "opacity-25 grayscale"} />
                ))}
              </span>
              {unit.rewardItemId ? (
                <span className="flex items-center gap-0.5" title="Unit reward">
                  <ItemArt itemId={unit.rewardItemId} size={18} /> reward
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AdventureMap({ data, subject, level }: { data: AdventureMapData; subject: string; level: string }) {
  const session = useRequiredSession();
  const reduced = usePrefersReducedMotion();
  const theme = WORLD_THEMES[subject] ?? WORLD_THEMES.english;
  const { headers, nodes, height } = useMemo(() => layout(data.units), [data.units]);
  const [selected, setSelected] = useState<Placed | null>(null);
  const storageKey = `twogether:map:${subject}:${level}`;
  const currentKey = data.current ? `${data.current.unitId}:${data.current.nodeIndex}` : null;
  const target = nodes.find((n) => n.key === currentKey) ?? nodes.filter((n) => !n.ghost).at(-1) ?? nodes[0];
  const [walkPath, setWalkPath] = useState<Placed[] | null>(null);
  const walked = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target || walked.current) return;
    walked.current = true;
    let previous: string | null = null;
    try {
      previous = localStorage.getItem(storageKey);
      localStorage.setItem(storageKey, target.key);
    } catch {
      previous = null;
    }
    const from = nodes.find((n) => n.key === previous);
    if (from && from.index < target.index && !reduced) {
      const steps = nodes.filter((n) => n.index >= from.index && n.index <= target.index);
      queueMicrotask(() => setWalkPath(steps));
      setTimeout(() => {
        sfx.pop();
        toast({ tone: "success", title: "New checkpoint unlocked!", vi: "Đã mở điểm dừng mới!" });
      }, 450 * steps.length);
    }
    const el = document.getElementById(`node-${target.key}`);
    el?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  }, [target, nodes, storageKey, reduced]);

  const points = nodes.map((n) => ({ x: n.x, y: n.y }));
  const completedUpTo = nodes.filter((n) => n.node?.completed).at(-1)?.index ?? -1;
  const doneD = pathFor(points.slice(0, Math.max(completedUpTo + 2, 0)));
  const avatar = readAvatar(session.profile.avatar);
  const charStops = walkPath ?? (target ? [target] : []);

  return (
    <div ref={scroller} className="relative overflow-hidden rounded-[2rem] ring-2 ring-white" style={{ height, background: `linear-gradient(180deg, ${theme.sky[0]} 0%, #fff7ed 40%, ${theme.sky[0]} 100%)` }}>
      {Array.from({ length: Math.ceil(height / 220) }, (_, i) => (
        <span
          key={i}
          className="pointer-events-none absolute size-1.5 rounded-full bg-white"
          style={{ left: `${(i * 37) % 92}%`, top: i * 220 + 60, animation: `legend-twinkle ${2.4 + (i % 3) * 0.5}s ease-in-out ${(i % 4) * 0.4}s infinite` }}
          aria-hidden
        />
      ))}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
        <path d={pathFor(points)} fill="none" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity=".9" />
        <path d={pathFor(points)} fill="none" stroke={theme.ground} strokeWidth="10" strokeLinecap="round" strokeDasharray="2 14" vectorEffect="non-scaling-stroke" />
        {doneD ? <path d={doneD} fill="none" stroke={theme.accent} strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity=".55" /> : null}
      </svg>

      {nodes.map((n) => (n.index % 2 === 0 ? <Decor key={`d-${n.key}`} subject={subject} side={n.x > 50 ? "left" : "right"} y={n.y} /> : null))}
      {headers.map(({ unit, y }) => (
        <UnitHeader key={unit.id} unit={unit} y={y} accent={theme.accent} />
      ))}

      {nodes.map((n) => {
        const node = n.node;
        const isCurrent = n.key === target?.key && !node?.completed;
        const size = node?.kind === "boss" ? 76 : 62;
        return (
          <div key={n.key} id={`node-${n.key}`} className="absolute flex w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${n.x}%`, top: n.y }}>
            <motion.button
              type="button"
              disabled={n.ghost}
              onClick={() => node && setSelected(n)}
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: n.ghost ? 1 : 1.06 }}
              className={cn(
                "relative grid place-items-center rounded-full border-4 shadow-[0_6px_0_0_rgba(69,54,91,0.18)] transition-colors",
                n.ghost || !node?.unlocked ? "border-white/70 bg-cream-200/90" : node.completed ? "border-white bg-mint-200" : "border-white bg-white",
                isCurrent && "ring-4 ring-sakura-300",
              )}
              style={{ width: size, height: size }}
              aria-label={node ? `${node.title}${node.completed ? ", completed" : node.unlocked ? ", unlocked" : ", locked"}` : "Coming soon"}
            >
              {isCurrent && !reduced ? <span className="absolute inset-0 animate-ping rounded-full bg-sakura-200/60" /> : null}
              <span className={cn("relative", (n.ghost || !node?.unlocked) && "opacity-40 grayscale")}>{node ? <NodeGlyph node={node} /> : <Lock size={20} />}</span>
              {node?.completed ? (
                <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-mint-400 text-white ring-2 ring-white">
                  <Check size={14} strokeWidth={3} />
                </span>
              ) : node && !node.unlocked ? (
                <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-lavender-200 text-plum-500 ring-2 ring-white">
                  <Lock size={12} />
                </span>
              ) : null}
            </motion.button>
            {node ? (
              <p className={cn("mt-1 line-clamp-2 text-center text-[11px] font-bold leading-tight", node.unlocked ? "text-plum-700" : "text-cocoa-400")}>{node.title}</p>
            ) : null}
            {node?.kind === "boss" && n.unit.stars > 0 ? (
              <span className="flex">
                {[1, 2, 3].map((s) => (
                  <StarIcon key={s} size={14} className={s <= n.unit.stars ? "" : "opacity-25 grayscale"} />
                ))}
              </span>
            ) : null}
          </div>
        );
      })}

      {charStops.length ? (
        <motion.div
          className="pointer-events-none absolute z-20 -translate-x-1/2"
          initial={{ left: `${charStops[0].x}%`, top: charStops[0].y - 34, x: sideOffset(charStops[0]) }}
          animate={{ left: charStops.map((s) => `${s.x}%`), top: charStops.map((s) => s.y - 34), x: charStops.map(sideOffset) }}
          transition={{ duration: Math.max(0.01, 0.45 * (charStops.length - 1)), ease: "easeInOut" }}
          data-testid="map-character"
        >
          <div style={reduced ? undefined : { animation: "legend-hop 1.8s ease-in-out infinite" }}>
            <span className="block rounded-full bg-white p-0.5 shadow-[var(--shadow-soft)] ring-2" style={{ ["--tw-ring-color" as string]: theme.accent }}>
              <AvatarFace avatar={avatar} size={44} />
            </span>
          </div>
        </motion.div>
      ) : null}

      <NodeSheet placed={selected} subject={subject} level={level} onClose={() => setSelected(null)} />
    </div>
  );
}

function NodeSheet({ placed, subject, level, onClose }: { placed: Placed | null; subject: string; level: string; onClose: () => void }) {
  const node = placed?.node;
  const unit = placed?.unit;
  if (!node || !unit) return <Modal open={false} onOpenChange={onClose} title="">{null}</Modal>;
  const mapParam = `map=${subject}/${level}`;
  const href =
    node.kind === "lesson" ? `/learn/${node.lessonId}?${mapParam}` : `/learn/unit/${unit.id}/${node.kind === "boss" ? "boss" : "review"}?${mapParam}`;

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={node.title} subtitle={`${node.titleVi} · Unit ${unit.number}: ${unit.title}`}>
      <div className="flex flex-col gap-3">
        {node.kind === "lesson" ? (
          <p className="text-plum-500">
            {node.questionCount} questions · {node.category}. First completion earns full XP and Love Coins; replays earn half XP.
          </p>
        ) : node.kind === "review" ? (
          <>
            <p className="text-plum-500">A mixed review of the whole unit — your weakest questions come first.</p>
            <Vi>Ôn tập toàn bộ unit, ưu tiên những câu bạn hay sai.</Vi>
          </>
        ) : (
          <>
            <p className="text-plum-500">
              Face <b>{unit.bossName}</b>! Answer questions from this unit. 80% clears the unit (1 star), 90% earns 2 stars, 100% earns 3 stars.
            </p>
            <Vi>Đạt 80% để qua unit, 90% được 2 sao, 100% được 3 sao. Có thể thử lại thoải mái.</Vi>
            {unit.bossBestPct ? <p className="text-sm font-semibold">Best score: {unit.bossBestPct}%</p> : null}
            {unit.rewardItemId ? (
              <div className="flex items-center gap-3 rounded-2xl bg-gold-200/50 p-3">
                <ItemArt itemId={unit.rewardItemId} size={48} />
                <p className="text-sm">First clear unlocks a home decoration for your room.</p>
              </div>
            ) : null}
          </>
        )}
        {node.unlocked ? (
          <Button asChild size="lg">
            <Link href={href}>{node.completed ? "Practice again" : node.kind === "boss" ? "Challenge the boss" : "Start"}</Link>
          </Button>
        ) : (
          <>
            <p className="rounded-2xl bg-lavender-100 px-3 py-2 text-sm text-plum-500">
              {!unit.unlocked ? "Clear the previous unit's boss to unlock this unit." : "Finish the previous checkpoint first."}
            </p>
            {node.kind === "lesson" ? (
              <Button asChild variant="soft">
                <Link href={`/learn/${node.lessonId}`}>Practice in Free Learning</Link>
              </Button>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}
