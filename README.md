# Twogether — Our Little World

> Two hearts. One adventure.

A cozy, anime-inspired web app for a long-distance couple: a shared isometric home rendered with PixiJS, real English (CEFR) and Chinese (HSK 3.0, levels 1–6) lessons with Vietnamese explanations and spaced repetition — each partner picks their own language — two mini-games, quests, streaks, Love Coins, a Love Shop, and a private love space with messages, gifts, a Daily Love Question and a memory album.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, Turbopack, Cache Components), React 19, TypeScript |
| UI | Tailwind CSS 4, Radix primitives (shadcn-style components in `src/components/ui`), Motion for React, GSAP |
| Game world | PixiJS 8 (procedural isometric art, no external sprites) |
| Data | Supabase: Postgres + RLS, Auth, Realtime (presence, broadcast, postgres changes) |
| State | TanStack Query (server state), Zustand (realtime, toasts, celebrations, room events) |
| Validation | Zod (content schema, forms) + Postgres constraints and RPC checks |
| Tests | Vitest + React Testing Library, Vitest DB integration suite, Playwright |

## Getting started (local)

Requirements: **Node 22+** (see `.nvmrc`), pnpm 10, Docker (OrbStack/Docker Desktop).

```bash
pnpm install
pnpm db:start          # starts local Supabase in Docker and prints keys
cp .env.example .env.local   # fill in the local URL/anon/service keys printed above
pnpm db:reset          # compiles content into supabase/seed.sql, applies migrations + seed
pnpm db:demo           # optional: creates a paired demo couple
pnpm dev               # http://localhost:3000
```

Demo couple (after `pnpm db:demo`): `mai@twogether.local` / `minh@twogether.local`, password `twogether-demo`. Open them in two different browsers (or one normal + one private window) to see presence, movement and interactions sync live.

Local email confirmation is disabled in `supabase/config.toml`; in production Supabase sends a confirmation link that lands on `/auth/callback`.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm typecheck` / `lint` | TypeScript, ESLint |
| `pnpm test:unit` | Pure logic + component tests (jsdom) |
| `pnpm test:db` | Integration tests against the local Supabase stack (RPCs, RLS, realtime authorization) |
| `pnpm test:e2e` | Playwright on desktop and Pixel 7 viewports (starts `pnpm dev` if not running) |
| `pnpm content:check` | Validates the question bank (schema, unique ids/prompts/words, answers ∈ options, puzzle token sets) |
| `pnpm content:seed` | Compiles content + catalog + room layout into `supabase/seed.sql` |
| `pnpm db:types` | Regenerates `src/lib/supabase/database.types.ts` |

## Project layout

```
src/
  app/                  routes: (auth) login/signup, (game) home/learn/games/shop/story/profile, pair, api/account, auth/callback
  components/           ui kit, layout (HUD/nav/shell), room, learning, games, couple, rewards
  content/              schema.ts (Zod), catalog.ts (shop/quests/achievements/home levels), data/*.json (question bank)
  features/             data hooks per domain (session, learning, progression, shop, messages, love, couples, games, realtime)
  game/                 engine (iso math, depth sort), movement (A*), entities (character, furniture), effects, scenes, world (room layout, placement rules)
  lib/                  supabase clients, i18n (en/vi dictionaries), errors, speech (TTS), sfx (WebAudio)
  stores/               zustand stores
supabase/migrations/    schema, RLS, RPCs (all sensitive writes)
scripts/                content validation/seed generation, demo seeding
tests/db, tests/e2e     integration and end-to-end suites
docs/GAME_SYSTEMS.md    formulas and rules (XP, rewards, SRS, streaks, quests, realtime)
```

## Security model

- Every table has RLS. Clients have **select-only** grants (plus column-limited updates of their own profile/couple name); every write that matters goes through `SECURITY DEFINER` RPCs that check `auth.uid()`, couple membership, and business rules inside one transaction.
- Answers and explanations live in `lesson_questions`, which clients cannot read; they see the `question_cards` view and get feedback only from `submit_answer`. Lesson, game, quest and purchase rewards are computed server-side.
- Love Coins: a ledger (`currency_transactions`, unique per `(user, reason, ref)`) plus a cached balance with `CHECK (coins >= 0)`, updated in the same transaction. Client request ids make purchases idempotent.
- Internal functions (`grant_reward`, `emit_event`, streak/achievement helpers) are not executable by `authenticated`.
- Realtime uses private channels `couple:<id>`; `realtime.messages` policies only admit the two members.
- The service-role key is used only by server code (`src/app/api/account`), tests and scripts — never shipped to the browser.
- Users can unpair (closes the shared home for both) and delete their account (cascades their data).

## Deploying to Vercel

1. Create a Supabase project, then `supabase link --project-ref <ref>` and `supabase db push` (migrations), and run `supabase/seed.sql` once (SQL editor or `psql`).
2. In Supabase Auth settings set the Site URL to your Vercel domain and add `https://<domain>/auth/callback` to redirect URLs.
3. In Vercel set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only) and `NEXT_PUBLIC_SITE_URL`. Use Node 22.

## Known limitations

- **Art is procedural.** Characters, furniture and icons are drawn in code (PixiJS Graphics / inline SVG) with an original style; there are no hand-made sprite sheets. Swapping in illustrated atlases would be the biggest visual upgrade.
- **Audio.** Listening exercises and pronunciation playback use the browser's text-to-speech (labelled as a computer voice, not native recordings). Voice recording is for self-comparison only — there is **no pronunciation scoring**.
- **Sound effects** are synthesized with WebAudio (toggle in Profile).
- **Chinese content** covers HSK 3.0 levels 1–6; every word card was checked against the community HSK 3.0 lists (drkameleon/complete-hsk-vocabulary). Grammar connectors follow common HSK teaching order and some are listed at a lower level officially. Levels 7–9 are not written yet.
- **Single room.** The data model (`room_reserved_tiles`, `furniture_placements`, `couple_progress.home_level`) allows expansion, but only one room exists.
- **Future games** (1v1 battle, couple boss, listening challenge, love quiz) appear as "coming soon" in the games registry; they are not playable.
- Daily Love Question reveal relies on RLS + polling/realtime; if a partner answers while you are offline you see it on next load.
- Invitation-code guessing is not rate-limited beyond the 32⁸ code space, single use and 72h expiry.
- Partner avatar changes reach the other client on the next session refetch (window focus), not instantly.
