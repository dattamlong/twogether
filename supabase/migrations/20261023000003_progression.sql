create table public.user_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp int not null default 0 check (xp >= 0),
  level int not null default 1 check (level >= 1),
  coins int not null default 0 check (coins >= 0),
  lessons_completed int not null default 0,
  games_won int not null default 0,
  puzzles_solved int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.couple_progress (
  couple_id uuid primary key references public.couples (id) on delete cascade,
  xp int not null default 0 check (xp >= 0),
  level int not null default 1 check (level >= 1),
  love_energy int not null default 0 check (love_energy >= 0),
  home_level int not null default 1 check (home_level between 1 and 5),
  updated_at timestamptz not null default now()
);

create table public.currency_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount int not null,
  xp int not null default 0 check (xp >= 0),
  reason text not null,
  ref_id text not null,
  balance_after int not null check (balance_after >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref_id)
);
create index currency_transactions_user_idx on public.currency_transactions (user_id, created_at desc);

create table public.streaks (
  subject_type text not null check (subject_type in ('user', 'couple')),
  subject_id uuid not null,
  current int not null default 0 check (current >= 0),
  longest int not null default 0 check (longest >= 0),
  last_active_date date,
  freezes int not null default 1 check (freezes between 0 and 2),
  updated_at timestamptz not null default now(),
  primary key (subject_type, subject_id)
);

create table public.activity_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table public.couple_activity_days (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  primary key (couple_id, day, user_id)
);

create table public.daily_quests (
  id text primary key,
  slot text not null,
  title text not null,
  title_vi text not null,
  event text not null,
  category text,
  target int not null check (target > 0),
  xp_reward int not null,
  coin_reward int not null
);

create table public.user_quest_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  quest_id text not null references public.daily_quests (id),
  day date not null,
  progress int not null default 0,
  completed_at timestamptz,
  claimed_at timestamptz,
  primary key (user_id, quest_id, day)
);

create table public.couple_quests (
  id text primary key,
  title text not null,
  title_vi text not null,
  description text not null,
  mode text not null check (mode in ('each', 'combined', 'same_day')),
  event text not null,
  target int not null check (target > 0),
  couple_xp int not null,
  love_energy int not null,
  coin_reward int not null
);

create table public.couple_quest_progress (
  couple_id uuid not null references public.couples (id) on delete cascade,
  quest_id text not null references public.couple_quests (id),
  week_start date not null,
  member_progress jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  primary key (couple_id, quest_id, week_start)
);

create table public.achievements (
  id text primary key,
  scope text not null check (scope in ('user', 'couple')),
  title text not null,
  title_vi text not null,
  description text not null,
  icon text not null,
  coin_reward int not null default 0,
  reward_item_id text
);

create table public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null references public.achievements (id),
  couple_id uuid references public.couples (id) on delete set null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create or replace function public.total_xp_for_level(target_level int, multiplier int default 1)
returns int
language sql
immutable
as $$
  select multiplier * (100 * greatest(target_level - 1, 0) + 25 * greatest(target_level - 1, 0) * greatest(target_level - 2, 0))
$$;

create or replace function public.level_for_xp(total_xp int, multiplier int default 1)
returns int
language plpgsql
immutable
as $$
declare
  lvl int := 1;
begin
  while public.total_xp_for_level(lvl + 1, multiplier) <= total_xp loop
    lvl := lvl + 1;
  end loop;
  return lvl;
end;
$$;

create or replace function public.home_level_for_energy(energy int)
returns int
language sql
immutable
as $$
  select case
    when energy >= 400 then 5
    when energy >= 240 then 4
    when energy >= 120 then 3
    when energy >= 40 then 2
    else 1
  end
$$;

create or replace function public.add_couple_progress(cid uuid, add_xp int, add_energy int, source text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  before public.couple_progress;
  after public.couple_progress;
begin
  if cid is null then
    return;
  end if;
  select * into before from public.couple_progress where couple_id = cid for update;
  if before.couple_id is null then
    return;
  end if;

  update public.couple_progress
  set xp = xp + greatest(add_xp, 0),
      level = public.level_for_xp(xp + greatest(add_xp, 0), 2),
      love_energy = love_energy + greatest(add_energy, 0),
      home_level = public.home_level_for_energy(love_energy + greatest(add_energy, 0)),
      updated_at = now()
  where couple_id = cid
  returning * into after;

  if after.home_level > before.home_level then
    insert into public.memories (couple_id, kind, title, body, meta)
    values (cid, 'home', 'Our home grew to level ' || after.home_level,
            'Love Energy made our little home even cozier.', jsonb_build_object('homeLevel', after.home_level));
    if after.home_level >= 3 then
      perform public.unlock_couple_achievement(cid, 'home_level_3');
    end if;
    if after.home_level >= 5 then
      perform public.unlock_couple_achievement(cid, 'home_level_5');
    end if;
  end if;
  if after.level > before.level then
    insert into public.memories (couple_id, kind, title, body, meta)
    values (cid, 'milestone', 'Couple level ' || after.level || '!', 'We grew together through ' || source || '.',
            jsonb_build_object('coupleLevel', after.level));
  end if;
end;
$$;

create or replace function public.grant_reward(uid uuid, add_xp int, add_coins int, reason text, ref text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  before public.user_progress;
  after public.user_progress;
begin
  if add_xp < 0 then
    raise exception 'negative_xp' using errcode = '22023';
  end if;

  select * into before from public.user_progress where user_id = uid for update;
  if before.user_id is null then
    raise exception 'progress_missing' using errcode = 'P0002';
  end if;
  if before.coins + add_coins < 0 then
    raise exception 'insufficient_coins' using errcode = 'P0001';
  end if;

  begin
    insert into public.currency_transactions (user_id, amount, xp, reason, ref_id, balance_after)
    values (uid, add_coins, add_xp, reason, ref, before.coins + add_coins);
  exception when unique_violation then
    raise exception 'duplicate_transaction' using errcode = 'P0001';
  end;

  update public.user_progress
  set xp = xp + add_xp,
      level = public.level_for_xp(xp + add_xp),
      coins = coins + add_coins,
      updated_at = now()
  where user_id = uid
  returning * into after;

  if add_xp > 0 then
    perform public.add_couple_progress(
      (select couple_id from public.couple_members where user_id = uid), add_xp / 2, 0, reason);
  end if;

  if after.level >= 5 and before.level < 5 then
    perform public.unlock_user_achievement(uid, 'level_5');
  end if;

  return jsonb_build_object(
    'xp', add_xp,
    'coins', add_coins,
    'totalXp', after.xp,
    'balance', after.coins,
    'level', after.level,
    'leveledUp', after.level > before.level
  );
end;
$$;

create or replace function public.unlock_user_achievement(uid uuid, achievement text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  def public.achievements;
  cid uuid := (select couple_id from public.couple_members where user_id = uid);
begin
  select * into def from public.achievements where id = achievement;
  if def.id is null then
    return false;
  end if;
  insert into public.user_achievements (user_id, achievement_id, couple_id)
  values (uid, achievement, cid)
  on conflict do nothing;
  if not found then
    return false;
  end if;

  if def.coin_reward > 0 then
    perform public.grant_reward(uid, 0, def.coin_reward, 'achievement', achievement);
  end if;
  if def.reward_item_id is not null then
    insert into public.inventories (user_id, couple_id, item_id, source)
    values (uid, cid, def.reward_item_id, 'achievement');
  end if;
  if cid is not null then
    insert into public.memories (couple_id, kind, title, body, created_by, meta)
    values (cid, 'achievement', def.title, def.description, uid, jsonb_build_object('achievement', achievement));
  end if;
  return true;
end;
$$;

create or replace function public.unlock_couple_achievement(cid uuid, achievement text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  member uuid;
  def public.achievements;
  first_unlock boolean := false;
begin
  select * into def from public.achievements where id = achievement;
  if def.id is null or cid is null then
    return;
  end if;
  for member in select user_id from public.couple_members where couple_id = cid order by slot loop
    insert into public.user_achievements (user_id, achievement_id, couple_id)
    values (member, achievement, cid)
    on conflict do nothing;
    if found then
      first_unlock := true;
      if def.coin_reward > 0 then
        perform public.grant_reward(member, 0, def.coin_reward, 'achievement', achievement);
      end if;
    end if;
  end loop;
  if first_unlock then
    if def.reward_item_id is not null then
      insert into public.inventories (user_id, couple_id, item_id, source)
      values ((select user_id from public.couple_members where couple_id = cid and slot = 0), cid, def.reward_item_id, 'achievement');
    end if;
    insert into public.memories (couple_id, kind, title, body, meta)
    values (cid, 'achievement', def.title, def.description, jsonb_build_object('achievement', achievement));
  end if;
end;
$$;

create or replace function public.advance_streak(kind text, subject uuid, today date)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s public.streaks;
  gap int;
  missed int;
  next_current int;
  next_freezes int;
begin
  insert into public.streaks (subject_type, subject_id) values (kind, subject) on conflict do nothing;
  select * into s from public.streaks where subject_type = kind and subject_id = subject for update;

  if s.last_active_date = today then
    return null;
  end if;

  gap := case when s.last_active_date is null then null else today - s.last_active_date end;
  missed := gap - 1;
  next_freezes := s.freezes;

  if gap = 1 then
    next_current := s.current + 1;
  elsif missed >= 1 and missed <= s.freezes then
    next_current := s.current + 1;
    next_freezes := s.freezes - missed;
  else
    next_current := 1;
  end if;

  if next_current in (7, 14, 30, 60, 100) then
    next_freezes := least(2, next_freezes + 1);
  end if;

  update public.streaks
  set current = next_current,
      longest = greatest(longest, next_current),
      last_active_date = today,
      freezes = next_freezes,
      updated_at = now()
  where subject_type = kind and subject_id = subject;

  if next_current in (3, 7, 14, 30, 60, 100) then
    return next_current;
  end if;
  return null;
end;
$$;

create or replace function public.record_qualifying_activity(uid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  personal_day date := public.user_local_date(uid);
  cid uuid := (select couple_id from public.couple_members where user_id = uid);
  couple_day date;
  milestone int;
  active_members int;
begin
  insert into public.activity_days (user_id, day) values (uid, personal_day) on conflict do nothing;
  milestone := public.advance_streak('user', uid, personal_day);
  if milestone is not null then
    perform public.unlock_user_achievement(uid, 'streak_' || milestone);
  end if;

  if cid is null then
    return;
  end if;
  couple_day := public.couple_local_date(cid);
  insert into public.couple_activity_days (couple_id, user_id, day) values (cid, uid, couple_day) on conflict do nothing;
  select count(*) into active_members from public.couple_activity_days where couple_id = cid and day = couple_day;
  if active_members = 2 then
    milestone := public.advance_streak('couple', cid, couple_day);
    if milestone is not null then
      perform public.unlock_couple_achievement(cid, 'couple_streak_' || milestone);
      insert into public.memories (couple_id, kind, title, body, meta)
      values (cid, 'streak', milestone || '-day couple streak', 'We learned together ' || milestone || ' days in a row.',
              jsonb_build_object('days', milestone));
    end if;
  end if;
end;
$$;

create or replace function public.quests_for_day(target_day date)
returns setof public.daily_quests
language sql
stable
set search_path = public, pg_temp
as $$
  with numbered as (
    select q.*, row_number() over (partition by q.slot order by q.id) - 1 as idx,
           count(*) over (partition by q.slot) as slot_size
    from public.daily_quests q
  )
  select id, slot, title, title_vi, event, category, target, xp_reward, coin_reward
  from numbered
  where idx = ((target_day - date '2024-01-01') + ascii(slot)) % slot_size
  order by array_position(array['learn', 'lesson', 'review', 'play'], slot)
$$;

create or replace function public.week_start(target_day date)
returns date
language sql
immutable
as $$
  select date_trunc('week', target_day)::date
$$;

create or replace function public.emit_event(uid uuid, event_name text, event_category text, amount int)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  today date := public.user_local_date(uid);
  quest public.daily_quests;
  cid uuid := (select couple_id from public.couple_members where user_id = uid);
  couple_day date;
  cq public.couple_quests;
  row_progress public.couple_quest_progress;
  member_key text := uid::text;
  partner uuid;
  done boolean;
begin
  for quest in select * from public.quests_for_day(today) loop
    if quest.event = event_name and (quest.category is null or quest.category = event_category) then
      insert into public.user_quest_progress (user_id, quest_id, day, progress)
      values (uid, quest.id, today, least(amount, quest.target))
      on conflict (user_id, quest_id, day)
      do update set progress = least(public.user_quest_progress.progress + amount, quest.target);
      update public.user_quest_progress
      set completed_at = coalesce(completed_at, now())
      where user_id = uid and quest_id = quest.id and day = today and progress >= quest.target;
    end if;
  end loop;

  if cid is null then
    return;
  end if;
  couple_day := public.couple_local_date(cid);
  select user_id into partner from public.couple_members where couple_id = cid and user_id <> uid;

  for cq in select * from public.couple_quests where event = event_name loop
    insert into public.couple_quest_progress (couple_id, quest_id, week_start)
    values (cid, cq.id, public.week_start(couple_day))
    on conflict do nothing;
    select * into row_progress from public.couple_quest_progress
      where couple_id = cid and quest_id = cq.id and week_start = public.week_start(couple_day)
      for update;
    if row_progress.completed_at is not null then
      continue;
    end if;

    if cq.mode = 'same_day' then
      row_progress.member_progress := jsonb_set(row_progress.member_progress, array[member_key], to_jsonb(couple_day::text));
      done := partner is not null and row_progress.member_progress->>partner::text = couple_day::text;
    else
      row_progress.member_progress := jsonb_set(
        row_progress.member_progress, array[member_key],
        to_jsonb(least(coalesce((row_progress.member_progress->>member_key)::int, 0) + amount, cq.target)));
      if cq.mode = 'each' then
        done := partner is not null
          and coalesce((row_progress.member_progress->>member_key)::int, 0) >= cq.target
          and coalesce((row_progress.member_progress->>partner::text)::int, 0) >= cq.target;
      else
        done := coalesce((row_progress.member_progress->>member_key)::int, 0)
              + coalesce((row_progress.member_progress->>coalesce(partner::text, '-'))::int, 0) >= cq.target;
      end if;
    end if;

    update public.couple_quest_progress
    set member_progress = row_progress.member_progress,
        completed_at = case when done then now() end
    where couple_id = cid and quest_id = cq.id and week_start = row_progress.week_start;

    if done then
      perform public.complete_couple_quest(cid, cq, row_progress.week_start);
    end if;
  end loop;
end;
$$;

create or replace function public.complete_couple_quest(cid uuid, cq public.couple_quests, period date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  member uuid;
begin
  for member in select user_id from public.couple_members where couple_id = cid loop
    perform public.grant_reward(member, 0, cq.coin_reward, 'couple_quest', cq.id || ':' || period);
  end loop;
  perform public.add_couple_progress(cid, cq.couple_xp, cq.love_energy, 'a couple quest');
  insert into public.memories (couple_id, kind, title, body, meta)
  values (cid, 'quest', cq.title, cq.description, jsonb_build_object('quest', cq.id));
  perform public.unlock_couple_achievement(cid, 'first_couple_quest');
end;
$$;

create or replace function public.get_daily_quests()
returns table (
  id text, slot text, title text, title_vi text, target int, xp_reward int, coin_reward int,
  progress int, completed boolean, claimed boolean, day date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select q.id, q.slot, q.title, q.title_vi, q.target, q.xp_reward, q.coin_reward,
         coalesce(p.progress, 0), p.completed_at is not null, p.claimed_at is not null,
         public.user_local_date(auth.uid())
  from public.quests_for_day(public.user_local_date(auth.uid())) q
  left join public.user_quest_progress p
    on p.user_id = auth.uid() and p.quest_id = q.id and p.day = public.user_local_date(auth.uid())
$$;

create or replace function public.claim_daily_quest(quest text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  today date := public.user_local_date(uid);
  progress_row public.user_quest_progress;
  def public.daily_quests;
begin
  select * into def from public.quests_for_day(today) q where q.id = quest;
  if def.id is null then
    raise exception 'quest_not_active_today' using errcode = 'P0001';
  end if;

  select * into progress_row from public.user_quest_progress
    where user_id = uid and quest_id = quest and day = today
    for update;
  if progress_row.user_id is null or progress_row.progress < def.target then
    raise exception 'quest_not_complete' using errcode = 'P0001';
  end if;
  if progress_row.claimed_at is not null then
    raise exception 'already_claimed' using errcode = 'P0001';
  end if;

  update public.user_quest_progress set claimed_at = now()
    where user_id = uid and quest_id = quest and day = today;
  return public.grant_reward(uid, def.xp_reward, def.coin_reward, 'daily_quest', quest || ':' || today);
end;
$$;

create or replace function public.get_couple_quests()
returns table (
  id text, title text, title_vi text, description text, mode text, target int,
  couple_xp int, love_energy int, coin_reward int, member_progress jsonb, completed boolean, week_start date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select q.id, q.title, q.title_vi, q.description, q.mode, q.target, q.couple_xp, q.love_energy, q.coin_reward,
         coalesce(p.member_progress, '{}'::jsonb), p.completed_at is not null,
         public.week_start(public.couple_local_date(public.my_couple_id()))
  from public.couple_quests q
  left join public.couple_quest_progress p
    on p.couple_id = public.my_couple_id()
   and p.quest_id = q.id
   and p.week_start = public.week_start(public.couple_local_date(public.my_couple_id()))
  where public.my_couple_id() is not null
  order by q.couple_xp
$$;

create or replace function public.check_user_achievements(uid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.user_progress;
  learned int;
  mastered int;
begin
  select * into p from public.user_progress where user_id = uid;
  if p.lessons_completed >= 1 then perform public.unlock_user_achievement(uid, 'first_lesson'); end if;
  if p.lessons_completed >= 10 then perform public.unlock_user_achievement(uid, 'lessons_10'); end if;
  if p.lessons_completed >= 25 then perform public.unlock_user_achievement(uid, 'lessons_25'); end if;
  if p.games_won >= 1 then perform public.unlock_user_achievement(uid, 'first_battle_win'); end if;
  if p.puzzles_solved >= 10 then perform public.unlock_user_achievement(uid, 'puzzles_10'); end if;

  select count(*) filter (where r.first_learned_at is not null), count(*) filter (where r.box >= 4)
  into learned, mastered
  from public.review_progress r
  join public.lesson_questions q on q.id = r.question_id
  where r.user_id = uid and q.word is not null;
  if learned >= 25 then perform public.unlock_user_achievement(uid, 'words_25'); end if;
  if mastered >= 20 then perform public.unlock_user_achievement(uid, 'words_mastered_20'); end if;
end;
$$;

create or replace function public.start_game(game public.game_kind)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  user_level public.cefr_level := (select english_level from public.profiles where id = uid);
  picked text[];
  session_id uuid;
begin
  if game = 'word_battle' then
    select array_agg(id) into picked from (
      select q.id
      from public.lesson_questions q
      join public.lessons l on l.id = q.lesson_id
      left join public.review_progress r on r.user_id = uid and r.question_id = q.id
      where l.category_id = 'vocabulary' and q.kind = 'multiple_choice' and q.level <= greatest(user_level, 'A2')
      order by (r.next_review_at is not null and r.next_review_at <= now()) desc, random()
      limit 8
    ) s;
  else
    select array_agg(id) into picked from (
      select q.id
      from public.lesson_questions q
      where q.kind = 'sentence_order' and q.level <= greatest(user_level, 'A2')
      order by random()
      limit 5
    ) s;
  end if;

  if coalesce(array_length(picked, 1), 0) = 0 then
    raise exception 'no_content' using errcode = 'P0002';
  end if;

  insert into public.game_sessions (user_id, kind, question_ids) values (uid, game, picked) returning id into session_id;

  return jsonb_build_object(
    'sessionId', session_id,
    'questions', (
      select jsonb_agg(to_jsonb(c) order by array_position(picked, c.id))
      from public.question_cards c where c.id = any (picked)
    )
  );
end;
$$;

create or replace function public.finish_game(game_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  session public.game_sessions;
  first_try int;
  solved int;
  is_won boolean;
  reward_xp int;
  reward_coins int;
  award jsonb;
  games_today int;
begin
  select * into session from public.game_sessions where id = game_session and user_id = uid for update;
  if session.id is null then
    raise exception 'invalid_game_session' using errcode = 'P0001';
  end if;
  if session.completed_at is not null then
    raise exception 'already_completed' using errcode = 'P0001';
  end if;

  select count(*) filter (where attempt_no = 1 and is_correct),
         count(distinct question_id) filter (where is_correct)
  into first_try, solved
  from public.question_attempts where game_session_id = session.id;

  if session.kind = 'word_battle' then
    is_won := first_try >= 5;
    reward_xp := case when is_won then 10 * first_try + 20 else 5 * first_try end;
    reward_coins := case when is_won then 15 else 3 end;
  else
    is_won := solved = array_length(session.question_ids, 1);
    reward_xp := 8 * first_try + 4 * (solved - first_try);
    reward_coins := 2 * solved + case when is_won then 5 else 0 end;
  end if;

  select count(*) into games_today from public.game_sessions
    where user_id = uid and completed_at is not null
      and (completed_at at time zone (select timezone from public.profiles where id = uid))::date = public.user_local_date(uid);
  if games_today >= 10 then
    reward_xp := reward_xp / 4;
    reward_coins := 0;
  end if;

  update public.game_sessions
  set completed_at = now(), won = is_won, correct_count = first_try, xp_awarded = reward_xp, coins_awarded = reward_coins
  where id = session.id;

  award := public.grant_reward(uid, reward_xp, reward_coins, session.kind::text, session.id::text);

  update public.user_progress
  set games_won = games_won + case when session.kind = 'word_battle' and is_won then 1 else 0 end,
      puzzles_solved = puzzles_solved + case when session.kind = 'sentence_puzzle' then solved else 0 end
  where user_id = uid;

  perform public.emit_event(uid, 'game_completed', null, 1);
  if session.kind = 'word_battle' and is_won then
    perform public.emit_event(uid, 'battle_won', null, 1);
  end if;
  if session.kind = 'sentence_puzzle' and solved > 0 then
    perform public.emit_event(uid, 'puzzle_solved', null, solved);
  end if;
  perform public.record_qualifying_activity(uid);
  perform public.check_user_achievements(uid);

  return award || jsonb_build_object('won', is_won, 'firstTryCorrect', first_try, 'solved', solved);
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1), 'Friend'), 24)
  );
  insert into public.user_progress (user_id) values (new.id);
  insert into public.streaks (subject_type, subject_id) values ('user', new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.delete_streak_on_user_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.streaks where subject_type = 'user' and subject_id = old.id;
  return old;
end;
$$;

create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.delete_streak_on_user_delete();

alter table public.user_progress enable row level security;
alter table public.couple_progress enable row level security;
alter table public.currency_transactions enable row level security;
alter table public.streaks enable row level security;
alter table public.activity_days enable row level security;
alter table public.couple_activity_days enable row level security;
alter table public.daily_quests enable row level security;
alter table public.user_quest_progress enable row level security;
alter table public.couple_quests enable row level security;
alter table public.couple_quest_progress enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

create policy "own or partner progress" on public.user_progress for select to authenticated
  using (user_id = auth.uid() or user_id = public.my_partner_id());
create policy "own couple progress" on public.couple_progress for select to authenticated
  using (public.is_couple_member(couple_id));
create policy "own transactions" on public.currency_transactions for select to authenticated
  using (user_id = auth.uid());
create policy "own and couple streaks" on public.streaks for select to authenticated
  using ((subject_type = 'user' and (subject_id = auth.uid() or subject_id = public.my_partner_id()))
      or (subject_type = 'couple' and public.is_couple_member(subject_id)));
create policy "own activity" on public.activity_days for select to authenticated
  using (user_id = auth.uid() or user_id = public.my_partner_id());
create policy "couple activity" on public.couple_activity_days for select to authenticated
  using (public.is_couple_member(couple_id));
create policy "catalog" on public.daily_quests for select to authenticated using (true);
create policy "own quest progress" on public.user_quest_progress for select to authenticated
  using (user_id = auth.uid());
create policy "catalog" on public.couple_quests for select to authenticated using (true);
create policy "couple quest progress" on public.couple_quest_progress for select to authenticated
  using (public.is_couple_member(couple_id));
create policy "catalog" on public.achievements for select to authenticated using (true);
create policy "own or partner achievements" on public.user_achievements for select to authenticated
  using (user_id = auth.uid() or user_id = public.my_partner_id());

revoke all on public.user_progress, public.couple_progress, public.currency_transactions, public.streaks,
  public.activity_days, public.couple_activity_days, public.daily_quests, public.user_quest_progress,
  public.couple_quests, public.couple_quest_progress, public.achievements, public.user_achievements
  from anon, authenticated;
grant select on public.user_progress, public.couple_progress, public.currency_transactions, public.streaks,
  public.activity_days, public.couple_activity_days, public.daily_quests, public.user_quest_progress,
  public.couple_quests, public.couple_quest_progress, public.achievements, public.user_achievements
  to authenticated;
