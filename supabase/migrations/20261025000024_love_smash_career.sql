create table public.love_smash_careers (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('solo', 'solo_doubles', 'couple')),
  owner_id uuid not null references auth.users (id) on delete cascade,
  couple_id uuid references public.couples (id) on delete cascade,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'couple') = (couple_id is not null))
);
create unique index love_smash_careers_owner_idx on public.love_smash_careers (owner_id, kind) where kind in ('solo', 'solo_doubles');
create unique index love_smash_careers_couple_idx on public.love_smash_careers (couple_id) where kind = 'couple';

alter table public.love_smash_careers enable row level security;
create policy "players read their careers" on public.love_smash_careers for select to authenticated
  using (owner_id = auth.uid() or (couple_id is not null and public.is_couple_member(couple_id)));
revoke all on public.love_smash_careers from anon, authenticated;
grant select on public.love_smash_careers to authenticated;

alter table public.love_smash_matches drop constraint love_smash_matches_mode_check;
alter table public.love_smash_matches add constraint love_smash_matches_mode_check check (mode in ('solo', 'couple_ai', 'versus', 'career'));
alter table public.love_smash_matches add column config jsonb;
alter table public.love_smash_matches add column career_id uuid references public.love_smash_careers (id) on delete set null;
alter table public.love_smash_rooms add column career_id uuid references public.love_smash_careers (id) on delete set null;

insert into public.shop_items (id, name, name_vi, description, category, price, asset_key, footprint_w, footprint_h, min_home_level, shop_visible) values
  ('career_trophy_1', 'Sakura Rookie Cup', 'Cúp Tân Binh Hoa Anh Đào', 'Champions of the Sakura Rookie Cup in Road to Legend.', 'decorations', 0, 'career_trophy_1', 1, 1, 1, false),
  ('career_trophy_2', 'Academy Trophy', 'Cúp Học Viện', 'Champions of the Academy Championship in Road to Legend.', 'decorations', 0, 'career_trophy_2', 1, 1, 1, false),
  ('career_trophy_3', 'City Open Trophy', 'Cúp Thành Phố', 'Champions of the City Open in Road to Legend.', 'decorations', 0, 'career_trophy_3', 1, 1, 1, false),
  ('career_trophy_4', 'National Champions Trophy', 'Cúp Vô Địch Quốc Gia', 'National Champions in Road to Legend.', 'decorations', 0, 'career_trophy_4', 1, 1, 1, false),
  ('career_trophy_5', 'Asia Masters Trophy', 'Cúp Asia Masters', 'Champions of the Asia Masters in Road to Legend.', 'decorations', 0, 'career_trophy_5', 1, 1, 1, false),
  ('career_trophy_6', 'World Grand Prix Trophy', 'Cúp World Grand Prix', 'World Grand Prix champions in Road to Legend.', 'decorations', 0, 'career_trophy_6', 1, 1, 1, false),
  ('career_trophy_7', 'Legends Championship Trophy', 'Cúp Huyền Thoại', 'Legendary Champions of Road to Legend.', 'decorations', 0, 'career_trophy_7', 1, 1, 1, false)
on conflict (id) do nothing;

create or replace function public.grant_career_trophy(player uuid, cid uuid, trophy text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if trophy is null then
    return;
  end if;
  if exists (
    select 1 from public.inventories
    where item_id = trophy and (user_id = player or (cid is not null and couple_id = cid))
  ) then
    return;
  end if;
  insert into public.inventories (user_id, couple_id, item_id, source) values (player, cid, trophy, 'achievement');
end;
$$;

create or replace function public.finish_love_smash_career(
  match_id uuid,
  player uuid,
  player_won boolean,
  final_player_score int,
  final_bot_score int,
  match_ticks int,
  rally_record int,
  perfect_count int,
  smash_count int,
  drop_count int,
  target_career uuid,
  expected_version int,
  new_state jsonb,
  trophy text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  career public.love_smash_careers;
  reward jsonb;
begin
  select * into career from public.love_smash_careers where id = target_career for update;
  if career.id is null or career.owner_id <> player then
    raise exception 'career_not_found' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.love_smash_matches where id = match_id and career_id = career.id) then
    raise exception 'invalid_match' using errcode = 'P0001';
  end if;
  if (career.state ->> 'version')::int <> expected_version then
    raise exception 'career_conflict' using errcode = 'P0001';
  end if;
  reward := public.finish_love_smash(match_id, player, player_won, final_player_score, final_bot_score, match_ticks, rally_record, perfect_count, smash_count, drop_count);
  update public.love_smash_careers set state = new_state, updated_at = now() where id = career.id;
  perform public.grant_career_trophy(player, (select couple_id from public.couple_members where user_id = player), trophy);
  return jsonb_build_object('reward', reward, 'state', new_state);
end;
$$;

create or replace function public.finish_love_smash_room_career(
  target_room uuid, winner_team int, final_scores int[], match_ticks int, rally_record int, player_stats jsonb,
  expected_version int, new_state jsonb, trophy text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  room public.love_smash_rooms;
  career public.love_smash_careers;
  result jsonb;
begin
  select * into room from public.love_smash_rooms where id = target_room for update;
  if room.id is null or room.career_id is null then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;
  select * into career from public.love_smash_careers where id = room.career_id for update;
  if (career.state ->> 'version')::int <> expected_version then
    raise exception 'career_conflict' using errcode = 'P0001';
  end if;
  result := public.finish_love_smash_room(target_room, winner_team, final_scores, match_ticks, rally_record, player_stats);
  update public.love_smash_careers set state = new_state, updated_at = now() where id = career.id;
  perform public.grant_career_trophy(career.owner_id, career.couple_id, trophy);
  return result || jsonb_build_object('career', new_state);
end;
$$;

revoke execute on function
  public.grant_career_trophy(uuid, uuid, text),
  public.finish_love_smash_career(uuid, uuid, boolean, int, int, int, int, int, int, int, uuid, int, jsonb, text),
  public.finish_love_smash_room_career(uuid, int, int[], int, int, jsonb, int, jsonb, text)
from anon, public, authenticated;
grant execute on function
  public.finish_love_smash_career(uuid, uuid, boolean, int, int, int, int, int, int, int, uuid, int, jsonb, text),
  public.finish_love_smash_room_career(uuid, int, int[], int, int, jsonb, int, jsonb, text)
to service_role;
