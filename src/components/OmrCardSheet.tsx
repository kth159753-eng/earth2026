"use client";

import { QUESTION_COUNT } from "@/lib/exams";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const CHOICES = [1, 2, 3, 4, 5] as const;

function TimingMark() {
  return <span className="h-3.5 w-[6px] rounded-[1px] bg-black" />;
}

export function OmrCardSheet({
  title,
  subtitle,
  answers,
  current,
  onAnswer,
  onFocus,
  onCollapse,
  identity,
  footer,
}: {
  title?: string;
  subtitle?: string;
  answers: number[];
  current?: number;
  onAnswer: (question: number, choice: number) => void;
  onFocus?: (question: number) => void;
  onCollapse?: () => void;
  identity?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <aside className="flex h-full max-h-full flex-col overflow-hidden bg-[#2a1616] p-[3px] shadow-[0_12px_32px_rgba(0,0,0,0.55)]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-[3px] border-[#c41e3a] bg-[#f3ead6] text-[#141414]">
        <div className="shrink-0 border-b-[3px] border-[#c41e3a] bg-[#c41e3a] px-3 py-2 text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-bold tracking-[0.28em]">컴퓨터용 수험생 답안지</p>
              <p className="mt-0.5 truncate text-sm font-black tracking-tight">{title ?? "OMR 카드"}</p>
            </div>
            {onCollapse ? (
              <button
                type="button"
                onClick={onCollapse}
                className="h-10 shrink-0 rounded-[2px] bg-black/20 px-3 text-[12px] font-black text-white sm:h-8"
              >
                접기
              </button>
            ) : (
              <p className="shrink-0 text-[10px] font-bold tracking-widest text-white/75">EARTH</p>
            )}
          </div>
          {subtitle ? <p className="mt-0.5 text-[11px] text-white/80">{subtitle}</p> : null}
        </div>

        {identity ? (
          <div className="shrink-0 border-b-2 border-[#c41e3a] bg-[#efe4cc] px-2.5 py-2">
            {identity}
          </div>
        ) : null}

        <p className="shrink-0 bg-[#f8d5d8] px-3 py-1.5 text-[10px] font-bold leading-4 text-[#8a1020]">
          ※ 컴퓨터용 사인펜으로 해당 번호를 완전히 칠하여 바르게 표기하시오.
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-[11px_26px_1fr_11px] border-t-2 border-[#c41e3a]">
            <div className="grid place-items-center bg-[#c41e3a] py-1">
              <TimingMark />
            </div>
            <div className="grid place-items-center border-b border-[#c41e3a]/40 bg-[#e4d6b8] text-[9px] font-black text-[#c41e3a]">
              문
            </div>
            <div className="flex items-center justify-around border-b border-[#c41e3a]/40 bg-[#e4d6b8] px-1 py-1">
              {CHOICES.map((choice) => (
                <span
                  key={choice}
                  className="grid h-6 w-6 place-items-center text-[10px] font-black text-[#c41e3a]"
                >
                  {choice}
                </span>
              ))}
            </div>
            <div className="grid place-items-center bg-[#c41e3a] py-1">
              <TimingMark />
            </div>

            {Array.from({ length: QUESTION_COUNT }, (_, question) => {
              const focused = current === question;
              return (
                <div key={question} className="contents">
                  <div className="grid place-items-center border-b border-black/35 bg-[#c41e3a]">
                    <TimingMark />
                  </div>
                  <button
                    type="button"
                    onClick={() => onFocus?.(question)}
                    className={cn(
                      "border-b border-[#c41e3a]/30 text-center text-[11px] font-black tabular-nums",
                      focused ? "bg-[#f8d5d8] text-[#c41e3a]" : "bg-[#e8dcc0] text-[#141414]",
                    )}
                  >
                    {String(question + 1).padStart(2, "0")}
                  </button>
                  <div
                    className={cn(
                      "flex items-center justify-around gap-0.5 border-b border-[#c41e3a]/30 px-1 py-1",
                      focused ? "bg-[#f8d5d8]" : "bg-[#f3ead6]",
                    )}
                  >
                    {CHOICES.map((choice) => {
                      const selected = answers[question] === choice;
                      return (
                        <button
                          key={choice}
                          type="button"
                          aria-label={`${question + 1}번 ${choice}`}
                          onClick={() => {
                            onFocus?.(question);
                            onAnswer(question, choice);
                          }}
                          className={cn(
                            "grid h-9 w-9 place-items-center rounded-full border-[1.6px] text-[11px] font-black sm:h-8 sm:w-8",
                            selected
                              ? "border-[#141414] bg-[#141414] text-[#f3ead6]"
                              : "border-[#141414] bg-[#fffdf6] text-[#c41e3a]",
                          )}
                        >
                          {choice}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid place-items-center border-b border-black/35 bg-[#c41e3a]">
                    <TimingMark />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {footer ? (
          <div className="shrink-0 border-t-[3px] border-[#c41e3a] bg-[#efe4cc] px-2.5 py-2">
            {footer}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
