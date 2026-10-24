alter type public.game_kind add value if not exists 'word_duel';
alter type public.answer_source add value if not exists 'word_duel';

create table public.social_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index social_blocks_blocked_idx on public.social_blocks (blocked_id);

create table public.world_chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('world', 'english_cafe')),
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  client_id uuid not null,
  created_at timestamptz not null default now(),
  hidden_at timestamptz,
  unique (user_id, client_id)
);
create index world_chat_messages_feed_idx on public.world_chat_messages (channel, created_at desc, id desc);
create index world_chat_messages_user_idx on public.world_chat_messages (user_id, created_at desc);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index friendships_pair_idx on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id, status);

create table public.home_visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references auth.users (id) on delete cascade,
  host_couple_id uuid not null references public.couples (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index home_visits_visitor_idx on public.home_visits (visitor_id, host_couple_id, created_at desc);
create index home_visits_host_idx on public.home_visits (host_couple_id, created_at desc);

create table public.home_guestbook_messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now(),
  hidden_at timestamptz
);
create index home_guestbook_couple_idx on public.home_guestbook_messages (couple_id, created_at desc, id desc);
create index home_guestbook_author_idx on public.home_guestbook_messages (author_id, created_at desc);

create table public.social_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid references public.world_chat_messages (id) on delete cascade,
  guestbook_id uuid references public.home_guestbook_messages (id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  details text check (char_length(details) <= 300),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  check (reporter_id <> target_user_id),
  check (num_nonnulls(message_id, guestbook_id) <= 1)
);
create unique index social_reports_message_idx on public.social_reports (reporter_id, message_id) where message_id is not null;
create unique index social_reports_guestbook_idx on public.social_reports (reporter_id, guestbook_id) where guestbook_id is not null;
create index social_reports_target_idx on public.social_reports (target_user_id, created_at desc);

create table public.game_invitations (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  game text not null check (game in ('word_duel')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  language text not null check (language in ('en', 'zh')),
  question_ids text[],
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  responded_at timestamptz,
  check (from_user <> to_user)
);
create index game_invitations_to_idx on public.game_invitations (to_user, created_at desc);
create index game_invitations_from_idx on public.game_invitations (from_user, created_at desc);

alter table public.game_sessions add column invitation_id uuid references public.game_invitations (id) on delete cascade;
create unique index game_sessions_invitation_user_idx on public.game_sessions (invitation_id, user_id) where invitation_id is not null;

create or replace function public.blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.social_blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

create or replace function public.blocked_with_couple(uid uuid, cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.couple_members m
    where m.couple_id = cid and public.blocked_between(uid, m.user_id)
  )
$$;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(a, b)
      and greatest(requester_id, addressee_id) = greatest(a, b)
  )
$$;

create or replace function public.player_card(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.display_name,
    'avatar', p.avatar,
    'level', coalesce(up.level, 1),
    'coupleId', c.id,
    'coupleName', c.name,
    'partnerName', (
      select p2.display_name from public.couple_members m2 join public.profiles p2 on p2.id = m2.user_id
      where m2.couple_id = c.id and m2.user_id <> p.id
    ),
    'tier', case when c.id is null then null else coalesce(t.tier, 1) end
  )
  from public.profiles p
  left join public.user_progress up on up.user_id = p.id
  left join public.couple_members m on m.user_id = p.id
  left join public.couples c on c.id = m.couple_id and c.dissolved_at is null
  left join public.couple_rank_tiers t on t.couple_id = c.id
  where p.id = uid
$$;

create or replace function public.get_player_cards(ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(public.player_card(x.id)), '[]'::jsonb)
  from (select distinct unnest(ids[1:100]) as id) x
  where auth.uid() is not null and exists (select 1 from public.profiles where id = x.id)
$$;

create or replace function public.message_json(msg public.world_chat_messages)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', msg.id, 'channel', msg.channel, 'userId', msg.user_id, 'body', msg.body,
    'clientId', msg.client_id, 'createdAt', msg.created_at, 'author', public.player_card(msg.user_id)
  )
$$;

create or replace function public.get_world_messages(channel text, before_id uuid default null, max_rows int default 40)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  cursor_row public.world_chat_messages;
  lim int := least(greatest(coalesce(max_rows, 40), 1), 100);
begin
  if before_id is not null then
    select * into cursor_row from public.world_chat_messages where id = before_id;
  end if;
  return (
    select coalesce(jsonb_agg(public.message_json(m) order by m.created_at, m.id), '[]'::jsonb)
    from (
      select * from public.world_chat_messages w
      where w.channel = get_world_messages.channel
        and w.hidden_at is null
        and not public.blocked_between(uid, w.user_id)
        and (cursor_row.id is null or (w.created_at, w.id) < (cursor_row.created_at, cursor_row.id))
      order by w.created_at desc, w.id desc
      limit lim
    ) m
  );
end;
$$;

create or replace function public.send_world_message(channel text, body text, client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  clean text := btrim(coalesce(body, ''));
  existing public.world_chat_messages;
  inserted public.world_chat_messages;
begin
  if channel not in ('world', 'english_cafe') then
    raise exception 'invalid_channel' using errcode = 'P0001';
  end if;
  if client_id is null then
    raise exception 'invalid_message' using errcode = 'P0001';
  end if;
  select * into existing from public.world_chat_messages w where w.user_id = uid and w.client_id = send_world_message.client_id;
  if existing.id is not null then
    return public.message_json(existing);
  end if;
  if char_length(clean) = 0 then
    raise exception 'empty_message' using errcode = 'P0001';
  end if;
  if char_length(clean) > 500 then
    raise exception 'message_too_long' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('world_chat:' || uid::text));
  if (select count(*) from public.world_chat_messages w where w.user_id = uid and w.created_at > now() - interval '10 seconds') >= 5
     or (select count(*) from public.world_chat_messages w where w.user_id = uid and w.created_at > now() - interval '1 minute') >= 20 then
    raise exception 'slow_down' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.world_chat_messages w
    where w.user_id = uid and w.channel = send_world_message.channel and lower(w.body) = lower(clean) and w.created_at > now() - interval '30 seconds'
  ) then
    raise exception 'duplicate_message' using errcode = 'P0001';
  end if;

  insert into public.world_chat_messages (channel, user_id, body, client_id)
  values (send_world_message.channel, uid, clean, send_world_message.client_id)
  returning * into inserted;
  return public.message_json(inserted);
end;
$$;

create or replace function public.delete_world_message(message uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
begin
  update public.world_chat_messages set hidden_at = now() where id = message and user_id = uid and hidden_at is null;
  if not found then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.block_player(target uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
begin
  if target is null or target = uid or not exists (select 1 from public.profiles where id = target) then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  insert into public.social_blocks (blocker_id, blocked_id) values (uid, target) on conflict do nothing;
  delete from public.friendships
  where least(requester_id, addressee_id) = least(uid, target) and greatest(requester_id, addressee_id) = greatest(uid, target);
  update public.game_invitations set status = 'cancelled', responded_at = now()
  where status = 'pending' and ((from_user = uid and to_user = target) or (from_user = target and to_user = uid));
end;
$$;

create or replace function public.unblock_player(target uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.social_blocks where blocker_id = public.require_user() and blocked_id = target
$$;

create or replace function public.get_blocked_players()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(public.player_card(b.blocked_id) order by b.created_at desc), '[]'::jsonb)
  from public.social_blocks b where b.blocker_id = public.require_user()
$$;

create or replace function public.report_player(target uuid, reason text, message uuid default null, guestbook uuid default null, details text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  reporters int := 0;
  hidden boolean := false;
begin
  if target is null or target = uid or not exists (select 1 from public.profiles where id = target) then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if reason not in ('spam', 'harassment', 'inappropriate', 'other') then
    raise exception 'invalid_reason' using errcode = 'P0001';
  end if;
  if message is not null and not exists (select 1 from public.world_chat_messages where id = message and user_id = target) then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if guestbook is not null and not exists (select 1 from public.home_guestbook_messages where id = guestbook and author_id = target) then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if (select count(*) from public.social_reports where reporter_id = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'slow_down' using errcode = 'P0001';
  end if;

  insert into public.social_reports (reporter_id, target_user_id, message_id, guestbook_id, reason, details)
  values (uid, target, message, guestbook, reason, nullif(btrim(coalesce(details, '')), ''))
  on conflict do nothing;

  if message is not null then
    select count(distinct reporter_id) into reporters from public.social_reports where message_id = message;
    if reporters >= 3 then
      update public.world_chat_messages set hidden_at = coalesce(hidden_at, now()) where id = message;
      update public.social_reports set status = 'actioned' where message_id = message and status = 'open';
      hidden := true;
    end if;
  elsif guestbook is not null then
    select count(distinct reporter_id) into reporters from public.social_reports where guestbook_id = guestbook;
    if reporters >= 3 then
      update public.home_guestbook_messages set hidden_at = coalesce(hidden_at, now()) where id = guestbook;
      update public.social_reports set status = 'actioned' where guestbook_id = guestbook and status = 'open';
      hidden := true;
    end if;
  end if;
  return jsonb_build_object('reported', true, 'hidden', hidden);
end;
$$;

create or replace function public.friendship_status(uid uuid, target uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select case
      when f.status = 'accepted' then 'friends'
      when f.requester_id = uid then 'outgoing'
      else 'incoming'
    end
    from public.friendships f
    where least(f.requester_id, f.addressee_id) = least(uid, target) and greatest(f.requester_id, f.addressee_id) = greatest(uid, target)
  ), 'none')
$$;

create or replace function public.get_player_profile(target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  card jsonb := public.player_card(target);
begin
  if card is null then
    raise exception 'player_not_found' using errcode = 'P0001';
  end if;
  return card || jsonb_build_object(
    'isSelf', target = uid,
    'friendship', public.friendship_status(uid, target),
    'blockedByMe', exists (select 1 from public.social_blocks where blocker_id = uid and blocked_id = target),
    'canInteract', target <> uid and not public.blocked_between(uid, target),
    'lessonsCompleted', coalesce((select lessons_completed from public.user_progress where user_id = target), 0),
    'unitsCleared', (select count(*) from public.unit_progress where user_id = target and boss_cleared_at is not null),
    'streak', coalesce((select current from public.streaks where subject_type = 'user' and subject_id = target), 0),
    'learning', (
      select jsonb_build_object('language', learning_language, 'english', english_level, 'chinese', 'HSK' || chinese_level)
      from public.profiles where id = target
    ),
    'achievements', (
      select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'title_vi', a.title_vi, 'icon', a.icon) order by ua.unlocked_at desc), '[]'::jsonb)
      from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id
      where ua.user_id = target and a.id <> 'first_purchase'
    )
  );
end;
$$;

create or replace function public.couple_card(cid uuid, viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'coupleId', c.id,
    'name', c.name,
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'avatar', p.avatar) order by m.slot), '[]'::jsonb)
      from public.couple_members m join public.profiles p on p.id = m.user_id where m.couple_id = c.id
    ),
    'level', coalesce(cp.level, 1),
    'homeLevel', coalesce(cp.home_level, 1),
    'tier', coalesce(t.tier, 1),
    'legendPoints', coalesce(t.legend_points, 0),
    'weeklyScore', coalesce((select score from public.leaderboard_scores s where s.couple_id = c.id and s.week_start = public.legend_week_start()), 0),
    'lastActive', (select max(day) from public.couple_activity_days d where d.couple_id = c.id),
    'items', (
      select coalesce(jsonb_agg(i.item_id order by fp.updated_at desc), '[]'::jsonb)
      from (select * from public.furniture_placements where couple_id = c.id order by updated_at desc limit 6) fp
      join public.inventories i on i.id = fp.inventory_id
    ),
    'itemCount', (select count(*) from public.furniture_placements where couple_id = c.id),
    'isFriend', exists (
      select 1 from public.couple_members m where m.couple_id = c.id and public.are_friends(viewer, m.user_id)
    ),
    'isOwn', exists (select 1 from public.couple_members m where m.couple_id = c.id and m.user_id = viewer)
  )
  from public.couples c
  left join public.couple_progress cp on cp.couple_id = c.id
  left join public.couple_rank_tiers t on t.couple_id = c.id
  where c.id = cid
$$;

create or replace function public.get_discover_couples(sort text default 'recent', page int default 0, page_size int default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  lim int := least(greatest(coalesce(page_size, 12), 1), 30);
  off int := greatest(coalesce(page, 0), 0) * lim;
  rows jsonb;
  total int;
begin
  if sort not in ('recent', 'level', 'legends', 'friends') then
    raise exception 'invalid_sort' using errcode = 'P0001';
  end if;

  with candidates as (
    select c.id,
      (select max(day) from public.couple_activity_days d where d.couple_id = c.id) as last_active,
      coalesce(cp.level, 1) as lvl, coalesce(cp.xp, 0) as xp,
      coalesce(t.legend_points, 0) as points, c.created_at
    from public.couples c
    left join public.couple_progress cp on cp.couple_id = c.id
    left join public.couple_rank_tiers t on t.couple_id = c.id
    where c.dissolved_at is null
      and exists (select 1 from public.couple_members m where m.couple_id = c.id)
      and not exists (select 1 from public.couple_members m where m.couple_id = c.id and m.user_id = uid)
      and not public.blocked_with_couple(uid, c.id)
      and (sort <> 'friends' or exists (select 1 from public.couple_members m where m.couple_id = c.id and public.are_friends(uid, m.user_id)))
  )
  select
    (select count(*) from candidates),
    (select coalesce(jsonb_agg(public.couple_card(x.id, uid) order by x.ord), '[]'::jsonb) from (
      select id, row_number() over (
        order by
          case when sort = 'recent' then last_active end desc nulls last,
          case when sort = 'level' then lvl end desc,
          case when sort = 'level' then xp end desc,
          case when sort = 'legends' then points end desc,
          created_at desc, id
      ) as ord
      from candidates
      order by ord
      offset off limit lim
    ) x)
  into total, rows;

  return jsonb_build_object('items', rows, 'total', total, 'hasMore', off + lim < total);
end;
$$;

create or replace function public.get_couple_world_profile(target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  card jsonb;
begin
  if not exists (select 1 from public.couples where id = target and dissolved_at is null) then
    raise exception 'couple_not_found' using errcode = 'P0001';
  end if;
  card := public.couple_card(target, uid);
  return card || jsonb_build_object(
    'canVisit', not public.blocked_with_couple(uid, target),
    'bestRank', (select best_weekly_rank from public.couple_rank_tiers where couple_id = target),
    'achievements', (
      select coalesce(jsonb_agg(distinct jsonb_build_object('id', a.id, 'title', a.title, 'title_vi', a.title_vi, 'icon', a.icon)), '[]'::jsonb)
      from public.user_achievements ua
      join public.achievements a on a.id = ua.achievement_id
      join public.couple_members m on m.user_id = ua.user_id and m.couple_id = target
      where a.id <> 'first_purchase'
    ),
    'guestbookCount', (
      select count(*) from public.home_guestbook_messages g
      where g.couple_id = target and g.hidden_at is null and not public.blocked_between(uid, g.author_id)
    )
  );
end;
$$;

create or replace function public.start_home_visit(target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  own boolean;
  distinct_homes int;
begin
  if not exists (select 1 from public.couples where id = target and dissolved_at is null) then
    raise exception 'couple_not_found' using errcode = 'P0001';
  end if;
  if public.blocked_with_couple(uid, target) then
    raise exception 'cannot_interact' using errcode = 'P0001';
  end if;
  own := exists (select 1 from public.couple_members where couple_id = target and user_id = uid);

  if not own then
    if not exists (
      select 1 from public.home_visits where visitor_id = uid and host_couple_id = target and created_at > now() - interval '10 minutes'
    ) then
      insert into public.home_visits (visitor_id, host_couple_id) values (uid, target);
    end if;
    perform public.unlock_user_achievement(uid, 'first_home_visit');
    select count(distinct host_couple_id) into distinct_homes from public.home_visits where visitor_id = uid;
    if distinct_homes >= 5 then
      perform public.unlock_user_achievement(uid, 'community_explorer');
    end if;
  end if;

  return public.couple_card(target, uid) || jsonb_build_object(
    'isOwn', own,
    'placements', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'inventoryId', fp.inventory_id, 'itemId', i.item_id, 'x', fp.x, 'y', fp.y,
        'w', greatest(s.footprint_w, 1), 'h', greatest(s.footprint_h, 1), 'flipped', fp.flipped
      )), '[]'::jsonb)
      from public.furniture_placements fp
      join public.inventories i on i.id = fp.inventory_id
      join public.shop_items s on s.id = i.item_id
      where fp.couple_id = target
    )
  );
end;
$$;

create or replace function public.guestbook_json(g public.home_guestbook_messages)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('id', g.id, 'coupleId', g.couple_id, 'body', g.body, 'createdAt', g.created_at, 'author', public.player_card(g.author_id))
$$;

create or replace function public.get_guestbook(target uuid, before_id uuid default null, max_rows int default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  cursor_row public.home_guestbook_messages;
  lim int := least(greatest(coalesce(max_rows, 20), 1), 50);
begin
  if before_id is not null then
    select * into cursor_row from public.home_guestbook_messages where id = before_id;
  end if;
  return (
    select coalesce(jsonb_agg(public.guestbook_json(g) order by g.created_at desc, g.id desc), '[]'::jsonb)
    from (
      select * from public.home_guestbook_messages h
      where h.couple_id = target
        and h.hidden_at is null
        and not public.blocked_between(uid, h.author_id)
        and (cursor_row.id is null or (h.created_at, h.id) < (cursor_row.created_at, cursor_row.id))
      order by h.created_at desc, h.id desc
      limit lim
    ) g
  );
end;
$$;

create or replace function public.sign_guestbook(target uuid, body text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  clean text := btrim(coalesce(body, ''));
  inserted public.home_guestbook_messages;
begin
  if not exists (select 1 from public.couples where id = target and dissolved_at is null) then
    raise exception 'couple_not_found' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.couple_members where couple_id = target and user_id = uid) then
    raise exception 'own_guestbook' using errcode = 'P0001';
  end if;
  if public.blocked_with_couple(uid, target) then
    raise exception 'cannot_interact' using errcode = 'P0001';
  end if;
  if char_length(clean) = 0 then
    raise exception 'empty_message' using errcode = 'P0001';
  end if;
  if char_length(clean) > 280 then
    raise exception 'message_too_long' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('guestbook:' || uid::text));
  if exists (select 1 from public.home_guestbook_messages where author_id = uid and couple_id = target and created_at > now() - interval '1 minute')
     or (select count(*) from public.home_guestbook_messages where author_id = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'slow_down' using errcode = 'P0001';
  end if;

  insert into public.home_guestbook_messages (couple_id, author_id, body) values (target, uid, clean) returning * into inserted;
  perform public.unlock_user_achievement(uid, 'first_guestbook_message');
  return public.guestbook_json(inserted);
end;
$$;

create or replace function public.delete_guestbook_message(message uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  row_data public.home_guestbook_messages;
begin
  select * into row_data from public.home_guestbook_messages where id = message and hidden_at is null;
  if row_data.id is null or not (row_data.author_id = uid or public.is_couple_member(row_data.couple_id)) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  update public.home_guestbook_messages set hidden_at = now() where id = message;
end;
$$;

create or replace function public.send_friend_request(target uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  existing public.friendships;
begin
  if target is null or target = uid or not exists (select 1 from public.profiles where id = target) then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if public.blocked_between(uid, target) then
    raise exception 'cannot_interact' using errcode = 'P0001';
  end if;
  select * into existing from public.friendships
  where least(requester_id, addressee_id) = least(uid, target) and greatest(requester_id, addressee_id) = greatest(uid, target)
  for update;
  if existing.id is not null then
    if existing.status = 'accepted' then
      return 'friends';
    end if;
    if existing.requester_id = uid then
      return 'outgoing';
    end if;
    update public.friendships set status = 'accepted', responded_at = now() where id = existing.id;
    perform public.unlock_user_achievement(uid, 'first_friend');
    perform public.unlock_user_achievement(target, 'first_friend');
    return 'friends';
  end if;
  if (select count(*) from public.friendships where requester_id = uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'slow_down' using errcode = 'P0001';
  end if;
  insert into public.friendships (requester_id, addressee_id) values (uid, target);
  return 'outgoing';
end;
$$;

create or replace function public.respond_friend_request(request uuid, accept boolean)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  row_data public.friendships;
begin
  select * into row_data from public.friendships where id = request and addressee_id = uid and status = 'pending' for update;
  if row_data.id is null then
    raise exception 'request_not_found' using errcode = 'P0001';
  end if;
  if not accept then
    delete from public.friendships where id = request;
    return 'none';
  end if;
  if public.blocked_between(uid, row_data.requester_id) then
    raise exception 'cannot_interact' using errcode = 'P0001';
  end if;
  update public.friendships set status = 'accepted', responded_at = now() where id = request;
  perform public.unlock_user_achievement(uid, 'first_friend');
  perform public.unlock_user_achievement(row_data.requester_id, 'first_friend');
  return 'friends';
end;
$$;

create or replace function public.remove_friend(target uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.friendships
  where least(requester_id, addressee_id) = least(public.require_user(), target)
    and greatest(requester_id, addressee_id) = greatest(public.require_user(), target)
$$;

create or replace function public.invitation_json(inv public.game_invitations, viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', inv.id,
    'game', inv.game,
    'status', case when inv.status = 'pending' and inv.expires_at < now() then 'expired' else inv.status end,
    'language', inv.language,
    'createdAt', inv.created_at,
    'expiresAt', inv.expires_at,
    'from', public.player_card(inv.from_user),
    'to', public.player_card(inv.to_user),
    'incoming', inv.to_user = viewer,
    'results', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'userId', s.user_id, 'correct', s.correct_count, 'total', array_length(s.question_ids, 1),
        'finished', s.completed_at is not null, 'finishedAt', s.completed_at
      )), '[]'::jsonb)
      from public.game_sessions s where s.invitation_id = inv.id
    )
  )
$$;

create or replace function public.send_game_invitation(target uuid, game text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  lang text;
  inserted public.game_invitations;
begin
  if game <> 'word_duel' then
    raise exception 'game_not_multiplayer' using errcode = 'P0001';
  end if;
  if target is null or target = uid or not exists (select 1 from public.profiles where id = target) then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if public.blocked_between(uid, target) then
    raise exception 'cannot_interact' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.game_invitations
    where status = 'pending' and expires_at > now()
      and ((from_user = uid and to_user = target) or (from_user = target and to_user = uid))
  ) then
    raise exception 'invitation_pending' using errcode = 'P0001';
  end if;
  if (select count(*) from public.game_invitations where from_user = uid and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'slow_down' using errcode = 'P0001';
  end if;
  select learning_language into lang from public.profiles where id = uid;
  insert into public.game_invitations (from_user, to_user, game, language) values (uid, target, game, lang) returning * into inserted;
  return public.invitation_json(inserted, uid);
end;
$$;

create or replace function public.respond_game_invitation(invitation uuid, accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  inv public.game_invitations;
  picked text[];
begin
  select * into inv from public.game_invitations where id = invitation for update;
  if inv.id is null or (inv.to_user <> uid and inv.from_user <> uid) then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;
  if inv.status <> 'pending' or inv.expires_at < now() then
    raise exception 'invitation_closed' using errcode = 'P0001';
  end if;
  if inv.from_user = uid then
    if accept then
      raise exception 'not_allowed' using errcode = 'P0001';
    end if;
    update public.game_invitations set status = 'cancelled', responded_at = now() where id = inv.id returning * into inv;
    return public.invitation_json(inv, uid);
  end if;
  if not accept then
    update public.game_invitations set status = 'declined', responded_at = now() where id = inv.id returning * into inv;
    return public.invitation_json(inv, uid);
  end if;
  if public.blocked_between(inv.from_user, inv.to_user) then
    raise exception 'cannot_interact' using errcode = 'P0001';
  end if;

  select array_agg(id) into picked from (
    select q.id
    from public.lesson_questions q
    join public.lessons l on l.id = q.lesson_id
    where l.language = inv.language
      and l.category_id = 'vocabulary'
      and q.kind = 'multiple_choice'
      and public.level_rank(q.level) <= 2
    order by random()
    limit 8
  ) s;
  if coalesce(array_length(picked, 1), 0) = 0 then
    raise exception 'no_content' using errcode = 'P0002';
  end if;
  update public.game_invitations set status = 'accepted', responded_at = now(), question_ids = picked where id = inv.id returning * into inv;
  return public.invitation_json(inv, uid);
end;
$$;

create or replace function public.get_game_invitations()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(public.invitation_json(i, public.require_user()) order by i.created_at desc), '[]'::jsonb)
  from (
    select * from public.game_invitations
    where (from_user = auth.uid() or to_user = auth.uid()) and created_at > now() - interval '7 days'
    order by created_at desc
    limit 30
  ) i
$$;

create or replace function public.start_duel(invitation uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  inv public.game_invitations;
  session public.game_sessions;
begin
  select * into inv from public.game_invitations where id = invitation;
  if inv.id is null or (inv.to_user <> uid and inv.from_user <> uid) or inv.status <> 'accepted' then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;
  select * into session from public.game_sessions where invitation_id = inv.id and user_id = uid;
  if session.id is not null and session.completed_at is not null then
    raise exception 'already_completed' using errcode = 'P0001';
  end if;
  if session.id is null then
    insert into public.game_sessions (user_id, kind, question_ids, invitation_id)
    values (uid, 'word_duel', inv.question_ids, inv.id) returning * into session;
  end if;
  return jsonb_build_object(
    'sessionId', session.id,
    'invitation', public.invitation_json(inv, uid),
    'questions', (
      select jsonb_agg(to_jsonb(c) order by array_position(inv.question_ids, c.id))
      from public.question_cards c where c.id = any (inv.question_ids)
    )
  );
end;
$$;

create or replace function public.finish_duel(game_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  session public.game_sessions;
  answered int;
  first_try int;
  inv public.game_invitations;
begin
  select * into session from public.game_sessions where id = game_session and user_id = uid and kind = 'word_duel' for update;
  if session.id is null or session.completed_at is not null then
    raise exception 'invalid_game_session' using errcode = 'P0001';
  end if;
  select count(distinct question_id), count(*) filter (where attempt_no = 1 and is_correct)
  into answered, first_try
  from public.question_attempts where game_session_id = session.id;
  if answered < array_length(session.question_ids, 1) then
    raise exception 'challenge_incomplete' using errcode = 'P0001';
  end if;
  update public.game_sessions set completed_at = now(), correct_count = first_try where id = session.id;
  select * into inv from public.game_invitations where id = session.invitation_id;
  return public.invitation_json(inv, uid);
end;
$$;

create or replace function public.get_social_overview()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'friends', (
      select coalesce(jsonb_agg(public.player_card(case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end) order by f.responded_at desc), '[]'::jsonb)
      from public.friendships f
      where f.status = 'accepted' and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    ),
    'incoming', (
      select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'createdAt', f.created_at, 'player', public.player_card(f.requester_id)) order by f.created_at desc), '[]'::jsonb)
      from public.friendships f
      where f.status = 'pending' and f.addressee_id = auth.uid() and not public.blocked_between(auth.uid(), f.requester_id)
    ),
    'outgoing', (
      select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'createdAt', f.created_at, 'player', public.player_card(f.addressee_id)) order by f.created_at desc), '[]'::jsonb)
      from public.friendships f
      where f.status = 'pending' and f.requester_id = auth.uid()
    )
  )
  where public.require_user() is not null
$$;

create or replace function public.can_join_social_topic(topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  cid uuid;
begin
  if auth.uid() is null then
    return false;
  end if;
  if topic = 'world:lobby' then
    return true;
  end if;
  if topic !~ '^home:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  cid := substring(topic from 6)::uuid;
  return exists (select 1 from public.couples where id = cid and dissolved_at is null)
    and not public.blocked_with_couple(auth.uid(), cid);
end;
$$;

create policy "players join world and home channels" on realtime.messages for select to authenticated
  using (public.can_join_social_topic(realtime.topic()));
create policy "players send on world and home channels" on realtime.messages for insert to authenticated
  with check (public.can_join_social_topic(realtime.topic()));

alter table public.social_blocks enable row level security;
alter table public.world_chat_messages enable row level security;
alter table public.friendships enable row level security;
alter table public.home_visits enable row level security;
alter table public.home_guestbook_messages enable row level security;
alter table public.social_reports enable row level security;
alter table public.game_invitations enable row level security;

create policy "own blocks" on public.social_blocks for select to authenticated using (blocker_id = auth.uid());
create policy "visible chat" on public.world_chat_messages for select to authenticated
  using (hidden_at is null and not public.blocked_between(auth.uid(), user_id));
create policy "own friendships" on public.friendships for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy "own visits" on public.home_visits for select to authenticated
  using (visitor_id = auth.uid() or public.is_couple_member(host_couple_id));
create policy "visible guestbook" on public.home_guestbook_messages for select to authenticated
  using (hidden_at is null and not public.blocked_between(auth.uid(), author_id));
create policy "own reports" on public.social_reports for select to authenticated using (reporter_id = auth.uid());
create policy "own invitations" on public.game_invitations for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

revoke all on public.social_blocks, public.world_chat_messages, public.friendships, public.home_visits,
  public.home_guestbook_messages, public.social_reports, public.game_invitations from anon, authenticated;
grant select on public.social_blocks, public.world_chat_messages, public.friendships, public.home_visits,
  public.home_guestbook_messages, public.social_reports, public.game_invitations to authenticated;

alter publication supabase_realtime add table
  public.world_chat_messages, public.home_guestbook_messages, public.friendships, public.game_invitations;

revoke execute on function
  public.player_card(uuid),
  public.message_json(public.world_chat_messages),
  public.guestbook_json(public.home_guestbook_messages),
  public.invitation_json(public.game_invitations, uuid),
  public.couple_card(uuid, uuid),
  public.friendship_status(uuid, uuid),
  public.blocked_with_couple(uuid, uuid),
  public.are_friends(uuid, uuid)
from anon, public, authenticated;

revoke execute on function
  public.blocked_between(uuid, uuid),
  public.can_join_social_topic(text),
  public.get_player_cards(uuid[]),
  public.get_world_messages(text, uuid, int),
  public.send_world_message(text, text, uuid),
  public.delete_world_message(uuid),
  public.block_player(uuid),
  public.unblock_player(uuid),
  public.get_blocked_players(),
  public.report_player(uuid, text, uuid, uuid, text),
  public.get_player_profile(uuid),
  public.get_discover_couples(text, int, int),
  public.get_couple_world_profile(uuid),
  public.start_home_visit(uuid),
  public.get_guestbook(uuid, uuid, int),
  public.sign_guestbook(uuid, text),
  public.delete_guestbook_message(uuid),
  public.send_friend_request(uuid),
  public.respond_friend_request(uuid, boolean),
  public.remove_friend(uuid),
  public.send_game_invitation(uuid, text),
  public.respond_game_invitation(uuid, boolean),
  public.get_game_invitations(),
  public.start_duel(uuid),
  public.finish_duel(uuid),
  public.get_social_overview()
from anon, public;

grant execute on function
  public.blocked_between(uuid, uuid),
  public.can_join_social_topic(text),
  public.get_player_cards(uuid[]),
  public.get_world_messages(text, uuid, int),
  public.send_world_message(text, text, uuid),
  public.delete_world_message(uuid),
  public.block_player(uuid),
  public.unblock_player(uuid),
  public.get_blocked_players(),
  public.report_player(uuid, text, uuid, uuid, text),
  public.get_player_profile(uuid),
  public.get_discover_couples(text, int, int),
  public.get_couple_world_profile(uuid),
  public.start_home_visit(uuid),
  public.get_guestbook(uuid, uuid, int),
  public.sign_guestbook(uuid, text),
  public.delete_guestbook_message(uuid),
  public.send_friend_request(uuid),
  public.respond_friend_request(uuid, boolean),
  public.remove_friend(uuid),
  public.send_game_invitation(uuid, text),
  public.respond_game_invitation(uuid, boolean),
  public.get_game_invitations(),
  public.start_duel(uuid),
  public.finish_duel(uuid),
  public.get_social_overview()
to authenticated;

create or replace function public.lookup_vocabulary(term text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'questionId', q.id,
    'language', l.language,
    'word', q.word,
    'saved', exists (select 1 from public.review_progress r where r.user_id = auth.uid() and r.question_id = q.id and r.first_learned_at is not null)
  )
  from public.lesson_questions q
  join public.lessons l on l.id = q.lesson_id
  where auth.uid() is not null
    and q.word is not null
    and char_length(btrim(coalesce(term, ''))) between 1 and 40
    and lower(q.word_term) = lower(btrim(term))
  order by public.level_rank(q.level), q.id
  limit 1
$$;

create or replace function public.save_vocabulary(question text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
begin
  if not exists (select 1 from public.lesson_questions where id = question and word is not null) then
    raise exception 'question_not_found' using errcode = 'P0001';
  end if;
  insert into public.review_progress (user_id, question_id, box, next_review_at, first_learned_at)
  values (uid, question, 0, now(), now())
  on conflict (user_id, question_id) do update set first_learned_at = coalesce(public.review_progress.first_learned_at, now());
  return true;
end;
$$;

revoke execute on function public.lookup_vocabulary(text), public.save_vocabulary(text) from anon, public;
grant execute on function public.lookup_vocabulary(text), public.save_vocabulary(text) to authenticated;
