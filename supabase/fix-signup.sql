-- 회원가입/아이디 로그인/학급 저장 패치. SQL Editor에서 이 파일 전체를 실행하세요.

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.class_configs to authenticated;
grant select, insert, update, delete on table public.answer_keys to authenticated;
grant select, insert, update, delete on table public.exam_assets to authenticated;
grant select, insert, update, delete on table public.omr_codes to authenticated;
grant select, insert, update, delete on table public.submissions to authenticated;

alter table public.answer_keys add column if not exists grade_cuts smallint[];

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

create or replace function public.save_class_configs(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  insert into public.profiles (id, username, full_name)
  values (
    v_uid,
    'user_' || substr(replace(v_uid::text, '-', ''), 1, 8),
    '교사'
  )
  on conflict (id) do nothing;

  delete from public.class_configs where teacher_id = v_uid;

  insert into public.class_configs (teacher_id, grade, class_number, student_count)
  select
    v_uid,
    (elem->>'grade')::smallint,
    (elem->>'class_number')::smallint,
    (elem->>'student_count')::smallint
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as elem
  where (elem->>'grade')::int between 1 and 3
    and (elem->>'class_number')::int between 1 and 15
    and (elem->>'student_count')::int between 1 and 40;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.save_class_configs(jsonb) from public;
grant execute on function public.save_class_configs(jsonb) to authenticated;

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());
