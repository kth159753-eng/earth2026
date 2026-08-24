"use client";

import { gradeSession, saveAnswerKey, saveClassConfigs } from "@/lib/actions/teacher";
import { CHOICE_COUNT, QUESTION_COUNT, defaultPoints, emptyAnswers } from "@/lib/exams";
import type { ClassConfig, ClassSummary, GradedRow } from "@/lib/types";
import { Button, Notice, SectionTitle } from "@/components/ui";
import {
  classLabel,
  cn,
  formatPercent,
  formatScore,
  gradeLabel,
  studentLabel,
} from "@/lib/utils";
import { useMemo, useState } from "react";

type Tab = "classes" | "omr" | "answers" | "compare";

type DashboardClass = {
  grade: number;
  classNumber: number;
  studentCount: number;
  rows: GradedRow[];
  summary: ClassSummary;
};

export function AdminConsole({
  sessionId,
  sessionLabel,
  classConfigs,
  initialAnswers,
  initialPoints,
  dashboard,
  onReload,
}: {
  sessionId: string;
  sessionLabel: string;
  classConfigs: ClassConfig[];
  initialAnswers: number[];
  initialPoints: number[];
  dashboard: DashboardClass[];
  onReload?: () => void | Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("omr");

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-5">
      <p className="flex items-center gap-1.5 text-[13px] font-bold tracking-[0.28em]">
        <b className="text-[22px] font-black tracking-[-0.08em] text-[#e50914]">E</b>
        ADMIN
      </p>
      <h1 className="mt-1 text-[40px] font-bold leading-none tracking-[-0.03em]">
        {sessionLabel}
      </h1>
      <p className="mt-1 text-sm text-stone-400">
        학급 설정, 제출 현황, 정답·배점, 비교를 한 화면에서 관리합니다.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:flex">
        {(
          [
            ["omr", "OMR 대시보드"],
            ["answers", "정답 · 배점"],
            ["compare", "학년 · 학급 비교"],
            ["classes", "학년 · 학급 설정"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-[4px] px-4 py-2 text-sm",
              tab === id ? "bg-[#e50914] text-white" : "bg-white/5 text-stone-300",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "classes" ? (
          <ClassSettings initial={classConfigs} onReload={onReload} />
        ) : null}
        {tab === "answers" ? (
          <AnswerEditor
            sessionId={sessionId}
            initialAnswers={initialAnswers}
            initialPoints={initialPoints}
            onReload={onReload}
          />
        ) : null}
        {tab === "omr" ? (
          <OmrBoard sessionId={sessionId} dashboard={dashboard} onReload={onReload} />
        ) : null}
        {tab === "compare" ? <CompareBoard dashboard={dashboard} /> : null}
      </div>
    </div>
  );
}

type ClassSlot = {
  classNumber: number;
  studentCount: number;
};

function defaultSlots(count: number, start = 1): ClassSlot[] {
  return Array.from({ length: count }, (_, index) => ({
    classNumber: Math.min(15, start + index),
    studentCount: 30,
  }));
}

function nextFreeClassNumber(slots: ClassSlot[]) {
  const used = new Set(slots.map((slot) => slot.classNumber));
  for (let number = 1; number <= 15; number += 1) {
    if (!used.has(number)) return number;
  }
  return 15;
}

function ClassSettings({
  initial,
  onReload,
}: {
  initial: ClassConfig[];
  onReload?: () => void | Promise<void>;
}) {
  const seeded = useMemo(() => seedSettings(initial), [initial]);
  const [enabled, setEnabled] = useState(seeded.enabled);
  const [slots, setSlots] = useState(seeded.slots);
  const [bulk, setBulk] = useState(30);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function toggleGrade(grade: number) {
    setEnabled((current) => ({ ...current, [grade]: !current[grade] }));
  }

  function changeClassCount(grade: number, count: number) {
    const nextCount = Math.min(15, Math.max(1, count));
    setSlots((current) => {
      const existing = current[grade] ?? [];
      if (nextCount <= existing.length) {
        return { ...current, [grade]: existing.slice(0, nextCount) };
      }
      const added = [...existing];
      while (added.length < nextCount) {
        added.push({
          classNumber: nextFreeClassNumber(added),
          studentCount: added[added.length - 1]?.studentCount ?? 30,
        });
      }
      return { ...current, [grade]: added };
    });
  }

  function updateSlot(grade: number, index: number, patch: Partial<ClassSlot>) {
    setSlots((current) => {
      const next = [...(current[grade] ?? [])];
      const prev = next[index];
      if (!prev) return current;
      next[index] = {
        classNumber: patch.classNumber ?? prev.classNumber,
        studentCount: patch.studentCount ?? prev.studentCount,
      };
      return { ...current, [grade]: next };
    });
  }

  async function save() {
    setError("");
    setMessage("");
    const rows: Array<{ grade: number; classNumber: number; studentCount: number }> = [];
    for (const grade of [1, 2, 3]) {
      if (!enabled[grade]) continue;
      const names = (slots[grade] ?? []).map((slot) => slot.classNumber);
      if (new Set(names).size !== names.length) {
        setError(`${gradeLabel(grade)}에 같은 반 번호가 있습니다.`);
        return;
      }
      for (const slot of slots[grade] ?? []) {
        rows.push({
          grade,
          classNumber: slot.classNumber,
          studentCount: slot.studentCount,
        });
      }
    }
    setPending(true);
    try {
      await saveClassConfigs(rows);
      setMessage("학급 설정을 저장했습니다.");
      await onReload?.();
    } catch {
      setError("저장에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[4px] border border-white/8 bg-[#1f1f1f] p-5">
      <SectionTitle title="학년 · 학급 · 학생 수" />
      <p className="mb-4 text-sm text-[#808080]">
        학급 수를 정한 뒤 반 번호를 바꿀 수 있습니다. 예: 5개 반을 3, 4, 5, 6, 7반으로.
      </p>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((grade) => (
          <button
            key={grade}
            type="button"
            onClick={() => toggleGrade(grade)}
            className={cn(
              "rounded-[4px] px-4 py-2 text-sm",
              enabled[grade] ? "bg-[#e50914] text-white" : "bg-white/5 text-stone-400",
            )}
          >
            {gradeLabel(grade)}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-6">
        {[1, 2, 3].filter((grade) => enabled[grade]).map((grade) => (
          <div key={grade} className="rounded-[4px] border border-white/8 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label>
                <span className="mb-1 block text-xs text-stone-500">{gradeLabel(grade)} 학급 수</span>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={slots[grade]?.length ?? 1}
                  onChange={(event) => changeClassCount(grade, Number(event.target.value))}
                  className="h-11 w-28 rounded-[4px] border border-white/10 bg-black/30 px-3"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-stone-500">일괄 학생 수</span>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={bulk}
                  onChange={(event) => setBulk(Number(event.target.value))}
                  className="h-11 w-28 rounded-[4px] border border-white/10 bg-black/30 px-3"
                />
              </label>
              <Button
                variant="line"
                className="h-11"
                onClick={() => {
                  const count = Math.min(40, Math.max(1, bulk));
                  setSlots((current) => ({
                    ...current,
                    [grade]: (current[grade] ?? []).map((slot) => ({
                      ...slot,
                      studentCount: count,
                    })),
                  }));
                }}
              >
                일괄 적용
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {(slots[grade] ?? []).map((slot, index) => (
                <div key={`${grade}-${index}`} className="rounded-[4px] bg-black/25 p-3">
                  <label>
                    <span className="block text-xs text-stone-500">반 번호</span>
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={15}
                        value={slot.classNumber}
                        onChange={(event) =>
                          updateSlot(grade, index, {
                            classNumber: Math.min(15, Math.max(1, Number(event.target.value) || 1)),
                          })
                        }
                        className="h-10 w-full rounded-[4px] border border-white/10 bg-transparent px-2"
                      />
                      <span className="text-sm text-[#b3b3b3]">반</span>
                    </div>
                  </label>
                  <label className="mt-2 block">
                    <span className="block text-xs text-stone-500">학생 수</span>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={slot.studentCount}
                      onChange={(event) =>
                        updateSlot(grade, index, {
                          studentCount: Math.min(40, Math.max(1, Number(event.target.value) || 1)),
                        })
                      }
                      className="mt-1 h-10 w-full rounded-[4px] border border-white/10 bg-transparent px-2"
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error ? <div className="mt-4"><Notice tone="warn">{error}</Notice></div> : null}
      {message ? <div className="mt-4"><Notice tone="ok">{message}</Notice></div> : null}
      <Button className="mt-5" onClick={() => void save()} disabled={pending}>
        {pending ? "저장 중..." : "학급 설정 저장"}
      </Button>
    </section>
  );
}

function seedSettings(initial: ClassConfig[]) {
  const enabled: Record<number, boolean> = { 1: false, 2: false, 3: true };
  const slots: Record<number, ClassSlot[]> = {
    1: defaultSlots(1),
    2: defaultSlots(1),
    3: defaultSlots(5),
  };

  const grouped: Record<number, ClassSlot[]> = { 1: [], 2: [], 3: [] };
  for (const row of initial) {
    enabled[row.grade] = true;
    grouped[row.grade].push({
      classNumber: row.class_number,
      studentCount: row.student_count,
    });
  }
  for (const grade of [1, 2, 3]) {
    if (grouped[grade].length > 0) {
      slots[grade] = grouped[grade].sort((a, b) => a.classNumber - b.classNumber);
    }
  }

  if (initial.length === 0) {
    enabled[3] = true;
  }

  return { enabled, slots };
}

function AnswerEditor({
  sessionId,
  initialAnswers,
  initialPoints,
  onReload,
}: {
  sessionId: string;
  initialAnswers: number[];
  initialPoints: number[];
  onReload?: () => void | Promise<void>;
}) {
  const [answers, setAnswers] = useState(initialAnswers.length ? initialAnswers : emptyAnswers());
  const [points, setPoints] = useState(initialPoints.length ? initialPoints : defaultPoints());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const total = points.reduce((sum, value) => sum + value, 0);

  async function save() {
    setError("");
    setMessage("");
    setPending(true);
    try {
      await saveAnswerKey(sessionId, answers, points);
      setMessage("정답과 배점을 저장했습니다.");
      await onReload?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "저장에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[4px] border border-white/8 bg-[#1f1f1f] p-5">
      <SectionTitle
        title="정답과 배점"
        action={<p className="text-sm text-stone-400">총점 {total}점</p>}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-stone-500">
            <tr>
              <th className="py-2 text-left font-medium">문항</th>
              {Array.from({ length: CHOICE_COUNT }, (_, index) => (
                <th key={index} className="font-medium">
                  {index + 1}
                </th>
              ))}
              <th className="font-medium">배점</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: QUESTION_COUNT }, (_, question) => (
              <tr key={question} className="border-t border-white/5">
                <td className="py-2 text-white">{question + 1}</td>
                {Array.from({ length: CHOICE_COUNT }, (_, choice) => {
                  const value = choice + 1;
                  return (
                    <td key={value} className="text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setAnswers((current) => {
                            const next = [...current];
                            next[question] = value;
                            return next;
                          })
                        }
                        className={cn(
                          "h-9 w-9 rounded-[4px] border text-xs",
                          answers[question] === value
                            ? "border-[#e50914] bg-[#e50914] text-white"
                            : "border-white/15 text-stone-400",
                        )}
                      >
                        {value}
                      </button>
                    </td>
                  );
                })}
                <td className="text-center">
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={points[question]}
                    onChange={(event) =>
                      setPoints((current) => {
                        const next = [...current];
                        next[question] = Number(event.target.value);
                        return next;
                      })
                    }
                    className="h-9 w-16 rounded-lg border border-white/10 bg-black/30 text-center"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error ? <div className="mt-4"><Notice tone="warn">{error}</Notice></div> : null}
      {message ? <div className="mt-4"><Notice tone="ok">{message}</Notice></div> : null}
      <Button className="mt-5" onClick={() => void save()} disabled={pending}>
        {pending ? "저장 중..." : "정답 저장"}
      </Button>
    </section>
  );
}

function OmrBoard({
  sessionId,
  dashboard,
  onReload,
}: {
  sessionId: string;
  dashboard: DashboardClass[];
  onReload?: () => void | Promise<void>;
}) {
  const [selected, setSelected] = useState(dashboard[0] ? keyOf(dashboard[0]) : "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const current = dashboard.find((item) => keyOf(item) === selected) ?? dashboard[0];

  const heatmap = useMemo(() => {
    const submitted = dashboard.flatMap((item) => item.rows.filter((row) => row.submitted));
    return Array.from({ length: QUESTION_COUNT }, (_, index) => {
      const question = index + 1;
      const wrong = submitted.filter((row) => row.wrongQuestions.includes(question)).length;
      const rate = submitted.length ? (wrong / submitted.length) * 100 : 0;
      return { question, wrong, rate, total: submitted.length };
    });
  }, [dashboard]);

  async function grade() {
    setError("");
    setMessage("");
    setPending(true);
    try {
      const result = await gradeSession(sessionId);
      setMessage(`${result.graded}명의 답안을 채점했습니다.`);
      await onReload?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "채점에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  if (dashboard.length === 0) {
    return <Notice>먼저 학년과 학급을 설정해 주세요.</Notice>;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {dashboard.map((item) => (
            <button
              key={keyOf(item)}
              type="button"
              onClick={() => setSelected(keyOf(item))}
              className={cn(
                "rounded-[4px] px-3 py-1.5 text-sm",
                current && keyOf(item) === keyOf(current)
                  ? "bg-[#e50914] text-white"
                  : "bg-white/5 text-stone-300",
              )}
            >
              {gradeLabel(item.grade)} {classLabel(item.classNumber)}
              <span className="ml-2 text-xs opacity-70">
                {item.summary.submitted}/{item.summary.roster}
              </span>
            </button>
          ))}
        </div>
        <Button onClick={() => void grade()} disabled={pending}>
          {pending ? "채점 중..." : "채점"}
        </Button>
      </div>
      {error ? <Notice tone="warn">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="제출" value={`${current?.summary.submitted ?? 0}명`} />
        <Stat label="평균" value={formatScore(current?.summary.average ?? null)} />
        <Stat label="채점 완료" value={`${current?.summary.graded ?? 0}명`} />
      </div>

      <div className="rounded-[4px] border border-white/8 bg-[#1f1f1f] p-4">
        <p className="mb-3 text-sm text-stone-400">문항별 오답률</p>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {heatmap.map((item) => (
            <div
              key={item.question}
              className="rounded-[4px] p-2 text-center"
              style={{ background: `rgba(196, 92, 74, ${0.08 + item.rate / 140})` }}
            >
              <p className="text-xs text-stone-400">{item.question}</p>
              <p className="text-sm font-semibold">{formatPercent(item.rate)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-[4px] border border-white/8">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-white/3 text-stone-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">번호</th>
              <th className="px-4 py-3 text-left font-medium">제출</th>
              <th className="px-4 py-3 text-left font-medium">점수</th>
              <th className="px-4 py-3 text-left font-medium">틀린 문제</th>
            </tr>
          </thead>
          <tbody>
            {current?.rows.map((row) => (
              <tr key={row.studentNumber} className="border-t border-white/5">
                <td className="px-4 py-3">{studentLabel(row.studentNumber)}</td>
                <td className="px-4 py-3 text-stone-400">
                  {row.submitted ? "제출" : "미제출"}
                </td>
                <td className="px-4 py-3 font-medium text-white">
                  {formatScore(row.score)}
                </td>
                <td className="px-4 py-3">
                  {row.wrongQuestions.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {row.wrongQuestions.map((question) => (
                        <span
                          key={question}
                          className="rounded-md bg-rose-950/70 px-2 py-0.5 text-xs text-rose-100"
                        >
                          {question}
                        </span>
                      ))}
                    </div>
                  ) : row.submitted && row.score !== null ? (
                    <span className="text-teal">만점</span>
                  ) : (
                    <span className="text-stone-600">채점 전</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CompareBoard({ dashboard }: { dashboard: DashboardClass[] }) {
  const byGrade = useMemo(() => {
    const map = new Map<number, ClassSummary[]>();
    for (const item of dashboard) {
      const list = map.get(item.grade) ?? [];
      list.push(item.summary);
      map.set(item.grade, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [dashboard]);

  const maxAverage = Math.max(
    ...dashboard.map((item) => item.summary.average ?? 0),
    1,
  );

  if (dashboard.length === 0) {
    return <Notice>비교할 학급이 없습니다.</Notice>;
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {byGrade.map(([grade, rows]) => {
          const averages = rows
            .map((row) => row.average)
            .filter((value): value is number => value !== null);
          const mean =
            averages.length === 0
              ? null
              : averages.reduce((sum, value) => sum + value, 0) / averages.length;
          const submitted = rows.reduce((sum, row) => sum + row.submitted, 0);
          return (
            <div key={grade} className="rounded-[4px] border border-white/8 bg-[#1f1f1f] p-5">
              <p className="text-sm text-stone-400">{gradeLabel(grade)}</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {formatScore(mean)}
              </p>
              <p className="mt-1 text-xs text-stone-500">제출 {submitted}명</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-[4px] border border-white/8 bg-[#1f1f1f] p-5">
        <SectionTitle title="학급 평균 비교" />
        <div className="space-y-3">
          {dashboard.map((item) => {
            const width = ((item.summary.average ?? 0) / maxAverage) * 100;
            return (
              <div key={keyOf(item)}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>
                    {gradeLabel(item.grade)} {classLabel(item.classNumber)}
                  </span>
                  <span className="text-white">
                    {formatScore(item.summary.average)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-[4px] bg-white/5">
                  <div className="h-full rounded-[4px] bg-[#e50914]" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[4px] border border-white/8 bg-[#1f1f1f] px-4 py-4">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-stone-100">{value}</p>
    </div>
  );
}

function keyOf(item: { grade: number; classNumber: number }) {
  return `${item.grade}-${item.classNumber}`;
}
