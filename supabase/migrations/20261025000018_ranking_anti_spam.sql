create index leaderboard_point_events_learning_rate_idx
  on public.leaderboard_point_events (user_id, created_at)
  where source = 'learning';

create or replace function public.ranking_learning_eligible(reason text, ref_id text, uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  attempt public.lesson_attempts;
  session public.game_sessions;
begin
  if reason = 'daily_quest' then
    return true;
  end if;
  if ref_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  if reason = 'lesson' then
    select * into attempt from public.lesson_attempts where id = ref_id::uuid and user_id = uid;
    if attempt.id is null or attempt.completed_at is null then
      return false;
    end if;
    if attempt.completed_at - attempt.started_at < make_interval(secs => 2 * greatest(coalesce(attempt.total_count, 1), 1)) then
      return false;
    end if;
    return not exists (
      select 1 from public.lesson_attempts o
      where o.user_id = uid and o.lesson_id = attempt.lesson_id and o.id <> attempt.id
        and o.completed_at is not null and o.completed_at < attempt.completed_at
    );
  end if;

  select * into session from public.game_sessions where id = ref_id::uuid and user_id = uid;
  if session.id is null or session.completed_at is null then
    return false;
  end if;
  return session.completed_at - session.started_at >= make_interval(secs => 2 * greatest(coalesce(cardinality(session.question_ids), 1), 1));
end;
$$;

create or replace function public.on_learning_transaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.xp <= 0 or new.reason not in ('lesson', 'daily_quest', 'word_battle', 'sentence_puzzle', 'boss', 'unit_review', 'adventure') then
    return new;
  end if;
  if not public.ranking_learning_eligible(new.reason, new.ref_id, new.user_id) then
    return new;
  end if;
  if new.reason <> 'daily_quest' and (
    select count(*) from public.leaderboard_point_events
    where user_id = new.user_id and source = 'learning'
      and created_at > now() - interval '1 hour' and ref not like 'daily_quest:%'
  ) >= 30 then
    return new;
  end if;
  perform public.add_ranking_points(
    (select couple_id from public.couple_members where user_id = new.user_id),
    new.user_id, new.xp, 'learning', new.reason || ':' || new.ref_id || ':' || new.user_id);
  return new;
end;
$$;

create temporary table spam_events as
select e.id, e.couple_id
from public.leaderboard_point_events e
where e.source = 'learning'
  and split_part(e.ref, ':', 1) <> 'daily_quest'
  and not public.ranking_learning_eligible(split_part(e.ref, ':', 1), split_part(e.ref, ':', 2), e.user_id);

delete from public.leaderboard_point_events where id in (select id from spam_events);

update public.leaderboard_scores set score = 0, member_points = '{}'::jsonb
where couple_id in (select couple_id from spam_events)
  and week_start not in (select week_start from public.leaderboard_weeks);
update public.couple_rank_tiers set legend_points = 0, tier = 1
where couple_id in (select couple_id from spam_events);

select public.rebuild_legend_totals();
drop table spam_events;

revoke execute on function public.ranking_learning_eligible(text, text, uuid) from anon, public, authenticated;
revoke execute on function public.on_learning_transaction() from anon, public, authenticated;
