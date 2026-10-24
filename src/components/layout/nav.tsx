"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { AlbumIcon, BookIcon, GamepadIcon, GiftIcon, GlobeIcon, HouseIcon, TrophyIcon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/home", key: "nav.home", short: "nav.home", icon: HouseIcon },
  { href: "/world", key: "nav.world", short: "nav.worldShort", icon: GlobeIcon },
  { href: "/learn", key: "nav.learn", short: "nav.learn", icon: BookIcon },
  { href: "/games", key: "nav.games", short: "nav.games", icon: GamepadIcon },
  { href: "/legends", key: "nav.legends", short: "nav.legendsShort", icon: TrophyIcon },
  { href: "/shop", key: "nav.shop", short: "nav.shop", icon: GiftIcon },
  { href: "/story", key: "nav.story", short: "nav.story", icon: AlbumIcon },
] as const;

export function Nav({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  return (
    <>
      <nav aria-label="Main" className="fixed left-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-2 rounded-[2rem] bg-white/80 p-2 shadow-[var(--shadow-soft)] ring-2 ring-white backdrop-blur md:flex">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex w-20 flex-col items-center gap-1 rounded-3xl px-2 py-3 text-xs font-bold transition",
                active ? "text-plum-700" : "text-cocoa-400 hover:bg-sakura-50 hover:text-plum-700",
              )}
            >
              {active ? <motion.span layoutId="nav-active-desktop" className="absolute inset-0 rounded-3xl bg-sakura-100" transition={{ type: "spring", bounce: 0.3, duration: 0.5 }} /> : null}
              <Icon size={34} className="relative transition-transform group-hover:-translate-y-0.5 group-active:scale-90" />
              <span className="relative text-center leading-tight">{t(key)}</span>
              {href === "/story" && unread > 0 ? <span className="absolute right-3 top-2 size-3 rounded-full bg-sakura-400 ring-2 ring-white" aria-label={`${unread} unread`} /> : null}
            </Link>
          );
        })}
      </nav>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-white bg-white/90 px-2 pt-1.5 pb-safe backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-lg justify-between">
          {ITEMS.map(({ href, short, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <li key={href} className="min-w-0 flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-bold", active ? "text-plum-700" : "text-cocoa-400")}
                >
                  {active ? <motion.span layoutId="nav-active-mobile" className="absolute inset-x-2 inset-y-0 rounded-2xl bg-sakura-100" transition={{ type: "spring", bounce: 0.3, duration: 0.45 }} /> : null}
                  <Icon size={26} className="relative" />
                  <span className="relative max-w-full truncate px-0.5">{t(short)}</span>
                  {href === "/story" && unread > 0 ? <span className="absolute right-[22%] top-1 size-2.5 rounded-full bg-sakura-400 ring-2 ring-white" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
