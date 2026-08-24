-- EARTH 2026 classroom exam schema
-- Paste this file into the SQL Editor and run it.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 테이블
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  full_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{4,20}$'),
  constraint full_name_len check (char_length(full_name) between 2 and 20)
);

create unique index if not exists profiles_username_unique
  on public.profiles (username);

create table if not exists public.class_configs (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  grade smallint not null check (grade between 1 and 3),
  class_number smallint not null check (class_number between 1 and 15),
  student_count smallint not null check (student_count between 1 and 40),
  unique (teacher_id, grade, class_number)
);

create index if not exists class_configs_teacher_idx
  on public.class_configs (teacher_id);

create table if not exists public.answer_keys (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  session_id text not null,
  answers smallint[] not null,
  points smallint[] not null,
  updated_at timestamptz not null default now(),
  unique (teacher_id, session_id),
  constraint answer_len check (cardinality(answers) = 20),
  constraint points_len check (cardinality(points) = 20)
);

create table if not exists public.exam_assets (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  session_id text not null,
  paper_path text,
  solution_path text,
  updated_at timestamptz not null default now(),
  unique (teacher_id, session_id)
);

create table if not exists public.omr_codes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  session_id text not null,
  grade smallint not null check (grade between 1 and 3),
  class_number smallint not null check (class_number between 1 and 15),
  code text not null,
  created_at timestamptz not null default now(),
  unique (teacher_id, session_id, grade, class_number),
  unique (code)
);

create index if not exists omr_codes_teacher_session_idx
  on public.omr_codes (teacher_id, session_id);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  omr_code_id uuid not null references public.omr_codes (id) on delete cascade,
  student_number smallint not null check (student_number between 1 and 40),
  answers smallint[] not null,
  score numeric(5,1),
  wrong_questions smallint[],
  submitted_at timestamptz not null default now(),
  unique (omr_code_id, student_number),
  constraint submission_answer_len check (cardinality(answers) = 20)
);

create index if not exists submissions_omr_idx
  on public.submissions (omr_code_id);

-- ---------------------------------------------------------------------------
-- 가입 시 프로필 자동 생성 (이메일은 profiles에 복제하지 않음)
-- ---------------------------------------------------------------------------

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
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 공개 RPC
-- ---------------------------------------------------------------------------

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.profiles
    where username = lower(trim(p_username))
  );
$$;

create or replace function public.get_omr_meta(p_code text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
begin
  select json_build_object(
    'session_id', oc.session_id,
    'grade', oc.grade,
    'class_number', oc.class_number,
    'student_count', coalesce(cc.student_count, 40)
  )
  into result
  from public.omr_codes oc
  left join public.class_configs cc
    on cc.teacher_id = oc.teacher_id
   and cc.grade = oc.grade
   and cc.class_number = oc.class_number
  where oc.code = p_code;

  return result;
end;
$$;

create or replace function public.submit_omr(
  p_code text,
  p_student_number smallint,
  p_answers smallint[]
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_omr public.omr_codes%rowtype;
  v_count smallint;
  v_item smallint;
begin
  if p_student_number < 1 or p_student_number > 40 then
    raise exception 'INVALID_STUDENT';
  end if;

  if p_answers is null or cardinality(p_answers) <> 20 then
    raise exception 'INVALID_ANSWERS';
  end if;

  foreach v_item in array p_answers loop
    if v_item < 1 or v_item > 5 then
      raise exception 'INVALID_ANSWERS';
    end if;
  end loop;

  select * into v_omr
  from public.omr_codes
  where code = p_code;

  if not found then
    raise exception 'INVALID_CODE';
  end if;

  select student_count into v_count
  from public.class_configs
  where teacher_id = v_omr.teacher_id
    and grade = v_omr.grade
    and class_number = v_omr.class_number;

  if v_count is not null and p_student_number > v_count then
    raise exception 'INVALID_STUDENT';
  end if;

  insert into public.submissions (omr_code_id, student_number, answers, score, wrong_questions, submitted_at)
  values (v_omr.id, p_student_number, p_answers, null, null, now())
  on conflict (omr_code_id, student_number)
  do update set
    answers = excluded.answers,
    score = null,
    wrong_questions = null,
    submitted_at = now();

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.is_username_available(text) from public;
revoke all on function public.get_omr_meta(text) from public;
revoke all on function public.submit_omr(text, smallint, smallint[]) from public;

grant execute on function public.is_username_available(text) to anon, authenticated;
grant execute on function public.get_omr_meta(text) to anon, authenticated;
grant execute on function public.submit_omr(text, smallint, smallint[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS · 교사는 본인 데이터만, 학생은 RPC만
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.class_configs enable row level security;
alter table public.answer_keys enable row level security;
alter table public.exam_assets enable row level security;
alter table public.omr_codes enable row level security;
alter table public.submissions enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists class_configs_own on public.class_configs;
create policy class_configs_own on public.class_configs
  for all to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

drop policy if exists answer_keys_own on public.answer_keys;
create policy answer_keys_own on public.answer_keys
  for all to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

drop policy if exists exam_assets_own on public.exam_assets;
create policy exam_assets_own on public.exam_assets
  for all to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

drop policy if exists omr_codes_own on public.omr_codes;
create policy omr_codes_own on public.omr_codes
  for all to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

drop policy if exists submissions_teacher_select on public.submissions;
create policy submissions_teacher_select on public.submissions
  for select to authenticated
  using (
    exists (
      select 1
      from public.omr_codes
      where omr_codes.id = submissions.omr_code_id
        and omr_codes.teacher_id = auth.uid()
    )
  );

drop policy if exists submissions_teacher_update on public.submissions;
create policy submissions_teacher_update on public.submissions
  for update to authenticated
  using (
    exists (
      select 1
      from public.omr_codes
      where omr_codes.id = submissions.omr_code_id
        and omr_codes.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.omr_codes
      where omr_codes.id = submissions.omr_code_id
        and omr_codes.teacher_id = auth.uid()
    )
  );

drop policy if exists submissions_teacher_delete on public.submissions;
create policy submissions_teacher_delete on public.submissions
  for delete to authenticated
  using (
    exists (
      select 1
      from public.omr_codes
      where omr_codes.id = submissions.omr_code_id
        and omr_codes.teacher_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage · 시험지/해설지 (교사 본인 폴더만)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exam-files',
  'exam-files',
  false,
  20971520,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists exam_files_select_own on storage.objects;
create policy exam_files_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'exam-files'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists exam_files_insert_own on storage.objects;
create policy exam_files_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'exam-files'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists exam_files_update_own on storage.objects;
create policy exam_files_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'exam-files'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'exam-files'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists exam_files_delete_own on storage.objects;
create policy exam_files_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'exam-files'
    and split_part(name, '/', 1) = auth.uid()::text
  );
