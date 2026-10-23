create table public.learning_categories (
  id text primary key,
  name text not null,
  name_vi text not null,
  description text not null,
  sort_order int not null
);

create table public.lessons (
  id text primary key,
  category_id text not null references public.learning_categories (id),
  level public.cefr_level not null,
  topic text not null,
  title text not null,
  title_vi text not null,
  objectives text[] not null,
  sort_order int not null
);
create index lessons_category_level_idx on public.lessons (category_id, level);

create type public.question_kind as enum ('multiple_choice', 'sentence_order', 'listening');

create table public.lesson_questions (
  id text primary key,
  lesson_id text not null references public.lessons (id) on delete cascade,
  position int not null,
  kind public.question_kind not null,
  level public.cefr_level not null,
  objective text not null,
  prompt text not null,
  prompt_vi text,
  options jsonb,
  tokens jsonb,
  audio_text text,
  hint text,
  hint_vi text,
  word_term text,
  answers jsonb not null check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) >= 1),
  explanation text not null,
  explanation_vi text not null,
  word jsonb,
  unique (lesson_id, position)
);
create index lesson_questions_lesson_idx on public.lesson_questions (lesson_id);

create view public.question_cards as
select q.id, q.lesson_id, q.position, q.kind, q.level, q.objective, q.prompt, q.prompt_vi,
       q.options, q.tokens, q.audio_text, q.hint, q.hint_vi, l.category_id
from public.lesson_questions q
join public.lessons l on l.id = q.lesson_id;

create table public.lesson_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null references public.lessons (id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  correct_count int,
  total_count int,
  xp_awarded int not null default 0,
  coins_awarded int not null default 0
);
create index lesson_attempts_user_idx on public.lesson_attempts (user_id, lesson_id, completed_at);

create type public.game_kind as enum ('word_battle', 'sentence_puzzle');

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.game_kind not null,
  question_ids text[] not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  won boolean,
  correct_count int,
  xp_awarded int not null default 0,
  coins_awarded int not null default 0
);
create index game_sessions_user_idx on public.game_sessions (user_id, started_at desc);

create type public.answer_source as enum ('lesson', 'review', 'word_battle', 'sentence_puzzle');

create table public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null references public.lesson_questions (id),
  source public.answer_source not null,
  lesson_attempt_id uuid references public.lesson_attempts (id) on delete cascade,
  game_session_id uuid references public.game_sessions (id) on delete cascade,
  attempt_no int not null default 1,
  answer text not null,
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(lesson_attempt_id, game_session_id) <= 1)
);
create index question_attempts_user_idx on public.question_attempts (user_id, created_at desc);
create index question_attempts_lesson_idx on public.question_attempts (lesson_attempt_id, question_id);
create index question_attempts_game_idx on public.question_attempts (game_session_id, question_id);

create table public.review_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null references public.lesson_questions (id) on delete cascade,
  box smallint not null default 0 check (box between 0 and 5),
  correct_count int not null default 0,
  incorrect_count int not null default 0,
  review_count int not null default 0,
  last_reviewed_at timestamptz not null default now(),
  next_review_at timestamptz not null default now(),
  first_learned_at timestamptz,
  primary key (user_id, question_id)
);
create index review_progress_due_idx on public.review_progress (user_id, next_review_at);

create or replace function public.srs_interval(box smallint)
returns interval
language sql
immutable
as $$
  select case box
    when 0 then interval '10 minutes'
    when 1 then interval '1 day'
    when 2 then interval '3 days'
    when 3 then interval '7 days'
    when 4 then interval '14 days'
    else interval '30 days'
  end
$$;

create or replace function public.normalize_answer(raw text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(coalesce(raw, '')), '\s+', ' ', 'g'))
$$;

create or replace function public.update_review_progress(uid uuid, qid text, correct boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_row public.review_progress;
  new_box smallint;
  newly_learned boolean := false;
begin
  select * into current_row from public.review_progress where user_id = uid and question_id = qid for update;

  if current_row.user_id is null then
    new_box := case when correct then 1 else 0 end;
    insert into public.review_progress
      (user_id, question_id, box, correct_count, incorrect_count, review_count, last_reviewed_at, next_review_at, first_learned_at)
    values
      (uid, qid, new_box, case when correct then 1 else 0 end, case when correct then 0 else 1 end, 1, now(),
       now() + public.srs_interval(new_box), case when correct then now() end);
    return correct;
  end if;

  new_box := case when correct then least(current_row.box + 1, 5) else 0 end;
  newly_learned := correct and current_row.first_learned_at is null;

  update public.review_progress
  set box = new_box,
      correct_count = correct_count + case when correct then 1 else 0 end,
      incorrect_count = incorrect_count + case when correct then 0 else 1 end,
      review_count = review_count + 1,
      last_reviewed_at = now(),
      next_review_at = now() + public.srs_interval(new_box),
      first_learned_at = coalesce(first_learned_at, case when correct then now() end)
  where user_id = uid and question_id = qid;

  return newly_learned;
end;
$$;

create or replace function public.start_lesson(target_lesson text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  attempt_id uuid;
begin
  if not exists (select 1 from public.lessons where id = target_lesson) then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;
  insert into public.lesson_attempts (user_id, lesson_id) values (uid, target_lesson) returning id into attempt_id;
  return attempt_id;
end;
$$;

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

  if previous_attempts = 0 then
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

create or replace function public.complete_lesson(lesson_attempt uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  attempt public.lesson_attempts;
  q_total int;
  q_answered int;
  first_try_correct int;
  is_first boolean;
  reward_xp int;
  reward_coins int;
  category text;
  award jsonb;
begin
  select * into attempt from public.lesson_attempts where id = lesson_attempt and user_id = uid for update;
  if attempt.id is null then
    raise exception 'invalid_lesson_attempt' using errcode = 'P0001';
  end if;
  if attempt.completed_at is not null then
    raise exception 'already_completed' using errcode = 'P0001';
  end if;

  select count(*) into q_total from public.lesson_questions where lesson_id = attempt.lesson_id;
  select count(distinct question_id) into q_answered from public.question_attempts where lesson_attempt_id = attempt.id;
  if q_answered < q_total then
    raise exception 'lesson_incomplete' using errcode = 'P0001';
  end if;

  select count(*) into first_try_correct from public.question_attempts
    where lesson_attempt_id = attempt.id and attempt_no = 1 and is_correct;

  is_first := not exists (
    select 1 from public.lesson_attempts
    where user_id = uid and lesson_id = attempt.lesson_id and completed_at is not null
  );

  reward_xp := 10 * first_try_correct + 20;
  if is_first then
    reward_coins := 10 + 2 * first_try_correct;
  else
    reward_xp := reward_xp / 2;
    reward_coins := 5;
  end if;

  update public.lesson_attempts
  set completed_at = now(), correct_count = first_try_correct, total_count = q_total,
      xp_awarded = reward_xp, coins_awarded = reward_coins
  where id = attempt.id;

  award := public.grant_reward(uid, reward_xp, reward_coins, 'lesson', attempt.id::text);

  update public.user_progress
  set lessons_completed = lessons_completed + case when is_first then 1 else 0 end
  where user_id = uid;

  select category_id into category from public.lessons where id = attempt.lesson_id;
  perform public.emit_event(uid, 'lesson_completed', category, 1);
  perform public.record_qualifying_activity(uid);
  perform public.check_user_achievements(uid);

  return award || jsonb_build_object(
    'correct', first_try_correct,
    'total', q_total,
    'firstCompletion', is_first
  );
end;
$$;

create or replace function public.get_review_queue(max_items int default 10)
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
    and (r.next_review_at <= now() or r.incorrect_count > r.correct_count)
  order by (r.next_review_at <= now()) desc, r.incorrect_count - r.correct_count desc, r.next_review_at asc
  limit least(greatest(max_items, 1), 30)
$$;

create or replace function public.get_word_bank()
returns table (question_id text, word jsonb, box smallint, next_review_at timestamptz, correct_count int, incorrect_count int)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.question_id, q.word, r.box, r.next_review_at, r.correct_count, r.incorrect_count
  from public.review_progress r
  join public.lesson_questions q on q.id = r.question_id
  where r.user_id = auth.uid() and q.word is not null and r.first_learned_at is not null
  order by r.last_reviewed_at desc
$$;

alter table public.learning_categories enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_questions enable row level security;
alter table public.lesson_attempts enable row level security;
alter table public.game_sessions enable row level security;
alter table public.question_attempts enable row level security;
alter table public.review_progress enable row level security;

create policy "content readable by signed-in users" on public.learning_categories for select to authenticated using (true);
create policy "content readable by signed-in users" on public.lessons for select to authenticated using (true);
create policy "own lesson attempts" on public.lesson_attempts for select to authenticated using (user_id = auth.uid());
create policy "own game sessions" on public.game_sessions for select to authenticated using (user_id = auth.uid());
create policy "own question attempts" on public.question_attempts for select to authenticated using (user_id = auth.uid());
create policy "own review progress" on public.review_progress for select to authenticated using (user_id = auth.uid());

revoke all on public.learning_categories, public.lessons, public.lesson_questions, public.question_cards,
  public.lesson_attempts, public.game_sessions, public.question_attempts, public.review_progress from anon, authenticated;
grant select on public.learning_categories, public.lessons, public.question_cards,
  public.lesson_attempts, public.game_sessions, public.question_attempts, public.review_progress to authenticated;
