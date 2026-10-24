import { Application, Container, Graphics, type FederatedPointerEvent } from "pixi.js";
import type { Avatar } from "@/features/session/types";
import type { BroadcastEvent, CharacterAnim, Envelope, Facing, PresenceState } from "@/features/realtime/couple-channel";
import { sortByDepth, type DepthBox } from "../engine/depth";
import { facingBetween, screenToTile, tileToScreen } from "../engine/iso";
import { ParticleLayer } from "../effects/particles";
import { Character } from "../entities/character";
import { drawFurniture, type FurnitureArt } from "../entities/furniture";
import { createWalkGrid, findPath, isWalkable, nearestReachable, type WalkGrid } from "../movement/pathfinding";
import { placedBlockingTiles, placementProblem, type Placement } from "../world/placement";
import { FIXTURES, SPAWN_TILES, activeFixtures, footprintTiles, inBounds, tileKey, type Fixture, type RoomAction, type Tile } from "../world/room";
import { drawRoomShell, roomScreenBounds, timeOfDay, type RoomShell } from "./room-shell";

const WALK_SPEED = 2.9;
const GUESTBOOK_TILE = { x: 10.45, y: 7.6 };
export const GUEST_SPAWN: Tile = SPAWN_TILES[1];
const BED_SPOTS: [Tile, Tile] = [
  { x: 0.6, y: 1.3 },
  { x: 1.4, y: 1.3 },
];

type Walker = {
  character: Character;
  pos: { x: number; y: number };
  path: Tile[];
  attachedTo: string | null;
  onArrive: (() => void) | null;
  timedAnimUntil: number;
  zzzTimer: number;
};

export type RoomCallbacks = {
  onAction: (action: RoomAction | "sofa_together", fixture: Fixture) => void;
  onPartnerTap: () => void;
  onBroadcast: (event: BroadcastEvent) => void;
  onPresence: (patch: Partial<PresenceState>) => void;
  onPlaceTile: (tile: Tile) => void;
  onBlockedTap: () => void;
  onRemoteTap?: (userId: string) => void;
  onGuestbook?: () => void;
};

export type RemoteView = {
  id: string;
  name: string;
  avatar: Avatar;
  role: "host" | "guest";
  tile: Tile;
  facing: Facing;
  anim: CharacterAnim;
};

export type PartnerView =
  | { mode: "hidden" }
  | { mode: "resting"; name: string; avatar: Avatar }
  | { mode: "present"; name: string; avatar: Avatar; presence: PresenceState };

export type DecorDraft = { itemId: string; w: number; h: number; flipped: boolean; inventoryId: string } | null;

type Options = {
  host: HTMLElement;
  self: { name: string; avatar: Avatar; slot: 0 | 1 };
  homeLevel: number;
  reducedMotion: boolean;
  callbacks: RoomCallbacks;
  mode?: "home" | "visit";
  spawn?: Tile;
};

export class RoomScene {
  private app = new Application();
  private world = new Container();
  private shellLayer = new Container();
  private floorLayer = new Container();
  private objectLayer = new Container();
  private fxLayer = new ParticleLayer();
  private overlayLayer = new Container();
  private shell: RoomShell | null = null;
  private fixtureArt = new Map<string, FurnitureArt>();
  private placementArt = new Map<string, FurnitureArt>();
  private depthBoxes = new Map<string, DepthBox>();
  private nodes = new Map<string, Container>();
  private grid: WalkGrid;
  private self: Walker;
  private partner: Walker;
  private partnerView: PartnerView = { mode: "hidden" };
  private remotes = new Map<string, Walker>();
  private remoteViews = new Map<string, RemoteView>();
  private guestbook: Container | null = null;
  private mode: "home" | "visit";
  private flights: { node: Graphics; from: { x: number; y: number }; to: () => { x: number; y: number }; t: number; duration: number; onLand: () => void }[] = [];
  private placements: Placement[] = [];
  private homeLevel: number;
  private reducedMotion: boolean;
  private callbacks: RoomCallbacks;
  private slot: 0 | 1;
  private time = 0;
  private decor: DecorDraft = null;
  private ghost = new Graphics();
  private hoverMarker = new Graphics();
  private panEnabled = false;
  private drag: { startX: number; startY: number; worldX: number; worldY: number; moved: boolean } | null = null;
  private destroyed = false;
  private ready = false;
  private resizeObserver: ResizeObserver | null = null;
  private visibilityHandler = () => {
    if (document.hidden) this.app.ticker?.stop();
    else this.app.ticker?.start();
  };

  constructor(private options: Options) {
    this.homeLevel = options.homeLevel;
    this.reducedMotion = options.reducedMotion;
    this.callbacks = options.callbacks;
    this.slot = options.self.slot;
    this.mode = options.mode ?? "home";
    this.grid = this.buildGrid();
    const spawn = options.spawn ?? SPAWN_TILES[this.slot];
    this.self = this.makeWalker(new Character(options.self.avatar, options.self.name), spawn);
    this.self.character.setStatus("self");
    this.partner = this.makeWalker(new Character(options.self.avatar, ""), SPAWN_TILES[this.slot === 0 ? 1 : 0]);
    this.partner.character.visible = false;
  }

  async init() {
    const host = this.options.host;
    await this.app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: "webgl",
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    host.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = "none";
    this.app.canvas.setAttribute("aria-label", "Your shared isometric room. Tap the floor to walk, tap furniture to interact.");

    this.world.addChild(this.shellLayer, this.floorLayer, this.objectLayer, this.fxLayer, this.overlayLayer);
    this.objectLayer.sortableChildren = true;
    for (const layer of [this.shellLayer, this.floorLayer, this.fxLayer, this.overlayLayer]) layer.eventMode = "none";
    this.overlayLayer.addChild(this.hoverMarker, this.ghost);
    this.app.stage.addChild(this.world);
    this.fxLayer.reducedMotion = this.reducedMotion;

    this.buildRoom();
    this.addWalkerNode("self", this.self);
    this.addWalkerNode("partner", this.partner);
    for (const [id, walker] of this.remotes) this.addWalkerNode(`remote:${id}`, walker);
    this.partner.character.eventMode = "static";
    this.partner.character.cursor = "pointer";
    this.buildGuestbook();

    this.setupInput();
    this.fit();
    this.resizeObserver = new ResizeObserver(() => this.fit());
    this.resizeObserver.observe(host);
    document.addEventListener("visibilitychange", this.visibilityHandler);
    this.app.ticker.add((ticker) => this.tick(ticker.deltaMS));
    this.ready = true;
    this.publishSelf();
  }

  destroy() {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    document.removeEventListener("visibilitychange", this.visibilityHandler);
    if (this.ready) this.app.destroy(true, { children: true });
  }

  private makeWalker(character: Character, tile: Tile): Walker {
    return { character, pos: { x: tile.x + 0.5, y: tile.y + 0.5 }, path: [], attachedTo: null, onArrive: null, timedAnimUntil: 0, zzzTimer: 0 };
  }

  private buildGrid() {
    const blocking = activeFixtures(this.homeLevel).filter((f) => f.blocking);
    const seats = FIXTURES.flatMap((f) => f.seats?.map((s) => s.tile) ?? []);
    return createWalkGrid([...blocking.flatMap(footprintTiles), ...placedBlockingTiles(this.placements)], seats);
  }

  private buildRoom() {
    this.shellLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.shell = drawRoomShell(this.homeLevel, timeOfDay());
    this.shellLayer.addChild(this.shell.container);

    for (const [id, art] of this.fixtureArt) {
      art.container.destroy({ children: true });
      this.nodes.delete(id);
      this.depthBoxes.delete(id);
    }
    this.fixtureArt.clear();
    for (const fixture of activeFixtures(this.homeLevel)) {
      const art = drawFurniture(fixture.kind, fixture.w, fixture.h);
      const origin = tileToScreen(fixture.x, fixture.y);
      art.container.position.set(origin.x, origin.y);
      if (fixture.kind === "rug") {
        this.floorLayer.addChild(art.container);
      } else {
        this.objectLayer.addChild(art.container);
        this.nodes.set(fixture.id, art.container);
        this.depthBoxes.set(fixture.id, { id: fixture.id, x: fixture.x, y: fixture.y, w: fixture.w, h: fixture.h });
      }
      if (fixture.action) {
        art.container.eventMode = "static";
        art.container.cursor = "pointer";
      }
      art.container.label = `fixture:${fixture.id}`;
      this.fixtureArt.set(fixture.id, art);
    }
    this.objectLayer.addChild(this.shell.nightShade);
    this.shell.nightShade.zIndex = 10_000;
    this.shell.nightShade.eventMode = "none";
    this.renderPlacements();
  }

  private renderPlacements() {
    for (const [id, art] of this.placementArt) {
      art.container.destroy({ children: true });
      this.nodes.delete(id);
      this.depthBoxes.delete(id);
    }
    this.placementArt.clear();
    for (const p of this.placements) {
      const id = `placed:${p.inventoryId}`;
      const art = drawFurniture(p.itemId, p.w, p.h, p.flipped);
      const origin = tileToScreen(p.x, p.y);
      art.container.position.set(origin.x, origin.y);
      art.container.label = id;
      if (this.decor?.inventoryId === p.inventoryId) art.container.alpha = 0.35;
      this.objectLayer.addChild(art.container);
      this.placementArt.set(id, art);
      this.nodes.set(id, art.container);
      this.depthBoxes.set(id, { id, x: p.x, y: p.y, w: p.w, h: p.h });
    }
  }

  private addWalkerNode(id: string, walker: Walker) {
    this.objectLayer.addChild(walker.character);
    this.nodes.set(id, walker.character);
    this.placeWalker(walker);
  }

  private placeWalker(walker: Walker) {
    const s = tileToScreen(walker.pos.x, walker.pos.y);
    walker.character.position.set(s.x, s.y);
  }

  private buildGuestbook() {
    if (!this.callbacks.onGuestbook) return;
    const book = new Container();
    const g = new Graphics();
    const base = tileToScreen(GUESTBOOK_TILE.x, GUESTBOOK_TILE.y);
    const glow = new Graphics();
    glow.circle(base.x, base.y - 40, 26).fill({ color: 0xc7b8ea, alpha: 0.35 });
    g.poly([base.x - 10, base.y, base.x + 10, base.y, base.x + 6, base.y - 24, base.x - 6, base.y - 24]).fill(0xc49a83).stroke({ color: 0x45365b, width: 1, alpha: 0.35 });
    g.ellipse(base.x, base.y, 13, 5).fill(0xb3866f);
    g.poly([base.x - 17, base.y - 30, base.x, base.y - 25, base.x, base.y - 40, base.x - 17, base.y - 45]).fill(0xfff7ed).stroke({ color: 0xa995dc, width: 1.4 });
    g.poly([base.x + 17, base.y - 30, base.x, base.y - 25, base.x, base.y - 40, base.x + 17, base.y - 45]).fill(0xfde4ee).stroke({ color: 0xa995dc, width: 1.4 });
    g.moveTo(base.x - 13, base.y - 37).lineTo(base.x - 4, base.y - 34).moveTo(base.x - 13, base.y - 33).lineTo(base.x - 5, base.y - 30).stroke({ color: 0xc7b8ea, width: 1 });
    g.moveTo(base.x + 8, base.y - 33).bezierCurveTo(base.x + 4, base.y - 37, base.x + 7, base.y - 40, base.x + 8, base.y - 38).bezierCurveTo(base.x + 9, base.y - 40, base.x + 12, base.y - 37, base.x + 8, base.y - 33).fill(0xe7779f);
    book.addChild(glow, g);
    book.label = "guestbook";
    book.eventMode = "static";
    book.cursor = "pointer";
    this.objectLayer.addChild(book);
    this.nodes.set("guestbook", book);
    this.depthBoxes.set("guestbook", { id: "guestbook", x: GUESTBOOK_TILE.x - 0.3, y: GUESTBOOK_TILE.y - 0.3, w: 0.6, h: 0.6 });
    this.guestbook = book;
  }

  setRemotes(views: RemoteView[]) {
    const next = new Map(views.map((v) => [v.id, v]));
    for (const [id, walker] of this.remotes) {
      if (next.has(id)) continue;
      if (this.ready) {
        const s = tileToScreen(walker.pos.x, walker.pos.y);
        this.fxLayer.spawn("sparkle", s.x, s.y - 40, 8);
      }
      walker.character.destroy({ children: true });
      this.nodes.delete(`remote:${id}`);
      this.remotes.delete(id);
      this.remoteViews.delete(id);
    }
    for (const view of views) {
      let walker = this.remotes.get(view.id);
      const tile = this.safeTile(view.tile);
      if (!walker) {
        const character = new Character(view.avatar, view.name);
        character.label = `remote:${view.id}`;
        character.eventMode = "static";
        character.cursor = "pointer";
        character.setStatus("online");
        walker = this.makeWalker(character, tile);
        this.remotes.set(view.id, walker);
        if (this.ready) {
          this.addWalkerNode(`remote:${view.id}`, walker);
          const s = tileToScreen(walker.pos.x, walker.pos.y);
          this.fxLayer.spawn("sparkle", s.x, s.y - 50, 12);
        }
        character.setFacing(view.facing);
        character.setAnim(view.anim === "walk" ? "idle" : view.anim);
      } else {
        walker.character.setAvatar(view.avatar);
        const previous = this.remoteViews.get(view.id);
        const moved = !previous || previous.tile.x !== view.tile.x || previous.tile.y !== view.tile.y;
        if (moved && walker.path.length === 0) {
          const distance = Math.hypot(tile.x + 0.5 - walker.pos.x, tile.y + 0.5 - walker.pos.y);
          if (distance > 3) {
            walker.pos = { x: tile.x + 0.5, y: tile.y + 0.5 };
            this.placeWalker(walker);
          } else if (distance > 0.05) {
            walker.path = findPath(this.grid, this.tileOf(walker), tile, []) ?? [];
          }
        }
        if (walker.path.length === 0 && performance.now() > walker.timedAnimUntil) {
          walker.character.setFacing(view.facing);
          walker.character.setAnim(view.anim === "walk" ? "idle" : view.anim);
        }
      }
      walker.character.setName(view.role === "host" ? `${view.name} · host` : view.name);
      this.remoteViews.set(view.id, view);
    }
  }

  applyRemoteFrom(envelope: Envelope) {
    const walker = this.remotes.get(envelope.senderId);
    if (!walker) return;
    if (envelope.type === "move") {
      const from = this.safeTile(envelope.from);
      const path = this.sanitizePath(from, envelope.path);
      const lag = Math.hypot(from.x + 0.5 - walker.pos.x, from.y + 0.5 - walker.pos.y);
      if (lag > 1.5) {
        walker.pos = { x: from.x + 0.5, y: from.y + 0.5 };
        this.placeWalker(walker);
      }
      walker.path = path;
      walker.onArrive = null;
      walker.character.setAnim(path.length ? "walk" : "idle");
    } else if (envelope.type === "pose") {
      walker.path = [];
      const tile = this.safeTile(envelope.tile);
      walker.pos = { x: tile.x + 0.5, y: tile.y + 0.5 };
      this.placeWalker(walker);
      walker.character.setFacing(envelope.facing);
      walker.character.setAnim(["sit", "study", "sleep"].includes(envelope.anim) ? "idle" : envelope.anim);
    } else if (envelope.type === "emote") {
      this.playEmote(walker, envelope.emote);
    }
  }

  private safeTile(tile: Tile): Tile {
    const t = { x: Math.floor(Number(tile?.x)), y: Math.floor(Number(tile?.y)) };
    if (Number.isFinite(t.x) && Number.isFinite(t.y) && inBounds(t) && isWalkable(this.grid, t)) return t;
    return GUEST_SPAWN;
  }

  private sanitizePath(from: Tile, path: Tile[]): Tile[] {
    if (!Array.isArray(path)) return [];
    const clean: Tile[] = [];
    let prev = from;
    for (const step of path.slice(0, 40)) {
      const t = { x: Math.floor(Number(step?.x)), y: Math.floor(Number(step?.y)) };
      const adjacent = Math.abs(t.x - prev.x) <= 1 && Math.abs(t.y - prev.y) <= 1;
      if (!adjacent || !inBounds(t) || !isWalkable(this.grid, t)) {
        const end = path.at(-1);
        return end ? (findPath(this.grid, from, this.safeTile(end), []) ?? clean) : clean;
      }
      clean.push(t);
      prev = t;
    }
    return clean;
  }

  setHomeLevel(level: number) {
    if (level === this.homeLevel) return;
    this.homeLevel = level;
    this.grid = this.buildGrid();
    if (this.ready) {
      this.buildRoom();
      this.fxLayer.spawn("sparkle", 0, 80, 18);
    }
  }

  setPlacements(placements: Placement[]) {
    this.placements = placements;
    this.grid = this.buildGrid();
    if (this.ready) this.renderPlacements();
  }

  setSelfAvatar(avatar: Avatar, name: string) {
    this.self.character.setAvatar(avatar);
    this.self.character.setName(name);
  }

  setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced;
    this.fxLayer.reducedMotion = reduced;
  }

  setDecorMode(draft: DecorDraft) {
    this.decor = draft;
    this.ghost.clear();
    if (this.ready) this.renderPlacements();
  }

  setPartner(view: PartnerView) {
    const previous = this.partnerView;
    this.partnerView = view;
    const p = this.partner;
    const c = p.character;
    if (view.mode === "hidden") {
      c.visible = false;
      return;
    }
    c.visible = true;
    c.setAvatar(view.avatar);
    if (view.mode === "resting") {
      c.setName(`${view.name} · resting`);
      c.setStatus("offline");
      c.setDimmed(true);
      p.path = [];
      p.onArrive = null;
      p.attachedTo = "bed";
      const spot = BED_SPOTS[this.slot === 0 ? 1 : 0];
      p.pos = { x: spot.x, y: spot.y };
      c.setFacing("se");
      c.setAnim("sleep");
      this.placeWalker(p);
      return;
    }

    c.setName(view.name);
    c.setStatus(view.presence.away ? "away" : "online");
    c.setDimmed(false);
    const arrived = previous.mode !== "present";
    if (arrived || (p.path.length === 0 && performance.now() > p.timedAnimUntil)) this.applyPartnerPose(view.presence.tile, view.presence.facing, view.presence.anim, arrived);
  }

  private applyPartnerPose(tile: Tile, facing: Facing, anim: CharacterAnim, snap: boolean) {
    const p = this.partner;
    const attach = this.attachmentFor(tile, anim);
    p.attachedTo = attach?.id ?? null;
    const target = attach ? attach.pos : { x: tile.x + 0.5, y: tile.y + 0.5 };
    const distance = Math.hypot(target.x - p.pos.x, target.y - p.pos.y);
    if (snap || distance > 3 || attach) {
      p.pos = { ...target };
      p.path = [];
      this.placeWalker(p);
    } else if (distance > 0.05) {
      p.path = [{ x: Math.floor(target.x), y: Math.floor(target.y) }];
    }
    p.character.setFacing(facing);
    p.character.setAnim(p.path.length ? "walk" : anim);
    if (anim === "sleep") p.zzzTimer = 0;
  }

  private attachmentFor(tile: Tile, anim: CharacterAnim) {
    if (anim === "sleep") {
      const bed = FIXTURES.find((f) => f.kind === "bed")!;
      if (tile.x >= bed.x && tile.x < bed.x + bed.w && tile.y >= bed.y && tile.y < bed.y + bed.h) {
        const spot = BED_SPOTS[tile.x <= 0 ? 0 : 1];
        return { id: "bed", pos: { x: spot.x, y: spot.y } };
      }
    }
    for (const f of FIXTURES) {
      const seat = f.seats?.find((s) => s.tile.x === tile.x && s.tile.y === tile.y);
      if (seat) {
        const chair = FIXTURES.find((c) => c.kind === "chair" && c.x === tile.x && c.y === tile.y);
        return { id: chair?.id ?? f.id, pos: { x: tile.x + 0.5, y: tile.y + 0.5 } };
      }
    }
    return null;
  }

  applyRemote(envelope: Envelope) {
    if (this.partnerView.mode !== "present") return;
    const p = this.partner;
    if (envelope.type === "move") {
      const lag = Math.hypot(envelope.from.x + 0.5 - p.pos.x, envelope.from.y + 0.5 - p.pos.y);
      if (lag > 1.5 || p.attachedTo) {
        p.pos = { x: envelope.from.x + 0.5, y: envelope.from.y + 0.5 };
        this.placeWalker(p);
      }
      p.attachedTo = null;
      p.path = [...envelope.path];
      const then = envelope.then;
      p.onArrive = then ? () => this.applyPartnerPose(then.tile ?? p.path.at(-1) ?? this.tileOf(p), then.facing, then.anim, false) : null;
      p.character.setAnim("walk");
    } else if (envelope.type === "pose") {
      p.onArrive = null;
      p.path = [];
      this.applyPartnerPose(envelope.tile, envelope.facing, envelope.anim, false);
    } else if (envelope.type === "emote") {
      this.playEmote(p, envelope.emote);
    }
  }

  private tileOf(walker: Walker): Tile {
    return { x: Math.floor(walker.pos.x), y: Math.floor(walker.pos.y) };
  }

  private partnerBlocking(): Tile[] {
    if (this.partnerView.mode !== "present" || this.partner.attachedTo) return [];
    return [this.tileOf(this.partner)];
  }

  private standUp(walker: Walker) {
    if (!walker.attachedTo) return;
    const owner = walker.attachedTo.startsWith("chair") ? "desk" : walker.attachedTo;
    const exits = FIXTURES.find((f) => f.id === owner)?.approach ?? [SPAWN_TILES[this.slot]];
    const exit = exits.find((t) => isWalkable(this.grid, t)) ?? SPAWN_TILES[this.slot];
    walker.pos = { x: exit.x + 0.5, y: exit.y + 0.5 };
    walker.attachedTo = null;
    this.placeWalker(walker);
  }

  private walkSelf(path: Tile[], then?: { anim: CharacterAnim; facing: Facing; tile?: Tile }, onArrive?: () => void) {
    const from = this.tileOf(this.self);
    this.self.path = path;
    this.self.onArrive = onArrive ?? null;
    this.self.timedAnimUntil = 0;
    this.self.character.setAnim(path.length ? "walk" : this.self.character.anim);
    this.callbacks.onBroadcast({ type: "move", from, path, then });
    if (!path.length) onArrive?.();
  }

  moveSelfTo(tile: Tile) {
    this.standUp(this.self);
    const path = findPath(this.grid, this.tileOf(this.self), tile, this.partnerBlocking());
    if (!path) {
      this.callbacks.onBlockedTap();
      return;
    }
    this.walkSelf(path, undefined, () => {
      this.self.character.setAnim("idle");
      this.publishSelf();
    });
  }

  interact(fixture: Fixture) {
    if (!fixture.action || !fixture.approach) return;
    if (this.mode === "visit") {
      const near = nearestReachable(this.grid, this.tileOf(this.self), fixture.approach, []);
      if (near) this.walkSelf(near.path, undefined, () => {
        this.self.character.setAnim("idle");
        this.publishSelf();
      });
      else this.callbacks.onBlockedTap();
      return;
    }
    this.standUp(this.self);
    const start = this.tileOf(this.self);
    const best = nearestReachable(this.grid, start, fixture.approach, this.partnerBlocking());
    if (!best) {
      this.callbacks.onBlockedTap();
      return;
    }
    const center = tileToScreen(fixture.x + fixture.w / 2, fixture.y + fixture.h / 2);
    const faceFixture = () => {
      const here = tileToScreen(this.self.pos.x, this.self.pos.y);
      this.self.character.setFacing(facingBetween(here, center));
    };

    const arrive = () => {
      faceFixture();
      switch (fixture.action) {
        case "study":
        case "sofa": {
          const partnerSeat = this.partner.attachedTo;
          const seat = fixture.seats?.find((s) => {
            const chair = FIXTURES.find((c) => c.kind === "chair" && c.x === s.tile.x && c.y === s.tile.y);
            const occupiedByPartner = this.partnerView.mode !== "hidden" && Math.floor(this.partner.pos.x) === s.tile.x && Math.floor(this.partner.pos.y) === s.tile.y;
            return !occupiedByPartner && (chair ? chair.id !== partnerSeat : true);
          });
          if (!seat) {
            this.self.character.setAnim("idle");
            this.callbacks.onAction(fixture.action, fixture);
            break;
          }
          const anim: CharacterAnim = fixture.action === "study" ? "study" : "sit";
          this.self.pos = { x: seat.tile.x + 0.5, y: seat.tile.y + 0.5 };
          this.self.attachedTo = this.attachmentFor(seat.tile, anim)?.id ?? fixture.id;
          this.placeWalker(this.self);
          this.self.character.setFacing(seat.facing);
          this.self.character.setAnim(anim);
          this.callbacks.onBroadcast({ type: "pose", tile: seat.tile, facing: seat.facing, anim });
          this.publishSelf();
          const together = fixture.action === "sofa" && this.partnerView.mode === "present" && this.partner.attachedTo === fixture.id;
          if (together) {
            this.spawnAbove(this.self, "heart", 6);
            this.spawnAbove(this.partner, "heart", 6);
          }
          this.callbacks.onAction(together ? "sofa_together" : fixture.action, fixture);
          break;
        }
        case "sleep": {
          const spot = BED_SPOTS[this.slot];
          this.self.pos = { x: spot.x, y: spot.y };
          this.self.attachedTo = "bed";
          this.placeWalker(this.self);
          this.self.character.setFacing("se");
          this.self.character.setAnim("sleep");
          const tile = { x: this.slot === 0 ? 0 : 1, y: 1 };
          this.callbacks.onBroadcast({ type: "pose", tile, facing: "se", anim: "sleep" });
          this.publishSelf(tile);
          this.callbacks.onAction("sleep", fixture);
          break;
        }
        case "games":
          this.playTimedAnim(this.self, "happy", 1200);
          this.callbacks.onAction("games", fixture);
          break;
        default:
          this.self.character.setAnim("idle");
          this.publishSelf();
          this.callbacks.onAction(fixture.action!, fixture);
      }
    };
    this.walkSelf(best.path, undefined, arrive);
  }

  emote(emote: "wave" | "heart" | "twirl" | "heart_burst" | "celebrate") {
    this.playEmote(this.self, emote);
    this.callbacks.onBroadcast({ type: "emote", emote });
  }

  private playEmote(walker: Walker, emote: "wave" | "heart" | "twirl" | "heart_burst" | "celebrate") {
    switch (emote) {
      case "wave":
        if (!walker.attachedTo) this.playTimedAnim(walker, "wave", 1800);
        else this.spawnAbove(walker, "sparkle", 3);
        break;
      case "heart":
        this.spawnAbove(walker, "heart", 4);
        break;
      case "heart_burst":
        this.spawnAbove(walker, "heart", 14);
        if (!walker.attachedTo) this.playTimedAnim(walker, "happy", 1400);
        break;
      case "twirl":
        if (!walker.attachedTo) this.playTimedAnim(walker, "twirl", 1400);
        this.spawnAbove(walker, "sparkle", 6);
        break;
      case "celebrate":
        if (!walker.attachedTo) this.playTimedAnim(walker, "celebrate", 2000);
        this.spawnAbove(walker, "sparkle", 14);
        break;
    }
  }

  private flyHeart(from: Walker, to: Walker | null, onLand: () => void) {
    const start = tileToScreen(from.pos.x, from.pos.y);
    const node = new Graphics();
    node.moveTo(0, 5).bezierCurveTo(-13, -4, -6, -14, 0, -7).bezierCurveTo(6, -14, 13, -4, 0, 5).fill(0xe7779f).stroke({ color: 0xffffff, width: 2 });
    node.position.set(start.x, start.y - 60);
    this.fxLayer.addChild(node);
    const target = () => {
      if (to) {
        const s = tileToScreen(to.pos.x, to.pos.y);
        return { x: s.x, y: s.y - 60 };
      }
      const door = tileToScreen(0.2, 4.5);
      return { x: door.x, y: door.y - 70 };
    };
    this.flights.push({ node, from: { x: start.x, y: start.y - 60 }, to: target, t: 0, duration: this.reducedMotion ? 0.4 : 1.6, onLand });
  }

  playLovePingSent() {
    const partnerVisible = this.partnerView.mode !== "hidden";
    this.spawnAbove(this.self, "heart", 3);
    this.spawnAbove(this.self, "petal", 8);
    if (!this.self.attachedTo) this.playTimedAnim(this.self, "happy", 1200);
    this.flyHeart(this.self, partnerVisible ? this.partner : null, () => {
      if (partnerVisible) this.spawnAbove(this.partner, "sparkle", 10);
    });
  }

  playLovePingReceived() {
    if (this.partnerView.mode === "hidden") {
      this.spawnAbove(this.self, "heart", 8);
      this.spawnAbove(this.self, "petal", 10);
      return;
    }
    this.flyHeart(this.partner, this.self, () => {
      this.spawnAbove(this.self, "heart", 10);
      this.spawnAbove(this.self, "sparkle", 6);
      if (!this.self.attachedTo) this.playTimedAnim(this.self, "happy", 1400);
    });
  }

  playReunion(partnerPresent: boolean) {
    const sky = tileToScreen(5, 3);
    for (let i = 0; i < 4; i++) this.fxLayer.spawn("petal", sky.x + (i - 1.5) * 60, sky.y - 160, 6);
    if (partnerPresent && this.partnerView.mode === "present") {
      this.playHug();
      this.spawnAbove(this.partner, "heart", 10);
    } else {
      this.spawnAbove(this.self, "heart", 12);
      if (!this.self.attachedTo) this.playTimedAnim(this.self, "celebrate", 1800);
    }
  }

  private stepFlights(dt: number) {
    for (const f of [...this.flights]) {
      f.t += dt / f.duration;
      const to = f.to();
      const k = Math.min(f.t, 1);
      const ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const arc = Math.sin(Math.PI * k) * 70;
      f.node.position.set(f.from.x + (to.x - f.from.x) * ease, f.from.y + (to.y - f.from.y) * ease - arc);
      f.node.scale.set(1 + Math.sin(Math.PI * k) * 0.4);
      if (!this.reducedMotion && Math.random() < dt * 14) this.fxLayer.spawn("sparkle", f.node.x, f.node.y, 1);
      if (k >= 1) {
        f.node.destroy();
        this.flights.splice(this.flights.indexOf(f), 1);
        f.onLand();
      }
    }
  }

  celebrateSelf() {
    this.emote("celebrate");
  }

  playGiftReceived() {
    if (!this.self.attachedTo) this.playTimedAnim(this.self, "gift", 2200);
    this.spawnAbove(this.self, "sparkle", 10);
  }

  playHug() {
    if (this.partnerView.mode !== "present") return;
    this.standUp(this.self);
    const partnerTile = this.tileOf(this.partner);
    const neighbors: Tile[] = [
      { x: partnerTile.x + 1, y: partnerTile.y },
      { x: partnerTile.x - 1, y: partnerTile.y },
      { x: partnerTile.x, y: partnerTile.y + 1 },
      { x: partnerTile.x, y: partnerTile.y - 1 },
    ].filter((t) => isWalkable(this.grid, t));
    const best = nearestReachable(this.grid, this.tileOf(this.self), neighbors, []);
    const hug = () => {
      const here = tileToScreen(this.self.pos.x, this.self.pos.y);
      const there = tileToScreen(this.partner.pos.x, this.partner.pos.y);
      const facing = facingBetween(here, there);
      this.self.character.setFacing(facing);
      this.playTimedAnim(this.self, "hug", 2800);
      this.callbacks.onBroadcast({ type: "pose", tile: this.tileOf(this.self), facing, anim: "hug" });
      this.spawnAbove(this.self, "heart", 10);
    };
    if (!best) {
      hug();
      return;
    }
    this.walkSelf(best.path, undefined, hug);
  }

  private playTimedAnim(walker: Walker, anim: CharacterAnim, ms: number) {
    walker.character.setAnim(anim);
    walker.timedAnimUntil = performance.now() + (this.reducedMotion ? Math.min(ms, 900) : ms);
  }

  private spawnAbove(walker: Walker, kind: "heart" | "sparkle" | "petal", count: number) {
    const s = tileToScreen(walker.pos.x, walker.pos.y);
    this.fxLayer.spawn(kind, s.x, s.y - 58, count);
  }

  private publishSelf(tileOverride?: Tile) {
    this.callbacks.onPresence({ tile: tileOverride ?? this.tileOf(this.self), facing: this.self.character.facing, anim: this.self.character.anim });
  }

  private setupInput() {
    const stage = this.app.stage;
    stage.eventMode = "static";
    stage.hitArea = this.app.screen;

    stage.on("pointerdown", (e: FederatedPointerEvent) => {
      this.drag = { startX: e.global.x, startY: e.global.y, worldX: this.world.x, worldY: this.world.y, moved: false };
    });
    stage.on("globalpointermove", (e: FederatedPointerEvent) => {
      const local = this.world.toLocal(e.global);
      const tile = screenToTile(local.x, local.y);
      this.updateHover({ x: Math.floor(tile.x), y: Math.floor(tile.y) });
      if (!this.drag) return;
      const dx = e.global.x - this.drag.startX;
      const dy = e.global.y - this.drag.startY;
      if (Math.hypot(dx, dy) > 8) this.drag.moved = true;
      if (this.drag.moved && this.panEnabled) {
        this.world.position.set(this.drag.worldX + dx, this.drag.worldY + dy);
        this.clampCamera();
      }
    });
    const end = (e: FederatedPointerEvent) => {
      const drag = this.drag;
      this.drag = null;
      if (!drag || drag.moved) return;
      this.handleTap(e);
    };
    stage.on("pointerup", end);
    stage.on("pointerupoutside", () => (this.drag = null));
  }

  private handleTap(e: FederatedPointerEvent) {
    const local = this.world.toLocal(e.global);
    const raw = screenToTile(local.x, local.y);
    const tile = { x: Math.floor(raw.x), y: Math.floor(raw.y) };

    if (this.decor && this.mode === "home") {
      this.callbacks.onPlaceTile(tile);
      return;
    }

    let node: Container | null = e.target as Container | null;
    while (node && node !== this.world) {
      if (node.label?.startsWith("remote:")) {
        this.callbacks.onRemoteTap?.(node.label.slice(7));
        return;
      }
      if (node === this.guestbook) {
        this.callbacks.onGuestbook?.();
        return;
      }
      if (node === this.partner.character && this.partnerView.mode !== "hidden") {
        this.callbacks.onPartnerTap();
        return;
      }
      const fixtureId = node.label?.startsWith("fixture:") ? node.label.slice(8) : null;
      const fixture = fixtureId ? FIXTURES.find((f) => f.id === fixtureId) : null;
      if (fixture?.action) {
        this.interact(fixture);
        return;
      }
      node = node.parent;
    }

    const fixtureOnTile = activeFixtures(this.homeLevel).find(
      (f) => f.action && tile.x >= f.x && tile.x < f.x + f.w && tile.y >= f.y && tile.y < f.y + f.h,
    );
    if (fixtureOnTile) {
      this.interact(fixtureOnTile);
      return;
    }
    if (isWalkable(this.grid, tile)) this.moveSelfTo(tile);
    else this.callbacks.onBlockedTap();
  }

  private updateHover(tile: Tile) {
    this.hoverMarker.clear();
    this.ghost.clear();
    if (this.decor) {
      const candidate: Placement = { inventoryId: this.decor.inventoryId, itemId: this.decor.itemId, x: tile.x, y: tile.y, w: this.decor.w, h: this.decor.h, flipped: this.decor.flipped };
      const ok = placementProblem(candidate, this.placements) === null;
      for (const t of footprintTiles(candidate)) this.drawTileMarker(this.ghost, t, ok ? 0x6cc3a2 : 0xe0607e, 0.45);
      return;
    }
    if (!isWalkable(this.grid, tile)) return;
    this.drawTileMarker(this.hoverMarker, tile, 0xffffff, 0.45);
  }

  private drawTileMarker(g: Graphics, t: Tile, color: number, alpha: number) {
    const a = tileToScreen(t.x, t.y);
    const b = tileToScreen(t.x + 1, t.y);
    const c = tileToScreen(t.x + 1, t.y + 1);
    const d = tileToScreen(t.x, t.y + 1);
    g.poly([a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]).fill({ color, alpha }).stroke({ color, width: 1.5, alpha: Math.min(1, alpha + 0.3) });
  }

  private fit() {
    if (!this.ready && !this.app.renderer) return;
    const { width, height } = this.app.screen;
    const bounds = roomScreenBounds();
    const fitScale = Math.min(width / (bounds.width + 40), height / (bounds.height + 40));
    const portrait = width < height && fitScale < 0.75;
    const scale = portrait ? Math.min(0.85, height / (bounds.height + 60)) : Math.min(fitScale, 1.7);
    this.panEnabled = portrait;
    this.world.scale.set(scale);
    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;
    if (portrait) {
      const focus = tileToScreen(this.self.pos.x, this.self.pos.y);
      this.world.position.set(width / 2 - focus.x * scale, height / 2 - centerY * scale);
    } else {
      this.world.position.set(width / 2 - centerX * scale, height / 2 - centerY * scale);
    }
    this.clampCamera();
  }

  private publishDebugState() {
    const host = this.options.host;
    host.dataset.camera = `${this.world.x.toFixed(1)},${this.world.y.toFixed(1)},${this.world.scale.x.toFixed(4)}`;
    host.dataset.selfTile = `${Math.floor(this.self.pos.x)},${Math.floor(this.self.pos.y)}`;
    host.dataset.selfAnim = this.self.character.anim;
    host.dataset.partnerTile = this.partnerView.mode === "hidden" ? "" : `${Math.floor(this.partner.pos.x)},${Math.floor(this.partner.pos.y)}`;
    host.dataset.partnerAnim = this.partnerView.mode === "hidden" ? "" : this.partner.character.anim;
    host.dataset.partnerMode = this.partnerView.mode;
    host.dataset.remotes = [...this.remotes].map(([id, w]) => `${id}@${Math.floor(w.pos.x)},${Math.floor(w.pos.y)}`).join(";");
  }

  private clampCamera() {
    if (!this.panEnabled) return;
    const { width } = this.app.screen;
    const bounds = roomScreenBounds();
    const s = this.world.scale.x;
    const minX = width - (bounds.right + 20) * s;
    const maxX = -(bounds.left - 20) * s;
    this.world.x = Math.min(maxX, Math.max(minX, this.world.x));
  }

  private followSelf(dt: number) {
    if (!this.panEnabled || this.drag?.moved) return;
    const { width } = this.app.screen;
    const s = this.world.scale.x;
    const focus = tileToScreen(this.self.pos.x, this.self.pos.y);
    const desired = width / 2 - focus.x * s;
    if (this.self.path.length === 0) return;
    this.world.x += (desired - this.world.x) * (1 - Math.exp(-dt * 3));
    this.clampCamera();
  }

  private stepWalker(walker: Walker, dt: number) {
    if (walker.path.length) {
      const next = walker.path[0];
      const target = { x: next.x + 0.5, y: next.y + 0.5 };
      const dx = target.x - walker.pos.x;
      const dy = target.y - walker.pos.y;
      const distance = Math.hypot(dx, dy);
      const step = WALK_SPEED * dt;
      const from = tileToScreen(walker.pos.x, walker.pos.y);
      const to = tileToScreen(target.x, target.y);
      if (distance > 0.02) walker.character.setFacing(facingBetween(from, to));
      if (distance <= step) {
        walker.pos = target;
        walker.path.shift();
        if (!walker.path.length) {
          walker.character.setAnim("idle");
          const done = walker.onArrive;
          walker.onArrive = null;
          done?.();
        }
      } else {
        walker.pos = { x: walker.pos.x + (dx / distance) * step, y: walker.pos.y + (dy / distance) * step };
        if (walker.character.anim !== "walk") walker.character.setAnim("walk");
      }
      this.placeWalker(walker);
    } else if (walker.timedAnimUntil && performance.now() > walker.timedAnimUntil) {
      walker.timedAnimUntil = 0;
      walker.character.setAnim(walker.attachedTo ? walker.character.anim : "idle");
      if (walker === this.self) this.publishSelf();
    }

    if (walker.character.anim === "sleep" && walker.character.visible) {
      walker.zzzTimer -= dt;
      if (walker.zzzTimer <= 0) {
        walker.zzzTimer = this.reducedMotion ? 3 : 1.4;
        const s = tileToScreen(walker.pos.x, walker.pos.y);
        this.fxLayer.spawn("zzz", s.x + 10, s.y - 40, 1);
      }
    }
  }

  private sortDepth() {
    const boxes: DepthBox[] = [...this.depthBoxes.values()];
    const walkers: [string, Walker][] = [
      ["self", this.self],
      ["partner", this.partner],
      ...[...this.remotes].map(([id, w]): [string, Walker] => [`remote:${id}`, w]),
    ];
    for (const [id, w] of walkers) {
      if (!w.character.visible) continue;
      if (w.attachedTo) continue;
      boxes.push({ id, x: w.pos.x - 0.3, y: w.pos.y - 0.3, w: 0.6, h: 0.6 });
    }
    const order = sortByDepth(boxes);
    for (const [id, w] of walkers) {
      if (!w.character.visible || !w.attachedTo) continue;
      const anchor = order.indexOf(w.attachedTo);
      order.splice(anchor >= 0 ? anchor + 1 : order.length, 0, id);
    }
    order.forEach((id, index) => {
      const node = this.nodes.get(id);
      if (node) node.zIndex = index;
    });
  }

  private tick(deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000;
    this.time += dt;
    this.stepWalker(this.self, dt);
    if (this.partnerView.mode !== "hidden") this.stepWalker(this.partner, dt);
    this.self.character.update(deltaMs, this.reducedMotion);
    this.partner.character.update(deltaMs, this.reducedMotion);
    for (const walker of this.remotes.values()) {
      this.stepWalker(walker, dt);
      walker.character.update(deltaMs, this.reducedMotion);
    }
    if (this.guestbook && !this.reducedMotion) this.guestbook.children[0].alpha = 0.7 + Math.sin(this.time * 2.4) * 0.3;
    this.followSelf(dt);
    this.stepFlights(dt);
    this.sortDepth();
    this.publishDebugState();
    this.fxLayer.update(deltaMs);

    const motion = this.reducedMotion ? 0 : 1;
    for (const art of [...this.fixtureArt.values(), ...this.placementArt.values()]) {
      if (art.sway) art.sway.rotation = Math.sin(this.time * 1.3 + art.container.x * 0.01) * 0.05 * motion;
      if (art.glow) art.glow.alpha = 0.85 + Math.sin(this.time * 2) * 0.15 * motion;
      if (art.screen) art.screen.alpha = 0.75 + Math.sin(this.time * 7) * 0.08 * motion + (Math.random() < 0.02 ? 0.1 : 0);
    }
    if (this.shell) {
      this.shell.twinkles.forEach((bulb, i) => {
        bulb.alpha = 0.55 + Math.sin(this.time * 2.2 + i * 1.7) * 0.45 * motion;
      });
      this.shell.windowLight.alpha = 0.9 + Math.sin(this.time * 0.6) * 0.1 * motion;
      if (!this.reducedMotion && this.fxLayer.dustCount < 10 && Math.random() < dt * 2) {
        this.fxLayer.spawn("dust", this.shell.dustOrigin.x, this.shell.dustOrigin.y, 1);
      }
    }
  }

  get selfTile() {
    return this.tileOf(this.self);
  }

  isTileWalkable(tile: Tile) {
    return isWalkable(this.grid, tile) && !this.partnerBlocking().some((t) => tileKey(t) === tileKey(tile));
  }
}
