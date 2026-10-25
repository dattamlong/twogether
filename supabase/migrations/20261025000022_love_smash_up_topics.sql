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
  if auth.uid() is null or topic !~ '^love-smash:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(:up:[0-3])?$' then
    return false;
  end if;
  rid := substring(topic from 12 for 36)::uuid;
  return exists (
    select 1 from public.love_smash_room_members m join public.love_smash_rooms r on r.id = m.room_id
    where m.room_id = rid and m.user_id = auth.uid() and m.status = 'joined' and r.status in ('lobby', 'playing', 'finished')
  );
end;
$$;
