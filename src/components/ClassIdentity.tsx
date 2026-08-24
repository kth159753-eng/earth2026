"use client";

import { HeaderIconWell, headerChipClass } from "@/components/ui";
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

const selectClassName =
  "h-8 max-w-[7.5rem] cursor-pointer appearance-none rounded-[4px] border border-[#ffd400]/30 bg-black/50 py-0 pl-1.5 pr-5 text-base font-black text-[#ffd400] outline-none sm:h-8 sm:max-w-none sm:pl-2 sm:pr-6 sm:text-[13px]";

export function ActiveClassControl() {
  const [active, setActive] = useState<ActiveClass | null>(null);
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

  const grade = active?.grade ?? grouped[0]?.grade ?? 1;
  const classes = grouped.find((row) => row.grade === grade)?.classes ?? [];
  const classNumber =
    active && classes.includes(active.classNumber) ? active.classNumber : (classes[0] ?? 1);

  function pick(nextGrade: number, nextClass: number) {
    const current = readActiveClass();
    writeActiveClass({
      grade: nextGrade,
      classNumber: nextClass,
      sessionId: current?.sessionId ?? DEFAULT_SESSION_ID,
      running: current?.running ?? false,
    });
  }

  function changeGrade(nextGrade: number) {
    const nextClasses = grouped.find((row) => row.grade === nextGrade)?.classes ?? [];
    const nextClass = nextClasses.includes(classNumber) ? classNumber : (nextClasses[0] ?? 1);
    pick(nextGrade, nextClass);
  }

  return (
    <div className={cn(headerChipClass(false, "gold"), "min-w-0 gap-1.5 px-2 sm:gap-2 sm:px-3 md:px-4")} title="학급 바꾸기">
      <HeaderIconWell tone="gold">
        <ClassIcon />
      </HeaderIconWell>
      <ClassSelect
        id="active-class-grade"
        label="학년"
        value={grade}
        onChange={changeGrade}
        options={grouped.map((row) => ({ value: row.grade, label: gradeLabel(row.grade) }))}
      />
      <ClassSelect
        id="active-class-number"
        label="반"
        value={classNumber}
        onChange={(value) => pick(grade, value)}
        options={classes.map((value) => ({ value, label: classLabel(value) }))}
      />
    </div>
  );
}

function ClassSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  options: { value: number; label: string }[];
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={selectClassName}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-1.5 grid place-items-center text-[#ffe066]">
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-none stroke-current" strokeWidth="1.8" aria-hidden>
          <path d="M2.2 4.2 6 8l3.8-3.8" />
        </svg>
      </span>
    </label>
  );
}

function ClassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="8.6" r="2.3" />
      <circle cx="15.2" cy="8.6" r="2.3" />
      <path d="M5.4 17.8c.6-2.5 2-3.7 3.6-3.7s3 1.2 3.6 3.7" />
      <path d="M11.4 17.8c.6-2.5 2-3.7 3.8-3.7s3.2 1.2 3.8 3.7" />
    </svg>
  );
}
