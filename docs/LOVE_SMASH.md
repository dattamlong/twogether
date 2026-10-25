# Love Smash! 🏸💗

Anime chibi badminton inside TWOGETHER at `/games/love-smash`.

## Modes

| Mode | Status | Where it runs | Rewards |
|---|---|---|---|
| Practice vs Bot (1v1, Easy/Normal/Hard) | ✅ Playable | This device | XP/coins after server replay |
| How to Play tutorial | ✅ Playable | This device | none |
| Solo Doubles (you + Mochi 🤖 vs 2 bots) | ✅ Playable | This device | none (practice) |
| 💗 Couple vs Bots (2 humans vs 2 bots) | ✅ Playable | Two devices, online | XP/coins for both after server replay |
| 🏸 2v2 Room (couple vs couple, or friends) | ✅ Playable | Four devices, online | XP/coins for all four after server replay |
| Online 1v1 | ⏳ Not built | — | — |
| Ranked | ⏳ Not built | — | — |

## Controls

- **Desktop:**
  - `WASD`/arrows move. Holding a direction while hitting steers your aim.
  - `J` hits: clear, drive or lift, chosen by shuttle height. It also does a high serve.
  - `K` smashes. `L` plays a drop shot or a short serve. `Space` dives. `Esc`/`P` pauses (offline only).
- **Mobile:** a joystick plus 🏸 HIT, 🔥 SMASH, 🌸 DROP and 💨 DIVE buttons.
- **On-court help:**
  - The pink ring under you glows when the shuttle is in reach.
  - A dashed ring on the floor shows where a falling shuttle will land, calculated from the actual simulation.

## Anime skills

All skill logic lives in the deterministic simulation: energy, cooldowns, activation checks, movement and shot changes, and the team meter. Clients only send activation inputs, the host or server simulation applies them, and the server replay re-checks every activation before giving rewards. All balancing numbers are in `src/features/love-smash/skills.ts` (`SKILL_BALANCE`, `SKILLS`).

| Skill | Slot · key | Cost | Cooldown | What it really does |
|---|---|---|---|---|
| ⚡ Lightning Dash | Movement · `Q` | 20 | 6 s | A 0.2 s burst at 11.5 m/s in your movement direction. It can't cross the net or leave your side, and gives no invulnerability. |
| ❄️ Frost Drop | Special · `E` | 25 | 8 s | A precise drop aimed 1.05 m behind the net. It still needs a valid contact, and opponents near the net can return it. |
| 🔥 Phoenix Drive | Special · `E` | 30 | 10 s | A fast, flat drive. A late contact uses a dipping trajectory that can hit the net. |
| 🌸 Sakura Meteor | Ultimate · `R` | 80 | 25 s | A smash that is 9 m/s faster. It needs contact at 2.0 m or higher and must not be late, otherwise you play a normal shot and spend no energy. It can still be returned. |
| 💗 Love Sync / ✨ Duo Sync | Team · `F` | 100 team | 35 s | Doubles only. The team meter fills **only** through teamwork: +34 per combo and +4 when partners alternate hits. For 6 s, the team's next attacking shot is perfectly placed and smashes get +4 m/s. Couples and friend teams get identical strength. |

- **Energy (0–100):**
  - Gained from real hits only (serves don't count): +3 normal, +5 good, +8 perfect, +10 for a diving or lunging save, +12 for a ⚡ Perfect Counter, +8 to each teammate after a combo.
  - At most 30 energy per player per rally, to prevent farming. Hits made with a skill earn no energy.
  - A failed activation (not enough energy, still on cooldown, not equipped, or contact too low) spends nothing.
- **Perfect Counter:** returning an opponent's smash or Meteor without a late contact, within 0.6 s of your own Lightning Dash. It is presentation and energy on top of a normal valid return.
- **AI skill use:** bots spend energy and respect cooldowns exactly like players. A `skillIQ` per difficulty (Easy 0.15, Normal 0.45, Hard 0.8) controls how often they pick a sensible moment:
  - Meteor when the shuttle is high;
  - Frost Drop when opponents are deep;
  - Phoenix Drive on mid-height shuttles;
  - Dash when the intercept is out of reach;
  - Sync just before an attack.
- **Unlocks**, computed by the server only from verified matches:

  | Skill | Unlock condition |
  |---|---|
  | Lightning Dash | finish the tutorial or one match |
  | Frost Drop | 20 drop shots |
  | Phoenix Drive | 10 wins |
  | Sakura Meteor | Love Smash level 10, where level = 1 + ⌊(matches + 2·wins) / 3⌋ |
  | Love Sync | 5 doubles matches |

- **Loadouts:** chosen in the Skills panel. `set_love_smash_loadout` removes anything not unlocked. Each match stores the loadout it started with, so the server replay uses exactly that loadout. Nothing gameplay-related is sold.
- **Controls:** `Q`/`E`/`R`/`F` on desktop, or tap the skill chips above the action buttons on mobile. Chips show the cost, the cooldown sweep and the ready state.

## Simulation (`src/features/love-smash/`)

The simulation is pure, deterministic TypeScript. It ticks 60 times a second and uses only `+ − × ÷ sqrt`: no `Math.random`, no clock, no trig, no `Math.hypot`. Bots draw from seeded random number generators. The same seed plus the same input logs therefore always reproduce the same match, in any browser and on the server.

| File | Role |
|---|---|
| `court.ts` | Singles and doubles geometry, service courts |
| `physics.ts` | Shuttle with gravity and quadratic drag, net collision, shot solver |
| `skills.ts` | Skill registry, balance config, unlock rules, loadout sanitising |
| `sim.ts` | Players: up to 4, each controlled as `human` (inputs), `puppet` (a remote player's reported positions) or `bot`. Also hit timing, doubles rules, scoring and Love Combo |
| `bot.ts` | Trajectory-predicting AI with doubles teamwork |
| `net.ts` | Snapshot encoding, puppet frame packing, multi-player input logs, server replay |
| `replay.ts` | 1v1 input log and replay |
| `camera.ts` / `scene.ts` / `chibi.ts` / `render.ts` | 2.5D camera that fits the court to the screen, pre-rendered arena layer, animated chibis, effects |

### Doubles rules

- **Court and rotation:**
  - Rallies use the doubles sidelines. Serves must land in the doubles service court.
  - When the serving team wins a point, the server switches court. When the receivers win, the serve passes to them, and their player in the court matching their score's parity serves.
- **Hitting and spacing:**
  - Each side gets one hit per crossing, so teammates can never both hit the same shuttle. If both press in the same tick, only the closer one plays it.
  - Teammates are pushed apart so they keep at least 0.55 m between them.
- **Love Combo** (cosmetic only) triggers when a team wins a rally with:
  - a save followed by the partner's shot: "Love Combo";
  - both teammates smashing in the same rally: "Sakura Duo Smash";
  - both teammates hitting a perfect shot: "Perfect Teamwork".

  Friend teams see the same effect under a "Duo" name. It has no effect on gameplay.

### AI teamwork

Bots pick formations: front and back after their own attacking shot, side by side when defending.

For each incoming shuttle, every bot computes the same responsibility point. The teammate who can reach it first takes the shot, and the other covers the open court. An AI teammate defers to a human partner who is closer or already moving toward the shuttle, so it supports the human rather than stealing their shots.

Bots use the same speed limits, reach and physics as human players.

## Online architecture (Supabase Realtime)

- **Rooms:** stored in `love_smash_rooms` and `love_smash_room_members`, with RPCs to create, invite, join by code, respond, ready, switch team, choose difficulty, start, leave and abandon.
  - "Play With My Partner" invites the couple partner using the existing `notify()` system (in-app and push notification). The link opens `/games/love-smash?room=…`.
  - The room screen shows whether each player is invited, in the room, away or ready.
- **Host device:** the device that created the room runs the authoritative simulation.
  - It broadcasts snapshots 12 times a second on the private channel `love-smash:<room>`.
  - Other players send their position about 10 times a second, plus their hit presses, on their own `love-smash:<room>:up:<slot>` topic (only the host listens). Each press carries the tick of the shuttle they were looking at, and the host rewinds the shuttle up to 24 ticks to check whether the hit was valid (lag compensation).
  - Remote players move their own character instantly on their own device. The host limits how far a remote player can move each tick.
- **Channel access:** only joined members of the room can open either channel (enforced by an RLS policy on `realtime.messages`).
- **Results:**
  - The host's device posts every player's logs to `POST /api/love-smash/room/finish`.
  - The server replays the whole match. Only then does the service role call `finish_love_smash_room`, which records each player's result and pays rewards per player.
  - Players cannot call this function themselves.
- **Disconnects:**
  - If a player drops, the host pauses the match and everyone sees "Waiting for …". When the player comes back to Love Smash and taps **Rejoin match**, they continue.
  - After 45 seconds of absence, the match ends without rewards.
  - Absent players are never replaced by bots.
- **Known limitation:** the host is trusted to forward inputs, and their own inputs have no network delay. This is fine for co-op against bots. For competitive 2v2 it gives the host a small edge. A host can't forge the final score, because the server replays the logs, but a host who disconnects ends the match (it can't be resumed).

  A dedicated WebSocket game server running the same `sim.ts` would remove both limits without rewriting the game.
- **Message budget:** about 12 snapshots a second from the host, plus up to 12 position reports a second from each remote player while they move (only the host receives them; about 70 messages a second for a full 2v2 room). The host plays remote positions back 110 ms late and interpolates between reports, so partners move smoothly instead of stop-and-go. Supabase's free tier caps Realtime messages per second for the whole project, so many simultaneous 2v2 rooms need a paid plan.

## Rewards and anti-cheat

- **Amounts:**
  - +20 XP per match, +50 XP for a win.
  - +100 Love Coins for the first win of the day.
  - XP stops after 10 matches a day.
- **Rules:**
  - Every reward requires a server replay that ends in a valid finished match.
  - Results that arrive faster than real time are rejected.
  - Each match is paid out once.
  - Love Smash never awards Love Legends ranking points.
  - Solo Doubles is practice only and gives no rewards.

## Tests

- **Unit** (`love-smash.test.ts`, `doubles.test.ts`): physics, timing, 1v1 and doubles scoring, serve rotation, preventing teammates' double hits, teammate spacing, combos, bot coordination, camera fit, puppet packing, rewind hits, multi-player replay and snapshot mirroring.
- **Database** (`love-smash.test.ts`, `love-smash-rooms.test.ts`):
  - rewards and anti-cheat;
  - partner invite notifications, joining by code, room full, team switching, ready and start rules, controller config;
  - server-only finishing with per-team rewards;
  - realtime topic access.
- **End to end:**
  - `love-smash.spec.ts`: 1v1 on desktop and mobile.
  - `love-smash-online.spec.ts`: Couple vs Bots on 2 browsers, a 2v2 room on 4 browsers, and disconnect plus rejoin.

## Not built yet

- Online 1v1 and Ranked matchmaking.
- A dedicated authoritative game server (see the limitation above).
- Hand-drawn sprite art. Characters are drawn in code from avatar colours.

## Road to Legend (career mode)

Route: `/games/love-smash/career`. Three career kinds, each stored as one row in `love_smash_careers` (`state` jsonb, versioned):

| Kind | Who plays | Match flow |
| --- | --- | --- |
| `solo` | one player vs AI singles | `POST /api/love-smash/career {action:"start"}` → local `SmashGame` → `/api/love-smash/career/finish` |
| `solo_doubles` | player + Kiko 🤖 vs AI doubles | same as solo |
| `couple` | both partners, one device each, vs AI doubles | `{action:"room"}` creates a room linked by `career_id`; host starts with `{action:"room_start"}`; `/api/love-smash/room/finish` applies the career result |

- **Data** (`src/features/love-smash/career.ts`): 7 tiers (`TIERS`, 8 or 16 entrants), fictional characters (`CHARACTERS`), seeded brackets, rivals Mochi & Sakura, one boss per tier. Story entrants (boss/rival) always advance in simulated matches so the player meets them.
- **Results** are never trusted from the client: the server replays the logs from the stored config, runs `applyResult`, and commits rewards, career state (optimistic `version` check) and a first-title trophy in one SQL function (`finish_love_smash_career` / `finish_love_smash_room_career`, service role only).
- **Losing** keeps the bracket and increments `attempts` (retry). A title unlocks the next tier; trophies (`career_trophy_1..7`) go to the inventory once and can be placed at home.
- **Bots** use `personaProfile("style:level")`; no paid AI is involved. Arenas come from `THEMES` in `scene.ts`.
