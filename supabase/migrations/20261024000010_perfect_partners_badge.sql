insert into public.achievements (id, scope, title, title_vi, description, icon, coin_reward, reward_item_id) values
  ('legend_perfect_partners', 'couple', 'Perfect Partners', 'Cặp đôi ăn ý', 'Finished a Love Legends week where both partners each earned at least 40% of the learning points (200+ total).', 'hearts', 50, null)
on conflict (id) do nothing;

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

    if (
      select sum(coalesce((s.member_points->>m.user_id::text)::int, 0)) >= 200
         and min(coalesce((s.member_points->>m.user_id::text)::int, 0)) >= 0.4 * sum(coalesce((s.member_points->>m.user_id::text)::int, 0))
         and count(*) = 2
      from public.leaderboard_scores s
      join public.couple_members m on m.couple_id = s.couple_id
      where s.couple_id = entry.couple_id and s.week_start = week
    ) then
      perform public.unlock_couple_achievement(entry.couple_id, 'legend_perfect_partners');
    end if;

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
