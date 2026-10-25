create table public.love_smash_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  difficulty text not null check (difficulty in ('easy', 'normal', 'hard')),
  seed int not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  won boolean,
  player_score int,
  bot_score int,
  ticks int,
  longest_rally int,
  perfect_hits int,
  smashes int,
  xp_awarded int not null default 0,
  coins_awarded int not null default 0
);
create index love_smash_matches_user_idx on public.love_smash_matches (user_id, started_at desc);

create table public.love_smash_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  matches int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  longest_rally int not null default 0,
  perfect_hits int not null default 0,
  smashes int not null default 0,
  couple_wins int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.love_smash_matches enable row level security;
alter table public.love_smash_stats enable row level security;
create policy "own love smash matches" on public.love_smash_matches for select to authenticated using (user_id = auth.uid());
create policy "own love smash stats" on public.love_smash_stats for select to authenticated using (user_id = auth.uid());
revoke all on public.love_smash_matches, public.love_smash_stats from anon, authenticated;
grant select on public.love_smash_matches, public.love_smash_stats to authenticated;

create or replace function public.start_love_smash(difficulty text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  match public.love_smash_matches;
begin
  if difficulty not in ('easy', 'normal', 'hard') then
    raise exception 'invalid_difficulty' using errcode = '22023';
  end if;
  if (select count(*) from public.love_smash_matches
      where user_id = uid and finished_at is null and started_at > now() - interval '10 minutes') >= 5 then
    raise exception 'too_many_open_matches' using errcode = 'P0001';
  end if;
  insert into public.love_smash_matches (user_id, difficulty, seed)
  values (uid, difficulty, floor(random() * 2147483646)::int + 1)
  returning * into match;
  return jsonb_build_object('matchId', match.id, 'seed', match.seed, 'difficulty', match.difficulty);
end;
$$;

create or replace function public.finish_love_smash(
  match_id uuid,
  player uuid,
  player_won boolean,
  final_player_score int,
  final_bot_score int,
  match_ticks int,
  rally_record int,
  perfect_count int,
  smash_count int
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  match public.love_smash_matches;
  today date := public.user_local_date(player);
  zone text := coalesce((select timezone from public.profiles where id = player), 'Asia/Ho_Chi_Minh');
  played_today int;
  won_today int;
  reward_xp int;
  reward_coins int;
  award jsonb;
  stats public.love_smash_stats;
begin
  select * into match from public.love_smash_matches where id = match_id and user_id = player for update;
  if match.id is null then
    raise exception 'invalid_match' using errcode = 'P0001';
  end if;
  if match.finished_at is not null then
    raise exception 'already_finished' using errcode = 'P0001';
  end if;
  if match_ticks <= 0 or now() - match.started_at < make_interval(secs => match_ticks / 60.0 - 3) then
    raise exception 'too_fast' using errcode = 'P0001';
  end if;
  if now() - match.started_at > interval '3 hours' then
    raise exception 'match_expired' using errcode = 'P0001';
  end if;

  select count(*), count(*) filter (where won) into played_today, won_today
  from public.love_smash_matches
  where user_id = player and finished_at is not null
    and (finished_at at time zone zone)::date = today;

  reward_xp := case when played_today >= 10 then 0 when player_won then 50 else 20 end;
  reward_coins := case when player_won and won_today = 0 then 100 else 0 end;

  update public.love_smash_matches
  set finished_at = now(), won = player_won, player_score = final_player_score, bot_score = final_bot_score,
      ticks = match_ticks, longest_rally = rally_record, perfect_hits = perfect_count, smashes = smash_count,
      xp_awarded = reward_xp, coins_awarded = reward_coins
  where id = match.id;

  insert into public.love_smash_stats (user_id) values (player) on conflict do nothing;
  update public.love_smash_stats
  set matches = matches + 1,
      wins = wins + case when player_won then 1 else 0 end,
      losses = losses + case when player_won then 0 else 1 end,
      longest_rally = greatest(longest_rally, rally_record),
      perfect_hits = perfect_hits + perfect_count,
      smashes = smashes + smash_count,
      updated_at = now()
  where user_id = player
  returning * into stats;

  if reward_xp > 0 or reward_coins > 0 then
    award := public.grant_reward(player, reward_xp, reward_coins, 'love_smash', match.id::text);
  else
    select jsonb_build_object('xp', 0, 'coins', 0, 'totalXp', p.xp, 'balance', p.coins, 'level', p.level, 'leveledUp', false)
    into award from public.user_progress p where p.user_id = player;
  end if;

  perform public.record_qualifying_activity(player);
  perform public.emit_event(player, 'love_smash_played', 'play', 1);
  perform public.check_user_achievements(player);

  return award || jsonb_build_object(
    'won', player_won,
    'firstWinToday', reward_coins > 0,
    'dailyLimitReached', played_today >= 10,
    'stats', to_jsonb(stats) - 'user_id' - 'updated_at'
  );
end;
$$;

revoke execute on function public.start_love_smash(text) from anon, public;
grant execute on function public.start_love_smash(text) to authenticated;
revoke execute on function public.finish_love_smash(uuid, uuid, boolean, int, int, int, int, int, int) from anon, public, authenticated;
grant execute on function public.finish_love_smash(uuid, uuid, boolean, int, int, int, int, int, int) to service_role;
