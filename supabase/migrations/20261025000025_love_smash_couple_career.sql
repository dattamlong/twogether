create or replace function public.love_smash_room_json(target_room uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', r.id, 'code', r.code, 'hostId', r.host_id, 'mode', r.mode, 'difficulty', r.difficulty, 'status', r.status,
    'seed', r.seed, 'config', r.config, 'result', r.result, 'startedAt', r.started_at, 'careerId', r.career_id,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', m.user_id, 'slot', m.slot, 'status', m.status, 'ready', m.ready,
        'name', p.display_name, 'avatar', p.avatar
      ) order by m.slot)
      from public.love_smash_room_members m join public.profiles p on p.id = m.user_id
      where m.room_id = r.id and m.status in ('invited', 'joined', 'declined')
    ), '[]'::jsonb)
  )
  from public.love_smash_rooms r where r.id = target_room
$$;

create or replace function public.start_love_smash_room_with_config(target_room uuid, host uuid, base_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  room public.love_smash_rooms;
  joined int;
  not_ready int;
  controllers jsonb := '[]'::jsonb;
  loadouts jsonb := '[]'::jsonb;
  member public.love_smash_room_members;
  new_seed int := (base_config ->> 'seed')::int;
  preset jsonb;
begin
  select * into room from public.love_smash_rooms where id = target_room for update;
  if room.id is null or room.host_id <> host then
    raise exception 'not_host' using errcode = 'P0001';
  end if;
  if room.status <> 'lobby' then
    raise exception 'room_closed' using errcode = 'P0001';
  end if;
  select count(*), count(*) filter (where not ready and user_id <> host) into joined, not_ready
  from public.love_smash_room_members where room_id = room.id and status = 'joined';
  if joined <> 2 then
    raise exception 'players_missing' using errcode = 'P0001';
  end if;
  if not_ready > 0 then
    raise exception 'players_not_ready' using errcode = 'P0001';
  end if;
  for s in 0..3 loop
    preset := base_config -> 'controllers' -> s;
    select * into member from public.love_smash_room_members where room_id = room.id and slot = s and status = 'joined';
    controllers := controllers || case
      when member.user_id is null then preset
      when member.user_id = host then jsonb_build_object('kind', 'human')
      else jsonb_build_object('kind', 'puppet') end;
    loadouts := loadouts || jsonb_build_array(case when member.user_id is null then null else
      public.love_smash_clean_loadout(member.user_id, coalesce((select st.loadout from public.love_smash_stats st where st.user_id = member.user_id), '{}'::jsonb)) end);
  end loop;
  update public.love_smash_rooms
  set status = 'playing', seed = new_seed, started_at = now(), updated_at = now(),
      config = base_config || jsonb_build_object('controllers', controllers, 'loadouts', loadouts, 'teamSync', jsonb_build_array(
        exists (select 1 from public.love_smash_room_members m where m.room_id = room.id and m.status = 'joined' and 'love_sync' = any(public.love_smash_unlocks(m.user_id))),
        true))
  where id = room.id;
  insert into public.love_smash_matches (user_id, difficulty, seed, room_id, mode, loadout, career_id)
  select m.user_id, null, new_seed, room.id, 'career', loadouts -> m.slot::int, room.career_id
  from public.love_smash_room_members m where m.room_id = room.id and m.status = 'joined';
  return public.love_smash_room_json(room.id);
end;
$$;

revoke execute on function public.start_love_smash_room_with_config(uuid, uuid, jsonb) from anon, public, authenticated;
grant execute on function public.start_love_smash_room_with_config(uuid, uuid, jsonb) to service_role;
