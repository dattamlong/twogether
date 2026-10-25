alter table public.daily_quests add column active boolean not null default true;

insert into public.daily_quests (id, slot, title, title_vi, event, category, target, xp_reward, coin_reward, active) values
  ('map_lessons_2', 'lesson', 'Finish 2 lessons on the Adventure Map', 'Hoàn thành 2 bài trên Bản đồ phiêu lưu', 'map_lesson', null, 2, 35, 15, true),
  ('map_step_1', 'explore', 'Take one step forward on the Adventure Map', 'Tiến thêm 1 bước trên Bản đồ phiêu lưu', 'map_step', null, 1, 25, 12, true),
  ('duel_1', 'play', 'Play a Word Duel', 'Chơi 1 trận Đấu từ vựng', 'duel_played', null, 1, 25, 12, true),
  ('adventure_part_1', 'play', 'Play an adventure part with your partner', 'Làm 1 phần Phiêu lưu cùng người ấy', 'adventure_part', null, 1, 25, 12, true),
  ('together_lesson_1', 'together', 'Both of you finish a lesson today', 'Cả hai cùng hoàn thành 1 bài hôm nay', 'together_lesson', null, 1, 30, 15, true)
on conflict (id) do update set slot = excluded.slot, title = excluded.title, title_vi = excluded.title_vi, event = excluded.event,
  category = excluded.category, target = excluded.target, xp_reward = excluded.xp_reward, coin_reward = excluded.coin_reward, active = true;

update public.daily_quests set active = false
where id in ('boss_attempt_1', 'minigame_1', 'battle_win_1', 'puzzle_3');

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
    where q.active
  )
  select id, slot, title, title_vi, event, category, target, xp_reward, coin_reward, active
  from numbered
  where idx = ((target_day - date '2024-01-01') + ascii(slot)) % slot_size
  order by array_position(array['together', 'learn', 'lesson', 'review', 'play', 'explore'], slot)
$$;

create or replace function public.on_lesson_quest_events()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  partner uuid;
begin
  if new.completed_at is null or old.completed_at is not null then
    return new;
  end if;

  if exists (select 1 from public.unit_lessons where lesson_id = new.lesson_id) then
    perform public.emit_event(new.user_id, 'map_lesson', null, 1);
    perform public.emit_event(new.user_id, 'map_step', null, 1);
  end if;

  select m.user_id into partner from public.couple_members m
  where m.couple_id = (select couple_id from public.couple_members where user_id = new.user_id)
    and m.user_id <> new.user_id;
  if partner is not null and exists (
    select 1 from public.lesson_attempts a
    where a.user_id = partner and a.completed_at is not null
      and (a.completed_at at time zone coalesce((select timezone from public.profiles where id = partner), 'Asia/Ho_Chi_Minh'))::date
        = public.user_local_date(partner)
  ) then
    perform public.emit_event(new.user_id, 'together_lesson', null, 1);
    perform public.emit_event(partner, 'together_lesson', null, 1);
  end if;
  return new;
end;
$$;

create trigger lesson_attempts_quest_events
  after update on public.lesson_attempts
  for each row execute function public.on_lesson_quest_events();

create or replace function public.on_game_session_quest_events()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.completed_at is null or old.completed_at is not null then
    return new;
  end if;
  case new.kind::text
    when 'word_duel' then perform public.emit_event(new.user_id, 'duel_played', null, 1);
    when 'adventure' then perform public.emit_event(new.user_id, 'adventure_part', null, 1);
    when 'boss', 'unit_review' then perform public.emit_event(new.user_id, 'map_step', null, 1);
    else null;
  end case;
  return new;
end;
$$;

create trigger game_sessions_quest_events
  after update on public.game_sessions
  for each row execute function public.on_game_session_quest_events();

revoke execute on function public.on_lesson_quest_events(), public.on_game_session_quest_events() from anon, public, authenticated;
