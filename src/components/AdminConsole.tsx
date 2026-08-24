"use client";

import { gradeSession, saveAnswerKey, saveClassConfigs } from "@/lib/actions/teacher";
import { CHOICE_COUNT, QUESTION_COUNT, defaultPoints, emptyAnswers } from "@/lib/exams";
import { GRADE_TONES, bandFromScore, bandLabel, countBands, normalizeCuts } from "@/lib/grades";
import { ScoreReportBoard } from "@/components/ScoreReport";
import type { ClassConfig, ClassSummary, GradedRow, ScoreReport } from "@/lib/types";
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

type Tab = "report" | "classes" | "omr" | "answers" | "compare";

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
  initialCuts,
  dashboard,
  report,
  onReload,
}: {
  sessionId: string;
  sessionLabel: string;
  classConfigs: ClassConfig[];
  initialAnswers: number[];
  initialPoints: number[];
  initialCuts: number[];
  dashboard: DashboardClass[];
  report: ScoreReport;
  onReload?: () => void | Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("report");

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-5">
      <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] sm:text-[36px] lg:text-[40px]">
        {sessionLabel}
      </h1>
      <p className="mt-1 text-sm text-stone-400">
        회차별 성적 보고서, 채점, 학급 설정, 정답·배점을 한 화면에서 관리합니다.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {(
          [
            ["report", "관리자 페이지"],
            ["omr", "채점하기"],
            ["compare", "학년 · 학급 비교"],
            ["classes", "학년 · 학급 설정"],
            ["answers", "정답 · 배점"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "min-h-11 rounded-[4px] px-2.5 py-2 text-[13px] sm:px-4 sm:text-sm",
              tab === id ? "bg-[#e50914] text-white" : "bg-white/5 text-stone-300",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "report" ? <ScoreReportBoard report={report} /> : null}
        {tab === "classes" ? (
          <ClassSettings initial={classConfigs} onReload={onReload} />
        ) : null}
        {tab === "answers" ? (
          <AnswerEditor
            key={`${sessionId}-answers`}
            sessionId={sessionId}
            initialAnswers={initialAnswers}
            initialPoints={initialPoints}
            initialCuts={initialCuts}
            onReload={onReload}
          />
        ) : null}
        {tab === "omr" ? (
          <OmrBoard
            key={`${sessionId}-omr`}
            sessionId={sessionId}
            dashboard={dashboard}
            cuts={normalizeCuts(
              initialCuts,
              initialPoints.length ? initialPoints.reduce((sum, value) => sum + value, 0) : 50,
            )}
            onReload={onReload}
          />
        ) : null}
        {tab === "compare" ? (
          <CompareBoard
            key={`${sessionId}-compare`}
            dashboard={dashboard}
            cuts={normalizeCuts(
              initialCuts,
              initialPoints.length ? initialPoints.reduce((sum, value) => sum + value, 0) : 50,
            )}
          />
        ) : null}
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "저장에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[4px] border border-white/8 bg-[#1f1f1f] p-4 sm:p-5">
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
      <Button className="mt-5 w-full sm:w-auto" onClick={() => void save()} disabled={pending}>
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
  initialCuts,
  onReload,
}: {
  sessionId: string;
  initialAnswers: number[];
  initialPoints: number[];
  initialCuts: number[];
  onReload?: () => void | Promise<void>;
}) {
  const [answers, setAnswers] = useState(initialAnswers.length ? initialAnswers : emptyAnswers());
  const [points, setPoints] = useState(initialPoints.length ? initialPoints : defaultPoints());
  const total = points.reduce((sum, value) => sum + value, 0);
  const [cuts, setCuts] = useState(() => normalizeCuts(initialCuts, total));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function save() {
    setError("");
    setMessage("");
    setPending(true);
    try {
      const nextCuts = normalizeCuts(cuts, total);
      await saveAnswerKey(sessionId, answers, points, nextCuts);
      localStorage.setItem(`earth-cuts-${sessionId}`, JSON.stringify(nextCuts));
      setMessage("정답, 배점, 등급 컷을 저장했습니다.");
      await onReload?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "저장에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[4px] border border-white/8 bg-[#1f1f1f] p-4 sm:p-5">
      <SectionTitle
        title="정답과 배점"
        action={<p className="text-sm text-stone-400">총점 {total}점</p>}
      />
      <div className="space-y-3 md:hidden">
        {Array.from({ length: QUESTION_COUNT }, (_, question) => (
          <div key={question} className="rounded-[4px] bg-black/25 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold">{question + 1}번</p>
              <label className="flex items-center gap-2 text-xs text-stone-400">
                배점
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
                  className="h-10 w-16 rounded-lg border border-white/10 bg-black/30 text-center text-base"
                />
              </label>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: CHOICE_COUNT }, (_, choice) => {
                const value = choice + 1;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setAnswers((current) => {
                        const next = [...current];
                        next[question] = value;
                        return next;
                      })
                    }
                    className={cn(
                      "grid h-11 flex-1 place-items-center rounded-[4px] border text-sm",
                      answers[question] === value
                        ? "border-[#e50914] bg-[#e50914] text-white"
                        : "border-white/15 text-stone-400",
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
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
      <div className="mt-6 rounded-[4px] border border-white/8 bg-black/20 p-4">
        <SectionTitle title="1~9등급 컷 원점수" />
        <p className="mb-3 text-sm text-[#808080]">
          해당 등급이 되려면 필요한 최소 원점수입니다. 1등급 컷이 가장 높고, 아래로 갈수록 낮아집니다. 총점 {total}점 기준.
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
          {cuts.map((cut, index) => (
            <label key={index} className="rounded-[4px] bg-black/30 p-2">
              <span className="block text-center text-[11px] font-bold" style={{ color: GRADE_TONES[index] }}>
                {index + 1}등급
              </span>
              <input
                type="number"
                min={0}
                max={total}
                value={cut}
                onChange={(event) =>
                  setCuts((current) => {
                    const next = [...current];
                    next[index] = Number(event.target.value);
                    return next;
                  })
                }
                className="mt-1 h-10 w-full rounded-[4px] border border-white/10 bg-transparent text-center text-base"
              />
            </label>
          ))}
        </div>
      </div>
      {error ? <div className="mt-4"><Notice tone="warn">{error}</Notice></div> : null}
      {message ? <div className="mt-4"><Notice tone="ok">{message}</Notice></div> : null}
      <Button className="mt-5 w-full sm:w-auto" onClick={() => void save()} disabled={pending}>
        {pending ? "저장 중..." : "정답 저장"}
      </Button>
    </section>
  );
}

function OmrBoard({
  sessionId,
  dashboard,
  cuts,
  onReload,
}: {
  sessionId: string;
  dashboard: DashboardClass[];
  cuts: number[];
  onReload?: () => void | Promise<void>;
}) {
  const [selected, setSelected] = useState(dashboard[0] ? keyOf(dashboard[0]) : "");
  const [scope, setScope] = useState<"class" | "all">("class");
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

  const scopedRows = useMemo(() => {
    if (scope === "all") return dashboard.flatMap((item) => item.rows);
    return current?.rows ?? [];
  }, [current, dashboard, scope]);

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
              onClick={() => {
                setSelected(keyOf(item));
                setScope("class");
              }}
              className={cn(
                "rounded-[4px] px-3 py-1.5 text-sm",
                current && keyOf(item) === keyOf(current) && scope === "class"
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
          <button
            type="button"
            onClick={() => setScope("all")}
            className={cn(
              "rounded-[4px] px-3 py-1.5 text-sm",
              scope === "all" ? "bg-[#e50914] text-white" : "bg-white/5 text-stone-300",
            )}
          >
            전체
          </button>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => void grade()} disabled={pending}>
          {pending ? "채점 중..." : "채점"}
        </Button>
      </div>
      {error ? <Notice tone="warn">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="제출" value={`${scope === "all" ? dashboard.reduce((sum, item) => sum + item.summary.submitted, 0) : current?.summary.submitted ?? 0}명`} />
        <Stat
          label="평균"
          value={formatScore(
            scope === "all"
              ? averageOf(dashboard.flatMap((item) => item.rows.map((row) => row.score)))
              : current?.summary.average ?? null,
          )}
        />
        <Stat label="채점 완료" value={`${scope === "all" ? dashboard.reduce((sum, item) => sum + item.summary.graded, 0) : current?.summary.graded ?? 0}명`} />
      </div>

      <GradeChart
        title={
          scope === "all"
            ? "전체 1~9등급 분포"
            : `${gradeLabel(current?.grade ?? 1)} ${classLabel(current?.classNumber ?? 1)} 등급 분포`
        }
        scores={scopedRows.map((row) => row.score)}
        cuts={cuts}
      />

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

      <div className="rounded-[4px] border border-white/8 bg-[#1f1f1f] p-3 sm:p-4">
        <p className="mb-3 text-sm text-stone-400">학생 현황</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {(current?.rows ?? []).map((row) => {
            const band = bandFromScore(row.score, cuts);
            const graded = row.submitted && row.score !== null;
            return (
              <article
                key={row.studentNumber}
                className={cn(
                  "rounded-[4px] border px-2.5 py-2.5",
                  row.submitted
                    ? "border-white/12 bg-white/[0.05]"
                    : "border-white/[0.06] bg-black/25",
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <p className="text-sm font-black tabular-nums text-white">
                    {studentLabel(row.studentNumber)}
                  </p>
                  <span
                    className={cn(
                      "text-[10px] font-bold",
                      row.submitted ? "text-[#46d369]" : "text-[#808080]",
                    )}
                  >
                    {row.submitted ? "제출" : "미제출"}
                  </span>
                </div>
                <div className="mt-1.5 flex items-end justify-between gap-1">
                  <p className="text-lg font-black leading-none tabular-nums text-white">
                    {formatScore(row.score)}
                  </p>
                  {band ? (
                    <span
                      className="rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold"
                      style={{
                        color: GRADE_TONES[band - 1],
                        background: `${GRADE_TONES[band - 1]}22`,
                      }}
                    >
                      {bandLabel(band)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#555]">—</span>
                  )}
                </div>
                <div className="mt-2 min-h-5">
                  {row.wrongQuestions.length > 0 ? (
                    <div className="flex flex-wrap gap-0.5">
                      {row.wrongQuestions.map((question) => (
                        <span
                          key={question}
                          className="rounded-[3px] bg-rose-950/70 px-1 py-px text-[10px] font-bold text-rose-100"
                        >
                          {question}
                        </span>
                      ))}
                    </div>
                  ) : graded ? (
                    <p className="text-[10px] font-bold text-[#46d369]">만점</p>
                  ) : (
                    <p className="text-[10px] text-[#555]">채점 전</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CompareBoard({
  dashboard,
  cuts,
}: {
  dashboard: DashboardClass[];
  cuts: number[];
}) {
  const ranked = useMemo(() => {
    return [...dashboard].sort((a, b) => (b.summary.average ?? -1) - (a.summary.average ?? -1));
  }, [dashboard]);

  const byGrade = useMemo(() => {
    const map = new Map<number, DashboardClass[]>();
    for (const item of dashboard) {
      const list = map.get(item.grade) ?? [];
      list.push(item);
      map.set(item.grade, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [dashboard]);

  const maxAverage = Math.max(...dashboard.map((item) => item.summary.average ?? 0), 1);

  if (dashboard.length === 0) {
    return <Notice>비교할 학급이 없습니다.</Notice>;
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {byGrade.map(([grade, items]) => {
          const scores = items.flatMap((item) => item.rows.map((row) => row.score));
          const counts = countBands(scores, cuts);
          const graded = counts.reduce((sum, value) => sum + value, 0);
          const mean = averageOf(scores);
          const submitted = items.reduce((sum, item) => sum + item.summary.submitted, 0);
          return (
            <div key={grade} className="rounded-[4px] border border-white/8 bg-[#1f1f1f] p-5">
              <p className="text-sm text-stone-400">{gradeLabel(grade)}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{formatScore(mean)}</p>
              <p className="mt-1 text-xs text-stone-500">
                제출 {submitted}명 · 채점 {graded}명
              </p>
              <StackedBands counts={counts} className="mt-4 h-3" />
              <div className="mt-3 grid grid-cols-9 gap-1">
                {counts.map((count, index) => (
                  <div key={index} className="text-center">
                    <p className="text-[10px] font-bold" style={{ color: GRADE_TONES[index] }}>
                      {index + 1}
                    </p>
                    <p className="text-xs text-white">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-[4px] border border-white/8 bg-[#1f1f1f] p-5">
        <SectionTitle title="학급 순위 · 등급 비교" />
        <p className="mb-4 text-sm text-[#808080]">평균 순으로 정렬하고, 막대는 1~9등급 비율입니다.</p>
        <div className="space-y-4">
          {ranked.map((item, rank) => {
            const scores = item.rows.map((row) => row.score);
            const counts = countBands(scores, cuts);
            const graded = counts.reduce((sum, value) => sum + value, 0);
            const top = counts[0] + counts[1];
            const width = ((item.summary.average ?? 0) / maxAverage) * 100;
            return (
              <div key={keyOf(item)} className="rounded-[4px] bg-black/25 p-3">
                <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-[4px] text-sm font-black",
                        rank === 0
                          ? "bg-[#c4a574] text-black"
                          : rank === 1
                            ? "bg-[#9aa4b2] text-black"
                            : rank === 2
                              ? "bg-[#b07a4a] text-white"
                              : "bg-white/8 text-stone-300",
                      )}
                    >
                      {rank + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-white">
                        {gradeLabel(item.grade)} {classLabel(item.classNumber)}
                      </p>
                      <p className="text-xs text-stone-500">
                        제출 {item.summary.submitted}/{item.summary.roster} · 1~2등급 {top}명
                      </p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatScore(item.summary.average)}</p>
                </div>
                <div className="h-2 overflow-hidden rounded-[4px] bg-white/5">
                  <div className="h-full rounded-[4px] bg-[#e50914]" style={{ width: `${width}%` }} />
                </div>
                <StackedBands counts={counts} className="mt-2 h-4" />
                <div className="mt-2 flex flex-wrap gap-1">
                  {counts.map((count, index) => (
                    <span
                      key={index}
                      className="rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold"
                      style={{
                        color: GRADE_TONES[index],
                        background: `${GRADE_TONES[index]}1f`,
                      }}
                    >
                      {index + 1}등급 {count}
                      {graded ? ` · ${Math.round((count / graded) * 100)}%` : ""}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function GradeChart({
  title,
  scores,
  cuts,
}: {
  title: string;
  scores: Array<number | null>;
  cuts: number[];
}) {
  const counts = countBands(scores, cuts);
  const graded = counts.reduce((sum, value) => sum + value, 0);
  const max = Math.max(...counts, 1);

  return (
    <div className="rounded-[4px] border border-white/8 bg-[#1f1f1f] p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <p className="text-sm text-stone-400">{title}</p>
        <p className="text-xs text-stone-500">채점 {graded}명</p>
      </div>
      <StackedBands counts={counts} className="mb-4 h-3" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-9">
        {counts.map((count, index) => {
          const percent = graded ? (count / graded) * 100 : 0;
          return (
            <div key={index} className="rounded-[4px] bg-black/30 p-2">
              <p className="text-center text-[11px] font-bold" style={{ color: GRADE_TONES[index] }}>
                {index + 1}등급
              </p>
              <p className="mt-1 text-center text-xl font-bold text-white">{count}</p>
              <p className="text-center text-[11px] text-stone-500">{percent.toFixed(0)}%</p>
              <div className="mt-2 flex h-16 items-end">
                <div
                  className="w-full rounded-sm"
                  style={{
                    height: `${(count / max) * 100}%`,
                    minHeight: count ? 4 : 0,
                    background: GRADE_TONES[index],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StackedBands({ counts, className }: { counts: number[]; className?: string }) {
  const total = counts.reduce((sum, value) => sum + value, 0);
  return (
    <div className={cn("flex overflow-hidden rounded-full bg-white/5", className)}>
      {counts.map((count, index) => (
        <div
          key={index}
          style={{
            width: total ? `${(count / total) * 100}%` : "0%",
            background: GRADE_TONES[index],
          }}
        />
      ))}
    </div>
  );
}

function averageOf(scores: Array<number | null>) {
  const values = scores.filter((value): value is number => value !== null && !Number.isNaN(value));
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
