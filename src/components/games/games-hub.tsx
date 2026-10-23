"use client";

import { Lock, Users } from "lucide-react";
import Link from "next/link";
import { GamepadIcon, SparkleIcon } from "@/components/ui/icons";
import { Vi } from "@/components/ui/panel";
import { GAMES } from "@/features/games/registry";
import { cn } from "@/lib/utils";

export function GamesHub() {
  const playable = GAMES.filter((g) => g.href);
  const upcoming = GAMES.filter((g) => !g.href);
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-3xl font-bold">Games</h1>
        <Vi>Vừa chơi vừa học — mỗi trận đều tính vào nhiệm vụ hằng ngày</Vi>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {playable.map((g) => (
          <li key={g.id}>
            <Link
              href={g.href!}
              className={cn("group flex h-full flex-col gap-3 rounded-[1.75rem] bg-gradient-to-br p-6 ring-2 ring-white shadow-[var(--shadow-soft)] transition hover:-translate-y-1", g.accent)}
            >
              <div className="flex items-center gap-3">
                {g.id === "word-battle" ? <SparkleIcon size={48} /> : <GamepadIcon size={48} />}
                <div>
                  <h2 className="text-2xl font-semibold">{g.title}</h2>
                  <p lang="vi" className="text-sm text-cocoa-400">{g.title_vi}</p>
                </div>
              </div>
              <p className="text-plum-500">{g.description}</p>
              <span className="mt-auto w-fit rounded-2xl bg-white/80 px-4 py-2 font-display font-semibold text-plum-700 shadow-[var(--shadow-pop)] transition group-hover:bg-white">Play now</span>
            </Link>
          </li>
        ))}
      </ul>
      <section aria-labelledby="coming-soon">
        <h2 id="coming-soon" className="text-xl font-semibold">
          Coming soon
        </h2>
        <Vi>Đang được xây dựng</Vi>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {upcoming.map((g) => (
            <li key={g.id} className={cn("flex flex-col gap-1 rounded-3xl bg-gradient-to-br p-4 opacity-75 ring-2 ring-white", g.accent)}>
              <div className="flex items-center justify-between">
                <p className="font-display font-semibold">{g.title}</p>
                {g.mode === "solo" ? <Lock size={16} /> : <Users size={16} />}
              </div>
              <p lang="vi" className="text-xs text-cocoa-400">{g.title_vi}</p>
              <p className="text-sm text-plum-500">{g.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
