alter table public.profiles
  add column learning_language text not null default 'en' check (learning_language in ('en', 'zh')),
  add column chinese_level smallint not null default 1 check (chinese_level between 1 and 9);

grant update (learning_language, chinese_level) on public.profiles to authenticated;

drop function public.get_review_queue(int);
drop view public.question_cards;

alter table public.lessons
  add column language text not null default 'en' check (language in ('en', 'zh'));
alter table public.lessons alter column level type text using level::text;
alter table public.lesson_questions alter column level type text using level::text;

create or replace function public.level_rank(level text)
returns smallint
language sql
immutable
as $$
  select case
    when level like 'HSK%' then substring(level from 4)::smallint
    else array_position(array['A1', 'A2', 'B1', 'B2', 'C1'], level)::smallint
  end
$$;

alter table public.lessons
  add constraint lessons_level_matches_language check (
    (language = 'zh' and level ~ '^HSK[1-9]$') or (language = 'en' and level in ('A1', 'A2', 'B1', 'B2', 'C1'))
  );
alter table public.lesson_questions
  add constraint lesson_questions_level_valid check (level ~ '^(HSK[1-9]|A1|A2|B1|B2|C1)$');

create index lessons_language_idx on public.lessons (language, category_id);

create view public.question_cards as
select q.id, q.lesson_id, q.position, q.kind, q.level, q.objective, q.prompt, q.prompt_vi,
       q.options, q.tokens, q.audio_text, q.hint, q.hint_vi, l.category_id, l.language
from public.lesson_questions q
join public.lessons l on l.id = q.lesson_id;

revoke all on public.question_cards from anon, authenticated;
grant select on public.question_cards to authenticated;

create or replace function public.learner_level(uid uuid)
returns table (language text, rank smallint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.learning_language,
         case when p.learning_language = 'zh' then p.chinese_level else public.level_rank(p.english_level::text) end
  from public.profiles p
  where p.id = uid
$$;

create or replace function public.start_game(game public.game_kind)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_user();
  learner record;
  picked text[];
  session_id uuid;
begin
  select * into learner from public.learner_level(uid);

  if game = 'word_battle' then
    select array_agg(id) into picked from (
      select q.id
      from public.lesson_questions q
      join public.lessons l on l.id = q.lesson_id
      left join public.review_progress r on r.user_id = uid and r.question_id = q.id
      where l.language = learner.language
        and l.category_id = 'vocabulary'
        and q.kind = 'multiple_choice'
        and public.level_rank(q.level) <= greatest(learner.rank, 2)
      order by (r.next_review_at is not null and r.next_review_at <= now()) desc, random()
      limit 8
    ) s;
  else
    select array_agg(id) into picked from (
      select q.id
      from public.lesson_questions q
      join public.lessons l on l.id = q.lesson_id
      where l.language = learner.language
        and q.kind = 'sentence_order'
        and public.level_rank(q.level) <= greatest(learner.rank, 2)
      order by random()
      limit 5
    ) s;
  end if;

  if coalesce(array_length(picked, 1), 0) = 0 then
    raise exception 'no_content' using errcode = 'P0002';
  end if;

  insert into public.game_sessions (user_id, kind, question_ids) values (uid, game, picked) returning id into session_id;

  return jsonb_build_object(
    'sessionId', session_id,
    'questions', (
      select jsonb_agg(to_jsonb(c) order by array_position(picked, c.id))
      from public.question_cards c where c.id = any (picked)
    )
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
    and c.language = (select learning_language from public.profiles where id = auth.uid())
    and (r.next_review_at <= now() or r.incorrect_count > r.correct_count)
  order by (r.next_review_at <= now()) desc, r.incorrect_count - r.correct_count desc, r.next_review_at asc
  limit least(greatest(max_items, 1), 30)
$$;

drop function public.get_word_bank();
create function public.get_word_bank()
returns table (question_id text, word jsonb, box smallint, next_review_at timestamptz, correct_count int, incorrect_count int, language text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.question_id, q.word, r.box, r.next_review_at, r.correct_count, r.incorrect_count, l.language
  from public.review_progress r
  join public.lesson_questions q on q.id = r.question_id
  join public.lessons l on l.id = q.lesson_id
  where r.user_id = auth.uid()
    and q.word is not null
    and r.first_learned_at is not null
    and l.language = (select learning_language from public.profiles where id = auth.uid())
  order by r.last_reviewed_at desc
$$;

revoke execute on function public.get_review_queue(int), public.get_word_bank(), public.learner_level(uuid), public.level_rank(text) from anon, public;
grant execute on function public.get_review_queue(int), public.get_word_bank(), public.level_rank(text) to authenticated;
revoke execute on function public.learner_level(uuid) from authenticated;
