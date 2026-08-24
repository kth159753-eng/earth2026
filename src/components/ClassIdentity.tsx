"use client";

import { getClassConfigs } from "@/lib/data";
import {
  readActiveClass,
  subscribeActiveClass,
  writeActiveClass,
  type ActiveClass,
} from "@/lib/active-class";
import { DEFAULT_SESSION_ID } from "@/lib/exams";
import type { ClassConfig } from "@/lib/types";
import { classLabel, cn, gradeLabel, studentLabel } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function IdentityTile({
  label,
  value,
  min,
  max,
  onChange,
  tone = "dark",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  tone?: "dark" | "exam";
}) {
  const exam = tone === "exam";
  return (
    <div
      className={cn(
        "px-1 py-1.5 text-center",
        exam
          ? "rounded-[2px] border border-[#c41e3a] bg-[#fffdf8]"
          : "rounded-[6px] border border-white/12 bg-black/35",
      )}
    >
      <p
        className={cn(
          "text-[10px] font-bold tracking-[0.18em]",
          exam ? "text-[#c41e3a]" : "text-[#e50914]",
        )}
      >
        {label}
      </p>
      <div className="mt-1 flex items-center justify-between gap-0.5">
        <button
          type="button"
          aria-label={`${label} 줄이기`}
          onClick={() => onChange(clamp(value - 1, min, max))}
          className={cn(
            "grid h-8 w-8 place-items-center text-lg font-bold",
            exam ? "text-[#5a3a3a]" : "rounded-[4px] bg-white/10 text-white",
          )}
        >
          −
        </button>
        <p
          className={cn(
            "min-w-[1.4rem] text-[26px] font-black leading-none tabular-nums",
            exam ? "text-[#141414]" : "text-white",
          )}
        >
          {value}
        </p>
        <button
          type="button"
          aria-label={`${label} 늘리기`}
          onClick={() => onChange(clamp(value + 1, min, max))}
          className={cn(
            "grid h-8 w-8 place-items-center text-lg font-bold",
            exam ? "text-[#5a3a3a]" : "rounded-[4px] bg-white/10 text-white",
          )}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function IdentityRow({
  grade,
  classNumber,
  studentNumber,
  onGrade,
  onClass,
  onStudent,
  tone = "dark",
}: {
  grade: number;
  classNumber: number;
  studentNumber?: number;
  onGrade: (value: number) => void;
  onClass: (value: number) => void;
  onStudent?: (value: number) => void;
  tone?: "dark" | "exam";
}) {
  return (
    <div>
      <div className={cn("grid gap-1.5", onStudent ? "grid-cols-3" : "grid-cols-2")}>
        <IdentityTile tone={tone} label="학년" value={grade} min={1} max={3} onChange={onGrade} />
        <IdentityTile tone={tone} label="반" value={classNumber} min={1} max={15} onChange={onClass} />
        {onStudent && studentNumber != null ? (
          <IdentityTile tone={tone} label="번호" value={studentNumber} min={1} max={40} onChange={onStudent} />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 text-center text-sm font-bold tracking-tight",
          tone === "exam" ? "text-[#141414]" : "text-white",
        )}
      >
        {gradeLabel(grade)} {classLabel(classNumber)}
        {studentNumber ? ` ${studentLabel(studentNumber)}` : ""}
      </p>
    </div>
  );
}

export function ActiveClassControl() {
  const [active, setActive] = useState<ActiveClass | null>(null);
  const [open, setOpen] = useState(false);
  const [configs, setConfigs] = useState<ClassConfig[]>([]);

  useEffect(() => subscribeActiveClass(setActive), []);
  useEffect(() => {
    getClassConfigs()
      .then(setConfigs)
      .catch(() => setConfigs([]));
  }, []);

  const grouped = useMemo(() => {
    const source =
      configs.length > 0
        ? configs
        : Array.from({ length: 3 }, (_, grade) =>
            Array.from({ length: 15 }, (__, index) => ({
              grade: grade + 1,
              class_number: index + 1,
            })),
          ).flat();
    return [1, 2, 3]
      .map((grade) => ({
        grade,
        classes: source
          .filter((row) => row.grade === grade)
          .map((row) => row.class_number)
          .filter((value, index, list) => list.indexOf(value) === index)
          .sort((a, b) => a - b),
      }))
      .filter((row) => row.classes.length > 0);
  }, [configs]);

  function pick(grade: number, classNumber: number) {
    const current = readActiveClass();
    writeActiveClass({
      grade,
      classNumber,
      sessionId: current?.sessionId ?? DEFAULT_SESSION_ID,
      running: current?.running ?? false,
    });
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-[4px] border border-[#ffd400]/45 bg-[#ffd400]/10 px-2 text-left sm:h-11 sm:gap-2 sm:px-3"
        title="학급 바꾸기"
      >
        {active?.running ? (
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#ffd400]" />
        ) : (
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#ffd400]/45" />
        )}
        <span className="leading-none">
          <span className="hidden text-[9px] font-bold tracking-[0.16em] text-[#ffe066] sm:block">학급</span>
          <span className="block text-[13px] font-black text-[#ffd400] sm:text-sm">
            {active
              ? `${gradeLabel(active.grade)} ${classLabel(active.classNumber)}`
              : "학급 선택"}
          </span>
        </span>
        {active?.running ? (
          <span className="hidden text-[10px] font-bold text-[#ffd400] sm:inline">진행 중</span>
        ) : null}
        <span className="text-[10px] text-[#ffe066]">▾</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="닫기"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[min(78dvh,640px)] overflow-y-auto rounded-t-xl bg-[#1a1a1a] px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:inset-auto sm:right-4 sm:top-16 sm:bottom-auto sm:w-[min(420px,92vw)] sm:rounded-[8px] sm:border sm:border-white/10">
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#e50914]">학급 선택</p>
            <h2 className="mt-1 text-xl font-bold">학년과 반을 고르세요</h2>
            <div className="mt-4 space-y-4">
              {grouped.map((row) => (
                <div key={row.grade}>
                  <p className="mb-2 text-sm font-bold text-[#d0d0d0]">{gradeLabel(row.grade)}</p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {row.classes.map((classNumber) => {
                      const selected =
                        active?.grade === row.grade && active.classNumber === classNumber;
                      return (
                        <button
                          key={classNumber}
                          type="button"
                          onClick={() => pick(row.grade, classNumber)}
                          className={cn(
                            "h-12 rounded-[6px] text-sm font-bold",
                            selected
                              ? "bg-[#e50914] text-white"
                              : "bg-white/8 text-[#d0d0d0]",
                          )}
                        >
                          {classLabel(classNumber)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
