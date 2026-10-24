create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  sender_user_id uuid references auth.users (id) on delete set null,
  type text not null check (type in (
    'love_ping', 'study_invitation', 'game_invitation', 'gift_received', 'friend_request',
    'achievement_unlocked', 'couple_quest_completed', 'guestbook_signed', 'world_event'
  )),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 400),
  preview text not null check (char_length(preview) between 1 and 200),
  metadata jsonb not null default '{}'::jsonb,
  destination text not null check (destination ~ '^/[A-Za-z0-9/_?=&%.-]*$' and destination !~ '^//'),
  client_id uuid,
  push_status text not null default 'none' check (push_status in ('none', 'pending', 'sending', 'sent', 'skipped', 'failed')),
  push_note text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  deleted_at timestamptz,
  check (sender_user_id is null or sender_user_id <> recipient_user_id or type in ('achievement_unlocked', 'couple_quest_completed'))
);
create unique index notifications_client_idx on public.notifications (sender_user_id, client_id) where client_id is not null;
create index notifications_inbox_idx on public.notifications (recipient_user_id, created_at desc, id desc) where deleted_at is null;
create index notifications_unread_idx on public.notifications (recipient_user_id) where deleted_at is null and read_at is null;
create index notifications_pending_idx on public.notifications (sender_user_id, created_at desc) where push_status = 'pending';
create index notifications_ping_idx on public.notifications (sender_user_id, recipient_user_id, created_at desc) where (metadata ? 'ping');

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  device_label text check (char_length(device_label) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count int not null default 0
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  love_ping_enabled boolean not null default true,
  study_invites_enabled boolean not null default true,
  game_invites_enabled boolean not null default true,
  community_enabled boolean not null default true,
  sound_enabled boolean not null default true,
  message_previews_enabled boolean not null default false,
  quiet_start smallint check (quiet_start between 0 and 23),
  quiet_end smallint check (quiet_end between 0 and 23),
  updated_at timestamptz not null default now(),
  check ((quiet_start is null) = (quiet_end is null))
);

create table public.notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  subscription_id uuid references public.push_subscriptions (id) on delete set null,
  status text not null check (status in ('sent', 'failed', 'expired')),
  status_code int,
  error_code text,
  attempted_at timestamptz not null default now()
);
create index notification_delivery_attempts_notification_idx on public.notification_delivery_attempts (notification_id);

create table public.device_presence (
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text not null check (char_length(device_id) between 8 and 64),
  visible boolean not null,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

create or replace function public.notification_category(kind text)
returns text
language sql
immutable
as $$
  select case kind
    when 'love_ping' then 'love'
    when 'gift_received' then 'love'
    when 'study_invitation' then 'study'
    when 'game_invitation' then 'game'
    when 'friend_request' then 'community'
    when 'guestbook_signed' then 'community'
    when 'world_event' then 'community'
    else 'inapp'
  end
$$;

create or replace function public.notify(
  recipient uuid, sender uuid, kind text, title text, body text, preview text, destination text,
  meta jsonb default '{}'::jsonb, request_id uuid default null
)
returns public.notifications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted public.notifications;
begin
  if recipient is null then
    return null;
  end if;
  if sender is not null and sender <> recipient and public.blocked_between(sender, recipient) then
    return null;
  end if;
  insert into public.notifications (recipient_user_id, sender_user_id, type, title, body, preview, destination, metadata, client_id, push_status)
  values (
    recipient, sender, kind, left(title, 120), left(body, 400), left(preview, 200), destination, coalesce(meta, '{}'::jsonb), request_id,
    case when public.notification_category(kind) = 'inapp' or sender is null or sender = recipient then 'none' else 'pending' end
  )
  on conflict (sender_user_id, client_id) where client_id is not null do nothing
  returning * into inserted;
  return inserted;
end;
$$;

create or replace function public.notification_json(n public.notifications)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', n.id, 'type', n.type, 'title', n.title, 'body', n.body, 'destination', n.destination,
    'metadata', n.metadata, 'createdAt', n.created_at, 'readAt', n.read_at, 'pushStatus', n.push_status,
    'sender', case when n.sender_user_id is null then null else (
      select jsonb_build_object('id', p.id, 'name', p.display_name, 'avatar', p.avatar) from public.profiles p where p.id = n.sender_user_id
    ) end
  )
$$;

create or replace function public.send_love_ping(kind text, message text default null, client_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  cid uuid := public.my_couple_id();
  partner uuid := public.my_partner_id();
  sender_name text := (select display_name from public.profiles where id = uid);
  clean text := btrim(coalesce(message, ''));
  existing public.notifications;
  created public.notifications;
  recent int;
  n_type text := 'love_ping';
  n_title text;
  n_body text;
  n_preview text;
  n_dest text := '/home';
begin
  if cid is null or partner is null then
    raise exception 'partner_missing' using errcode = 'P0001';
  end if;
  if kind not in ('miss_you', 'come_home', 'study', 'play', 'custom') then
    raise exception 'invalid_love_ping' using errcode = 'P0001';
  end if;
  if client_id is not null then
    select * into existing from public.notifications n where n.sender_user_id = uid and n.client_id = send_love_ping.client_id;
    if existing.id is not null then
      return jsonb_build_object('notification', public.notification_json(existing), 'duplicate', true);
    end if;
  end if;
  if kind = 'custom' and char_length(clean) = 0 then
    raise exception 'empty_message' using errcode = 'P0001';
  end if;
  if kind = 'custom' and char_length(clean) > 200 then
    raise exception 'message_too_long' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('love_ping:' || uid::text));
  select count(*) into recent from public.notifications n
  where n.sender_user_id = uid and n.recipient_user_id = partner and n.metadata ? 'ping' and n.created_at > now() - interval '30 minutes';
  if recent >= 3 then
    raise exception 'love_ping_cooldown' using errcode = 'P0001';
  end if;

  case kind
    when 'miss_you' then
      n_title := '💌 ' || sender_name || ' misses you!';
      n_body := 'I miss you! Come spend some time with me 🥺💕';
    when 'come_home' then
      n_title := '🏡 ' || sender_name || ' is waiting at home';
      n_body := 'Come home! I''m waiting for you in our little world 🌸';
    when 'study' then
      n_type := 'study_invitation';
      n_dest := '/learn';
      n_title := '📚 Study Together';
      n_body := sender_name || ' invited you to learn together! 📖💗';
    when 'play' then
      n_dest := '/games';
      n_title := '🎮 ' || sender_name || ' wants to play';
      n_body := 'Come play with me! Our adventure is waiting 🎮✨';
    else
      n_title := '💌 ' || sender_name || ' sent you a Love Ping';
      n_body := clean;
  end case;
  n_preview := case when kind = 'custom' then sender_name || ' sent you a little love note 💗' else n_body end;

  created := public.notify(partner, uid, n_type, n_title, n_body, n_preview, n_dest,
    jsonb_build_object('ping', true, 'kind', kind, 'coupleId', cid, 'private', kind = 'custom'), client_id);
  return jsonb_build_object('notification', public.notification_json(created), 'duplicate', false);
end;
$$;

create or replace function public.get_notifications(before_id uuid default null, max_rows int default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  cursor_row public.notifications;
  lim int := least(greatest(coalesce(max_rows, 20), 1), 50);
begin
  if before_id is not null then
    select * into cursor_row from public.notifications where id = before_id and recipient_user_id = uid;
  end if;
  return (
    select coalesce(jsonb_agg(public.notification_json(n) order by n.created_at desc, n.id desc), '[]'::jsonb)
    from (
      select * from public.notifications x
      where x.recipient_user_id = uid and x.deleted_at is null
        and (cursor_row.id is null or (x.created_at, x.id) < (cursor_row.created_at, cursor_row.id))
      order by x.created_at desc, x.id desc
      limit lim
    ) n
  );
end;
$$;

create or replace function public.unread_notification_count()
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int from public.notifications
  where recipient_user_id = public.require_user() and deleted_at is null and read_at is null
$$;

create or replace function public.mark_notifications_read(ids uuid[] default null)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed int;
begin
  update public.notifications set read_at = now()
  where recipient_user_id = public.require_user() and read_at is null and deleted_at is null
    and (ids is null or id = any (ids));
  get diagnostics changed = row_count;
  return changed;
end;
$$;

create or replace function public.delete_notification(notification uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.notifications set deleted_at = now(), read_at = coalesce(read_at, now())
  where id = notification and recipient_user_id = public.require_user() and deleted_at is null;
  if not found then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.claim_love_ping_reunion()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  partner uuid := public.my_partner_id();
  ping public.notifications;
begin
  if partner is null then
    return null;
  end if;
  select * into ping from public.notifications
  where recipient_user_id = uid and sender_user_id = partner and metadata ? 'ping'
    and created_at > now() - interval '6 hours' and not (metadata ? 'reunionAt') and deleted_at is null
  order by created_at desc
  limit 1
  for update skip locked;
  if ping.id is null then
    return null;
  end if;
  update public.notifications
  set metadata = metadata || jsonb_build_object('reunionAt', now())
  where recipient_user_id = uid and sender_user_id = partner and metadata ? 'ping' and not (metadata ? 'reunionAt') and created_at > now() - interval '6 hours';
  return public.notification_json(ping);
end;
$$;

create or replace function public.save_push_subscription(endpoint text, p256dh text, auth text, device_label text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  uid uuid := public.require_user();
  saved uuid;
  target_endpoint text := save_push_subscription.endpoint;
begin
  if (select count(*) from public.push_subscriptions s where s.user_id = uid) >= 10
     and not exists (select 1 from public.push_subscriptions s where s.endpoint = target_endpoint) then
    delete from public.push_subscriptions where id = (
      select s.id from public.push_subscriptions s where s.user_id = uid order by coalesce(s.last_success_at, s.updated_at) asc limit 1
    );
  end if;
  insert into public.push_subscriptions as ps (user_id, endpoint, p256dh, auth, device_label)
  values (uid, target_endpoint, save_push_subscription.p256dh, save_push_subscription.auth,
          nullif(left(btrim(coalesce(save_push_subscription.device_label, '')), 80), ''))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        device_label = coalesce(excluded.device_label, ps.device_label),
        updated_at = now(), failure_count = 0
  returning ps.id into saved;
  return saved;
end;
$$;

create or replace function public.remove_push_subscription(endpoint text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.push_subscriptions s where s.endpoint = remove_push_subscription.endpoint and s.user_id = public.require_user()
$$;

create or replace function public.get_notification_settings()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  prefs public.notification_preferences;
begin
  insert into public.notification_preferences (user_id) values (uid) on conflict do nothing;
  select * into prefs from public.notification_preferences where user_id = uid;
  return jsonb_build_object(
    'lovePing', prefs.love_ping_enabled,
    'studyInvites', prefs.study_invites_enabled,
    'gameInvites', prefs.game_invites_enabled,
    'community', prefs.community_enabled,
    'sound', prefs.sound_enabled,
    'messagePreviews', prefs.message_previews_enabled,
    'quietStart', prefs.quiet_start,
    'quietEnd', prefs.quiet_end,
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'label', s.device_label, 'createdAt', s.created_at, 'lastSuccessAt', s.last_success_at) order by s.created_at), '[]'::jsonb)
      from public.push_subscriptions s where s.user_id = uid
    )
  );
end;
$$;

create or replace function public.update_notification_settings(settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  qs int;
  qe int;
begin
  insert into public.notification_preferences (user_id) values (uid) on conflict do nothing;
  qs := case when settings ? 'quietStart' and jsonb_typeof(settings->'quietStart') = 'number' then (settings->>'quietStart')::int end;
  qe := case when settings ? 'quietEnd' and jsonb_typeof(settings->'quietEnd') = 'number' then (settings->>'quietEnd')::int end;
  if (settings ? 'quietStart' or settings ? 'quietEnd') and ((qs is null) <> (qe is null) or qs not between 0 and 23 or qe not between 0 and 23) then
    raise exception 'invalid_quiet_hours' using errcode = 'P0001';
  end if;
  update public.notification_preferences set
    love_ping_enabled = coalesce((settings->>'lovePing')::boolean, love_ping_enabled),
    study_invites_enabled = coalesce((settings->>'studyInvites')::boolean, study_invites_enabled),
    game_invites_enabled = coalesce((settings->>'gameInvites')::boolean, game_invites_enabled),
    community_enabled = coalesce((settings->>'community')::boolean, community_enabled),
    sound_enabled = coalesce((settings->>'sound')::boolean, sound_enabled),
    message_previews_enabled = coalesce((settings->>'messagePreviews')::boolean, message_previews_enabled),
    quiet_start = case when settings ? 'quietStart' then qs else quiet_start end,
    quiet_end = case when settings ? 'quietEnd' then qe else quiet_end end,
    updated_at = now()
  where user_id = uid;
  return public.get_notification_settings();
end;
$$;

create or replace function public.touch_device_presence(device text, visible boolean)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.device_presence (user_id, device_id, visible, last_seen_at)
  values (public.require_user(), device, coalesce(visible, false), now())
  on conflict (user_id, device_id) do update set visible = excluded.visible, last_seen_at = now()
$$;

create or replace function public.on_friendship_notify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requester_name text := (select display_name from public.profiles where id = new.requester_id);
  addressee_name text := (select display_name from public.profiles where id = new.addressee_id);
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.notify(new.addressee_id, new.requester_id, 'friend_request', '🤝 ' || requester_name || ' wants to be friends',
      requester_name || ' sent you a friend request in TWOGETHER World.', requester_name || ' sent you a friend request.',
      '/world?tab=friends', jsonb_build_object('friendshipId', new.id));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.notify(new.requester_id, new.addressee_id, 'friend_request', '💗 ' || addressee_name || ' accepted your request',
      'You and ' || addressee_name || ' are now friends!', 'You have a new friend in TWOGETHER World.',
      '/world?tab=friends', jsonb_build_object('friendshipId', new.id, 'accepted', true));
  end if;
  return new;
end;
$$;

create trigger friendships_notify after insert or update on public.friendships
for each row execute function public.on_friendship_notify();

create or replace function public.on_game_invitation_notify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sender_name text := (select display_name from public.profiles where id = new.from_user);
begin
  perform public.notify(new.to_user, new.from_user, 'game_invitation', '🎮 Word Duel invitation',
    sender_name || ' challenged you to a Word Duel!', sender_name || ' challenged you to a Word Duel!',
    '/world?tab=friends', jsonb_build_object('invitationId', new.id));
  return new;
end;
$$;

create trigger game_invitations_notify after insert on public.game_invitations
for each row execute function public.on_game_invitation_notify();

create or replace function public.on_gift_notify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sender_name text := (select display_name from public.profiles where id = new.sender_id);
  item_name text := (select name from public.shop_items where id = new.item_id);
begin
  if new.kind = 'gift' then
    perform public.notify(new.recipient_id, new.sender_id, 'gift_received', '🎁 ' || sender_name || ' sent you a gift',
      sender_name || ' sent you ' || coalesce(item_name, 'a gift') || coalesce(' — “' || new.body || '”', '') || '.',
      sender_name || ' sent you a gift 🎁', '/home', jsonb_build_object('messageId', new.id, 'itemId', new.item_id));
  end if;
  return new;
end;
$$;

create trigger love_messages_gift_notify after insert on public.love_messages
for each row execute function public.on_gift_notify();

create or replace function public.on_guestbook_notify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  author_name text := (select display_name from public.profiles where id = new.author_id);
  member uuid;
begin
  for member in select user_id from public.couple_members where couple_id = new.couple_id loop
    perform public.notify(member, new.author_id, 'guestbook_signed', '🌸 ' || author_name || ' signed your guestbook',
      '“' || new.body || '”', author_name || ' left a note in your guestbook.', '/home', jsonb_build_object('guestbookId', new.id));
  end loop;
  return new;
end;
$$;

create trigger home_guestbook_notify after insert on public.home_guestbook_messages
for each row execute function public.on_guestbook_notify();

create or replace function public.on_achievement_notify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  def public.achievements;
begin
  select * into def from public.achievements where id = new.achievement_id;
  perform public.notify(new.user_id, null, 'achievement_unlocked', '🏆 ' || def.title,
    def.description, 'Achievement unlocked: ' || def.title, '/story', jsonb_build_object('achievementId', def.id));
  return new;
end;
$$;

create trigger user_achievements_notify after insert on public.user_achievements
for each row execute function public.on_achievement_notify();

create or replace function public.on_couple_quest_notify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  quest public.couple_quests;
  member uuid;
begin
  if new.completed_at is not null and (tg_op = 'INSERT' or old.completed_at is null) then
    select * into quest from public.couple_quests where id = new.quest_id;
    for member in select user_id from public.couple_members where couple_id = new.couple_id loop
      perform public.notify(member, null, 'couple_quest_completed', '💞 Couple Quest complete!',
        'You completed “' || coalesce(quest.title, new.quest_id) || '” together.', 'Couple Quest complete!', '/home',
        jsonb_build_object('questId', new.quest_id));
    end loop;
  end if;
  return new;
end;
$$;

create trigger couple_quest_progress_notify after insert or update on public.couple_quest_progress
for each row execute function public.on_couple_quest_notify();

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_delivery_attempts enable row level security;
alter table public.device_presence enable row level security;

create policy "own notifications" on public.notifications for select to authenticated
  using (recipient_user_id = auth.uid() and deleted_at is null);
create policy "own push subscriptions" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "own notification preferences" on public.notification_preferences for select to authenticated using (user_id = auth.uid());

revoke all on public.notifications, public.push_subscriptions, public.notification_preferences,
  public.notification_delivery_attempts, public.device_presence from anon, authenticated;
grant select on public.notifications, public.push_subscriptions, public.notification_preferences to authenticated;

alter publication supabase_realtime add table public.notifications;

revoke execute on function
  public.notify(uuid, uuid, text, text, text, text, text, jsonb, uuid),
  public.notification_json(public.notifications),
  public.on_friendship_notify(),
  public.on_game_invitation_notify(),
  public.on_gift_notify(),
  public.on_guestbook_notify(),
  public.on_achievement_notify(),
  public.on_couple_quest_notify()
from anon, public, authenticated;

revoke execute on function
  public.notification_category(text),
  public.send_love_ping(text, text, uuid),
  public.get_notifications(uuid, int),
  public.unread_notification_count(),
  public.mark_notifications_read(uuid[]),
  public.delete_notification(uuid),
  public.claim_love_ping_reunion(),
  public.save_push_subscription(text, text, text, text),
  public.remove_push_subscription(text),
  public.get_notification_settings(),
  public.update_notification_settings(jsonb),
  public.touch_device_presence(text, boolean)
from anon, public;

grant execute on function
  public.notification_category(text),
  public.send_love_ping(text, text, uuid),
  public.get_notifications(uuid, int),
  public.unread_notification_count(),
  public.mark_notifications_read(uuid[]),
  public.delete_notification(uuid),
  public.claim_love_ping_reunion(),
  public.save_push_subscription(text, text, text, text),
  public.remove_push_subscription(text),
  public.get_notification_settings(),
  public.update_notification_settings(jsonb),
  public.touch_device_presence(text, boolean)
to authenticated;
