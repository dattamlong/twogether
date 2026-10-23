alter table public.couple_public_profiles alter column is_public set default true;

insert into public.couple_public_profiles (couple_id, is_public)
select id, true from public.couples
on conflict (couple_id) do update set is_public = true, updated_at = now();

create or replace function public.on_couple_created_public()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.couple_public_profiles (couple_id, is_public) values (new.id, true)
  on conflict (couple_id) do update set is_public = true;
  return new;
end;
$$;

create trigger couples_public_on_create
  after insert on public.couples
  for each row execute function public.on_couple_created_public();

revoke execute on function public.on_couple_created_public() from anon, public, authenticated;
revoke execute on function public.set_legend_visibility(boolean) from anon, public, authenticated;
