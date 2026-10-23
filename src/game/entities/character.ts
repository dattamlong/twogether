import { Container, Graphics, Text } from "pixi.js";
import type { Avatar } from "@/features/session/types";
import type { CharacterAnim, Facing } from "@/features/realtime/couple-channel";

const OUTLINE = 0x45365b;
const hex = (color: string) => Number.parseInt(color.replace("#", ""), 16);

type Pose = {
  rigY: number;
  lean: number;
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  headTilt: number;
  lie: number;
  spin: number;
};

const NEUTRAL: Pose = { rigY: 0, lean: 0, legL: 0, legR: 0, armL: 0.15, armR: -0.15, headTilt: 0, lie: 0, spin: 1 };

function shade(color: number, amount: number) {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (color & 0xff) + amount));
  return (r << 16) | (g << 8) | b;
}

export class Character extends Container {
  readonly rig = new Container();
  private readonly shadow = new Graphics();
  private readonly legL = new Graphics();
  private readonly legR = new Graphics();
  private readonly body = new Graphics();
  private readonly armL = new Graphics();
  private readonly armR = new Graphics();
  private readonly head = new Container();
  private readonly hairBack = new Graphics();
  private readonly face = new Graphics();
  private readonly eyes = new Graphics();
  private readonly mouth = new Graphics();
  private readonly hairFront = new Graphics();
  private readonly accessory = new Graphics();
  private readonly prop = new Graphics();
  private readonly nameTag: Text;
  private readonly statusDot = new Graphics();

  anim: CharacterAnim = "idle";
  facing: Facing = "se";
  private avatar: Avatar;
  private time = Math.random() * 10;
  private animTime = 0;
  private blinkIn = 2 + Math.random() * 3;
  private blinking = 0;
  private pose: Pose = { ...NEUTRAL };
  private eyeState: "open" | "closed" | "happy" | "blink" = "open";

  constructor(avatar: Avatar, name: string) {
    super();
    this.avatar = avatar;
    this.sortableChildren = false;

    this.shadow.ellipse(0, 0, 15, 6).fill({ color: OUTLINE, alpha: 0.18 });
    this.addChild(this.shadow, this.rig);
    this.head.addChild(this.hairBack, this.face, this.eyes, this.mouth, this.hairFront, this.accessory);
    this.rig.addChild(this.legL, this.legR, this.armL, this.body, this.prop, this.armR, this.head);
    this.head.position.set(0, -34);
    this.legL.position.set(-4.5, -9);
    this.legR.position.set(4.5, -9);
    this.armL.position.set(-9, -24);
    this.armR.position.set(9, -24);

    this.nameTag = new Text({
      text: name,
      style: { fontFamily: "Fredoka, Nunito, sans-serif", fontSize: 12, fontWeight: "600", fill: 0x45365b, stroke: { color: 0xffffff, width: 4 } },
      resolution: 3,
    });
    this.nameTag.anchor.set(0.5, 1);
    this.nameTag.position.set(0, -68);
    this.statusDot.position.set(-this.nameTag.width / 2 - 7, -74);
    this.addChild(this.nameTag, this.statusDot);
    this.redraw();
  }

  setAvatar(avatar: Avatar) {
    this.avatar = avatar;
    this.redraw();
  }

  setName(name: string) {
    this.nameTag.text = name;
    this.statusDot.position.set(-this.nameTag.width / 2 - 7, -74);
  }

  setStatus(status: "online" | "away" | "offline" | "self") {
    this.statusDot.clear();
    if (status === "self") return;
    const color = status === "online" ? 0x6cc3a2 : status === "away" ? 0xf5cb78 : 0xc7b8ea;
    this.statusDot.circle(0, 0, 4).fill(color).stroke({ color: 0xffffff, width: 2 });
  }

  setDimmed(dimmed: boolean) {
    this.alpha = dimmed ? 0.72 : 1;
  }

  setAnim(anim: CharacterAnim) {
    if (anim === this.anim) return;
    this.anim = anim;
    this.animTime = 0;
    this.prop.clear();
    if (anim === "study") this.drawBook();
    if (anim === "gift") this.drawGiftBox();
  }

  setFacing(facing: Facing) {
    if (facing === this.facing) return;
    this.facing = facing;
    this.redraw();
  }

  private get facingBack() {
    return this.facing === "ne" || this.facing === "nw";
  }

  private redraw() {
    const a = this.avatar;
    const skin = hex(a.skin);
    const hair = hex(a.hairColor);
    const outfit = hex(a.outfitColor);
    const back = this.facingBack;
    this.rig.scale.x = this.facing === "sw" || this.facing === "nw" ? -1 : 1;

    for (const leg of [this.legL, this.legR]) {
      leg.clear();
      leg.roundRect(-3, 0, 6, 10, 3).fill(a.outfit === "overalls" ? shade(outfit, -40) : 0x6a5583);
      leg.roundRect(-3.5, 7, 7, 4, 2).fill(0x8a73c8);
    }

    this.body.clear();
    if (a.outfit === "yukata_sakura") {
      this.body.roundRect(-10, -27, 20, 22, 9).fill(0xfde4ee).stroke({ color: OUTLINE, width: 1.5, alpha: 0.6 });
      this.body.poly([-6, -26, 0, -17, 6, -26]).fill(0xe7779f);
      this.body.rect(-10, -14, 20, 4).fill(0xc7b8ea);
      for (const [x, y] of [[-5, -8], [5, -20], [-6, -20]]) this.body.circle(x, y, 1.6).fill(0xf39bbb);
    } else if (a.outfit === "hoodie_lavender") {
      this.body.roundRect(-11, -27, 22, 21, 9).fill(0xc7b8ea).stroke({ color: OUTLINE, width: 1.5, alpha: 0.6 });
      this.body.roundRect(-6, -15, 12, 6, 3).fill(0xa995dc);
      if (!back) this.body.moveTo(-3, -26).lineTo(-3, -20).moveTo(3, -26).lineTo(3, -20).stroke({ color: 0xffffff, width: 1.5 });
    } else if (a.outfit === "sweater_mint") {
      this.body.roundRect(-11, -27, 22, 21, 9).fill(0xbce5d5).stroke({ color: OUTLINE, width: 1.5, alpha: 0.6 });
      for (let y = -22; y < -8; y += 4) this.body.moveTo(-9, y).lineTo(9, y).stroke({ color: 0x6cc3a2, width: 1, alpha: 0.5 });
    } else {
      this.body.roundRect(-10, -27, 20, 20, 8).fill(outfit).stroke({ color: OUTLINE, width: 1.5, alpha: 0.6 });
      if (a.outfit === "overalls") {
        this.body.roundRect(-7, -18, 14, 11, 3).fill(shade(outfit, -40));
        this.body.moveTo(-5, -26).lineTo(-5, -18).moveTo(5, -26).lineTo(5, -18).stroke({ color: shade(outfit, -40), width: 2 });
      } else if (!back) {
        this.body.moveTo(-3, -16).bezierCurveTo(-3, -19, 0, -19, 0, -16.5).bezierCurveTo(0, -19, 3, -19, 3, -16).lineTo(0, -13).closePath().fill({ color: 0xffffff, alpha: 0.7 });
      }
    }

    for (const arm of [this.armL, this.armR]) {
      arm.clear();
      arm.roundRect(-2.8, 0, 5.6, 13, 2.8).fill(a.outfit === "tee" || a.outfit === "overalls" ? skin : this.sleeveColor(outfit));
      arm.circle(0, 13, 3).fill(skin);
    }

    this.face.clear();
    this.face.ellipse(0, 0, 17, 15.5).fill(skin).stroke({ color: OUTLINE, width: 1.5, alpha: 0.55 });
    if (!back) {
      this.face.ellipse(-10, 8, 3.6, 2.2).fill({ color: 0xf39bbb, alpha: 0.55 });
      this.face.ellipse(10, 8, 3.6, 2.2).fill({ color: 0xf39bbb, alpha: 0.55 });
    }
    this.eyes.visible = !back;
    this.mouth.visible = !back;

    this.hairBack.clear();
    this.hairFront.clear();
    this.drawHair(hair, back);

    this.accessory.clear();
    this.drawAccessory(back);
    this.drawEyes();
    this.drawMouth();
  }

  private sleeveColor(outfit: number) {
    const map: Record<string, number> = { hoodie_lavender: 0xc7b8ea, sweater_mint: 0xbce5d5, yukata_sakura: 0xfde4ee };
    return map[this.avatar.outfit] ?? outfit;
  }

  private drawHair(color: number, back: boolean) {
    const dark = shade(color, -25);
    const light = shade(color, 35);
    const hb = this.hairBack;
    const hf = this.hairFront;
    const style = this.avatar.hair;

    if (style === "long") hb.roundRect(-18, -6, 36, 30, 12).fill(color);
    if (style === "bob") hb.roundRect(-18.5, -8, 37, 21, 10).fill(color);
    if (style === "twintails") {
      hb.ellipse(-21, 8, 6, 13).fill(color);
      hb.ellipse(21, 8, 6, 13).fill(color);
      hb.circle(-17, -6, 3.5).fill(0xe7779f);
      hb.circle(17, -6, 3.5).fill(0xe7779f);
    }
    if (style === "bun") hb.circle(0, -17, 8).fill(color).stroke({ color: dark, width: 1.2 });

    hf.ellipse(0, -9, 18.5, 9.5).fill(color);
    if (back) {
      hf.ellipse(0, 1, 18, 15).fill(color);
      if (style === "long" || style === "bob") hf.roundRect(-18, -2, 36, style === "long" ? 26 : 15, 10).fill(color);
      hf.moveTo(-8, -10).quadraticCurveTo(0, -14, 8, -10).stroke({ color: light, width: 2, alpha: 0.6 });
      return;
    }

    if (style === "spiky") {
      hf.poly([-18, -3, -14, -17, -8, -10, -3, -20, 2, -11, 8, -19, 12, -10, 18, -14, 18, -3, 10, -6, 4, -2, -2, -6, -9, -2, -14, -6]).fill(color);
    } else if (style === "short") {
      hf.poly([-18, -3, -16, -12, 16, -12, 18, -3, 12, -6, 6, -3, 0, -7, -6, -3, -12, -6]).fill(color);
    } else {
      hf.poly([-18, 0, -17, -10, 17, -10, 18, 0, 13, -4, 9, -2, 4, -5, -1, -2, -6, -5, -11, -2, -14, -5]).fill(color);
    }
    hf.ellipse(-6, -12, 6, 2.2).fill({ color: light, alpha: 0.7 });
    hf.ellipse(0, -9, 18.5, 9.5).stroke({ color: dark, width: 1.2, alpha: 0.4 });
  }

  private drawAccessory(back: boolean) {
    const g = this.accessory;
    switch (this.avatar.accessory) {
      case "bow":
        g.poly([2, -16, 12, -22, 12, -10]).fill(0xe7779f);
        g.poly([2, -16, -8, -22, -8, -10]).fill(0xe7779f);
        g.circle(2, -16, 3).fill(0xd45a86);
        break;
      case "glasses":
        if (back) break;
        g.circle(-6.5, 3.5, 4.6).stroke({ color: OUTLINE, width: 1.6 });
        g.circle(6.5, 3.5, 4.6).stroke({ color: OUTLINE, width: 1.6 });
        g.moveTo(-2, 3.5).lineTo(2, 3.5).stroke({ color: OUTLINE, width: 1.6 });
        break;
      case "flower_crown":
        for (let i = -3; i <= 3; i++) {
          const x = i * 5;
          const y = -15 + Math.abs(i) * 1.2;
          g.circle(x, y, 3).fill(i % 2 ? 0xf8bbd0 : 0xfbe3b1);
          g.circle(x, y, 1.2).fill(0xf5cb78);
        }
        break;
      case "beanie":
        g.roundRect(-18, -20, 36, 14, 7).fill(0xa995dc);
        g.rect(-18, -10, 36, 4).fill(0x8a73c8);
        g.circle(0, -21, 4).fill(0xfff7ed);
        break;
    }
  }

  private drawEyes() {
    const g = this.eyes;
    g.clear();
    const color = hex(this.avatar.eyes);
    const state = this.blinking > 0 ? "blink" : this.eyeState;
    if (state === "closed" || state === "blink") {
      g.moveTo(-10, 4).quadraticCurveTo(-6.5, 6.5, -3, 4).stroke({ color: OUTLINE, width: 1.8 });
      g.moveTo(3, 4).quadraticCurveTo(6.5, 6.5, 10, 4).stroke({ color: OUTLINE, width: 1.8 });
      return;
    }
    if (state === "happy") {
      g.moveTo(-10, 5).quadraticCurveTo(-6.5, 0.5, -3, 5).stroke({ color: OUTLINE, width: 2 });
      g.moveTo(3, 5).quadraticCurveTo(6.5, 0.5, 10, 5).stroke({ color: OUTLINE, width: 2 });
      return;
    }
    for (const x of [-6.5, 6.5]) {
      g.ellipse(x, 3.5, 3.4, 4.4).fill(color);
      g.ellipse(x, 5.2, 2.4, 1.9).fill({ color: shade(color, 40), alpha: 0.6 });
      g.circle(x + 1.2, 1.8, 1.4).fill(0xffffff);
      g.circle(x - 1, 5.2, 0.7).fill(0xffffff);
    }
  }

  private drawMouth() {
    const g = this.mouth;
    g.clear();
    if (this.anim === "celebrate" || this.anim === "gift") {
      g.ellipse(0, 10.5, 2.6, 2.2).fill(0xd45a86);
    } else if (this.anim === "sleep") {
      g.circle(0, 10.5, 1.2).fill({ color: OUTLINE, alpha: 0.6 });
    } else {
      g.moveTo(-2.8, 9.5).quadraticCurveTo(0, 12.3, 2.8, 9.5).stroke({ color: OUTLINE, width: 1.6 });
    }
  }

  private drawBook() {
    this.prop.roundRect(-9, -22, 18, 12, 2).fill(0xfff7ed).stroke({ color: 0xa995dc, width: 1.5 });
    this.prop.moveTo(0, -22).lineTo(0, -10).stroke({ color: 0xa995dc, width: 1 });
    this.prop.moveTo(-6, -18).lineTo(-2, -18).moveTo(2, -18).lineTo(6, -18).stroke({ color: 0xc7b8ea, width: 1 });
  }

  private drawGiftBox() {
    this.prop.roundRect(-8, -50, 16, 13, 2).fill(0xf8bbd0).stroke({ color: 0xe7779f, width: 1.5 });
    this.prop.rect(-1.5, -50, 3, 13).fill(0xf5cb78);
    this.prop.circle(-3, -52, 3).stroke({ color: 0xf5cb78, width: 2 });
    this.prop.circle(3, -52, 3).stroke({ color: 0xf5cb78, width: 2 });
  }

  update(deltaMs: number, reducedMotion: boolean) {
    const dt = Math.min(deltaMs, 50) / 1000;
    this.time += dt;
    this.animTime += dt;
    const t = this.time;
    const motion = reducedMotion ? 0.25 : 1;

    const target: Pose = { ...NEUTRAL };
    let eyes: typeof this.eyeState = "open";
    switch (this.anim) {
      case "idle":
        target.rigY = Math.sin(t * 2.2) * 0.8 * motion;
        target.armL = 0.15 + Math.sin(t * 2.2) * 0.05;
        target.armR = -0.15 - Math.sin(t * 2.2) * 0.05;
        break;
      case "walk": {
        const s = Math.sin(t * 11);
        target.rigY = -Math.abs(s) * 2.6 * motion;
        target.legL = s * 0.55;
        target.legR = -s * 0.55;
        target.armL = 0.15 - s * 0.6;
        target.armR = -0.15 - s * 0.6;
        break;
      }
      case "sit":
        target.rigY = 7;
        target.legL = -1.25;
        target.legR = -1.25;
        target.armL = 0.5;
        target.armR = -0.5;
        break;
      case "study":
        target.rigY = 7;
        target.legL = -1.25;
        target.legR = -1.25;
        target.armL = -0.9;
        target.armR = 0.9;
        target.headTilt = 0.12 + Math.sin(t * 1.6) * 0.06 * motion;
        break;
      case "happy":
        target.rigY = -Math.abs(Math.sin(t * 7)) * 6 * motion;
        target.armL = 0.9;
        target.armR = -0.9;
        eyes = "happy";
        break;
      case "celebrate":
        target.rigY = -Math.abs(Math.sin(t * 8)) * 10 * motion;
        target.armL = 2.6 + Math.sin(t * 16) * 0.2;
        target.armR = -2.6 - Math.sin(t * 16) * 0.2;
        eyes = "happy";
        break;
      case "sleep":
        target.lie = 1;
        target.rigY = 2 + Math.sin(t * 1.4) * 0.6 * motion;
        eyes = "closed";
        break;
      case "hug":
        target.lean = 0.12;
        target.armL = -1.4;
        target.armR = -1.7;
        target.rigY = Math.sin(t * 3) * 0.8 * motion;
        eyes = "happy";
        break;
      case "wave":
        target.armR = -2.5 + Math.sin(t * 12) * 0.45 * motion;
        target.rigY = Math.sin(t * 3) * 0.6 * motion;
        eyes = "happy";
        break;
      case "gift":
        target.armL = 2.8;
        target.armR = -2.8;
        target.rigY = -Math.abs(Math.sin(t * 6)) * 4 * motion;
        break;
      case "twirl":
        target.spin = Math.cos(this.animTime * 9);
        target.rigY = -Math.abs(Math.sin(this.animTime * 4.5)) * 5 * motion;
        target.armL = 1.3;
        target.armR = -1.3;
        eyes = "happy";
        break;
    }

    const k = 1 - Math.exp(-dt * (this.anim === "walk" ? 20 : 12));
    for (const key of Object.keys(target) as (keyof Pose)[]) {
      this.pose[key] = key === "spin" && this.anim === "twirl" ? target.spin : this.pose[key] + (target[key] - this.pose[key]) * k;
    }

    this.blinkIn -= dt;
    if (this.blinkIn <= 0 && eyes === "open") {
      this.blinking = 0.13;
      this.blinkIn = 2.5 + Math.random() * 3.5;
    }
    const wasBlinking = this.blinking > 0;
    this.blinking = Math.max(0, this.blinking - dt);
    if (eyes !== this.eyeState || wasBlinking !== this.blinking > 0) {
      this.eyeState = eyes;
      this.drawEyes();
      this.drawMouth();
    }

    const p = this.pose;
    this.rig.y = p.rigY;
    const facingSign = this.facing === "sw" || this.facing === "nw" ? -1 : 1;
    this.rig.rotation = p.lean * facingSign - p.lie * 1.35;
    this.rig.scale.x = facingSign * (Math.abs(p.spin) < 0.08 ? 0.08 * Math.sign(p.spin || 1) : p.spin);
    this.legL.rotation = p.legL;
    this.legR.rotation = p.legR;
    this.legL.visible = this.legR.visible = p.lie < 0.5;
    this.armL.rotation = p.armL;
    this.armR.rotation = p.armR;
    this.head.rotation = p.headTilt;
    this.shadow.scale.set(p.lie > 0.5 ? 1.6 : 1 + Math.min(0, p.rigY) * 0.02, 1);
  }
}
