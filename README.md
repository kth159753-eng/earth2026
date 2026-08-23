# EARTH 2026 · 지구과학 실전 모의고사

교실 화면용 지구과학 모의고사입니다. GitHub Pages 주소는
[https://kth159753-eng.github.io/earth2026/](https://kth159753-eng.github.io/earth2026/) 입니다.

GitHub에는 **정적 파일과 anon 공개키만** 올라갑니다. `service_role` 키, `.env.local`, 교사 이메일, 학생 이름은 저장소에 넣지 않습니다.

## 절대 올리면 안 되는 것

| 항목 | 위치 | GitHub |
| --- | --- | --- |
| `service_role` 키 | Supabase 대시보드에만 존재 | 금지. Secrets에도 넣지 말 것 |
| `.env.local` | 본인 컴퓨터에만 | 금지. `.gitignore`로 차단됨 |
| 교사 이메일·비밀번호 | Supabase Auth에만 | 금지 |
| 학생 이름 | 수집하지 않음 | - |

`anon public` 키는 웹사이트 JavaScript에 들어갑니다. 이것은 Supabase가 정한 공개키입니다. 데이터 보호는 SQL의 Row Level Security가 합니다.

## 최종 절차

SQL은 이미 실행했다면 1번은 건너뛰면 됩니다.

### 1. Supabase SQL

SQL Editor에서 `supabase/schema.sql` 전체를 실행합니다.

### 2. Supabase 인증 주소

**Authentication → URL Configuration**

- Site URL: `https://kth159753-eng.github.io/earth2026`
- Redirect URLs
  - `https://kth159753-eng.github.io/earth2026/**`
  - `https://kth159753-eng.github.io/earth2026/reset-password/`
  - `http://localhost:3000/**`

**Authentication → Providers → Email**에서 교실용이면 Confirm email을 끕니다.

### 3. 아이디 로그인 함수 (비밀키는 여기에만)

GitHub가 아니라 **Supabase Edge Function**이 `service_role`을 사용합니다. 이메일 주소는 브라우저로 내려가지 않습니다.

1. Supabase → **Edge Functions** → **Create function**
2. 이름: `teacher-login` (철자 그대로)
3. `supabase/functions/teacher-login/index.ts` 내용을 붙여 넣고 Deploy
4. JWT 검증은 켜 두어도 됩니다. 사이트는 anon 키로 호출합니다.

CLI를 쓰는 경우:

```bash
npx supabase login
npx supabase functions deploy teacher-login --project-ref 프로젝트REF
```

### 4. 로컬에서만 쓰는 키 파일

프로젝트 폴더에 `.env.local`을 **직접** 만들고 아래만 넣습니다. 이 파일은 GitHub에 올리지 않습니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://프로젝트.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon_public_키
NEXT_PUBLIC_BASE_PATH=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`service_role`은 여기에 넣지 않습니다.

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` → 회원가입 → 관리자에서 학년·학급 저장.

### 5. GitHub Secrets (공개키 두 개만)

저장소 **Settings → Secrets and variables → Actions**에 이것만 추가합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`SUPABASE_SERVICE_ROLE_KEY`를 넣으면 배포가 일부러 실패합니다.

### 6. GitHub Pages를 Actions로 바꿉니다

1. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 변경
2. `main`에 이 프로젝트를 푸시
3. **Actions**에서 `Deploy GitHub Pages`가 초록색이면
   [https://kth159753-eng.github.io/earth2026/](https://kth159753-eng.github.io/earth2026/) 에서 로그인합니다.

지금 주소에 README만 보이면, Pages 소스가 아직 “브랜치의 파일”로 되어 있는 상태입니다. Actions로 바꾸면 앱이 열립니다.

## 수업 흐름

1. 관리자에서 학년(1~3), 학급(1~15), 학생 수(1~40)를 저장
2. 왼쪽에서 `2025_3월_지I` 같은 회차를 선택
3. 실전 모의고사에서 시간 설정 후 시작. 학년·반마다 QR이 다릅니다
4. 학생은 QR → 번호만 고르고 1~20번 제출 (이름 없음)
5. 시험문제 & 정답지는 왼쪽 시험지, 오른쪽 해설지
6. 정답·배점 입력 후 채점, 학년·학급 비교

시험지를 폴더에 넣을 때:

```
public/exams/2025_3월_지I/paper.pdf
public/exams/2025_3월_지I/solution.pdf
```

또는 로그인 후 화면에서 업로드합니다.
