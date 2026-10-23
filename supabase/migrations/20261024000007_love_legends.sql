create or replace function public.is_couple_member(target_couple uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(target_couple is not null and target_couple = public.my_couple_id(), false)
$$;

create table public.leaderboard_seasons (
  id smallint primary key,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  check (ends_on > starts_on)
);

create table public.couple_public_profiles (
  couple_id uuid primary key references public.couples (id) on delete cascade,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.leaderboard_point_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  week_start date not null,
  day date not null,
  points int not null check (points > 0),
  source text not null check (source in ('learning', 'couple_quest', 'coop_bonus')),
  ref text not null,
  created_at timestamptz not null default now(),
  unique (couple_id, source, ref)
);
create index leaderboard_point_events_daily_idx on public.leaderboard_point_events (couple_id, user_id, day, source);

create table public.leaderboard_scores (
  couple_id uuid not null references public.couples (id) on delete cascade,
  week_start date not null,
  score int not null default 0 check (score >= 0),
  member_points jsonb not null default '{}'::jsonb,
  last_scored_at timestamptz not null default now(),
  primary key (couple_id, week_start)
);
create index leaderboard_scores_week_idx on public.leaderboard_scores (week_start, score desc, last_scored_at asc);

create table public.couple_rank_tiers (
  couple_id uuid primary key references public.couples (id) on delete cascade,
  legend_points int not null default 0 check (legend_points >= 0),
  tier smallint not null default 1 check (tier between 1 and 6),
  best_weekly_rank int,
  updated_at timestamptz not null default now()
);

create table public.leaderboard_weeks (
  week_start date primary key,
  finalized_at timestamptz not null default now(),
  participants int not null
);

create table public.leaderboard_snapshots (
  week_start date not null references public.leaderboard_weeks (week_start) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  rank int not null check (rank > 0),
  score int not null,
  primary key (week_start, couple_id),
  unique (week_start, rank)
);

create table public.ranking_rewards (
  rank_from int not null,
  rank_to int not null,
  coins int not null,
  badge_achievement text not null,
  effect text,
  effect_days int not null default 0,
  trophy_item text,
  primary key (rank_from, rank_to)
);

create table public.ranking_reward_claims (
  week_start date not null references public.leaderboard_weeks (week_start) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  rank int not null,
  coins_per_member int not null,
  effect text,
  effect_expires_at timestamptz,
  claimed_at timestamptz not null default now(),
  primary key (week_start, couple_id)
);

create table public.legend_celebrations (
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  milestone text not null check (milestone in ('top3', 'first')),
  seen_at timestamptz not null default now(),
  primary key (user_id, week_start, milestone)
);

insert into public.leaderboard_seasons (id, name, starts_on, ends_on) values
  (1, 'Sakura Dreams', '2026-10-19', '2026-12-14'),
  (2, 'Winter Lanterns', '2026-12-14', '2027-02-08'),
  (3, 'Spring Promise', '2027-02-08', '2027-04-05');

insert into public.ranking_rewards (rank_from, rank_to, coins, badge_achievement, effect, effect_days, trophy_item) values
  (1, 1, 500, 'legend_weekly_champion', 'golden_aura', 7, 'legend_trophy'),
  (2, 2, 300, 'legend_diamond_hearts', 'diamond_aura', 7, null),
  (3, 3, 200, 'legend_burning_hearts', 'burning_aura', 7, null),
  (4, 10, 100, 'legend_top_couple', null, 0, null);

insert into public.shop_items (id, name, name_vi, description, category, price, asset_key, footprint_w, footprint_h, min_home_level, shop_visible) values
  ('legend_trophy', 'Legendary Love Trophy', 'Cúp Tình Yêu Huyền Thoại', 'Awarded to the #1 couple of a Love Legends week.', 'decorations', 0, 'legend_trophy', 1, 1, 1, false),
  ('tier_trophy_gold', 'Golden Hearts Trophy', 'Cúp Trái Tim Vàng', 'Reached the Golden Hearts tier.', 'decorations', 0, 'tier_trophy_gold', 1, 1, 1, false),
  ('tier_trophy_diamond', 'Diamond Hearts Trophy', 'Cúp Trái Tim Kim Cương', 'Reached the Diamond Hearts tier.', 'decorations', 0, 'tier_trophy_diamond', 1, 1, 1, false),
  ('tier_trophy_sakura', 'Sakura Master Trophy', 'Cúp Bậc Thầy Hoa Anh Đào', 'Reached the Sakura Master tier.', 'decorations', 0, 'tier_trophy_sakura', 1, 1, 1, false),
  ('tier_trophy_eternal', 'Eternal Legends Trophy', 'Cúp Huyền Thoại Vĩnh Cửu', 'Reached the Eternal Legends tier.', 'decorations', 0, 'tier_trophy_eternal', 1, 1, 1, false)
on conflict (id) do nothing;

insert into public.achievements (id, scope, title, title_vi, description, icon, coin_reward, reward_item_id) values
  ('legend_weekly_champion', 'couple', 'The Ultimate Couple', 'Cặp đôi tối thượng', 'Finished a Love Legends week at #1.', 'crown', 0, null),
  ('legend_diamond_hearts', 'couple', 'Diamond Hearts', 'Trái tim kim cương', 'Finished a Love Legends week at #2.', 'diamond', 0, null),
  ('legend_burning_hearts', 'couple', 'Burning Hearts', 'Trái tim rực cháy', 'Finished a Love Legends week at #3.', 'flame', 0, null),
  ('legend_top_couple', 'couple', 'Top Couple', 'Cặp đôi top 10', 'Finished a Love Legends week in the top 10.', 'star', 0, null),
  ('tier_silver', 'couple', 'Silver Hearts', 'Trái tim bạc', 'Reached the Silver Hearts tier.', 'tier', 30, null),
  ('tier_gold', 'couple', 'Golden Hearts', 'Trái tim vàng', 'Reached the Golden Hearts tier.', 'tier', 60, 'tier_trophy_gold'),
  ('tier_diamond', 'couple', 'Diamond Hearts Tier', 'Bậc Trái tim kim cương', 'Reached the Diamond Hearts tier.', 'tier', 100, 'tier_trophy_diamond'),
  ('tier_sakura', 'couple', 'Sakura Master', 'Bậc thầy hoa anh đào', 'Reached the Sakura Master tier.', 'tier', 150, 'tier_trophy_sakura'),
  ('tier_eternal', 'couple', 'Eternal Legends', 'Huyền thoại vĩnh cửu', 'Reached the Eternal Legends tier.', 'tier', 250, 'tier_trophy_eternal')
on conflict (id) do nothing;

create or replace function public.legend_week_start(at_time timestamptz default now())
returns date
language sql
stable
as $$
  select date_trunc('week', at_time at time zone 'UTC')::date
$$;

create or replace function public.legend_tier_for_points(points int)
returns smallint
language sql
immutable
as $$
  select case
    when points >= 12000 then 6
    when points >= 7000 then 5
    when points >= 3500 then 4
    when points >= 1500 then 3
    when points >= 500 then 2
    else 1
  end::smallint
$$;

create or replace function public.add_ranking_points(cid uuid, uid uuid, add_points int, point_source text, point_ref text)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  daily_cap constant int := 400;
  week date := public.legend_week_start();
  today date := (now() at time zone 'UTC')::date;
  used int;
  granted int := add_points;
  before_tier smallint;
  after_tier smallint;
  tier_ids constant text[] := array['tier_silver', 'tier_gold', 'tier_diamond', 'tier_sakura', 'tier_eternal'];
begin
  if cid is null or add_points <= 0 then
    return 0;
  end if;

  perform 1 from public.couples where id = cid and dissolved_at is null for update;
  if not found then
    return 0;
  end if;

  if point_source = 'learning' then
    select coalesce(sum(points), 0) into used from public.leaderboard_point_events
      where couple_id = cid and user_id = uid and day = today and source = 'learning';
    granted := least(add_points, daily_cap - used);
    if granted <= 0 then
      return 0;
    end if;
  end if;

  begin
    insert into public.leaderboard_point_events (couple_id, user_id, week_start, day, points, source, ref)
    values (cid, uid, week, today, granted, point_source, point_ref);
  exception when unique_violation then
    return 0;
  end;

  insert into public.leaderboard_scores (couple_id, week_start, score, member_points, last_scored_at)
  values (cid, week, granted, case when uid is null then '{}'::jsonb else jsonb_build_object(uid::text, granted) end, now())
  on conflict (couple_id, week_start) do update
    set score = public.leaderboard_scores.score + granted,
        member_points = case when uid is null then public.leaderboard_scores.member_points
          else jsonb_set(public.leaderboard_scores.member_points, array[uid::text],
            to_jsonb(coalesce((public.leaderboard_scores.member_points->>uid::text)::int, 0) + granted)) end,
        last_scored_at = now();

  insert into public.couple_rank_tiers (couple_id) values (cid) on conflict do nothing;
  select tier into before_tier from public.couple_rank_tiers where couple_id = cid for update;
  update public.couple_rank_tiers
    set legend_points = legend_points + granted,
        tier = public.legend_tier_for_points(legend_points + granted),
        updated_at = now()
    where couple_id = cid
    returning tier into after_tier;

  for t in before_tier + 1 .. after_tier loop
    perform public.unlock_couple_achievement(cid, tier_ids[t - 1]);
  end loop;

  return granted;
end;
$$;

create or replace function public.on_learning_transaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.xp > 0 and new.reason in ('lesson', 'daily_quest', 'word_battle', 'sentence_puzzle') then
    perform public.add_ranking_points(
      (select couple_id from public.couple_members where user_id = new.user_id),
      new.user_id, new.xp, 'learning', new.reason || ':' || new.ref_id || ':' || new.user_id);
  end if;
  return new;
end;
$$;

create trigger currency_transactions_ranking
  after insert on public.currency_transactions
  for each row execute function public.on_learning_transaction();

create or replace function public.on_couple_quest_completed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  quest_xp int;
begin
  if new.completed_at is not null and old.completed_at is null then
    select couple_xp into quest_xp from public.couple_quests where id = new.quest_id;
    perform public.add_ranking_points(new.couple_id, null, coalesce(quest_xp, 0), 'couple_quest', new.quest_id || ':' || new.week_start);
  end if;
  return new;
end;
$$;

create trigger couple_quest_progress_ranking
  after update on public.couple_quest_progress
  for each row execute function public.on_couple_quest_completed();

create or replace function public.on_couple_activity_day()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select count(*) from public.couple_activity_days where couple_id = new.couple_id and day = new.day) = 2 then
    perform public.add_ranking_points(new.couple_id, null, 30, 'coop_bonus', new.day::text);
  end if;
  return new;
end;
$$;

create trigger couple_activity_days_ranking
  after insert on public.couple_activity_days
  for each row execute function public.on_couple_activity_day();

create or replace function public.finalize_legend_week(week date)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  entry record;
  reward public.ranking_rewards;
  member uuid;
  participant_count int;
begin
  if week >= public.legend_week_start() then
    raise exception 'week_not_over' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('love_legends_finalize'), (week - date '2024-01-01'));
  if exists (select 1 from public.leaderboard_weeks where week_start = week) then
    return 0;
  end if;

  select count(*) into participant_count
  from public.leaderboard_scores s
  join public.couple_public_profiles p on p.couple_id = s.couple_id and p.is_public
  join public.couples c on c.id = s.couple_id and c.dissolved_at is null
  where s.week_start = week and s.score > 0;

  insert into public.leaderboard_weeks (week_start, participants) values (week, participant_count);

  for entry in
    select s.couple_id, s.score,
           row_number() over (order by s.score desc, s.last_scored_at asc, s.couple_id asc) as rank
    from public.leaderboard_scores s
    join public.couple_public_profiles p on p.couple_id = s.couple_id and p.is_public
    join public.couples c on c.id = s.couple_id and c.dissolved_at is null
    where s.week_start = week and s.score > 0
  loop
    insert into public.leaderboard_snapshots (week_start, couple_id, rank, score) values (week, entry.couple_id, entry.rank, entry.score);
    insert into public.couple_rank_tiers (couple_id, best_weekly_rank) values (entry.couple_id, entry.rank)
    on conflict (couple_id) do update
      set best_weekly_rank = least(coalesce(public.couple_rank_tiers.best_weekly_rank, excluded.best_weekly_rank), excluded.best_weekly_rank);

    select * into reward from public.ranking_rewards where entry.rank between rank_from and rank_to;
    if reward.rank_from is null then
      continue;
    end if;

    insert into public.ranking_reward_claims (week_start, couple_id, rank, coins_per_member, effect, effect_expires_at)
    values (week, entry.couple_id, entry.rank, reward.coins, reward.effect,
            case when reward.effect is not null then (week + 7 + reward.effect_days)::timestamptz end);

    for member in select user_id from public.couple_members where couple_id = entry.couple_id loop
      perform public.grant_reward(member, 0, reward.coins, 'legend_reward', week::text);
    end loop;
    perform public.unlock_couple_achievement(entry.couple_id, reward.badge_achievement);
    if reward.trophy_item is not null then
      insert into public.inventories (user_id, couple_id, item_id, source)
      values ((select user_id from public.couple_members where couple_id = entry.couple_id order by slot limit 1),
              entry.couple_id, reward.trophy_item, 'achievement');
    end if;
    insert into public.memories (couple_id, kind, title, body, meta, occurred_on)
    values (entry.couple_id, 'achievement',
            case entry.rank when 1 then 'The Ultimate Couple of the week' when 2 then 'Diamond Hearts of the week'
                            when 3 then 'Burning Hearts of the week' else 'Top ' || entry.rank || ' in Love Legends' end,
            'We finished the week at #' || entry.rank || ' with ' || entry.score || ' points.',
            jsonb_build_object('week', week, 'rank', entry.rank), week + 6);
  end loop;

  return participant_count;
end;
$$;

create or replace function public.finalize_due_legend_weeks()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  week date;
  total int := 0;
begin
  for week in
    select distinct s.week_start from public.leaderboard_scores s
    where s.week_start < public.legend_week_start()
      and not exists (select 1 from public.leaderboard_weeks w where w.week_start = s.week_start)
    order by 1
  loop
    total := total + public.finalize_legend_week(week);
  end loop;
  return total;
end;
$$;

create or replace function public.couple_members_public(cid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', p.display_name, 'avatar', p.avatar) order by m.slot), '[]'::jsonb)
  from public.couple_members m
  join public.profiles p on p.id = m.user_id
  where m.couple_id = cid
$$;

create or replace function public.get_leaderboard(board text default 'weekly', max_rows int default 100)
returns table (
  rank int, couple_id uuid, couple_name text, members jsonb, score int, tier smallint,
  movement int, effect text, is_me boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  week date := public.legend_week_start();
  last_week date := public.legend_week_start() - 7;
  me uuid := public.my_couple_id();
  limit_rows int := least(greatest(max_rows, 1), 100);
begin
  perform public.require_user();
  if board not in ('weekly', 'all_time', 'partners', 'battle') then
    raise exception 'invalid_board' using errcode = '22023';
  end if;
  perform public.finalize_due_legend_weeks();

  return query
  with eligible as (
    select c.id, c.name
    from public.couples c
    join public.couple_public_profiles p on p.couple_id = c.id and p.is_public
    where c.dissolved_at is null and (select count(*) from public.couple_members m where m.couple_id = c.id) = 2
  ),
  scored as (
    select e.id, e.name,
      case board
        when 'weekly' then coalesce(s.score, 0)
        when 'all_time' then coalesce(t.legend_points, 0)
        when 'partners' then coalesce((
          select 2 * min(coalesce((s.member_points->>m.user_id::text)::int, 0))
          from public.couple_members m where m.couple_id = e.id), 0)
        else coalesce((
          select count(*)::int from public.game_sessions g
          join public.couple_members m on m.user_id = g.user_id and m.couple_id = e.id
          where g.kind = 'word_battle' and g.won and g.completed_at >= week::timestamptz), 0)
      end as value,
      coalesce(s.last_scored_at, t.updated_at, now()) as reached_at
    from eligible e
    left join public.leaderboard_scores s on s.couple_id = e.id and s.week_start = week
    left join public.couple_rank_tiers t on t.couple_id = e.id
  ),
  ranked as (
    select sc.*, row_number() over (order by sc.value desc, sc.reached_at asc, sc.id asc)::int as position
    from scored sc
    where sc.value > 0
  )
  select r.position, r.id, r.name, public.couple_members_public(r.id), r.value,
         coalesce(t.tier, 1::smallint),
         case when board = 'weekly' then (select snap.rank - r.position from public.leaderboard_snapshots snap
                                            where snap.week_start = last_week and snap.couple_id = r.id) end,
         (select cl.effect from public.ranking_reward_claims cl
            where cl.couple_id = r.id and cl.effect is not null and cl.effect_expires_at > now()
            order by cl.rank asc limit 1),
         r.id = me
  from ranked r
  left join public.couple_rank_tiers t on t.couple_id = r.id
  order by r.position
  limit limit_rows;
end;
$$;

create or replace function public.get_my_legend_status()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cid uuid := public.require_couple();
  week date := public.legend_week_start();
  my_score int;
  my_reached timestamptz;
  my_rank int;
  ahead_score int;
  tier_row public.couple_rank_tiers;
  last_rank int;
  public_flag boolean;
  thresholds constant int[] := array[0, 500, 1500, 3500, 7000, 12000];
begin
  perform public.finalize_due_legend_weeks();
  select coalesce(is_public, false) into public_flag from public.couple_public_profiles where couple_id = cid;
  select score, last_scored_at into my_score, my_reached from public.leaderboard_scores where couple_id = cid and week_start = week;
  my_score := coalesce(my_score, 0);
  select * into tier_row from public.couple_rank_tiers where couple_id = cid;

  if my_score > 0 then
    select count(*) + 1 into my_rank
    from public.leaderboard_scores s
    join public.couple_public_profiles p on p.couple_id = s.couple_id and p.is_public
    join public.couples c on c.id = s.couple_id and c.dissolved_at is null
    where s.week_start = week and s.couple_id <> cid
      and (s.score > my_score or (s.score = my_score and (s.last_scored_at, s.couple_id) < (my_reached, cid)));

    select min(s.score) into ahead_score
    from public.leaderboard_scores s
    join public.couple_public_profiles p on p.couple_id = s.couple_id and p.is_public
    where s.week_start = week and s.couple_id <> cid and s.score >= my_score
      and (s.score > my_score or (s.last_scored_at, s.couple_id) < (my_reached, cid));
  end if;

  select rank into last_rank from public.leaderboard_snapshots where week_start = week - 7 and couple_id = cid;

  return jsonb_build_object(
    'coupleId', cid,
    'isPublic', coalesce(public_flag, false),
    'weekStart', week,
    'weekEndsAt', (week + 7)::timestamptz,
    'season', (select to_jsonb(s) from public.leaderboard_seasons s where week >= s.starts_on and week < s.ends_on),
    'score', my_score,
    'rank', my_rank,
    'pointsToNext', case when ahead_score is not null then ahead_score - my_score + 1 end,
    'movement', case when last_rank is not null and my_rank is not null then last_rank - my_rank end,
    'tier', coalesce(tier_row.tier, 1),
    'legendPoints', coalesce(tier_row.legend_points, 0),
    'nextTierAt', case when coalesce(tier_row.tier, 1) < 6 then thresholds[coalesce(tier_row.tier, 1) + 1] end,
    'tierFloor', thresholds[coalesce(tier_row.tier, 1)],
    'bestRank', tier_row.best_weekly_rank,
    'memberPoints', (select coalesce(member_points, '{}'::jsonb) from public.leaderboard_scores where couple_id = cid and week_start = week),
    'dailyCap', 400,
    'celebrations', (select coalesce(jsonb_agg(milestone), '[]'::jsonb) from public.legend_celebrations where user_id = auth.uid() and week_start = week)
  );
end;
$$;

create or replace function public.set_legend_visibility(make_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.couple_public_profiles (couple_id, is_public)
  values (public.require_couple(), make_public)
  on conflict (couple_id) do update set is_public = excluded.is_public, updated_at = now();
end;
$$;

create or replace function public.ack_legend_celebration(milestone text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.legend_celebrations (user_id, week_start, milestone)
  values (public.require_user(), public.legend_week_start(), milestone)
  on conflict do nothing;
end;
$$;

create or replace function public.get_couple_legend_profile(target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  visible boolean;
  week date := public.legend_week_start();
begin
  perform public.require_user();
  select coalesce(p.is_public, false) into visible from public.couple_public_profiles p where p.couple_id = target;
  if not coalesce(visible, false) and not public.is_couple_member(target) then
    raise exception 'profile_private' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'coupleId', target,
    'name', (select name from public.couples where id = target),
    'members', public.couple_members_public(target),
    'tier', coalesce((select tier from public.couple_rank_tiers where couple_id = target), 1),
    'legendPoints', coalesce((select legend_points from public.couple_rank_tiers where couple_id = target), 0),
    'bestRank', (select best_weekly_rank from public.couple_rank_tiers where couple_id = target),
    'weeklyScore', coalesce((select score from public.leaderboard_scores where couple_id = target and week_start = week), 0),
    'coupleStreakBest', coalesce((select longest from public.streaks where subject_type = 'couple' and subject_id = target), 0),
    'homeLevel', coalesce((select home_level from public.couple_progress where couple_id = target), 1),
    'achievements', (
      select coalesce(jsonb_agg(distinct jsonb_build_object('id', a.id, 'title', a.title, 'title_vi', a.title_vi, 'scope', a.scope)), '[]'::jsonb)
      from public.user_achievements ua
      join public.achievements a on a.id = ua.achievement_id
      join public.couple_members m on m.user_id = ua.user_id and m.couple_id = target
      where a.id not like 'first_purchase'
    ),
    'trophies', (
      select coalesce(jsonb_agg(jsonb_build_object('week', c.week_start, 'rank', c.rank) order by c.week_start desc), '[]'::jsonb)
      from public.ranking_reward_claims c where c.couple_id = target and c.rank <= 3
    )
  );
end;
$$;

alter table public.leaderboard_seasons enable row level security;
alter table public.couple_public_profiles enable row level security;
alter table public.leaderboard_point_events enable row level security;
alter table public.leaderboard_scores enable row level security;
alter table public.couple_rank_tiers enable row level security;
alter table public.leaderboard_weeks enable row level security;
alter table public.leaderboard_snapshots enable row level security;
alter table public.ranking_rewards enable row level security;
alter table public.ranking_reward_claims enable row level security;
alter table public.legend_celebrations enable row level security;

create policy "catalog" on public.leaderboard_seasons for select to authenticated using (true);
create policy "catalog" on public.ranking_rewards for select to authenticated using (true);
create policy "own visibility" on public.couple_public_profiles for select to authenticated using (public.is_couple_member(couple_id));
create policy "own point events" on public.leaderboard_point_events for select to authenticated using (public.is_couple_member(couple_id));
create policy "own scores" on public.leaderboard_scores for select to authenticated using (public.is_couple_member(couple_id));
create policy "own tier" on public.couple_rank_tiers for select to authenticated using (public.is_couple_member(couple_id));
create policy "finalized weeks" on public.leaderboard_weeks for select to authenticated using (true);
create policy "own snapshots" on public.leaderboard_snapshots for select to authenticated using (public.is_couple_member(couple_id));
create policy "own reward claims" on public.ranking_reward_claims for select to authenticated using (public.is_couple_member(couple_id));
create policy "own celebrations" on public.legend_celebrations for select to authenticated using (user_id = auth.uid());

revoke all on public.leaderboard_seasons, public.couple_public_profiles, public.leaderboard_point_events, public.leaderboard_scores,
  public.couple_rank_tiers, public.leaderboard_weeks, public.leaderboard_snapshots, public.ranking_rewards,
  public.ranking_reward_claims, public.legend_celebrations from anon, authenticated;
grant select on public.leaderboard_seasons, public.couple_public_profiles, public.leaderboard_point_events, public.leaderboard_scores,
  public.couple_rank_tiers, public.leaderboard_weeks, public.leaderboard_snapshots, public.ranking_rewards,
  public.ranking_reward_claims, public.legend_celebrations to authenticated;

revoke execute on function
  public.add_ranking_points(uuid, uuid, int, text, text),
  public.on_learning_transaction(),
  public.on_couple_quest_completed(),
  public.on_couple_activity_day(),
  public.finalize_legend_week(date),
  public.couple_members_public(uuid)
from anon, public, authenticated;
revoke execute on function public.finalize_due_legend_weeks() from anon, public;
grant execute on function
  public.get_leaderboard(text, int),
  public.get_my_legend_status(),
  public.set_legend_visibility(boolean),
  public.ack_legend_celebration(text),
  public.get_couple_legend_profile(uuid),
  public.legend_week_start(timestamptz),
  public.legend_tier_for_points(int),
  public.finalize_due_legend_weeks()
to authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('love-legends-weekly-finalize', '5 0 * * 1', 'select public.finalize_due_legend_weeks()');
exception when others then
  raise notice 'pg_cron unavailable (%); weekly finalization runs lazily from get_leaderboard', sqlerrm;
end;
$$;
