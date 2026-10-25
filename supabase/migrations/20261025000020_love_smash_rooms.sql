create table public.love_smash_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('couple_ai', 'versus')),
  difficulty text not null default 'normal' check (difficulty in ('easy', 'normal', 'hard')),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished', 'abandoned')),
  seed int,
  config jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create index love_smash_rooms_host_idx on public.love_smash_rooms (host_id, created_at desc);

create table public.love_smash_room_members (
  room_id uuid not null references public.love_smash_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  slot smallint not null check (slot between 0 and 3),
  status text not null check (status in ('invited', 'joined', 'declined', 'left')),
  ready boolean not null default false,
  joined_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create unique index love_smash_room_slot_idx on public.love_smash_room_members (room_id, slot) where status in ('invited', 'joined');
create index love_smash_room_members_user_idx on public.love_smash_room_members (user_id, updated_at desc);

alter table public.love_smash_matches drop constraint love_smash_matches_difficulty_check;
alter table public.love_smash_matches alter column difficulty drop not null;
alter table public.love_smash_matches add constraint love_smash_matches_difficulty_check check (difficulty is null or difficulty in ('easy', 'normal', 'hard'));
alter table public.love_smash_matches add column room_id uuid references public.love_smash_rooms (id) on delete set null;
alter table public.love_smash_matches add column mode text not null default 'solo' check (mode in ('solo', 'couple_ai', 'versus'));
alter table public.love_smash_stats add column doubles_matches int not null default 0;

create or replace function public.love_smash_member_of(target_room uuid, include_invited boolean default true)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.love_smash_room_members
    where room_id = target_room and user_id = auth.uid()
      and (status = 'joined' or (include_invited and status = 'invited'))
  )
$$;

alter table public.love_smash_rooms enable row level security;
alter table public.love_smash_room_members enable row level security;
create policy "members read their love smash rooms" on public.love_smash_rooms for select to authenticated using (public.love_smash_member_of(id));
create policy "members read love smash room members" on public.love_smash_room_members for select to authenticated using (public.love_smash_member_of(room_id));
revoke all on public.love_smash_rooms, public.love_smash_room_members from anon, authenticated;
grant select on public.love_smash_rooms, public.love_smash_room_members to authenticated;

create or replace function public.love_smash_room_json(target_room uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', r.id, 'code', r.code, 'hostId', r.host_id, 'mode', r.mode, 'difficulty', r.difficulty, 'status', r.status,
    'seed', r.seed, 'config', r.config, 'result', r.result, 'startedAt', r.started_at,
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

create or replace function public.love_smash_open_slots(room_mode text)
returns smallint[]
language sql
immutable
as $$
  select case when room_mode = 'couple_ai' then array[0, 2]::smallint[] else array[0, 2, 1, 3]::smallint[] end
$$;

create or replace function public.create_love_smash_room(room_mode text, room_difficulty text default 'normal', invite_partner boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  partner uuid;
  room public.love_smash_rooms;
  new_code text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if room_mode not in ('couple_ai', 'versus') then
    raise exception 'invalid_mode' using errcode = '22023';
  end if;
  if room_difficulty not in ('easy', 'normal', 'hard') then
    raise exception 'invalid_difficulty' using errcode = '22023';
  end if;
  if invite_partner then
    select m.user_id into partner from public.couple_members m
    where m.couple_id = public.my_couple_id() and m.user_id <> uid;
    if partner is null then
      raise exception 'no_partner' using errcode = 'P0001';
    end if;
  end if;

  update public.love_smash_room_members set status = 'left', ready = false, updated_at = now()
  where user_id = uid and status in ('joined', 'invited')
    and room_id in (select id from public.love_smash_rooms where status = 'lobby');
  update public.love_smash_rooms set status = 'abandoned', updated_at = now()
  where host_id = uid and status = 'lobby';

  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.love_smash_rooms where code = new_code);
  end loop;

  insert into public.love_smash_rooms (code, host_id, mode, difficulty)
  values (new_code, uid, room_mode, room_difficulty)
  returning * into room;
  insert into public.love_smash_room_members (room_id, user_id, slot, status, ready, joined_at)
  values (room.id, uid, 0, 'joined', true, now());

  if partner is not null then
    insert into public.love_smash_room_members (room_id, user_id, slot, status)
    values (room.id, partner, 2, 'invited');
    perform public.notify(
      partner, uid, 'game_invitation', '🏸 Love Smash invitation',
      coalesce((select display_name from public.profiles where id = uid), 'Your partner') || ' wants to team up in Love Smash doubles!',
      'Tap to join the court 💗',
      '/games/love-smash?room=' || room.id,
      jsonb_build_object('roomId', room.id, 'mode', room_mode)
    );
  end if;
  return public.love_smash_room_json(room.id);
end;
$$;

create or replace function public.join_love_smash_room(room_code text default null, target_room uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  room public.love_smash_rooms;
  existing public.love_smash_room_members;
  free_slot smallint;
begin
  select * into room from public.love_smash_rooms
  where (target_room is not null and id = target_room) or (room_code is not null and code = upper(trim(room_code)))
  for update;
  if room.id is null then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;
  if room.status <> 'lobby' then
    raise exception 'room_closed' using errcode = 'P0001';
  end if;
  select * into existing from public.love_smash_room_members where room_id = room.id and user_id = uid;
  if existing.user_id is not null and existing.status in ('joined', 'invited')
     and not exists (select 1 from public.love_smash_room_members o where o.room_id = room.id and o.slot = existing.slot and o.user_id <> uid and o.status in ('invited', 'joined')) then
    update public.love_smash_room_members set status = 'joined', joined_at = coalesce(joined_at, now()), updated_at = now()
    where room_id = room.id and user_id = uid;
    return public.love_smash_room_json(room.id);
  end if;
  select s into free_slot from unnest(public.love_smash_open_slots(room.mode)) with ordinality as t(s, n)
  where not exists (select 1 from public.love_smash_room_members m where m.room_id = room.id and m.slot = s and m.status in ('invited', 'joined'))
  order by n limit 1;
  if free_slot is null then
    raise exception 'room_full' using errcode = 'P0001';
  end if;
  insert into public.love_smash_room_members (room_id, user_id, slot, status, ready, joined_at)
  values (room.id, uid, free_slot, 'joined', false, now())
  on conflict (room_id, user_id) do update set slot = excluded.slot, status = 'joined', ready = false, joined_at = now(), updated_at = now();
  return public.love_smash_room_json(room.id);
end;
$$;

create or replace function public.respond_love_smash_room(target_room uuid, accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
begin
  if accept then
    return public.join_love_smash_room(null, target_room);
  end if;
  update public.love_smash_room_members set status = 'declined', ready = false, updated_at = now()
  where room_id = target_room and user_id = uid and status = 'invited';
  if not found then
    raise exception 'not_invited' using errcode = 'P0001';
  end if;
  return jsonb_build_object('declined', true);
end;
$$;

create or replace function public.leave_love_smash_room(target_room uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  room public.love_smash_rooms;
begin
  select * into room from public.love_smash_rooms where id = target_room for update;
  if room.id is null or not exists (select 1 from public.love_smash_room_members where room_id = room.id and user_id = uid) then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;
  update public.love_smash_room_members set status = case when status = 'invited' then 'declined' else 'left' end, ready = false, updated_at = now()
  where room_id = room.id and user_id = uid;
  if room.status = 'lobby' and room.host_id = uid then
    update public.love_smash_rooms set status = 'abandoned', updated_at = now() where id = room.id;
  elsif room.status = 'playing' then
    update public.love_smash_rooms set status = 'abandoned', finished_at = now(), updated_at = now() where id = room.id;
  end if;
end;
$$;

create or replace function public.set_love_smash_ready(target_room uuid, is_ready boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
begin
  update public.love_smash_room_members m set ready = is_ready, updated_at = now()
  from public.love_smash_rooms r
  where m.room_id = target_room and m.user_id = uid and m.status = 'joined' and r.id = m.room_id and r.status = 'lobby';
  if not found then
    raise exception 'room_closed' using errcode = 'P0001';
  end if;
  return public.love_smash_room_json(target_room);
end;
$$;

create or replace function public.switch_love_smash_team(target_room uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  room public.love_smash_rooms;
  mine public.love_smash_room_members;
  target smallint;
begin
  select * into room from public.love_smash_rooms where id = target_room for update;
  select * into mine from public.love_smash_room_members where room_id = target_room and user_id = uid and status = 'joined';
  if room.id is null or mine.user_id is null or room.status <> 'lobby' or room.mode <> 'versus' then
    raise exception 'room_closed' using errcode = 'P0001';
  end if;
  select s into target from unnest(case when mine.slot % 2 = 0 then array[1, 3] else array[0, 2] end::smallint[]) as s
  where not exists (select 1 from public.love_smash_room_members m where m.room_id = room.id and m.slot = s and m.status in ('invited', 'joined'))
  order by s limit 1;
  if target is null then
    raise exception 'team_full' using errcode = 'P0001';
  end if;
  if mine.slot = 0 then
    raise exception 'host_stays' using errcode = 'P0001';
  end if;
  update public.love_smash_room_members set slot = target, ready = false, updated_at = now() where room_id = room.id and user_id = uid;
  return public.love_smash_room_json(room.id);
end;
$$;

create or replace function public.set_love_smash_room_difficulty(target_room uuid, room_difficulty text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if room_difficulty not in ('easy', 'normal', 'hard') then
    raise exception 'invalid_difficulty' using errcode = '22023';
  end if;
  update public.love_smash_rooms set difficulty = room_difficulty, updated_at = now()
  where id = target_room and host_id = public.require_user() and status = 'lobby';
  if not found then
    raise exception 'not_host' using errcode = 'P0001';
  end if;
  return public.love_smash_room_json(target_room);
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
  for s in 0..3 loop
    select * into member from public.love_smash_room_members where room_id = room.id and slot = s and status = 'joined';
    controllers := controllers || case
      when member.user_id is null then jsonb_build_object('kind', 'bot', 'difficulty', room.difficulty)
      when member.user_id = uid then jsonb_build_object('kind', 'human')
      else jsonb_build_object('kind', 'puppet') end;
  end loop;
  update public.love_smash_rooms
  set status = 'playing', seed = new_seed, started_at = now(), updated_at = now(),
      config = jsonb_build_object('seed', new_seed, 'format', 'doubles', 'difficulty', room.difficulty, 'controllers', controllers)
  where id = room.id;
  insert into public.love_smash_matches (user_id, difficulty, seed, room_id, mode)
  select m.user_id, case when room.mode = 'couple_ai' then room.difficulty end, new_seed, room.id, room.mode
  from public.love_smash_room_members m where m.room_id = room.id and m.status = 'joined';
  return public.love_smash_room_json(room.id);
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
      coalesce((stats ->> 'perfectHits')::int, 0), coalesce((stats ->> 'smashes')::int, 0)
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

create or replace function public.abandon_love_smash_room(target_room uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.love_smash_rooms set status = 'abandoned', finished_at = now(), updated_at = now()
  where id = target_room and status in ('lobby', 'playing') and public.love_smash_member_of(target_room, false);
end;
$$;

create or replace function public.get_love_smash_room(target_room uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.love_smash_member_of(target_room) and not exists (
    select 1 from public.love_smash_room_members where room_id = target_room and user_id = auth.uid()
  ) then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;
  return public.love_smash_room_json(target_room);
end;
$$;

create or replace function public.can_join_love_smash_topic(topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  rid uuid;
begin
  if auth.uid() is null or topic !~ '^love-smash:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(:up)?$' then
    return false;
  end if;
  rid := substring(topic from 12 for 36)::uuid;
  return exists (
    select 1 from public.love_smash_room_members m join public.love_smash_rooms r on r.id = m.room_id
    where m.room_id = rid and m.user_id = auth.uid() and m.status = 'joined' and r.status in ('lobby', 'playing', 'finished')
  );
end;
$$;

create policy "love smash players join their room channel" on realtime.messages for select to authenticated
  using (public.can_join_love_smash_topic(realtime.topic()));
create policy "love smash players send on their room channel" on realtime.messages for insert to authenticated
  with check (public.can_join_love_smash_topic(realtime.topic()));

revoke execute on function
  public.love_smash_room_json(uuid),
  public.finish_love_smash_room(uuid, int, int[], int, int, jsonb)
from anon, public, authenticated;
grant execute on function public.finish_love_smash_room(uuid, int, int[], int, int, jsonb) to service_role;
revoke execute on function
  public.create_love_smash_room(text, text, boolean),
  public.join_love_smash_room(text, uuid),
  public.respond_love_smash_room(uuid, boolean),
  public.leave_love_smash_room(uuid),
  public.set_love_smash_ready(uuid, boolean),
  public.switch_love_smash_team(uuid),
  public.set_love_smash_room_difficulty(uuid, text),
  public.start_love_smash_room(uuid),
  public.abandon_love_smash_room(uuid),
  public.get_love_smash_room(uuid)
from anon, public;
grant execute on function
  public.create_love_smash_room(text, text, boolean),
  public.join_love_smash_room(text, uuid),
  public.respond_love_smash_room(uuid, boolean),
  public.leave_love_smash_room(uuid),
  public.set_love_smash_ready(uuid, boolean),
  public.switch_love_smash_team(uuid),
  public.set_love_smash_room_difficulty(uuid, text),
  public.start_love_smash_room(uuid),
  public.abandon_love_smash_room(uuid),
  public.get_love_smash_room(uuid)
to authenticated;
