import { BrandMark } from "@/components/ui";

export function SetupNeeded() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
      <BrandMark />
      <h1 className="mt-8 text-2xl font-semibold">잠시 후 다시 시도해 주세요</h1>
    </main>
  );
}
