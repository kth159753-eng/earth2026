-- 회원가입/아이디 로그인 패치. SQL Editor에서 이 파일 전체를 실행하세요.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_name text;
begin
  v_username := lower(trim(coalesce(nullif(new.raw_user_meta_data->>'username', ''), '')));
  if v_username !~ '^[a-z0-9_]{4,20}$' then
    v_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  v_name := trim(coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), '교사'));
  if char_length(v_name) < 2 or char_length(v_name) > 20 then
    v_name := '교사';
  end if;

  insert into public.profiles (id, username, full_name)
  values (new.id, v_username, v_name)
  on conflict (id) do nothing;
  return new;
exception
  when others then
    begin
      insert into public.profiles (id, username, full_name)
      values (new.id, 'user_' || substr(replace(new.id::text, '-', ''), 1, 8), '교사')
      on conflict (id) do nothing;
    exception
      when others then
        null;
    end;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.teacher_login_email(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username = lower(trim(p_username))
  limit 1
$$;

revoke all on function public.teacher_login_email(text) from public;
grant execute on function public.teacher_login_email(text) to anon, authenticated;

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());
