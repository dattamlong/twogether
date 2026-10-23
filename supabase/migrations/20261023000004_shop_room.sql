create table public.shop_items (
  id text primary key,
  name text not null,
  name_vi text not null,
  description text not null,
  category text not null check (category in ('furniture', 'plants', 'decorations', 'clothing', 'accessories', 'animations', 'gifts')),
  price int not null check (price >= 0),
  asset_key text not null,
  footprint_w int not null default 0,
  footprint_h int not null default 0,
  min_home_level int not null default 1,
  shop_visible boolean not null default true
);

create table public.inventories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  couple_id uuid references public.couples (id) on delete set null,
  item_id text not null references public.shop_items (id),
  source text not null default 'purchase' check (source in ('purchase', 'achievement', 'gift')),
  acquired_at timestamptz not null default now()
);
create index inventories_user_idx on public.inventories (user_id);
create index inventories_couple_idx on public.inventories (couple_id);

create table public.room_reserved_tiles (
  x int not null,
  y int not null,
  primary key (x, y)
);

create table public.room_dimensions (
  id boolean primary key default true check (id),
  width int not null,
  depth int not null
);

create table public.furniture_placements (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  inventory_id uuid not null unique references public.inventories (id) on delete cascade,
  x int not null,
  y int not null,
  flipped boolean not null default false,
  placed_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index furniture_placements_couple_idx on public.furniture_placements (couple_id);

create or replace function public.purchase_item(item text, request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  cid uuid := public.my_couple_id();
  def public.shop_items;
  award jsonb;
  inventory_id uuid;
begin
  select * into def from public.shop_items where id = item;
  if def.id is null or not def.shop_visible then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  if def.category = 'gifts' then
    raise exception 'use_send_gift' using errcode = 'P0001';
  end if;
  if def.category in ('clothing', 'accessories', 'animations')
     and exists (select 1 from public.inventories where user_id = uid and item_id = item) then
    raise exception 'already_owned' using errcode = 'P0001';
  end if;
  if def.category in ('furniture', 'plants', 'decorations') then
    if cid is null then
      raise exception 'not_paired' using errcode = 'P0001';
    end if;
    if (select home_level from public.couple_progress where couple_id = cid) < def.min_home_level then
      raise exception 'home_level_too_low' using errcode = 'P0001';
    end if;
  end if;

  award := public.grant_reward(uid, 0, -def.price, 'purchase', request_id::text);
  insert into public.inventories (user_id, couple_id, item_id, source)
  values (uid, case when def.footprint_w > 0 then cid end, item, 'purchase')
  returning id into inventory_id;

  perform public.unlock_user_achievement(uid, 'first_purchase');
  return award || jsonb_build_object('inventoryId', inventory_id, 'item', item);
end;
$$;

create or replace function public.save_room_layout(layout jsonb)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  cid uuid := public.require_couple();
  dims public.room_dimensions;
  entry jsonb;
  inv record;
  px int;
  py int;
  occupied text[] := array(select x || ',' || y from public.room_reserved_tiles);
  tile text;
  kept uuid[] := '{}';
begin
  if jsonb_typeof(layout) <> 'array' or jsonb_array_length(layout) > 60 then
    raise exception 'invalid_layout' using errcode = '22023';
  end if;

  select * into dims from public.room_dimensions;
  perform 1 from public.couple_progress where couple_id = cid for update;

  for entry in select * from jsonb_array_elements(layout) loop
    select i.id, s.footprint_w, s.footprint_h into inv
    from public.inventories i
    join public.shop_items s on s.id = i.item_id
    where i.id = (entry->>'inventoryId')::uuid and i.couple_id = cid and s.footprint_w > 0;
    if inv.id is null then
      raise exception 'item_not_placeable' using errcode = 'P0001';
    end if;
    if inv.id = any (kept) then
      raise exception 'duplicate_item' using errcode = 'P0001';
    end if;

    px := (entry->>'x')::int;
    py := (entry->>'y')::int;
    if px < 0 or py < 0 or px + inv.footprint_w > dims.width or py + inv.footprint_h > dims.depth then
      raise exception 'out_of_bounds' using errcode = 'P0001';
    end if;

    for dx in 0..inv.footprint_w - 1 loop
      for dy in 0..inv.footprint_h - 1 loop
        tile := (px + dx) || ',' || (py + dy);
        if tile = any (occupied) then
          raise exception 'tile_occupied' using errcode = 'P0001', detail = tile;
        end if;
        occupied := occupied || tile;
      end loop;
    end loop;

    insert into public.furniture_placements (couple_id, inventory_id, x, y, flipped, placed_by)
    values (cid, inv.id, px, py, coalesce((entry->>'flipped')::boolean, false), uid)
    on conflict (inventory_id) do update
      set x = excluded.x, y = excluded.y, flipped = excluded.flipped, placed_by = uid, updated_at = now();
    kept := kept || inv.id;
  end loop;

  delete from public.furniture_placements where couple_id = cid and not (inventory_id = any (kept));
  return array_length(kept, 1);
end;
$$;

alter table public.shop_items enable row level security;
alter table public.inventories enable row level security;
alter table public.room_reserved_tiles enable row level security;
alter table public.room_dimensions enable row level security;
alter table public.furniture_placements enable row level security;

create policy "catalog" on public.shop_items for select to authenticated using (true);
create policy "catalog" on public.room_reserved_tiles for select to authenticated using (true);
create policy "catalog" on public.room_dimensions for select to authenticated using (true);
create policy "own or couple inventory" on public.inventories for select to authenticated
  using (user_id = auth.uid() or user_id = public.my_partner_id() or public.is_couple_member(couple_id));
create policy "couple placements" on public.furniture_placements for select to authenticated
  using (public.is_couple_member(couple_id));

revoke all on public.shop_items, public.inventories, public.room_reserved_tiles, public.room_dimensions,
  public.furniture_placements from anon, authenticated;
grant select on public.shop_items, public.inventories, public.room_reserved_tiles, public.room_dimensions,
  public.furniture_placements to authenticated;
