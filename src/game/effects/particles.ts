import { Container, Graphics, Text } from "pixi.js";

export type ParticleKind = "heart" | "sparkle" | "zzz" | "note" | "dust" | "petal";

type Particle = {
  node: Container;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  spin: number;
  wobble: number;
  kind: ParticleKind;
};

function heartShape(g: Graphics, size: number, color: number) {
  g.moveTo(0, size * 0.35)
    .bezierCurveTo(-size, -size * 0.3, -size * 0.45, -size, 0, -size * 0.45)
    .bezierCurveTo(size * 0.45, -size, size, -size * 0.3, 0, size * 0.35)
    .fill(color);
}

function sparkleShape(g: Graphics, size: number, color: number) {
  g.poly([0, -size, size * 0.25, -size * 0.25, size, 0, size * 0.25, size * 0.25, 0, size, -size * 0.25, size * 0.25, -size, 0, -size * 0.25, -size * 0.25]).fill(color);
}

export class ParticleLayer extends Container {
  private particles: Particle[] = [];
  reducedMotion = false;

  spawn(kind: ParticleKind, x: number, y: number, count = 1) {
    const total = this.reducedMotion ? Math.min(count, 2) : count;
    for (let i = 0; i < total; i++) {
      let node: Container;
      if (kind === "zzz") {
        node = new Text({ text: "z", style: { fontFamily: "Fredoka, sans-serif", fontSize: 14 + Math.random() * 6, fontWeight: "700", fill: 0xa995dc }, resolution: 2 });
      } else if (kind === "note") {
        node = new Text({ text: "♪", style: { fontFamily: "sans-serif", fontSize: 16, fill: 0x8a73c8 }, resolution: 2 });
      } else {
        const g = new Graphics();
        if (kind === "heart") heartShape(g, 6 + Math.random() * 5, [0xe7779f, 0xf39bbb, 0xf8bbd0][i % 3]);
        else if (kind === "sparkle") sparkleShape(g, 4 + Math.random() * 4, [0xf5cb78, 0xffffff, 0xc7b8ea][i % 3]);
        else if (kind === "petal") g.ellipse(0, 0, 4 + Math.random() * 2, 2.2 + Math.random()).fill([0xf8bbd0, 0xf39bbb, 0xfde4ee][i % 3]);
        else g.circle(0, 0, 1 + Math.random() * 1.4).fill({ color: 0xffffff, alpha: 0.8 });
        node = g;
      }
      const spread = kind === "dust" || kind === "petal" ? 120 : 24;
      node.position.set(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * (kind === "dust" ? 80 : kind === "petal" ? 40 : 10));
      this.addChild(node);
      const burst = kind === "sparkle" && count > 3;
      this.particles.push({
        node,
        kind,
        vx: burst ? (Math.random() - 0.5) * 140 : (Math.random() - 0.5) * 18,
        vy: burst ? -60 - Math.random() * 90 : kind === "dust" ? -4 - Math.random() * 4 : kind === "petal" ? 18 + Math.random() * 16 : -30 - Math.random() * 20,
        life: 0,
        maxLife: kind === "dust" ? 5 + Math.random() * 4 : kind === "petal" ? 2.6 + Math.random() * 1.4 : 1.4 + Math.random() * 0.8,
        spin: (Math.random() - 0.5) * 2,
        wobble: Math.random() * Math.PI * 2,
      });
    }
  }

  update(deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      const t = p.life / p.maxLife;
      p.node.x += (p.vx + Math.sin(p.life * 3 + p.wobble) * (p.kind === "dust" ? 6 : 10)) * dt;
      p.node.y += p.vy * dt;
      if (p.kind === "sparkle" || p.kind === "petal") p.node.rotation += p.spin * dt * 3;
      p.node.alpha = p.kind === "dust" ? Math.sin(Math.PI * t) * 0.7 : t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.6) / 0.4);
      p.node.scale.set(p.kind === "dust" ? 1 : 0.7 + Math.min(t * 2, 0.5));
      if (p.life >= p.maxLife) {
        p.node.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  get dustCount() {
    return this.particles.filter((p) => p.kind === "dust").length;
  }
}
