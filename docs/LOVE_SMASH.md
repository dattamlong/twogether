# Love Smash! 🏸💗

Anime chibi badminton inside TWOGETHER at `/games/love-smash`.

## What ships in Phase 1

- **Practice vs Bot**: a full match to 7 (win by 2, capped at 11) against Sleepy Mochi (Easy), Coach Mochi (Normal) or Captain Mochi (Hard).
- **Tutorial (How to Play)**: a playable drill with a feeder bot. It covers movement, hitting, drop shots, smashing and scoring, and the player can skip or replay it.
- **Lobby**: a live bot-vs-bot preview, difficulty picker, a controls reference and player stats. Online 1v1, Couple 2v2, Private Room and Ranked are clearly marked *Coming soon* and cannot be clicked.
- **Controls**:
  - Desktop: `WASD`/arrows move, `J` hit, `K` smash, `L` drop, `Space` dive, `Esc`/`P` pause.
  - Mobile: a joystick plus 🏸 HIT, 🔥 SMASH, 🌸 DROP and 💨 DIVE buttons. Multi-touch works and the page does not scroll while you play.
- **Audio**: racket, perfect-hit, smash, Sakura Smash, net, landing, footstep, point and victory/defeat sounds run on the existing SFX bus. "Smash Together!" is an original composed track that plays on Love Smash pages through the existing music director, and it respects the player's audio settings.

## Architecture

All code lives in `src/features/love-smash/`. The simulation is pure TypeScript with no DOM access:

| File | Role |
|---|---|
| `court.ts` | Court geometry in metres (singles and doubles lines, service courts, net) and the 60 Hz tick |
| `physics.ts` | Shuttlecock flight with gravity and quadratic drag, net collision, landing, and shot solving for each shot type |
| `sim.ts` | Match state, players (acceleration, lunge, recovery), hit timing, scoring, serves and events |
| `bot.ts` | Bot that predicts the trajectory, picks an intercept point, decides when to press and which shot to play. It follows the same movement and reach rules as a human. |
| `rules.ts` | Tunable constants |
| `replay.ts` | Input encoding, run-length input log, and server replay |
| `stepper.ts` | Fixed-timestep accumulator, independent of frame rate |
| `render.ts` | Canvas 2D 2.5D renderer: perspective camera, chibi characters drawn from the player's avatar, effects |

**Determinism.** The simulation uses no `Math.random`, no clock and no trig functions. Bots draw from a seeded generator. The same seed and input log therefore always produce the same match, in the browser and on the server.

**Rendering.** React renders only the HUD. The game loop runs on `requestAnimationFrame` with a fixed-step simulation and interpolates between ticks. The loop pauses when the tab is hidden, and reduced-motion turns off shake and most particles.

## Anti-cheat and rewards

1. `start_love_smash(difficulty)` creates a match row and returns a server-chosen seed.
2. The browser records only the player's inputs, one run-length entry per tick.
3. `POST /api/love-smash/finish` replays the whole match on the server from the seed and input log. Logs that are garbage, unfinished or too long are rejected.
4. The route then calls `finish_love_smash` with the service role. This function cannot be called by players. It:
   - checks the match belongs to the player;
   - accepts each match only once;
   - rejects results that arrive sooner than the match's real duration.

**Rewards:**
- +20 XP for finishing a match, or +50 XP for a win.
- +100 Love Coins for the first win of the day.
- XP stops after 10 matches a day.
- At most 5 unfinished matches can be open in any 10-minute window.

Love Smash does **not** award Love Legends ranking points.

**Stats** (`love_smash_stats`) are written only from replay-verified results. Players can read their own row and nothing else.

## Tests

- **Unit** (`src/features/love-smash/love-smash.test.ts`): trajectories for each shot, drag versus bouncing, net faults, hit timing, Sakura Smash, movement limits, in/out/net scoring, 7/win-by-2/cap-11, serve transitions, bot interception and strength order, replay determinism, frame-rate independence, and repeated restarts.
- **Database** (`tests/db/love-smash.test.ts`): seeded starts, players cannot finish their own match, too-fast and duplicate submissions, reward amounts, daily limit, no ranking points.
- **End to end** (`tests/e2e/love-smash.spec.ts`): a full verified match on desktop and on Pixel 7 including pause/resume and play again, the touch-joystick tutorial, and forged or foreign results being refused.

## Not built yet

- **Character art**: the chibis and the court are drawn in code from avatar colours. No image assets were created. Hand-drawn sprite sheets (idle, run, swings, victory and defeat poses) would be a production art upgrade.
- **Online 1v1, Private Room**:
  - Needs a realtime authoritative game server. A WebSocket service running `sim.ts` would work. Supabase Realtime is suitable for lobby presence and invitations but not for 60 Hz simulation.
  - Clients would send sequence-numbered inputs, the server would broadcast snapshots, and clients would use prediction and interpolation.
  - Reconnection could resume a match from the server's state.
- **Couple and Friends 2v2**: the court already models doubles lines. The simulation needs 4 players, partner hit priority and the Love Combo rule.
- **Ranked**: skill rating, matchmaking and seasons are built on top of online play.
