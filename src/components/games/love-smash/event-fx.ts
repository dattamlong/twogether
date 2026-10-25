import { COURT } from "@/features/love-smash/court";
import { banner, burst, impact, pop, type Fx } from "@/features/love-smash/render";
import type { ComboKind, Match, SimEvent } from "@/features/love-smash/sim";
import { sfx } from "@/lib/sfx";

export type FxEnv = {
  match: Match;
  fx: Fx;
  at: (x: number, y: number, z: number) => { x: number; y: number };
  reduced: boolean;
  mySlot: number;
  coupleTeam: (side: 0 | 1) => boolean;
  width: number;
  height: number;
};

const COMBO_TEXT: Record<ComboKind, (couple: boolean) => string> = {
  love_combo: (couple) => (couple ? "💞 LOVE COMBO!" : "✨ DUO COMBO!"),
  sakura_duo: (couple) => (couple ? "🌸 SAKURA DUO SMASH!" : "🌸 DUO SMASH!"),
  teamwork: () => "PERFECT TEAMWORK!",
};

export function playEventFx(e: SimEvent, env: FxEnv) {
  const { match, fx } = env;
  const count = (n: number) => (env.reduced ? Math.ceil(n / 4) : n);
  const mine = (slot: number) => slot === env.mySlot;
  switch (e.type) {
    case "hit": {
      const p = match.players[e.slot];
      const head = env.at(p.x, p.y, 2.3);
      const at = env.at(match.shuttle.pos.x, match.shuttle.pos.y, match.shuttle.pos.z);
      fx.trail = [];
      fx.trailKind = e.sakura ? "sakura" : e.shot === "smash" ? "smash" : "normal";
      if (e.sakura) {
        sfx.sakuraSmash();
        banner(fx, "SAKURA SMASH!", "🌸 Perfect jump smash", "#e7779f", 1.1);
        burst(fx, at.x, at.y, "petal", count(26), 1.4);
        impact(fx, at.x, at.y, "#e7779f", 1.4);
        fx.shake = 0.7;
        fx.flash = 0.8;
        fx.cheer = 1;
      } else if (e.shot === "smash") {
        sfx.smashHit();
        fx.shake = Math.max(fx.shake, 0.3);
        impact(fx, at.x, at.y, "#f5cb78", 1);
        burst(fx, at.x, at.y, "spark", count(10), 1.2);
      } else if (e.quality === "perfect") {
        sfx.perfectHit();
        burst(fx, at.x, at.y, "spark", count(9));
        impact(fx, at.x, at.y, "#ffffff", 0.55);
      } else sfx.racket(e.quality === "late" ? 0.3 : 0.7);
      if (e.shot === "drop") burst(fx, at.x, at.y, "petal", count(5), 0.5);
      if (e.save) {
        burst(fx, at.x, at.y, "streak", count(7), 0.8);
        pop(fx, "SAVE!", head.x, head.y - 22, "#3a9474", mine(e.slot) ? 24 : 18);
      }
      if (!e.shot.startsWith("serve")) {
        const label = e.quality === "perfect" ? "PERFECT!" : e.quality === "good" ? "GOOD" : "LATE";
        const color = e.quality === "perfect" ? "#e7779f" : e.quality === "good" ? "#8a73c8" : "#9a8288";
        pop(fx, e.shot === "smash" && !e.sakura ? "SMASH!" : label, head.x, head.y, e.shot === "smash" ? "#d9825f" : color, mine(e.slot) ? 24 : 17);
      }
      break;
    }
    case "whiff": {
      sfx.whiff();
      const p = match.players[e.slot];
      const head = env.at(p.x, p.y, 2.3);
      if (mine(e.slot)) pop(fx, "MISS", head.x, head.y, "#9a8288", 20);
      break;
    }
    case "lunge": {
      sfx.whiff();
      const p = match.players[e.slot];
      const at = env.at(p.x, p.y, 0.8);
      burst(fx, at.x, at.y, "streak", count(5), 0.6);
      break;
    }
    case "net": {
      sfx.netHit();
      const at = env.at(match.shuttle.pos.x, 0, COURT.netHeight + 0.5);
      pop(fx, "NET!", at.x, at.y, "#e0607e", 28);
      break;
    }
    case "land": {
      sfx.shuttleLand();
      const at = env.at(e.x, e.y, 0.4);
      pop(fx, e.inside ? "IN!" : "OUT!", at.x, at.y, e.inside ? "#3a9474" : "#e0607e", 28);
      burst(fx, at.x, at.y + 6, "spark", count(5), 0.6);
      break;
    }
    case "combo": {
      const couple = env.coupleTeam(e.side);
      banner(fx, COMBO_TEXT[e.kind](couple), e.kind === "love_combo" ? "Save + finish together" : e.kind === "sakura_duo" ? "Both partners smashed" : "Two perfect partners", couple ? "#e7779f" : "#8a73c8", 1.3);
      burst(fx, env.width / 2, env.height * 0.42, "petal", count(18), 1.2);
      sfx.love();
      break;
    }
    case "over":
      fx.cheer = 1.6;
      break;
    default:
      break;
  }
}
