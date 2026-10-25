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

## Simulation (`src/features/love-smash/`)

The simulation is pure, deterministic TypeScript. It ticks 60 times a second and uses only `+ − × ÷ sqrt`: no `Math.random`, no clock, no trig, no `Math.hypot`. Bots draw from seeded random number generators. The same seed plus the same input logs therefore always reproduce the same match, in any browser and on the server.

| File | Role |
|---|---|
| `court.ts` | Singles and doubles geometry, service courts |
| `physics.ts` | Shuttle with gravity and quadratic drag, net collision, shot solver |
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
- **Message budget:** about 12 snapshots a second from the host, plus up to 8 position reports a second from each remote player while they move (only the host receives them; about 60 messages a second for a full 2v2 room). Supabase's free tier caps Realtime messages per second for the whole project, so many simultaneous 2v2 rooms need a paid plan.

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
