import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="text-[11px] tracking-[0.28em] text-gold/70">EARTH 2026</p>
        <h1 className="mt-3 text-2xl font-semibold">페이지를 찾을 수 없습니다</h1>
        <Link href="/" className="mt-5 inline-block text-sm text-gold-bright">
          처음으로
        </Link>
      </div>
    </main>
  );
}
