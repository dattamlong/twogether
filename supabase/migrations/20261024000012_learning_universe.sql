alter type public.game_kind add value if not exists 'boss';
alter type public.game_kind add value if not exists 'unit_review';
alter type public.game_kind add value if not exists 'placement';
alter type public.game_kind add value if not exists 'adventure';
alter type public.answer_source add value if not exists 'boss';
alter type public.answer_source add value if not exists 'unit_review';
alter type public.answer_source add value if not exists 'placement';
alter type public.answer_source add value if not exists 'adventure';

create table public.subjects (
  id text primary key,
  name text not null,
  name_vi text not null,
  description text not null,
  description_vi text not null,
  status text not null check (status in ('available', 'coming_soon')),
  language text check (language in ('en', 'zh')),
  sort_order int not null
);

insert into public.subjects (id, name, name_vi, description, description_vi, status, language, sort_order) values
  ('english', 'English Kingdom', 'Vương quốc Tiếng Anh', 'A cherry-blossom kingdom of libraries, villages and castles.', 'Vương quốc hoa anh đào với thư viện, làng nhỏ và lâu đài.', 'available', 'en', 1),
  ('chinese', 'Chinese Garden', 'Khu vườn Tiếng Trung', 'Lanterns, bamboo forests and misty mountains.', 'Đèn lồng, rừng trúc và núi non mờ sương.', 'available', 'zh', 2),
  ('brain', 'Brain Academy', 'Học viện Trí tuệ', 'Puzzles, patterns and logic on floating islands.', 'Câu đố, quy luật và logic trên những hòn đảo bay.', 'available', null, 3),
  ('explorer', 'World Explorer', 'Nhà thám hiểm', 'Sail to continents, capitals and wonders of the world.', 'Giong buồm tới các châu lục, thủ đô và kỳ quan.', 'available', null, 4),
  ('science', 'Science Lab', 'Phòng thí nghiệm', 'Physics, chemistry, biology and the stars.', 'Vật lý, hóa học, sinh học và các vì sao.', 'coming_soon', null, 5),
  ('money', 'Money Academy', 'Học viện Tài chính', 'Budgeting, saving and smart money decisions.', 'Lập ngân sách, tiết kiệm và quyết định tài chính.', 'coming_soon', null, 6),
  ('tech', 'Tech Academy', 'Học viện Công nghệ', 'Computers, code, AI and staying safe online.', 'Máy tính, lập trình, AI và an toàn trên mạng.', 'coming_soon', null, 7)
on conflict (id) do nothing;

alter table public.lessons add column subject_id text references public.subjects (id);
update public.lessons set subject_id = case when language = 'zh' then 'chinese' else 'english' end where subject_id is null;
alter table public.lessons alter column subject_id set not null;
alter table public.lessons alter column language drop not null;
alter table public.lessons alter column language drop default;
alter table public.lessons add column intro jsonb;
alter table public.lessons drop constraint lessons_level_matches_language;
alter table public.lessons add constraint lessons_level_matches_subject check (
  (subject_id = 'chinese' and language = 'zh' and level ~ '^HSK[1-9]$')
  or (subject_id = 'english' and language = 'en' and level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))
  or (subject_id not in ('english', 'chinese') and language is null and level ~ '^L[1-5]$')
);
alter table public.lesson_questions drop constraint lesson_questions_level_valid;
alter table public.lesson_questions add constraint lesson_questions_level_valid check (level ~ '^(HSK[1-9]|A1|A2|B1|B2|C1|C2|L[1-5])$');
create index lessons_subject_idx on public.lessons (subject_id, level);

create or replace function public.level_rank(level text)
returns smallint
language sql
immutable
as $$
  select case
    when level like 'HSK%' then substring(level from 4)::smallint
    when level ~ '^L[1-5]$' then substring(level from 2)::smallint
    else array_position(array['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], level)::smallint
  end
$$;

create table public.subject_levels (
  subject_id text not null references public.subjects (id) on delete cascade,
  level text not null,
  title text not null,
  title_vi text not null,
  lesson_target int not null default 0,
  sort_order int not null,
  primary key (subject_id, level)
);

create table public.learning_units (
  id text primary key,
  subject_id text not null references public.subjects (id),
  level text not null,
  number int not null check (number > 0),
  title text not null,
  title_vi text not null,
  description text not null,
  location text not null,
  status text not null check (status in ('available', 'planned')),
  boss_name text,
  boss_questions int check (boss_questions between 5 and 12),
  reward_item_id text references public.shop_items (id),
  unique (subject_id, level, number),
  foreign key (subject_id, level) references public.subject_levels (subject_id, level)
);

create table public.unit_lessons (
  unit_id text not null references public.learning_units (id) on delete cascade,
  lesson_id text not null references public.lessons (id) on delete cascade,
  position int not null check (position > 0),
  primary key (unit_id, lesson_id),
  unique (lesson_id),
  unique (unit_id, position)
);

create table public.unit_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  unit_id text not null references public.learning_units (id) on delete cascade,
  review_completed_at timestamptz,
  boss_best_pct int not null default 0,
  stars smallint not null default 0 check (stars between 0 and 3),
  boss_attempts int not null default 0,
  boss_cleared_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, unit_id)
);

create table public.placement_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id text not null references public.subjects (id),
  session_id uuid references public.game_sessions (id) on delete set null,
  recommended_level text not null,
  correct int not null,
  total int not null,
  score_by_level jsonb not null,
  created_at timestamptz not null default now()
);
create index placement_results_user_idx on public.placement_results (user_id, subject_id, created_at desc);

create table public.couple_adventures (
  id text primary key,
  title text not null,
  title_vi text not null,
  story text not null,
  story_vi text not null,
  letter text not null,
  letter_vi text not null,
  parts jsonb not null,
  couple_xp int not null,
  love_energy int not null,
  reward_item_id text references public.shop_items (id),
  sort_order int not null
);

create table public.couple_adventure_progress (
  couple_id uuid not null references public.couples (id) on delete cascade,
  adventure_id text not null references public.couple_adventures (id),
  parts jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  primary key (couple_id, adventure_id)
);

alter table public.game_sessions
  add column unit_id text references public.learning_units (id) on delete set null,
  add column subject_id text references public.subjects (id),
  add column adventure_id text references public.couple_adventures (id);

drop view public.question_cards cascade;
create view public.question_cards as
select q.id, q.lesson_id, q.position, q.kind, q.level, q.objective, q.prompt, q.prompt_vi,
       q.options, q.tokens, q.audio_text, q.hint, q.hint_vi, l.category_id, l.language, l.subject_id
from public.lesson_questions q
join public.lessons l on l.id = q.lesson_id;
revoke all on public.question_cards from anon, authenticated;
grant select on public.question_cards to authenticated;

create or replace function public.submit_answer(
  question text,
  answer text,
  lesson_attempt uuid default null,
  game_session uuid default null,
  review boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  q public.lesson_questions;
  q_category text;
  attempt public.lesson_attempts;
  session public.game_sessions;
  src public.answer_source;
  correct boolean;
  previous_attempts int := 0;
  newly_learned boolean := false;
  reviews_today int;
begin
  if char_length(coalesce(answer, '')) > 400 then
    raise exception 'answer_too_long' using errcode = '22023';
  end if;

  select * into q from public.lesson_questions where id = question;
  if q.id is null then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;
  select category_id into q_category from public.lessons where id = q.lesson_id;

  if lesson_attempt is not null then
    select * into attempt from public.lesson_attempts where id = lesson_attempt and user_id = uid for update;
    if attempt.id is null or attempt.completed_at is not null or attempt.lesson_id <> q.lesson_id then
      raise exception 'invalid_lesson_attempt' using errcode = 'P0001';
    end if;
    src := 'lesson';
    select count(*) into previous_attempts from public.question_attempts
      where lesson_attempt_id = lesson_attempt and question_id = question;
  elsif game_session is not null then
    select * into session from public.game_sessions where id = game_session and user_id = uid for update;
    if session.id is null or session.completed_at is not null or not (question = any (session.question_ids)) then
      raise exception 'invalid_game_session' using errcode = 'P0001';
    end if;
    src := session.kind::text::public.answer_source;
    select count(*) into previous_attempts from public.question_attempts
      where game_session_id = game_session and question_id = question;
  elsif review then
    if not exists (select 1 from public.review_progress where user_id = uid and question_id = question) then
      raise exception 'not_in_review' using errcode = 'P0001';
    end if;
    src := 'review';
    select count(*) into previous_attempts from public.question_attempts
      where user_id = uid and question_id = question and source = 'review' and created_at > now() - interval '10 minutes';
  else
    raise exception 'answer_context_required' using errcode = '22023';
  end if;

  if q.kind = 'sentence_order' then
    correct := exists (
      select 1 from jsonb_array_elements_text(q.answers) a
      where public.normalize_answer(a) = public.normalize_answer(answer)
    );
  else
    correct := public.normalize_answer(q.answers->>0) = public.normalize_answer(answer);
  end if;

  insert into public.question_attempts
    (user_id, question_id, source, lesson_attempt_id, game_session_id, attempt_no, answer, is_correct)
  values (uid, question, src, lesson_attempt, game_session, previous_attempts + 1, coalesce(answer, ''), correct);

  if previous_attempts = 0 and src <> 'placement' then
    newly_learned := public.update_review_progress(uid, question, correct);
    if newly_learned and q_category = 'vocabulary' then
      perform public.emit_event(uid, 'word_learned', q_category, 1);
    end if;
    if correct and q_category = 'vocabulary' then
      perform public.emit_event(uid, 'vocab_correct', q_category, 1);
    end if;
    if src = 'review' then
      perform public.emit_event(uid, 'review_answered', q_category, 1);
      select count(*) into reviews_today from public.question_attempts
        where user_id = uid and source = 'review'
          and (created_at at time zone (select timezone from public.profiles where id = uid))::date = public.user_local_date(uid);
      if reviews_today = 5 then
        perform public.record_qualifying_activity(uid);
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'correct', correct,
    'attemptNo', previous_attempts + 1,
    'correctAnswer', q.answers->0,
    'acceptedAnswers', case when q.kind = 'sentence_order' then q.answers end,
    'explanation', q.explanation,
    'explanationVi', q.explanation_vi,
    'word', q.word,
    'newlyLearned', newly_learned
  );
end;
$$;

create function public.get_review_queue(max_items int default 10)
returns setof public.question_cards
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.*
  from public.review_progress r
  join public.question_cards c on c.id = r.question_id
  where r.user_id = auth.uid()
    and (c.language is null or c.language = (select learning_language from public.profiles where id = auth.uid()))
    and (r.next_review_at <= now() or r.incorrect_count > r.correct_count)
  order by (r.next_review_at <= now()) desc, r.incorrect_count - r.correct_count desc, r.next_review_at asc
  limit least(greatest(max_items, 1), 30)
$$;

create or replace function public.subject_level_for(uid uuid, subject text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case subject
    when 'english' then (select english_level::text from public.profiles where id = uid)
    when 'chinese' then 'HSK' || (select chinese_level from public.profiles where id = uid)
    else 'L1'
  end
$$;

create or replace function public.completed_lessons(uid uuid)
returns table (lesson_id text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct a.lesson_id from public.lesson_attempts a where a.user_id = uid and a.completed_at is not null
$$;

create or replace function public.unit_state(uid uuid, target_unit text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  u public.learning_units;
  prev public.learning_units;
  prog public.unit_progress;
  nodes jsonb := '[]'::jsonb;
  lesson_row record;
  previous_done boolean := true;
  all_lessons_done boolean := true;
  lesson_total int := 0;
  lesson_done int := 0;
  unlocked boolean;
begin
  select * into u from public.learning_units where id = target_unit;
  select * into prog from public.unit_progress where user_id = uid and unit_id = target_unit;
  select * into prev from public.learning_units
    where subject_id = u.subject_id and level = u.level and number = u.number - 1;

  unlocked := u.status = 'available' and (
    u.number = 1
    or prev.id is null
    or exists (select 1 from public.unit_progress p where p.user_id = uid and p.unit_id = prev.id and p.boss_cleared_at is not null)
  );

  for lesson_row in
    select ul.position, l.id, l.title, l.title_vi, l.category_id,
           exists (select 1 from public.lesson_attempts a where a.user_id = uid and a.lesson_id = l.id and a.completed_at is not null) as done,
           (select count(*) from public.lesson_questions q where q.lesson_id = l.id) as question_count
    from public.unit_lessons ul
    join public.lessons l on l.id = ul.lesson_id
    where ul.unit_id = target_unit
    order by ul.position
  loop
    lesson_total := lesson_total + 1;
    if lesson_row.done then lesson_done := lesson_done + 1; end if;
    nodes := nodes || jsonb_build_object(
      'kind', 'lesson', 'lessonId', lesson_row.id, 'title', lesson_row.title, 'titleVi', lesson_row.title_vi,
      'category', lesson_row.category_id, 'questionCount', lesson_row.question_count,
      'completed', lesson_row.done, 'unlocked', unlocked and (previous_done or lesson_row.done));
    previous_done := lesson_row.done;
    all_lessons_done := all_lessons_done and lesson_row.done;
  end loop;

  if u.status = 'available' then
    nodes := nodes || jsonb_build_object('kind', 'review', 'title', 'Unit Review', 'titleVi', 'Ôn tập unit',
      'completed', prog.review_completed_at is not null, 'unlocked', unlocked and all_lessons_done);
    nodes := nodes || jsonb_build_object('kind', 'boss', 'title', coalesce(u.boss_name, 'Guardian'), 'titleVi', 'Thử thách Boss',
      'completed', prog.boss_cleared_at is not null,
      'unlocked', unlocked and all_lessons_done and prog.review_completed_at is not null);
  end if;

  return jsonb_build_object(
    'id', u.id, 'number', u.number, 'title', u.title, 'titleVi', u.title_vi, 'description', u.description,
    'location', u.location, 'status', u.status, 'bossName', u.boss_name, 'rewardItemId', u.reward_item_id,
    'unlocked', unlocked, 'stars', coalesce(prog.stars, 0), 'bossBestPct', coalesce(prog.boss_best_pct, 0),
    'bossCleared', prog.boss_cleared_at is not null, 'reviewDone', prog.review_completed_at is not null,
    'lessonsTotal', lesson_total, 'lessonsDone', lesson_done, 'nodes', nodes);
end;
$$;

create or replace function public.get_learning_universe()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'name', s.name, 'nameVi', s.name_vi, 'description', s.description, 'descriptionVi', s.description_vi,
    'status', s.status, 'language', s.language,
    'currentLevel', public.subject_level_for(auth.uid(), s.id),
    'levels', (select coalesce(jsonb_agg(jsonb_build_object('level', sl.level, 'title', sl.title, 'titleVi', sl.title_vi,
                 'lessonTarget', sl.lesson_target,
                 'availableUnits', (select count(*) from public.learning_units u where u.subject_id = s.id and u.level = sl.level and u.status = 'available'))
                 order by sl.sort_order), '[]'::jsonb) from public.subject_levels sl where sl.subject_id = s.id),
    'lessonsTotal', (select count(*) from public.unit_lessons ul join public.learning_units u on u.id = ul.unit_id where u.subject_id = s.id and u.status = 'available'),
    'lessonsDone', (select count(*) from public.unit_lessons ul join public.learning_units u on u.id = ul.unit_id
                     where u.subject_id = s.id and u.status = 'available' and ul.lesson_id in (select lesson_id from public.completed_lessons(auth.uid()))),
    'stars', (select coalesce(sum(p.stars), 0) from public.unit_progress p join public.learning_units u on u.id = p.unit_id where p.user_id = auth.uid() and u.subject_id = s.id),
    'unitsCleared', (select count(*) from public.unit_progress p join public.learning_units u on u.id = p.unit_id where p.user_id = auth.uid() and u.subject_id = s.id and p.boss_cleared_at is not null),
    'placement', (select jsonb_build_object('recommendedLevel', r.recommended_level, 'correct', r.correct, 'total', r.total, 'at', r.created_at)
                  from public.placement_results r where r.user_id = auth.uid() and r.subject_id = s.id order by r.created_at desc limit 1)
  ) order by s.sort_order), '[]'::jsonb)
  from public.subjects s
$$;

create or replace function public.get_adventure_map(subject text, map_level text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  units jsonb := '[]'::jsonb;
  unit_id text;
  state jsonb;
  current_unit text;
  current_node int;
  idx int;
begin
  for unit_id in select id from public.learning_units where subject_id = subject and level = map_level order by number loop
    state := public.unit_state(uid, unit_id);
    units := units || state;
    if current_unit is null and (state->>'unlocked')::boolean and not (state->>'bossCleared')::boolean then
      current_unit := unit_id;
      idx := 0;
      for i in 0 .. jsonb_array_length(state->'nodes') - 1 loop
        if not (state->'nodes'->i->>'completed')::boolean then
          current_node := i;
          exit;
        end if;
      end loop;
    end if;
  end loop;

  return jsonb_build_object(
    'subject', (select to_jsonb(s) from public.subjects s where s.id = subject),
    'level', (select to_jsonb(sl) from public.subject_levels sl where sl.subject_id = subject and sl.level = map_level),
    'units', units,
    'current', case when current_unit is not null then jsonb_build_object('unitId', current_unit, 'nodeIndex', coalesce(current_node, 0)) end
  );
end;
$$;

create or replace function public.start_unit_challenge(target_unit text, mode text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  u public.learning_units;
  state jsonb;
  boss_node jsonb;
  review_node jsonb;
  picked text[];
  wanted int;
  session_id uuid;
begin
  if mode not in ('review', 'boss') then
    raise exception 'invalid_mode' using errcode = '22023';
  end if;
  select * into u from public.learning_units where id = target_unit;
  if u.id is null or u.status <> 'available' then
    raise exception 'unit_not_available' using errcode = 'P0001';
  end if;
  state := public.unit_state(uid, target_unit);
  select n into review_node from jsonb_array_elements(state->'nodes') n where n->>'kind' = 'review';
  select n into boss_node from jsonb_array_elements(state->'nodes') n where n->>'kind' = 'boss';
  if mode = 'review' and not (review_node->>'unlocked')::boolean then
    raise exception 'finish_unit_lessons_first' using errcode = 'P0001';
  end if;
  if mode = 'boss' and not (boss_node->>'unlocked')::boolean then
    raise exception 'boss_locked' using errcode = 'P0001';
  end if;

  wanted := case when mode = 'boss' then coalesce(u.boss_questions, 8) else 8 end;
  select array_agg(id) into picked from (
    select q.id
    from public.unit_lessons ul
    join public.lesson_questions q on q.lesson_id = ul.lesson_id
    left join public.review_progress r on r.user_id = uid and r.question_id = q.id
    where ul.unit_id = target_unit
    order by case when mode = 'review' then (coalesce(r.incorrect_count, 0) - coalesce(r.correct_count, 0)) else 0 end desc,
             case when mode = 'review' then (r.next_review_at is not null and r.next_review_at <= now()) else false end desc,
             random()
    limit wanted
  ) s;

  insert into public.game_sessions (user_id, kind, question_ids, unit_id, subject_id)
  values (uid, (case when mode = 'boss' then 'boss' else 'unit_review' end)::public.game_kind, picked, target_unit, u.subject_id)
  returning id into session_id;

  return jsonb_build_object(
    'sessionId', session_id,
    'unit', jsonb_build_object('id', u.id, 'title', u.title, 'titleVi', u.title_vi, 'bossName', u.boss_name, 'location', u.location, 'subjectId', u.subject_id, 'level', u.level),
    'questions', (select jsonb_agg(to_jsonb(c) order by array_position(picked, c.id)) from public.question_cards c where c.id = any (picked))
  );
end;
$$;

create or replace function public.finish_unit_challenge(game_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  session public.game_sessions;
  u public.learning_units;
  prog public.unit_progress;
  total int;
  first_try int;
  pct int;
  earned_stars smallint := 0;
  first_clear boolean := false;
  reward_xp int;
  reward_coins int;
  award jsonb;
  cid uuid := (select couple_id from public.couple_members where user_id = uid);
begin
  select * into session from public.game_sessions where id = game_session and user_id = uid for update;
  if session.id is null or session.kind not in ('boss', 'unit_review') then
    raise exception 'invalid_game_session' using errcode = 'P0001';
  end if;
  if session.completed_at is not null then
    raise exception 'already_completed' using errcode = 'P0001';
  end if;
  select * into u from public.learning_units where id = session.unit_id;

  total := array_length(session.question_ids, 1);
  select count(*) filter (where attempt_no = 1 and is_correct) into first_try
  from public.question_attempts where game_session_id = session.id;
  if (select count(distinct question_id) from public.question_attempts where game_session_id = session.id) < total then
    raise exception 'challenge_incomplete' using errcode = 'P0001';
  end if;
  pct := (100 * first_try) / greatest(total, 1);

  insert into public.unit_progress (user_id, unit_id) values (uid, u.id) on conflict do nothing;
  select * into prog from public.unit_progress where user_id = uid and unit_id = u.id for update;

  if session.kind = 'unit_review' then
    reward_xp := case when prog.review_completed_at is null then 5 * first_try + 10 else 2 * first_try end;
    reward_coins := case when prog.review_completed_at is null then 5 else 0 end;
    update public.unit_progress set review_completed_at = coalesce(review_completed_at, now()), updated_at = now()
      where user_id = uid and unit_id = u.id;
    perform public.emit_event(uid, 'unit_review_done', u.subject_id, 1);
  else
    earned_stars := case when pct >= 100 then 3 when pct >= 90 then 2 when pct >= 80 then 1 else 0 end;
    first_clear := earned_stars > 0 and prog.boss_cleared_at is null;
    if first_clear then
      reward_xp := 40 + 10 * first_try;
      reward_coins := 30 + 10 * earned_stars;
    elsif earned_stars > prog.stars then
      reward_xp := 5 * first_try;
      reward_coins := 10 * (earned_stars - prog.stars);
    else
      reward_xp := 5 * first_try;
      reward_coins := 0;
    end if;
    update public.unit_progress
      set boss_attempts = boss_attempts + 1,
          boss_best_pct = greatest(boss_best_pct, pct),
          stars = greatest(stars, earned_stars),
          boss_cleared_at = case when earned_stars > 0 then coalesce(boss_cleared_at, now()) else boss_cleared_at end,
          updated_at = now()
      where user_id = uid and unit_id = u.id;
    perform public.emit_event(uid, 'boss_attempted', u.subject_id, 1);
    if first_clear then
      perform public.emit_event(uid, 'unit_completed', u.subject_id, 1);
      perform public.unlock_user_achievement(uid, 'first_boss_clear');
      if u.reward_item_id is not null then
        insert into public.inventories (user_id, couple_id, item_id, source) values (uid, cid, u.reward_item_id, 'achievement');
      end if;
      if cid is not null then
        insert into public.memories (couple_id, kind, title, body, created_by, meta)
        values (cid, 'achievement', 'Defeated ' || coalesce(u.boss_name, 'the guardian'),
                (select display_name from public.profiles where id = uid) || ' cleared ' || u.title || ' (' || u.level || ') with ' || earned_stars || ' star' || case when earned_stars = 1 then '' else 's' end || '.',
                uid, jsonb_build_object('unit', u.id, 'stars', earned_stars));
      end if;
    end if;
  end if;

  update public.game_sessions set completed_at = now(), won = (session.kind = 'unit_review' or earned_stars > 0),
    correct_count = first_try, xp_awarded = reward_xp, coins_awarded = reward_coins
  where id = session.id;

  award := public.grant_reward(uid, reward_xp, reward_coins, session.kind::text, session.id::text);
  perform public.record_qualifying_activity(uid);
  perform public.check_user_achievements(uid);

  return award || jsonb_build_object(
    'mode', session.kind, 'correct', first_try, 'total', total, 'pct', pct, 'stars', earned_stars,
    'bestStars', greatest(prog.stars, earned_stars), 'firstClear', first_clear, 'rewardItemId', case when first_clear then u.reward_item_id end
  );
end;
$$;

create or replace function public.start_placement(subject text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  lang text := (select language from public.subjects where id = subject);
  picked text[];
  session_id uuid;
begin
  if lang is null then
    raise exception 'placement_not_available' using errcode = 'P0001';
  end if;
  select array_agg(id order by rank_order, rnd) into picked from (
    select q.id, public.level_rank(q.level) as rank_order, random() as rnd,
           row_number() over (partition by q.level order by random()) as n
    from public.lesson_questions q
    join public.lessons l on l.id = q.lesson_id
    where l.subject_id = subject and q.kind in ('multiple_choice', 'listening') and l.category_id in ('vocabulary', 'grammar', 'listening')
  ) s
  where n <= 3;

  insert into public.game_sessions (user_id, kind, question_ids, subject_id)
  values (uid, 'placement', picked, subject)
  returning id into session_id;

  return jsonb_build_object(
    'sessionId', session_id,
    'questions', (select jsonb_agg(to_jsonb(c) order by array_position(picked, c.id)) from public.question_cards c where c.id = any (picked))
  );
end;
$$;

create or replace function public.finish_placement(game_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  session public.game_sessions;
  by_level jsonb;
  recommended text;
  level_row record;
  correct_total int;
begin
  select * into session from public.game_sessions where id = game_session and user_id = uid and kind = 'placement' for update;
  if session.id is null or session.completed_at is not null then
    raise exception 'invalid_game_session' using errcode = 'P0001';
  end if;

  select jsonb_object_agg(level, jsonb_build_object('correct', correct, 'total', total)) into by_level
  from (
    select q.level, count(*) as total,
           count(*) filter (where exists (select 1 from public.question_attempts a where a.game_session_id = session.id and a.question_id = q.id and a.attempt_no = 1 and a.is_correct)) as correct
    from public.lesson_questions q where q.id = any (session.question_ids)
    group by q.level
  ) t;

  for level_row in
    select key as level, (value->>'correct')::int as correct, (value->>'total')::int as total
    from jsonb_each(by_level) order by public.level_rank(key)
  loop
    if recommended is null then recommended := level_row.level; end if;
    exit when level_row.correct * 3 < level_row.total * 2;
    recommended := (
      select l2 from (select key as l2 from jsonb_each(by_level) where public.level_rank(key) > public.level_rank(level_row.level) order by public.level_rank(key) limit 1) x
    );
    exit when recommended is null;
  end loop;
  if recommended is null then
    recommended := (select key from jsonb_each(by_level) order by public.level_rank(key) desc limit 1);
  end if;

  select count(*) filter (where attempt_no = 1 and is_correct) into correct_total from public.question_attempts where game_session_id = session.id;
  update public.game_sessions set completed_at = now(), correct_count = correct_total where id = session.id;
  insert into public.placement_results (user_id, subject_id, session_id, recommended_level, correct, total, score_by_level)
  values (uid, session.subject_id, session.id, recommended, correct_total, array_length(session.question_ids, 1), by_level);

  return jsonb_build_object('recommendedLevel', recommended, 'correct', correct_total, 'total', array_length(session.question_ids, 1), 'byLevel', by_level);
end;
$$;

create or replace function public.get_couple_adventures()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  cid uuid := public.require_couple();
  my_slot int := (select slot from public.couple_members where user_id = auth.uid());
begin
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.title, 'titleVi', a.title_vi, 'story', a.story, 'storyVi', a.story_vi,
      'coupleXp', a.couple_xp, 'loveEnergy', a.love_energy, 'rewardItemId', a.reward_item_id,
      'parts', a.parts, 'mySlot', my_slot,
      'progress', coalesce(p.parts, '{}'::jsonb),
      'completed', p.completed_at is not null,
      'letter', case when p.completed_at is not null then a.letter end,
      'letterVi', case when p.completed_at is not null then a.letter_vi end
    ) order by a.sort_order), '[]'::jsonb)
    from public.couple_adventures a
    left join public.couple_adventure_progress p on p.couple_id = cid and p.adventure_id = a.id
  );
end;
$$;

create or replace function public.start_adventure_part(adventure text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  cid uuid := public.require_couple();
  adv public.couple_adventures;
  my_slot int := (select slot from public.couple_members where user_id = uid);
  part jsonb;
  lang text := (select learning_language from public.profiles where id = uid);
  learner record;
  picked text[];
  session_id uuid;
begin
  select * into adv from public.couple_adventures where id = adventure;
  if adv.id is null then
    raise exception 'adventure_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.couple_adventure_progress where couple_id = cid and adventure_id = adventure and completed_at is not null) then
    raise exception 'adventure_completed' using errcode = 'P0001';
  end if;
  select p into part from jsonb_array_elements(adv.parts) p where (p->>'slot')::int = my_slot;
  select * into learner from public.learner_level(uid);

  select array_agg(id) into picked from (
    select q.id
    from public.lesson_questions q
    join public.lessons l on l.id = q.lesson_id
    where l.language = lang and l.category_id = part->>'category' and q.kind in ('multiple_choice', 'listening')
      and public.level_rank(q.level) <= greatest(learner.rank, 1)
    order by random()
    limit 5
  ) s;
  if coalesce(array_length(picked, 1), 0) < 5 then
    raise exception 'no_content' using errcode = 'P0002';
  end if;

  insert into public.game_sessions (user_id, kind, question_ids, adventure_id)
  values (uid, 'adventure', picked, adventure)
  returning id into session_id;

  return jsonb_build_object(
    'sessionId', session_id,
    'part', part,
    'questions', (select jsonb_agg(to_jsonb(c) order by array_position(picked, c.id)) from public.question_cards c where c.id = any (picked))
  );
end;
$$;

create or replace function public.finish_adventure_part(game_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  cid uuid := public.require_couple();
  session public.game_sessions;
  adv public.couple_adventures;
  first_try int;
  passed boolean;
  progress_row public.couple_adventure_progress;
  member uuid;
  completed_now boolean := false;
  award jsonb;
begin
  select * into session from public.game_sessions where id = game_session and user_id = uid and kind = 'adventure' for update;
  if session.id is null or session.completed_at is not null then
    raise exception 'invalid_game_session' using errcode = 'P0001';
  end if;
  if (select count(distinct question_id) from public.question_attempts where game_session_id = session.id) < array_length(session.question_ids, 1) then
    raise exception 'challenge_incomplete' using errcode = 'P0001';
  end if;
  select * into adv from public.couple_adventures where id = session.adventure_id;
  select count(*) filter (where attempt_no = 1 and is_correct) into first_try from public.question_attempts where game_session_id = session.id;
  passed := first_try * 5 >= array_length(session.question_ids, 1) * 3;

  update public.game_sessions set completed_at = now(), won = passed, correct_count = first_try where id = session.id;

  insert into public.couple_adventure_progress (couple_id, adventure_id) values (cid, adv.id) on conflict do nothing;
  select * into progress_row from public.couple_adventure_progress where couple_id = cid and adventure_id = adv.id for update;

  if passed and progress_row.parts->uid::text is null then
    progress_row.parts := progress_row.parts || jsonb_build_object(uid::text, jsonb_build_object('correct', first_try, 'at', now()));
    update public.couple_adventure_progress set parts = progress_row.parts where couple_id = cid and adventure_id = adv.id;
    award := public.grant_reward(uid, 10 * first_try, 10, 'adventure', session.id::text);
  else
    award := public.grant_reward(uid, 2 * first_try, 0, 'adventure', session.id::text);
  end if;

  if progress_row.completed_at is null
     and (select count(*) from public.couple_members m where m.couple_id = cid and progress_row.parts ? m.user_id::text) = 2 then
    update public.couple_adventure_progress set completed_at = now() where couple_id = cid and adventure_id = adv.id;
    completed_now := true;
    perform public.add_couple_progress(cid, adv.couple_xp, adv.love_energy, 'a couple adventure');
    perform public.add_ranking_points(cid, null, adv.couple_xp, 'couple_quest', 'adventure:' || adv.id);
    if adv.reward_item_id is not null then
      insert into public.inventories (user_id, couple_id, item_id, source)
      values ((select user_id from public.couple_members where couple_id = cid order by slot limit 1), cid, adv.reward_item_id, 'achievement');
    end if;
    insert into public.memories (couple_id, kind, title, body, meta)
    values (cid, 'quest', adv.title, adv.letter, jsonb_build_object('adventure', adv.id));
    perform public.unlock_couple_achievement(cid, 'adventure_' || adv.id);
  end if;

  perform public.record_qualifying_activity(uid);
  return award || jsonb_build_object('passed', passed, 'correct', first_try, 'total', array_length(session.question_ids, 1), 'adventureCompleted', completed_now);
end;
$$;

create or replace function public.on_world_lesson_completed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  subject text;
begin
  if new.completed_at is not null and old.completed_at is null then
    select subject_id into subject from public.lessons where id = new.lesson_id;
    if subject not in ('english', 'chinese') then
      perform public.emit_event(new.user_id, 'world_lesson', subject, 1);
    end if;
  end if;
  return new;
end;
$$;

create trigger lesson_attempts_world_events
  after update on public.lesson_attempts
  for each row execute function public.on_world_lesson_completed();

create or replace function public.on_learning_transaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.xp > 0 and new.reason in ('lesson', 'daily_quest', 'word_battle', 'sentence_puzzle', 'boss', 'unit_review', 'adventure') then
    perform public.add_ranking_points(
      (select couple_id from public.couple_members where user_id = new.user_id),
      new.user_id, new.xp, 'learning', new.reason || ':' || new.ref_id || ':' || new.user_id);
  end if;
  return new;
end;
$$;

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
  )
  select id, slot, title, title_vi, event, category, target, xp_reward, coin_reward
  from numbered
  where idx = ((target_day - date '2024-01-01') + ascii(slot)) % slot_size
  order by array_position(array['learn', 'lesson', 'review', 'play', 'explore'], slot)
$$;

alter table public.subjects enable row level security;
alter table public.subject_levels enable row level security;
alter table public.learning_units enable row level security;
alter table public.unit_lessons enable row level security;
alter table public.unit_progress enable row level security;
alter table public.placement_results enable row level security;
alter table public.couple_adventures enable row level security;
alter table public.couple_adventure_progress enable row level security;

create policy "catalog" on public.subjects for select to authenticated using (true);
create policy "catalog" on public.subject_levels for select to authenticated using (true);
create policy "catalog" on public.learning_units for select to authenticated using (true);
create policy "catalog" on public.unit_lessons for select to authenticated using (true);
create policy "catalog" on public.couple_adventures for select to authenticated using (true);
create policy "own unit progress" on public.unit_progress for select to authenticated using (user_id = auth.uid());
create policy "own placement" on public.placement_results for select to authenticated using (user_id = auth.uid());
create policy "couple adventure progress" on public.couple_adventure_progress for select to authenticated using (public.is_couple_member(couple_id));

revoke all on public.subjects, public.subject_levels, public.learning_units, public.unit_lessons, public.unit_progress,
  public.placement_results, public.couple_adventures, public.couple_adventure_progress from anon, authenticated;
grant select on public.subjects, public.subject_levels, public.learning_units, public.unit_lessons, public.unit_progress,
  public.placement_results, public.couple_adventures, public.couple_adventure_progress to authenticated;

revoke execute on function public.unit_state(uuid, text), public.completed_lessons(uuid), public.subject_level_for(uuid, text),
  public.on_world_lesson_completed() from anon, public, authenticated;
revoke execute on function public.get_review_queue(int), public.get_learning_universe(), public.get_adventure_map(text, text),
  public.start_unit_challenge(text, text), public.finish_unit_challenge(uuid), public.start_placement(text), public.finish_placement(uuid),
  public.get_couple_adventures(), public.start_adventure_part(text), public.finish_adventure_part(uuid) from anon, public;
grant execute on function public.get_review_queue(int), public.get_learning_universe(), public.get_adventure_map(text, text),
  public.start_unit_challenge(text, text), public.finish_unit_challenge(uuid), public.start_placement(text), public.finish_placement(uuid),
  public.get_couple_adventures(), public.start_adventure_part(text), public.finish_adventure_part(uuid) to authenticated;
