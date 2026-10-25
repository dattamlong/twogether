alter table public.love_smash_stats
  add column loadout jsonb not null default '{}'::jsonb,
  add column tutorial_done boolean not null default false,
  add column drop_shots int not null default 0;
alter table public.love_smash_matches add column loadout jsonb;

create or replace function public.love_smash_unlocks(uid uuid)
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select array_remove(array[
    case when s.tutorial_done or s.matches >= 1 then 'lightning_dash' end,
    case when s.drop_shots >= 20 then 'frost_drop' end,
    case when s.wins >= 10 then 'phoenix_drive' end,
    case when 1 + floor((s.matches + s.wins * 2) / 3.0) >= 10 then 'sakura_meteor' end,
    case when s.doubles_matches >= 5 then 'love_sync' end
  ], null)
  from (select coalesce(st.matches, 0) as matches, coalesce(st.wins, 0) as wins, coalesce(st.drop_shots, 0) as drop_shots,
               coalesce(st.doubles_matches, 0) as doubles_matches, coalesce(st.tutorial_done, false) as tutorial_done
        from (select 1) one left join public.love_smash_stats st on st.user_id = uid) s
$$;

create or replace function public.love_smash_clean_loadout(uid uuid, raw jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  unlocked text[] := public.love_smash_unlocks(uid);
  movement text := raw ->> 'movement';
  special text := raw ->> 'special';
  ultimate text := raw ->> 'ultimate';
begin
  return jsonb_build_object(
    'movement', case when movement = 'lightning_dash' and movement = any(unlocked) then movement end,
    'special', case when special in ('frost_drop', 'phoenix_drive') and special = any(unlocked) then special end,
    'ultimate', case when ultimate = 'sakura_meteor' and ultimate = any(unlocked) then ultimate end
  );
end;
$$;

create or replace function public.get_love_smash_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  st public.love_smash_stats;
begin
  select * into st from public.love_smash_stats where user_id = uid;
  return jsonb_build_object(
    'unlocked', to_jsonb(public.love_smash_unlocks(uid)),
    'loadout', public.love_smash_clean_loadout(uid, coalesce(st.loadout, '{}'::jsonb)),
    'level', 1 + floor((coalesce(st.matches, 0) + coalesce(st.wins, 0) * 2) / 3.0)::int,
    'dropShots', coalesce(st.drop_shots, 0),
    'tutorialDone', coalesce(st.tutorial_done, false)
  );
end;
$$;

create or replace function public.set_love_smash_loadout(new_loadout jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  clean jsonb := public.love_smash_clean_loadout(uid, coalesce(new_loadout, '{}'::jsonb));
begin
  insert into public.love_smash_stats (user_id, loadout) values (uid, clean)
  on conflict (user_id) do update set loadout = clean, updated_at = now();
  return clean;
end;
$$;

create or replace function public.complete_love_smash_tutorial()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
begin
  insert into public.love_smash_stats (user_id, tutorial_done) values (uid, true)
  on conflict (user_id) do update set tutorial_done = true, updated_at = now();
  return public.get_love_smash_progress();
end;
$$;

create or replace function public.start_love_smash(difficulty text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  match public.love_smash_matches;
  loadout jsonb := public.love_smash_clean_loadout(uid, coalesce((select s.loadout from public.love_smash_stats s where s.user_id = uid), '{}'::jsonb));
begin
  if difficulty not in ('easy', 'normal', 'hard') then
    raise exception 'invalid_difficulty' using errcode = '22023';
  end if;
  if (select count(*) from public.love_smash_matches
      where user_id = uid and finished_at is null and started_at > now() - interval '10 minutes') >= 5 then
    raise exception 'too_many_open_matches' using errcode = 'P0001';
  end if;
  insert into public.love_smash_matches (user_id, difficulty, seed, loadout)
  values (uid, difficulty, floor(random() * 2147483646)::int + 1, loadout)
  returning * into match;
  return jsonb_build_object('matchId', match.id, 'seed', match.seed, 'difficulty', match.difficulty, 'loadout', match.loadout);
end;
$$;

drop function public.finish_love_smash(uuid, uuid, boolean, int, int, int, int, int, int);

create or replace function public.finish_love_smash(
  match_id uuid,
  player uuid,
  player_won boolean,
  final_player_score int,
  final_bot_score int,
  match_ticks int,
  rally_record int,
  perfect_count int,
  smash_count int,
  drop_count int default 0
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
      drop_shots = drop_shots + greatest(drop_count, 0),
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
    'stats', to_jsonb(stats) - 'user_id' - 'updated_at' - 'loadout',
    'unlocked', to_jsonb(public.love_smash_unlocks(player))
  );
end;
$$;

create or replace function public.finish_love_smash_room(target_room uuid, winner_team int, final_scores int[], match_ticks int, rally_record int, player_stats jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  room public.love_smash_rooms;
  member public.love_smash_room_members;
  match_row uuid;
  rewards jsonb := '{}'::jsonb;
  result jsonb;
  stats jsonb;
begin
  select * into room from public.love_smash_rooms where id = target_room for update;
  if room.id is null then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;
  if room.status <> 'playing' then
    raise exception 'room_closed' using errcode = 'P0001';
  end if;
  for member in select * from public.love_smash_room_members where room_id = room.id and status in ('joined', 'left') loop
    select id into match_row from public.love_smash_matches where room_id = room.id and user_id = member.user_id and finished_at is null;
    if match_row is null then
      continue;
    end if;
    stats := coalesce(player_stats -> member.slot::text, '{}'::jsonb);
    result := public.finish_love_smash(
      match_row, member.user_id, (member.slot % 2) = winner_team,
      final_scores[1 + member.slot % 2], final_scores[2 - member.slot % 2], match_ticks, rally_record,
      coalesce((stats ->> 'perfectHits')::int, 0), coalesce((stats ->> 'smashes')::int, 0), coalesce((stats ->> 'drops')::int, 0)
    );
    update public.love_smash_stats set doubles_matches = doubles_matches + 1,
      couple_wins = couple_wins + case when room.mode = 'couple_ai' and (member.slot % 2) = winner_team then 1 else 0 end
    where user_id = member.user_id;
    rewards := rewards || jsonb_build_object(member.user_id::text, jsonb_build_object('xp', result -> 'xp', 'coins', result -> 'coins', 'won', result -> 'won'));
  end loop;
  update public.love_smash_rooms
  set status = 'finished', finished_at = now(), updated_at = now(),
      result = jsonb_build_object('winner', winner_team, 'score', to_jsonb(final_scores), 'ticks', match_ticks, 'longestRally', rally_record, 'players', player_stats, 'rewards', rewards)
  where id = room.id;
  return public.love_smash_room_json(room.id);
end;
$$;

create or replace function public.start_love_smash_room(target_room uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  room public.love_smash_rooms;
  joined int;
  not_ready int;
  controllers jsonb := '[]'::jsonb;
  loadouts jsonb := '[]'::jsonb;
  team_sync boolean[] := array[true, true];
  member public.love_smash_room_members;
  new_seed int := floor(random() * 2147483646)::int + 1;
begin
  select * into room from public.love_smash_rooms where id = target_room for update;
  if room.id is null or room.host_id <> uid then
    raise exception 'not_host' using errcode = 'P0001';
  end if;
  if room.status <> 'lobby' then
    raise exception 'room_closed' using errcode = 'P0001';
  end if;
  select count(*), count(*) filter (where not ready and user_id <> uid) into joined, not_ready
  from public.love_smash_room_members where room_id = room.id and status = 'joined';
  if (room.mode = 'couple_ai' and joined <> 2) or (room.mode = 'versus' and joined <> 4) then
    raise exception 'players_missing' using errcode = 'P0001';
  end if;
  if not_ready > 0 then
    raise exception 'players_not_ready' using errcode = 'P0001';
  end if;
  for t in 0..1 loop
    if exists (select 1 from public.love_smash_room_members m where m.room_id = room.id and m.status = 'joined' and m.slot % 2 = t) then
      team_sync[t + 1] := exists (
        select 1 from public.love_smash_room_members m
        where m.room_id = room.id and m.status = 'joined' and m.slot % 2 = t and 'love_sync' = any(public.love_smash_unlocks(m.user_id))
      );
    end if;
  end loop;
  for s in 0..3 loop
    select * into member from public.love_smash_room_members where room_id = room.id and slot = s and status = 'joined';
    controllers := controllers || case
      when member.user_id is null then jsonb_build_object('kind', 'bot', 'difficulty', room.difficulty)
      when member.user_id = uid then jsonb_build_object('kind', 'human')
      else jsonb_build_object('kind', 'puppet') end;
    loadouts := loadouts || jsonb_build_array(case when member.user_id is null then null else
      public.love_smash_clean_loadout(member.user_id, coalesce((select st.loadout from public.love_smash_stats st where st.user_id = member.user_id), '{}'::jsonb)) end);
  end loop;
  update public.love_smash_rooms
  set status = 'playing', seed = new_seed, started_at = now(), updated_at = now(),
      config = jsonb_build_object('seed', new_seed, 'format', 'doubles', 'difficulty', room.difficulty, 'controllers', controllers, 'loadouts', loadouts, 'teamSync', to_jsonb(team_sync))
  where id = room.id;
  insert into public.love_smash_matches (user_id, difficulty, seed, room_id, mode, loadout)
  select m.user_id, case when room.mode = 'couple_ai' then room.difficulty end, new_seed, room.id, room.mode, loadouts -> m.slot::int
  from public.love_smash_room_members m where m.room_id = room.id and m.status = 'joined';
  return public.love_smash_room_json(room.id);
end;
$$;

revoke execute on function public.finish_love_smash(uuid, uuid, boolean, int, int, int, int, int, int, int) from anon, public, authenticated;
grant execute on function public.finish_love_smash(uuid, uuid, boolean, int, int, int, int, int, int, int) to service_role;
revoke execute on function public.love_smash_unlocks(uuid), public.love_smash_clean_loadout(uuid, jsonb) from anon, public, authenticated;
revoke execute on function public.get_love_smash_progress(), public.set_love_smash_loadout(jsonb), public.complete_love_smash_tutorial() from anon, public;
grant execute on function public.get_love_smash_progress(), public.set_love_smash_loadout(jsonb), public.complete_love_smash_tutorial() to authenticated;
