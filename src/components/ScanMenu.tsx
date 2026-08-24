"use client";

import { cn } from "@/lib/utils";

export type ScanChoice = {
  id: string;
  title: string;
  hint: string;
};

export function ScanMenu({
  eyebrow = "EARTH 2026",
  title,
  subtitle,
  choices,
  onPick,
  onBack,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  choices: ScanChoice[];
  onPick: (id: string) => void;
  onBack?: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col justify-center px-4 py-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 h-11 w-fit rounded-[4px] bg-white/8 px-4 text-sm font-bold text-[#d0d0d0]"
        >
          이전
        </button>
      ) : null}
      <p className="text-[11px] tracking-[0.28em] text-[#e50914]">{eyebrow}</p>
      <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-[-0.03em] sm:text-[34px] md:text-[40px]">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-sm leading-6 text-[#808080] sm:text-base">{subtitle}</p>
      ) : null}
      <div
        className={cn(
          "mt-6 grid gap-3 sm:mt-8 sm:gap-4",
          choices.length > 1 ? "md:grid-cols-2" : "",
        )}
      >
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={() => onPick(choice.id)}
            className="flex min-h-[6.75rem] flex-col justify-center rounded-[8px] border border-white/10 bg-[#1f1f1f] px-5 py-5 text-left active:bg-[#262626] md:min-h-[12rem] md:px-7 md:py-8"
          >
            <p className="text-[22px] font-bold leading-tight text-white sm:text-[26px] md:text-[30px]">
              {choice.title}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#9a9a9a] sm:text-base">{choice.hint}</p>
          </button>
        ))}
      </div>
    </main>
  );
}
