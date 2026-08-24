create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    lower(trim(coalesce(nullif(new.raw_user_meta_data->>'username', ''), 'user_' || substr(new.id::text, 1, 8)))),
    trim(coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), '교사'))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
