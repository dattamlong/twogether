create or replace function public.my_active_love_smash_room()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.love_smash_room_json(r.id)
  from public.love_smash_rooms r
  join public.love_smash_room_members m on m.room_id = r.id
  where m.user_id = auth.uid() and m.status = 'joined'
    and r.status in ('lobby', 'playing')
    and r.updated_at > now() - interval '2 hours'
  order by r.updated_at desc
  limit 1
$$;

revoke execute on function public.my_active_love_smash_room() from anon, public;
grant execute on function public.my_active_love_smash_room() to authenticated;
