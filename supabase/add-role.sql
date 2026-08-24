-- 학생/교사 구분. Supabase SQL Editor에서 실행하세요.

alter table public.profiles
  add column if not exists role text not null default 'teacher';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('teacher', 'student'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_name text;
  v_role text;
begin
  v_username := lower(trim(coalesce(nullif(new.raw_user_meta_data->>'username', ''), '')));
  if v_username !~ '^[a-z0-9_]{4,20}$' then
    v_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  v_name := trim(coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), '사용자'));
  if char_length(v_name) < 2 or char_length(v_name) > 20 then
    v_name := '사용자';
  end if;
  v_role := lower(trim(coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'teacher')));
  if v_role not in ('teacher', 'student') then
    v_role := 'teacher';
  end if;

  insert into public.profiles (id, username, full_name, role)
  values (new.id, v_username, v_name, v_role)
  on conflict (id) do update
    set role = excluded.role
    where public.profiles.role is distinct from excluded.role;
  return new;
exception
  when others then
    begin
      insert into public.profiles (id, username, full_name)
      values (new.id, 'user_' || substr(replace(new.id::text, '-', ''), 1, 8), '사용자')
      on conflict (id) do nothing;
    exception
      when others then
        null;
    end;
    return new;
end;
$$;
