create or replace function public.rebuild_legend_totals()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tier_ids constant text[] := array['tier_silver', 'tier_gold', 'tier_diamond', 'tier_sakura', 'tier_eternal'];
  row_data record;
begin
  insert into public.leaderboard_scores (couple_id, week_start, score, member_points, last_scored_at)
  select e.couple_id, e.week_start, sum(e.points),
         coalesce((select jsonb_object_agg(x.user_id::text, x.total)
                   from (select e2.user_id, sum(e2.points) as total from public.leaderboard_point_events e2
                         where e2.couple_id = e.couple_id and e2.week_start = e.week_start and e2.user_id is not null
                         group by e2.user_id) x), '{}'::jsonb),
         max(e.created_at)
  from public.leaderboard_point_events e
  group by e.couple_id, e.week_start
  on conflict (couple_id, week_start) do update
    set score = excluded.score, member_points = excluded.member_points, last_scored_at = excluded.last_scored_at;

  insert into public.couple_rank_tiers (couple_id, legend_points, tier)
  select e.couple_id, sum(e.points), public.legend_tier_for_points(sum(e.points)::int)
  from public.leaderboard_point_events e
  group by e.couple_id
  on conflict (couple_id) do update
    set legend_points = excluded.legend_points, tier = excluded.tier, updated_at = now();

  for row_data in select couple_id, tier from public.couple_rank_tiers where tier > 1 loop
    for t in 2 .. row_data.tier loop
      perform public.unlock_couple_achievement(row_data.couple_id, tier_ids[t - 1]);
    end loop;
  end loop;
end;
$$;

revoke execute on function public.rebuild_legend_totals() from anon, public, authenticated;

do $$
declare
  tx record;
  cid uuid;
  tx_day date;
  used int;
  granted int;
begin
  for tx in
    select t.* from public.currency_transactions t
    where t.xp > 0 and t.reason in ('lesson', 'daily_quest', 'word_battle', 'sentence_puzzle')
    order by t.created_at, t.id
  loop
    select couple_id into cid from public.couple_members where user_id = tx.user_id;
    continue when cid is null;
    tx_day := (tx.created_at at time zone 'UTC')::date;
    select coalesce(sum(points), 0) into used from public.leaderboard_point_events
      where couple_id = cid and user_id = tx.user_id and day = tx_day and source = 'learning';
    granted := least(tx.xp, 400 - used);
    continue when granted <= 0;
    insert into public.leaderboard_point_events (couple_id, user_id, week_start, day, points, source, ref, created_at)
    values (cid, tx.user_id, public.legend_week_start(tx.created_at), tx_day, granted, 'learning',
            tx.reason || ':' || tx.ref_id || ':' || tx.user_id, tx.created_at)
    on conflict (couple_id, source, ref) do nothing;
  end loop;

  insert into public.leaderboard_point_events (couple_id, user_id, week_start, day, points, source, ref, created_at)
  select p.couple_id, null, public.legend_week_start(p.completed_at), (p.completed_at at time zone 'UTC')::date,
         q.couple_xp, 'couple_quest', p.quest_id || ':' || p.week_start, p.completed_at
  from public.couple_quest_progress p
  join public.couple_quests q on q.id = p.quest_id
  join public.couples c on c.id = p.couple_id and c.dissolved_at is null
  where p.completed_at is not null and q.couple_xp > 0
  on conflict (couple_id, source, ref) do nothing;

  insert into public.leaderboard_point_events (couple_id, user_id, week_start, day, points, source, ref, created_at)
  select d.couple_id, null, public.legend_week_start(max(d.day)::timestamp at time zone 'UTC'), d.day, 30, 'coop_bonus', d.day::text,
         (d.day::timestamp at time zone 'UTC') + interval '12 hours'
  from public.couple_activity_days d
  join public.couples c on c.id = d.couple_id and c.dissolved_at is null
  group by d.couple_id, d.day
  having count(*) = 2
  on conflict (couple_id, source, ref) do nothing;

  perform public.rebuild_legend_totals();
end;
$$;
