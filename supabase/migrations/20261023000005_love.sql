create table public.love_messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('text', 'heart', 'gift')),
  body text check (char_length(body) <= 500),
  item_id text references public.shop_items (id),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  opened_at timestamptz,
  saved boolean not null default false,
  check (kind <> 'text' or coalesce(char_length(trim(body)), 0) > 0),
  check (kind <> 'gift' or item_id is not null)
);
create index love_messages_couple_idx on public.love_messages (couple_id, created_at desc);

create table public.daily_love_questions (
  id text primary key,
  prompt text not null,
  prompt_vi text not null,
  helper_phrase text,
  sort_order int not null unique
);

create table public.daily_love_answers (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  question_id text not null references public.daily_love_questions (id),
  answer text not null check (char_length(trim(answer)) between 1 and 600),
  created_at timestamptz not null default now(),
  primary key (couple_id, user_id, day)
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  kind text not null check (kind in ('milestone', 'achievement', 'streak', 'quest', 'home', 'message', 'special')),
  title text not null check (char_length(title) between 1 and 80),
  body text check (char_length(body) <= 600),
  meta jsonb not null default '{}'::jsonb,
  occurred_on date not null default current_date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index memories_couple_idx on public.memories (couple_id, occurred_on desc, created_at desc);

create table public.couple_interactions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('hug', 'wave', 'sit_together')),
  status text not null check (status in ('pending', 'accepted', 'declined', 'delivered', 'expired')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index couple_interactions_couple_idx on public.couple_interactions (couple_id, created_at desc);

create table public.couple_rewards (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  description text check (char_length(description) <= 300),
  cost int not null check (cost between 10 and 5000),
  created_by uuid references auth.users (id) on delete set null,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'declined', 'archived')),
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.couple_rewards (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  redeemed_by uuid references auth.users (id) on delete set null,
  cost int not null,
  redeemed_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

create or replace function public.word_count(raw text)
returns int
language sql
immutable
as $$
  select coalesce(array_length(regexp_split_to_array(trim(raw), '\s+'), 1), 0)
$$;

create or replace function public.send_love_message(message_kind text, message_body text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  cid uuid := public.require_couple();
  partner uuid := public.my_partner_id();
  recent int;
  hearts_today int;
  message_id uuid;
begin
  if partner is null then
    raise exception 'partner_missing' using errcode = 'P0001';
  end if;
  if message_kind not in ('text', 'heart') then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  if message_kind = 'text' and coalesce(char_length(trim(message_body)), 0) = 0 then
    raise exception 'empty_message' using errcode = '22023';
  end if;
  select count(*) into recent from public.love_messages where sender_id = uid and created_at > now() - interval '1 hour';
  if recent >= 60 then
    raise exception 'slow_down' using errcode = 'P0001';
  end if;

  insert into public.love_messages (couple_id, sender_id, recipient_id, kind, body)
  values (cid, uid, partner, message_kind, nullif(trim(message_body), ''))
  returning id into message_id;

  perform public.emit_event(uid, 'message_sent', null, 1);
  if message_kind = 'text' and public.word_count(message_body) >= 12 and message_body ~ '[A-Za-z]{2,}' then
    perform public.emit_event(uid, 'love_letter', null, 1);
  end if;
  if message_kind = 'heart' then
    select count(*) into hearts_today from public.love_messages
      where sender_id = uid and kind = 'heart' and created_at > now() - interval '1 day';
    if hearts_today <= 5 then
      perform public.add_couple_progress(cid, 0, 1, 'hearts');
    end if;
  end if;
  return message_id;
end;
$$;

create or replace function public.send_gift(item text, note text, request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  cid uuid := public.require_couple();
  partner uuid := public.my_partner_id();
  def public.shop_items;
  award jsonb;
  message_id uuid;
begin
  select * into def from public.shop_items where id = item and category = 'gifts';
  if def.id is null then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  if partner is null then
    raise exception 'partner_missing' using errcode = 'P0001';
  end if;
  if char_length(coalesce(note, '')) > 200 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;

  award := public.grant_reward(uid, 0, -def.price, 'gift', request_id::text);
  insert into public.inventories (user_id, couple_id, item_id, source) values (partner, cid, item, 'gift');
  insert into public.love_messages (couple_id, sender_id, recipient_id, kind, body, item_id)
  values (cid, uid, partner, 'gift', nullif(trim(note), ''), item)
  returning id into message_id;
  perform public.add_couple_progress(cid, 0, 5, 'a gift');
  return award || jsonb_build_object('messageId', message_id);
end;
$$;

create or replace function public.mark_messages_read()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated int;
begin
  update public.love_messages set read_at = now()
  where recipient_id = auth.uid() and couple_id = public.require_couple() and read_at is null;
  get diagnostics updated = row_count;
  return updated;
end;
$$;

create or replace function public.open_gift(message uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.love_messages set opened_at = coalesce(opened_at, now()), read_at = coalesce(read_at, now())
  where id = message and recipient_id = public.require_user() and kind = 'gift';
  if not found then
    raise exception 'gift_not_found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.save_message_as_memory(message uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cid uuid := public.require_couple();
  msg public.love_messages;
  memory_id uuid;
begin
  select * into msg from public.love_messages where id = message and couple_id = cid;
  if msg.id is null or msg.kind <> 'text' then
    raise exception 'message_not_found' using errcode = 'P0002';
  end if;
  if msg.saved then
    raise exception 'already_saved' using errcode = 'P0001';
  end if;
  update public.love_messages set saved = true where id = msg.id;
  insert into public.memories (couple_id, kind, title, body, created_by, meta, occurred_on)
  values (cid, 'message', 'A message to remember', msg.body, auth.uid(),
          jsonb_build_object('messageId', msg.id, 'sender', msg.sender_id), msg.created_at::date)
  returning id into memory_id;
  return memory_id;
end;
$$;

create or replace function public.love_question_for_day(target_day date)
returns public.daily_love_questions
language sql
stable
set search_path = public, pg_temp
as $$
  select q.* from public.daily_love_questions q
  order by q.sort_order
  offset ((target_day - date '2024-01-01') % greatest((select count(*) from public.daily_love_questions), 1))
  limit 1
$$;

create or replace function public.get_today_love_question()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  cid uuid := public.require_couple();
  today date := public.couple_local_date(cid);
  q public.daily_love_questions := public.love_question_for_day(today);
  mine public.daily_love_answers;
  theirs public.daily_love_answers;
begin
  select * into mine from public.daily_love_answers where couple_id = cid and user_id = auth.uid() and day = today;
  select * into theirs from public.daily_love_answers where couple_id = cid and user_id = public.my_partner_id() and day = today;
  return jsonb_build_object(
    'day', today,
    'question', to_jsonb(q),
    'myAnswer', mine.answer,
    'partnerAnswered', theirs.user_id is not null,
    'partnerAnswer', case when mine.user_id is not null then theirs.answer end
  );
end;
$$;

create or replace function public.answer_love_question(answer_text text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  cid uuid := public.require_couple();
  today date := public.couple_local_date(cid);
  q public.daily_love_questions := public.love_question_for_day(today);
begin
  begin
    insert into public.daily_love_answers (couple_id, user_id, day, question_id, answer)
    values (cid, uid, today, q.id, trim(answer_text));
  exception when unique_violation then
    raise exception 'already_answered' using errcode = 'P0001';
  end;
  perform public.emit_event(uid, 'love_answered', null, 1);
  if (select count(*) from public.daily_love_answers where couple_id = cid and day = today) = 2 then
    perform public.add_couple_progress(cid, 10, 8, 'the Daily Love Question');
  end if;
  return public.get_today_love_question();
end;
$$;

create or replace function public.get_love_answer_history(max_days int default 14)
returns table (day date, question_id text, prompt text, my_answer text, partner_answer text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select mine.day, mine.question_id, q.prompt, mine.answer, theirs.answer
  from public.daily_love_answers mine
  join public.daily_love_questions q on q.id = mine.question_id
  left join public.daily_love_answers theirs
    on theirs.couple_id = mine.couple_id and theirs.day = mine.day and theirs.user_id = public.my_partner_id()
  where mine.couple_id = public.my_couple_id() and mine.user_id = auth.uid()
  order by mine.day desc
  limit least(greatest(max_days, 1), 60)
$$;

create or replace function public.send_interaction(interaction_kind text)
returns public.couple_interactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  cid uuid := public.require_couple();
  partner uuid := public.my_partner_id();
  result public.couple_interactions;
begin
  if interaction_kind not in ('hug', 'wave', 'sit_together') then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  if partner is null then
    raise exception 'partner_missing' using errcode = 'P0001';
  end if;
  if (select count(*) from public.couple_interactions where from_user = uid and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'slow_down' using errcode = 'P0001';
  end if;

  update public.couple_interactions set status = 'expired', responded_at = now()
  where couple_id = cid and from_user = uid and kind = interaction_kind and status = 'pending';

  insert into public.couple_interactions (couple_id, from_user, to_user, kind, status)
  values (cid, uid, partner, interaction_kind, case when interaction_kind = 'wave' then 'delivered' else 'pending' end)
  returning * into result;
  return result;
end;
$$;

create or replace function public.respond_interaction(interaction uuid, accept boolean)
returns public.couple_interactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  row_data public.couple_interactions;
  accepted_hugs_today int;
begin
  select * into row_data from public.couple_interactions where id = interaction and to_user = uid for update;
  if row_data.id is null then
    raise exception 'interaction_not_found' using errcode = 'P0002';
  end if;
  if row_data.status <> 'pending' or row_data.created_at < now() - interval '24 hours' then
    raise exception 'interaction_closed' using errcode = 'P0001';
  end if;

  update public.couple_interactions
  set status = case when accept then 'accepted' else 'declined' end, responded_at = now()
  where id = interaction
  returning * into row_data;

  if accept and row_data.kind = 'hug' then
    select count(*) into accepted_hugs_today from public.couple_interactions
      where couple_id = row_data.couple_id and kind = 'hug' and status = 'accepted'
        and responded_at > now() - interval '1 day';
    if accepted_hugs_today <= 3 then
      perform public.add_couple_progress(row_data.couple_id, 5, 5, 'a hug');
    end if;
    perform public.unlock_couple_achievement(row_data.couple_id, 'first_hug');
  end if;
  return row_data;
end;
$$;

create or replace function public.add_special_memory(memory_title text, memory_body text, memory_date date)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  memory_id uuid;
begin
  insert into public.memories (couple_id, kind, title, body, occurred_on, created_by)
  values (public.require_couple(), 'special', trim(memory_title), nullif(trim(memory_body), ''),
          coalesce(memory_date, current_date), auth.uid())
  returning id into memory_id;
  return memory_id;
end;
$$;

create or replace function public.delete_memory(memory uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.memories
  where id = memory and couple_id = public.require_couple() and kind in ('special', 'message');
  if not found then
    raise exception 'memory_not_deletable' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.propose_reward(reward_title text, reward_description text, reward_cost int)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reward_id uuid;
begin
  insert into public.couple_rewards (couple_id, title, description, cost, created_by)
  values (public.require_couple(), trim(reward_title), nullif(trim(reward_description), ''), reward_cost, auth.uid())
  returning id into reward_id;
  return reward_id;
end;
$$;

create or replace function public.respond_reward(reward uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.couple_rewards
  set status = case when approve then 'approved' else 'declined' end,
      approved_by = case when approve then auth.uid() end,
      responded_at = now()
  where id = reward and couple_id = public.require_couple() and status = 'proposed' and created_by <> auth.uid();
  if not found then
    raise exception 'reward_not_pending' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.archive_reward(reward uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.couple_rewards set status = 'archived'
  where id = reward and couple_id = public.require_couple() and status <> 'archived';
  if not found then
    raise exception 'reward_not_found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.redeem_reward(reward uuid, request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  cid uuid := public.require_couple();
  def public.couple_rewards;
  award jsonb;
begin
  select * into def from public.couple_rewards where id = reward and couple_id = cid;
  if def.id is null or def.status <> 'approved' then
    raise exception 'reward_not_approved' using errcode = 'P0001';
  end if;
  award := public.grant_reward(uid, 0, -def.cost, 'reward_redemption', request_id::text);
  insert into public.reward_redemptions (reward_id, couple_id, redeemed_by, cost) values (def.id, cid, uid, def.cost);
  insert into public.memories (couple_id, kind, title, body, created_by)
  values (cid, 'milestone', 'Redeemed: ' || def.title, def.description, uid);
  return award;
end;
$$;

create or replace function public.fulfill_redemption(redemption uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.reward_redemptions set fulfilled_at = now()
  where id = redemption and couple_id = public.require_couple() and fulfilled_at is null;
  if not found then
    raise exception 'redemption_not_found' using errcode = 'P0002';
  end if;
end;
$$;

alter table public.love_messages enable row level security;
alter table public.daily_love_questions enable row level security;
alter table public.daily_love_answers enable row level security;
alter table public.memories enable row level security;
alter table public.couple_interactions enable row level security;
alter table public.couple_rewards enable row level security;
alter table public.reward_redemptions enable row level security;

create policy "couple messages" on public.love_messages for select to authenticated
  using (public.is_couple_member(couple_id) and (sender_id = auth.uid() or recipient_id = auth.uid()));
create policy "catalog" on public.daily_love_questions for select to authenticated using (true);
create or replace function public.has_answered_love_question(target_couple uuid, target_day date)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.daily_love_answers
    where couple_id = target_couple and day = target_day and user_id = auth.uid()
  )
$$;

create policy "own answers or revealed partner answers" on public.daily_love_answers for select to authenticated
  using (
    public.is_couple_member(couple_id)
    and (user_id = auth.uid() or public.has_answered_love_question(couple_id, day))
  );
create policy "couple memories" on public.memories for select to authenticated using (public.is_couple_member(couple_id));
create policy "couple interactions" on public.couple_interactions for select to authenticated using (public.is_couple_member(couple_id));
create policy "couple rewards" on public.couple_rewards for select to authenticated using (public.is_couple_member(couple_id));
create policy "couple redemptions" on public.reward_redemptions for select to authenticated using (public.is_couple_member(couple_id));

revoke all on public.love_messages, public.daily_love_questions, public.daily_love_answers, public.memories,
  public.couple_interactions, public.couple_rewards, public.reward_redemptions from anon, authenticated;
grant select on public.love_messages, public.daily_love_questions, public.daily_love_answers, public.memories,
  public.couple_interactions, public.couple_rewards, public.reward_redemptions to authenticated;

alter publication supabase_realtime add table
  public.love_messages, public.couple_interactions, public.furniture_placements,
  public.couple_progress, public.memories, public.couple_members, public.daily_love_answers;

create policy "couple members use their channel" on realtime.messages for select to authenticated
  using (realtime.topic() = 'couple:' || public.my_couple_id()::text);
create policy "couple members broadcast on their channel" on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'couple:' || public.my_couple_id()::text);

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
revoke execute on function
  public.grant_reward(uuid, int, int, text, text),
  public.add_couple_progress(uuid, int, int, text),
  public.unlock_user_achievement(uuid, text),
  public.unlock_couple_achievement(uuid, text),
  public.advance_streak(text, uuid, date),
  public.record_qualifying_activity(uuid),
  public.emit_event(uuid, text, text, int),
  public.complete_couple_quest(uuid, public.couple_quests, date),
  public.check_user_achievements(uuid),
  public.update_review_progress(uuid, text, boolean),
  public.handle_new_user(),
  public.delete_streak_on_user_delete(),
  public.validate_profile(),
  public.touch_updated_at()
from authenticated;
