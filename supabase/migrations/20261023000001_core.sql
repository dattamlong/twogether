create extension if not exists pgcrypto with schema extensions;

create type public.cefr_level as enum ('A1', 'A2', 'B1', 'B2', 'C1');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  english_level public.cefr_level not null default 'A1',
  timezone text not null default 'Asia/Ho_Chi_Minh',
  avatar jsonb not null default '{"hair":"bob","hairColor":"#5b4256","skin":"#ffe3d3","outfit":"tee","outfitColor":"#f8bbd0","accessory":"none","eyes":"#45365b"}'::jsonb,
  equipped_emotes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Little Home' check (char_length(name) between 1 and 40),
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_by uuid references auth.users (id) on delete set null,
  anniversary date,
  created_at timestamptz not null default now(),
  dissolved_at timestamptz
);

create table public.couple_members (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  slot smallint not null check (slot in (0, 1)),
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (couple_id, slot),
  unique (user_id)
);

create table public.couple_invitations (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '72 hours',
  revoked_at timestamptz,
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);
create index couple_invitations_couple_idx on public.couple_invitations (couple_id);

create or replace function public.my_couple_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.couple_id
  from public.couple_members m
  join public.couples c on c.id = m.couple_id and c.dissolved_at is null
  where m.user_id = auth.uid()
$$;

create or replace function public.my_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.user_id
  from public.couple_members m
  where m.couple_id = public.my_couple_id() and m.user_id <> auth.uid()
$$;

create or replace function public.is_couple_member(target_couple uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select target_couple is not null and target_couple = public.my_couple_id()
$$;

create or replace function public.require_user()
returns uuid
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return auth.uid();
end;
$$;

create or replace function public.require_couple()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  cid uuid := public.my_couple_id();
begin
  perform public.require_user();
  if cid is null then
    raise exception 'not_paired' using errcode = 'P0001';
  end if;
  return cid;
end;
$$;

create or replace function public.user_local_date(target_user uuid)
returns date
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (now() at time zone coalesce((select timezone from public.profiles where id = target_user), 'Asia/Ho_Chi_Minh'))::date
$$;

create or replace function public.couple_local_date(target_couple uuid)
returns date
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (now() at time zone coalesce((select timezone from public.couples where id = target_couple), 'Asia/Ho_Chi_Minh'))::date
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.validate_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;
  if jsonb_typeof(new.avatar) <> 'object' or pg_column_size(new.avatar) > 2048
     or coalesce(new.avatar->>'hair', '') not in ('bob', 'long', 'spiky', 'twintails', 'bun', 'short')
     or coalesce(new.avatar->>'hairColor', '') !~ '^#[0-9a-fA-F]{6}$'
     or coalesce(new.avatar->>'skin', '') !~ '^#[0-9a-fA-F]{6}$'
     or coalesce(new.avatar->>'eyes', '') !~ '^#[0-9a-fA-F]{6}$'
     or coalesce(new.avatar->>'outfitColor', '') !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'invalid_avatar' using errcode = '22023';
  end if;

  if coalesce(new.avatar->>'outfit', '') not in ('tee', 'overalls')
     and not exists (
       select 1 from public.inventories i
       join public.shop_items s on s.id = i.item_id
       where i.user_id = new.id and i.item_id = new.avatar->>'outfit' and s.category = 'clothing'
     ) then
    raise exception 'item_not_owned' using errcode = 'P0001';
  end if;

  if coalesce(new.avatar->>'accessory', '') <> 'none'
     and not exists (
       select 1 from public.inventories i
       join public.shop_items s on s.id = i.item_id
       where i.user_id = new.id and i.item_id = new.avatar->>'accessory' and s.category = 'accessories'
     ) then
    raise exception 'item_not_owned' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from unnest(new.equipped_emotes) as emote
    where not exists (
      select 1 from public.inventories i
      join public.shop_items s on s.id = i.item_id
      where i.user_id = new.id and i.item_id = emote and s.category = 'animations'
    )
  ) then
    raise exception 'item_not_owned' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger profiles_validate before insert or update on public.profiles
  for each row execute function public.validate_profile();

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = public, extensions, pg_temp
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  result text := '';
begin
  for i in 0..7 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.create_invitation()
returns public.couple_invitations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  cid uuid := public.my_couple_id();
  member_count int;
  invitation public.couple_invitations;
begin
  if cid is null then
    insert into public.couples (created_by, timezone)
    values (uid, coalesce((select timezone from public.profiles where id = uid), 'Asia/Ho_Chi_Minh'))
    returning id into cid;
    insert into public.couple_members (couple_id, user_id, slot) values (cid, uid, 0);
    insert into public.couple_progress (couple_id) values (cid);
    insert into public.streaks (subject_type, subject_id) values ('couple', cid);
  end if;

  select count(*) into member_count from public.couple_members where couple_id = cid;
  if member_count >= 2 then
    raise exception 'couple_full' using errcode = 'P0001';
  end if;

  update public.couple_invitations
  set revoked_at = now()
  where couple_id = cid and used_at is null and revoked_at is null;

  insert into public.couple_invitations (couple_id, code, created_by)
  values (cid, public.generate_invite_code(), uid)
  returning * into invitation;
  return invitation;
end;
$$;

create or replace function public.revoke_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.couple_invitations
  set revoked_at = now()
  where id = invitation_id
    and couple_id = public.require_couple()
    and used_at is null
    and revoked_at is null;
  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.accept_invitation(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  invitation public.couple_invitations;
  member_count int;
begin
  if public.my_couple_id() is not null then
    raise exception 'already_paired' using errcode = 'P0001';
  end if;

  select * into invitation
  from public.couple_invitations
  where code = upper(trim(invite_code))
  for update;

  if invitation.id is null or invitation.revoked_at is not null or invitation.used_at is not null
     or invitation.expires_at <= now() then
    raise exception 'invalid_invitation' using errcode = 'P0001';
  end if;
  if invitation.created_by = uid then
    raise exception 'cannot_join_own_invitation' using errcode = 'P0001';
  end if;

  perform 1 from public.couples where id = invitation.couple_id and dissolved_at is null for update;
  if not found then
    raise exception 'invalid_invitation' using errcode = 'P0001';
  end if;

  select count(*) into member_count from public.couple_members where couple_id = invitation.couple_id;
  if member_count <> 1 then
    raise exception 'couple_full' using errcode = 'P0001';
  end if;

  insert into public.couple_members (couple_id, user_id, slot) values (invitation.couple_id, uid, 1);
  update public.couple_invitations set used_by = uid, used_at = now() where id = invitation.id;

  insert into public.memories (couple_id, kind, title, body)
  values (invitation.couple_id, 'milestone', 'Our little home opened', 'The day we started our adventure together.');

  return invitation.couple_id;
end;
$$;

create or replace function public.leave_couple()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cid uuid := public.require_couple();
begin
  update public.couples set dissolved_at = now() where id = cid;
  update public.couple_invitations set revoked_at = now() where couple_id = cid and used_at is null and revoked_at is null;
  delete from public.couple_members where couple_id = cid;
end;
$$;

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_invitations enable row level security;

create policy "read own or partner profile" on public.profiles
  for select to authenticated
  using (id = auth.uid() or id = public.my_partner_id());

create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "read own couple" on public.couples
  for select to authenticated
  using (public.is_couple_member(id));

create policy "rename own couple" on public.couples
  for update to authenticated
  using (public.is_couple_member(id))
  with check (public.is_couple_member(id));

create policy "read own couple members" on public.couple_members
  for select to authenticated
  using (public.is_couple_member(couple_id));

create policy "read own couple invitations" on public.couple_invitations
  for select to authenticated
  using (public.is_couple_member(couple_id));

revoke all on public.profiles, public.couples, public.couple_members, public.couple_invitations from anon, authenticated;
grant select on public.profiles, public.couples, public.couple_members, public.couple_invitations to authenticated;
grant update (display_name, english_level, timezone, avatar, equipped_emotes) on public.profiles to authenticated;
grant update (name, timezone, anniversary) on public.couples to authenticated;
