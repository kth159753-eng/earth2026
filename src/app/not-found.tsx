import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#141414] px-6 text-center">
      <div>
        <p className="text-[28px] font-black tracking-[-0.07em] text-[#e50914]">EARTH</p>
        <h1 className="mt-3 text-2xl font-bold">페이지를 찾을 수 없습니다</h1>
        <Link href="/" className="mt-5 inline-block text-sm font-bold text-white">
          처음으로
        </Link>
      </div>
    </main>
  );
}
