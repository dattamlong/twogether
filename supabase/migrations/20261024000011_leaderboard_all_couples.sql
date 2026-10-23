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
    select sc.*,
           case when sc.value > 0
             then row_number() over (partition by sc.value > 0 order by sc.value desc, sc.reached_at asc, sc.id asc)::int
           end as position
    from scored sc
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
  order by r.position asc nulls last, r.name asc, r.id asc
  limit limit_rows;
end;
$$;
