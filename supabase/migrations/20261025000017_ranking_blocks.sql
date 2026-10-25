create table public.ranking_blocks (
  couple_id uuid primary key references public.couples (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.ranking_blocks enable row level security;
revoke all on public.ranking_blocks from anon, authenticated;

create or replace function public.add_ranking_points(cid uuid, uid uuid, add_points int, point_source text, point_ref text)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  week date := public.legend_week_start();
  today date := (now() at time zone 'UTC')::date;
  granted int := add_points;
  before_tier smallint;
  after_tier smallint;
  tier_ids constant text[] := array['tier_silver', 'tier_gold', 'tier_diamond', 'tier_sakura', 'tier_eternal'];
begin
  if cid is null or add_points <= 0 then
    return 0;
  end if;

  if exists (select 1 from public.ranking_blocks where couple_id = cid) then
    return 0;
  end if;

  perform 1 from public.couples where id = cid and dissolved_at is null for update;
  if not found then
    return 0;
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
