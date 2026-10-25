import { COURT } from "@/features/love-smash/court";
import { banner, burst, impact, pop, type Fx } from "@/features/love-smash/render";
import type { ComboKind, Match, SimEvent } from "@/features/love-smash/sim";
import { SKILLS } from "@/features/love-smash/skills";
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

const FAIL_TEXT = { energy: "Need energy", cooldown: "Cooling down", locked: "Not equipped", position: "Too low!" } as const;

export function playSkillFx(e: SimEvent, env: FxEnv) {
  const { match, fx } = env;
  const count = (n: number) => (env.reduced ? Math.ceil(n / 4) : n);
  switch (e.type) {
    case "skill": {
      const p = match.players[e.slot];
      const body = env.at(p.x, p.y, 1);
      if (e.skill === "love_sync") {
        const couple = env.coupleTeam(e.side);
        banner(fx, couple ? "💗 LOVE SYNC! 💗" : "✨ DUO SYNC ✨", "Next attack is supercharged", couple ? "#e7779f" : "#8a73c8", 1.3);
        burst(fx, env.width / 2, env.height * 0.45, "heart", count(20), 1.3);
        burst(fx, body.x, body.y, "petal", count(10), 0.8);
        sfx.loveSync();
      } else if (e.skill === "lightning_dash") {
        burst(fx, body.x, body.y, "bolt", count(9), 0.9);
        burst(fx, body.x, body.y, "streak", count(6), 0.8);
        sfx.dash();
      } else if (e.skill === "frost_drop") {
        burst(fx, body.x, body.y - 30, "snow", count(14), 0.7);
        pop(fx, "❄️ FROST DROP", body.x, body.y - 60, "#6fb5e3", 22);
        sfx.frostDrop();
      } else if (e.skill === "phoenix_drive") {
        burst(fx, body.x, body.y - 30, "ember", count(16), 1);
        pop(fx, "🔥 PHOENIX DRIVE", body.x, body.y - 60, "#d9825f", 22);
        impact(fx, body.x, body.y - 30, "#f6a88a", 0.9);
        sfx.phoenixDrive();
      } else if (e.skill === "sakura_meteor") {
        banner(fx, "🌸 SAKURA METEOR! 🌸", SKILLS.sakura_meteor.name, "#e7779f", 1.2);
        burst(fx, body.x, body.y - 40, "petal", count(34), 1.7);
        impact(fx, body.x, body.y - 40, "#e7779f", 1.7);
        fx.shake = env.reduced ? 0 : 0.85;
        fx.flash = 1;
        sfx.meteor();
      }
      break;
    }
    case "hit":
      if (e.skill === "frost_drop") fx.trailKind = "frost";
      else if (e.skill === "phoenix_drive") fx.trailKind = "phoenix";
      else if (e.skill === "sakura_meteor") fx.trailKind = "sakura";
      if (e.sync) {
        fx.trailKind = "sync";
        const at = env.at(match.shuttle.pos.x, match.shuttle.pos.y, match.shuttle.pos.z);
        burst(fx, at.x, at.y, "heart", count(10), 1);
        pop(fx, env.coupleTeam(e.side) ? "💗 SYNC SHOT" : "✨ SYNC SHOT", at.x, at.y - 30, "#c2527c", 22);
      }
      break;
    case "skill_fail": {
      if (e.slot !== env.mySlot) break;
      const p = match.players[e.slot];
      const head = env.at(p.x, p.y, 2.4);
      pop(fx, FAIL_TEXT[e.reason], head.x, head.y, "#9a8288", 16);
      sfx.skillFail();
      break;
    }
    case "counter": {
      banner(fx, "⚡ PERFECT COUNTER! ⚡", "Read it, dashed, returned it", "#6fb5e3", 1.2);
      const p = match.players[e.slot];
      const body = env.at(p.x, p.y, 1.2);
      burst(fx, body.x, body.y, "bolt", count(12), 1.2);
      sfx.counter();
      break;
    }
    case "sync_ready": {
      const couple = env.coupleTeam(e.side);
      if (e.side === match.players[env.mySlot]?.side) {
        banner(fx, couple ? "💗 LOVE SYNC READY! 💗" : "✨ DUO SYNC READY ✨", "Press F / tap SYNC together", couple ? "#e7779f" : "#8a73c8", 1.4);
        sfx.skillReady();
      }
      break;
    }
    default:
      break;
  }
}

export function playEventFx(e: SimEvent, env: FxEnv) {
  const { match, fx } = env;
  playSkillFx(e, env);
  const count = (n: number) => (env.reduced ? Math.ceil(n / 4) : n);
  const mine = (slot: number) => slot === env.mySlot;
  switch (e.type) {
    case "hit": {
      const p = match.players[e.slot];
      const head = env.at(p.x, p.y, 2.3);
      const at = env.at(match.shuttle.pos.x, match.shuttle.pos.y, match.shuttle.pos.z);
      fx.trail = [];
      if (!e.skill && !e.sync) fx.trailKind = e.sakura ? "sakura" : e.shot === "smash" ? "smash" : "normal";
      if (e.sakura && e.skill !== "sakura_meteor") {
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
