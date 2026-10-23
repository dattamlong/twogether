# Game systems

Authoritative implementations live in Postgres functions (`supabase/migrations`). TypeScript mirrors exist only for display and are covered by parity tests (`tests/db/progression.test.ts`).

## XP and levels

Total XP needed to reach level `L`:

```
total(L) = m · (100·(L−1) + 25·(L−1)·(L−2))
```

`m = 1` for individuals and `m = 2` for the couple level. Each level costs 50 XP more than the previous one: L2 at 100, L3 at 250, L4 at 450, L5 at 700. Implemented in `src/features/progression/xp.ts` and `public.level_for_xp`.

Half of every XP grant a member earns also flows into couple XP.

## Lesson rewards

Only the **first attempt** at each question counts. Retries are recorded but don't affect the score.

| | XP | Love Coins |
| --- | --- | --- |
| First completion | `10 × first-try correct + 20` | `10 + 2 × first-try correct` |
| Replay | half of the XP above | 5 |

A lesson can only be completed after every question has been answered at least once. An attempt can only be completed once.

## Mini-games

The server chooses the questions in `start_game`, and `finish_game` scores them from the recorded answers.

- **Word Battle**: 8 vocabulary questions at or below the learner's level, with words due for review first. The learner wins with ≥ 5 first-try correct answers.
  - Win: `10 × correct + 20` XP and 15 coins.
  - Loss: `5 × correct` XP and 3 coins.
- **Sentence Puzzle**: 5 puzzles, unlimited retries. Rewards are `8` XP per first-try solve and `4` per later solve, plus `2` coins per solve and `5` coins for solving every puzzle.
- **Anti-farming**: after 10 completed games in a day, games give ¼ XP and no coins.

## Spaced repetition (Leitner boxes)

Each answered question has a `review_progress` row with box 0–5.

| Box | Next review |
| --- | --- |
| 0 (missed) | 10 minutes |
| 1 | 1 day |
| 2 | 3 days |
| 3 | 7 days |
| 4 | 14 days |
| 5 (mastered) | 30 days |

- A correct answer moves an item up one box, to a maximum of 5.
- A wrong answer sends it back to box 0.
- Only the first attempt in a lesson or game moves the box. Review answers to the same item within 10 minutes count as retries.
- `get_review_queue` serves items that are due, then items answered wrong more often than right. Within each group, items with the most net misses come first.
- A word counts as "learned" the first time it is answered correctly. It counts as "mastered" at box 4 or higher.

## Streaks

**Qualifying activity**: completing a lesson, finishing a mini-game, or the 5th review answer of the day. The day is measured in the user's timezone (`profiles.timezone`, default Asia/Ho_Chi_Minh), and resets at midnight.

When a user records qualifying activity on day `D`:

- If `D` is the same as the last active day, nothing changes.
- If `D` is the day after it, the streak goes up by 1.
- If `D` is 2 or more days later, the gap is `g = D − last − 1` missed days. If the user has at least `g` freezes, those freezes are used and the streak continues. Otherwise the streak resets to 1.
- Everyone starts with 1 freeze. Reaching 7, 14, 30, 60 or 100 days adds a freeze, up to a maximum of 2.
- Milestones at 3, 7, 14, 30, 60 and 100 days unlock achievements. The 7-day achievements also grant a cosmetic item: the Golden Streak Lamp, or the Heart Lantern for couples.

**Couple streak**: a couple-local day counts only when **both** partners qualify on it. The couple's day uses `couples.timezone`. Couple streaks follow the same freeze rules.

The UI shows "protected" when a freeze covers a missed day. Copy never shames the user, and notifications are toasts while the app is open, never pushes.

## Daily quests

There are four slots: learn, lesson, review and play. Each day one template per slot is chosen by `(day − 2024‑01‑01 + ascii(slot)) mod n`, so both partners see the same set. Progress is driven by server events (`emit_event`).

A user claims a quest with `claim_daily_quest`. The claim checks four things:

- the quest is active today,
- the target has been reached,
- the reward hasn't been claimed yet,
- the ledger entry is unique for `quest:day`.

## Couple quests

Couple quests are weekly, and the week starts on Monday in the couple's timezone. They have three modes:

- `each`: both partners reach the target.
- `combined`: the partners' totals add up to the target.
- `same_day`: both partners act on the same couple-local day.

Couple quests pay out automatically when completed:

- coins to both partners,
- couple XP,
- Love Energy,
- a memory entry.

## Love Energy and home levels

Love Energy comes from couple quests, mutual Daily Love Question answers (+8), accepted hugs (+5, up to 3 a day), gifts (+5) and hearts (+1, up to 5 a day). It unlocks home levels:

| Level | Energy | Unlock |
| --- | --- | --- |
| 1 | 0 | Cozy room |
| 2 | 40 | Decorative plants |
| 3 | 120 | Heart wallpaper |
| 4 | 240 | Fairy lights |
| 5 | 400 | Garland + premium decor items |

## Realtime

There is one private channel per couple, `couple:<couple_id>`, authorized by RLS on `realtime.messages`. It carries three kinds of traffic:

- **Presence** holds each member's tile, facing, animation and away flag. Updates are throttled to at most one every 300 ms.
- **Broadcast** events are ephemeral and never stored. A `move` event sends the whole path once, and the receiver walks the same path at the same speed. A `pose` event covers sitting, sleeping and hugging. An `emote` event covers waves and hearts.
  - Every envelope carries `senderId`, `tabId` and an increasing `seq`, and duplicates are dropped.
  - When an envelope arrives late, the receiver snaps the character to `from`.
- **Postgres changes** on couple tables (messages, interactions, placements, progress, memories, answers, members) refresh queries and show gentle notifications.

The client reconnects with exponential backoff and refetches all queries after reconnecting.

If the partner has no presence on the channel, their character is shown **resting** (asleep on the bed, dimmed, labelled "resting"). The app never pretends the partner is active when they aren't.

Hugs need consent: a hug is stored as `pending` until the partner accepts it, within 24 hours. A wave is delivered immediately.
