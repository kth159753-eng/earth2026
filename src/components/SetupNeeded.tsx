import { BrandMark } from "@/components/ui";

export function SetupNeeded() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
      <BrandMark />
      <h1 className="mt-8 text-2xl font-semibold">Supabase 연결이 필요합니다</h1>
      <p className="mt-3 text-sm leading-7 text-stone-400">
        `.env.local`에 프로젝트 URL과 키를 넣고, `supabase/schema.sql`을 SQL Editor에서
        실행한 뒤 개발 서버를 다시 시작해 주세요. 자세한 순서는 README를 참고하세요.
      </p>
    </main>
  );
}
