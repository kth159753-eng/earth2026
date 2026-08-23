# EARTH 2026 · 지구과학 실전 모의고사

교실 화면에 띄워 진행하는 지구과학 모의고사 시스템입니다. 교사는 아이디로 로그인하고, 학생은 이름 없이 학년·반·번호와 QR만으로 답을 제출합니다.

## 바로 시작

1. [Supabase](https://supabase.com) 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase/schema.sql` 전체를 실행합니다.
3. Authentication → Providers → Email에서 **Confirm email**은 교실용이면 끄는 것을 권장합니다.
4. Authentication → URL Configuration에 아래를 추가합니다.
   - `http://localhost:3000/**`
   - 배포 주소 `https://내주소/**`
5. 프로젝트 루트에 `.env.local`을 만들고 `.env.example`을 참고해 값을 넣습니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY`는 서버에서만 쓰입니다. 프론트 코드나 학생 화면에 넣지 마세요.

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` → 회원가입 → 관리자 페이지에서 학년·학급 저장.

## 수업 흐름

1. **관리자 페이지**에서 학년(1~3), 학급 수(1~15), 학생 수(1~40)를 저장합니다.
2. 왼쪽에서 회차를 고릅니다. 표기는 `2025_3월_지I`, `2025_5월_지II` 형식입니다.
3. **실전 모의고사**에서 시간을 맞추고 시작합니다. 학년·반을 바꾸면 QR이 그 학급 전용으로 바뀝니다.
4. 학생은 QR을 찍어 1~20번 답을 제출합니다. 이름은 받지 않습니다.
5. **시험문제 & 정답지**는 왼쪽 시험지, 오른쪽 해설지입니다. 파일을 올리거나 아래 폴더에 넣으면 됩니다.
6. 관리자에서 정답·배점을 입력한 뒤 **채점**을 누르면 틀린 문항이 바로 보입니다.

시험지 파일 위치:

```
public/exams/2025_3월_지I/paper.pdf
public/exams/2025_3월_지I/solution.pdf
```

## 개인정보

- 학생 이름은 저장하지 않습니다. 식별자는 학년 / 반 / 번호뿐입니다.
- 교사 이메일은 비밀번호 찾기에만 쓰이며 `auth.users`에만 남습니다. 프로필 테이블과 화면에는 이름·아이디만 둡니다.
- 학생용 RPC는 교사 정보와 점수를 돌려주지 않습니다.
- Row Level Security로 교사는 본인 학급 데이터만 봅니다.

## SQL

실행 파일은 `supabase/schema.sql`입니다. 만드는 대상은 다음과 같습니다.

| 대상 | 역할 |
| --- | --- |
| `profiles` | 교사 이름, 아이디 |
| `class_configs` | 학년·반·학생 수 |
| `answer_keys` | 회차별 정답 20개, 배점 20개 |
| `exam_assets` | 업로드한 시험지/해설지 경로 |
| `omr_codes` | 학년·반·회차별 고유 QR 코드 |
| `submissions` | 번호별 답안, 점수, 틀린 문항 |
| `is_username_available` | 가입 시 아이디 중복 확인 |
| `get_omr_meta` | 학생 화면에 회차·학년·반만 전달 |
| `submit_omr` | 학생 답안 제출 |
| `exam-files` 버킷 | 시험지 파일 저장 |
