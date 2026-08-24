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
    <main className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-center px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
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
      <h1 className="mt-2 text-[24px] font-bold leading-tight tracking-[-0.03em] sm:text-[32px] md:text-[36px]">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-sm leading-6 text-[#808080] sm:text-base">{subtitle}</p>
      ) : null}
      <div
        className={cn(
          "mt-5 grid gap-2.5 sm:mt-6 sm:gap-3",
          choices.length === 3 ? "md:grid-cols-3" : choices.length > 1 ? "md:grid-cols-2" : "",
        )}
      >
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={() => onPick(choice.id)}
            className="flex min-h-[5.5rem] flex-col justify-center rounded-[8px] border border-white/10 bg-[#1f1f1f] px-4 py-4 text-left active:bg-[#262626] sm:min-h-[7rem] md:min-h-[10rem] md:px-6 md:py-6"
          >
            <p className="text-[20px] font-bold leading-tight text-white sm:text-[24px] md:text-[26px]">
              {choice.title}
            </p>
            <p className="mt-1.5 text-sm leading-5 text-[#9a9a9a] sm:text-base">{choice.hint}</p>
          </button>
        ))}
      </div>
    </main>
  );
}
