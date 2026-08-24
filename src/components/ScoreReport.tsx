"use client";

import { deleteStudentSubmissions } from "@/lib/data";
import { QUESTION_COUNT, getSession } from "@/lib/exams";
import { GRADE_TONES, bandLabel } from "@/lib/grades";
import type { ReportStudent, ScoreReport } from "@/lib/types";
import {
  average,
  classLabel,
  cn,
  formatPercent,
  formatScore,
  gradeLabel,
  studentLabel,
} from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

function classKey(grade: number, classNumber: number) {
  return `${grade}-${classNumber}`;
}

function reportStudentKey(student: Pick<ReportStudent, "grade" | "classNumber" | "studentNumber">) {
  return `${student.grade}-${student.classNumber}-${student.studentNumber}`;
}

function studentName(student: ReportStudent, showClass: boolean) {
  const number = studentLabel(student.studentNumber);
  return showClass
    ? `${gradeLabel(student.grade)} ${classLabel(student.classNumber)} ${number}`
    : number;
}

function studentAverage(student: ReportStudent, sessionIds: string[]) {
  return average(
    sessionIds
      .map((id) => student.bySession[id]?.score)
      .filter((score): score is number => score != null),
  );
}

function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 text-[10px] font-extrabold tracking-[0.14em] text-[#808080]">
        {label}
      </span>
      <div className="flex min-w-0 overflow-hidden rounded-[4px] bg-black/50">
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                "h-7 min-w-0 px-2 text-[11px] font-bold sm:h-8 sm:px-2.5 sm:text-[12px]",
                active
                  ? "bg-[#e50914] text-white"
                  : "text-[#b4b4b4] hover:bg-white/[0.06] hover:text-white",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ScoreReportBoard({
  report,
  onReload,
}: {
  report: ScoreReport;
  onReload?: () => void | Promise<void>;
}) {
  const classes = useMemo(() => {
    const seen = new Map<string, { grade: number; classNumber: number }>();
    for (const student of report.students) {
      seen.set(classKey(student.grade, student.classNumber), {
        grade: student.grade,
        classNumber: student.classNumber,
      });
    }
    return Array.from(seen.values()).sort(
      (a, b) => a.grade - b.grade || a.classNumber - b.classNumber,
    );
  }, [report.students]);

  const [view, setView] = useState<"status" | "misses">("status");
  const [picked, setPicked] = useState(classes[0] ? classKey(classes[0].grade, classes[0].classNumber) : "all");
  const [year, setYear] = useState<number | "all">("all");
  const [subject, setSubject] = useState<"all" | "I" | "II">("all");
  const [openQuestion, setOpenQuestion] = useState<{ year: number; question: number } | null>(null);
  const [cleared, setCleared] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCleared(new Set());
  }, [report]);

  const sessionIds = useMemo(() => {
    return report.sessionIds.filter((id) => {
      const session = getSession(id);
      if (!session) return false;
      if (year !== "all" && session.year !== year) return false;
      if (subject !== "all" && session.subject !== subject) return false;
      return true;
    });
  }, [report.sessionIds, subject, year]);

  const patchedStudents = useMemo(() => {
    if (cleared.size === 0) return report.students;
    return report.students.map((student) => {
      if (!cleared.has(reportStudentKey(student))) return student;
      const bySession = { ...student.bySession };
      for (const id of sessionIds) delete bySession[id];
      return { ...student, bySession };
    });
  }, [cleared, report.students, sessionIds]);

  const students = useMemo(() => {
    return patchedStudents.filter((student) => {
      if (picked === "all") return true;
      return classKey(student.grade, student.classNumber) === picked;
    });
  }, [picked, patchedStudents]);

  const stats = useMemo(() => {
    const scores = students.flatMap((student) =>
      sessionIds
        .map((id) => student.bySession[id]?.score)
        .filter((score): score is number => score != null),
    );
    const taken = students.filter((student) =>
      sessionIds.some((id) => student.bySession[id]?.submitted),
    ).length;
    const missing = students.length - taken;
    return {
      taken,
      missing,
      roster: students.length,
      sessions: sessionIds.length,
      average: average(scores),
    };
  }, [sessionIds, students]);

  const sessionStats = useMemo(() => {
    return sessionIds.map((id) => {
      const scores = students
        .map((student) => student.bySession[id]?.score)
        .filter((score): score is number => score != null);
      return {
        id,
        label: getSession(id)?.label ?? id,
        submitted: students.filter((student) => student.bySession[id]?.submitted).length,
        average: average(scores),
      };
    });
  }, [sessionIds, students]);

  const missYears = useMemo(() => {
    const years = year === "all" ? [2025, 2026] : [year];
    return years
      .map((item) => {
        const ids = sessionIds.filter((id) => getSession(id)?.year === item);
        const papers = students.flatMap((student) =>
          ids
            .map((id) => ({ student, id, cell: student.bySession[id] }))
            .filter((row) => row.cell?.submitted && (row.cell.score != null || row.cell.wrongQuestions.length > 0)),
        );
        const questions = Array.from({ length: QUESTION_COUNT }, (_, index) => {
          const question = index + 1;
          const wrongRows = papers.filter((row) => row.cell?.wrongQuestions.includes(question));
          return {
            question,
            wrong: wrongRows.length,
            total: papers.length,
            rate: papers.length ? (wrongRows.length / papers.length) * 100 : 0,
            students: wrongRows.map((row) => row.student),
          };
        });
        const hottest = [...questions].sort((a, b) => b.rate - a.rate || b.wrong - a.wrong).slice(0, 3);
        return { year: item, papers: papers.length, questions, hottest };
      })
      .filter((item) => item.papers > 0 || year !== "all");
  }, [sessionIds, students, year]);

  if (report.students.length === 0) {
    return (
      <p className="rounded-[4px] border border-white/8 bg-[#1f1f1f] px-4 py-6 text-sm text-[#b3b3b3]">
        아직 모인 성적이 없습니다. 채점하기에서 회차를 채점하거나, 기출학습을 보관하면 이곳에 쌓입니다.
      </p>
    );
  }

  const showClass = picked === "all";

  return (
    <section className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <h2 className="text-[15px] font-bold sm:text-base">성적 대시보드</h2>
        <div className="flex overflow-hidden rounded-[4px] bg-black/40">
          {(
            [
              ["status", "제출 현황"],
              ["misses", "틀린 문항"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={cn(
                "h-8 px-2.5 text-[12px] font-bold sm:px-3",
                view === id ? "bg-[#e50914] text-white" : "text-[#b4b4b4] hover:bg-white/[0.06] hover:text-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[5px] border border-white/10 bg-[#1a1a1a] px-2 py-1.5">
        <FilterGroup
          label="연도"
          value={String(year)}
          onChange={(value) => setYear(value === "all" ? "all" : Number(value))}
          options={[
            { id: "all", label: "전체" },
            { id: "2025", label: "2025" },
            { id: "2026", label: "2026" },
          ]}
        />
        <FilterGroup
          label="과목"
          value={subject}
          onChange={(value) => setSubject(value as "all" | "I" | "II")}
          options={[
            { id: "all", label: "전체" },
            { id: "I", label: "지I" },
            { id: "II", label: "지II" },
          ]}
        />
        <span className="hidden h-5 w-px bg-white/10 sm:block" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <span className="shrink-0 text-[10px] font-extrabold tracking-[0.14em] text-[#c4a574]">학급</span>
          {classes.map((item) => {
            const id = classKey(item.grade, item.classNumber);
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPicked(id)}
                className={cn(
                  "h-7 rounded-[4px] px-2 text-[11px] font-bold sm:px-2.5",
                  picked === id ? "bg-[#e50914] text-white" : "bg-white/5 text-stone-300",
                )}
              >
                {gradeLabel(item.grade)} {classLabel(item.classNumber)}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setPicked("all")}
            className={cn(
              "h-7 rounded-[4px] px-2 text-[11px] font-bold sm:px-2.5",
              picked === "all" ? "bg-[#e50914] text-white" : "bg-white/5 text-stone-300",
            )}
          >
            전체
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatChip label="응시" value={`${stats.taken}`} hint={`/${stats.roster}`} />
        <StatChip label="미제출" value={`${stats.missing}`} />
        <StatChip label="회차" value={`${stats.sessions}`} />
        <StatChip label="평균" value={formatScore(stats.average)} />
        {sessionStats.map((item) => (
          <StatChip
            key={item.id}
            label={item.label}
            value={formatScore(item.average)}
            hint={` · ${item.submitted}명`}
          />
        ))}
      </div>

      {view === "status" ? (
        <StatusView
          students={students}
          sessionIds={sessionIds}
          showClass={showClass}
          onDeleted={(student) => {
            setCleared((current) => new Set(current).add(reportStudentKey(student)));
          }}
          onReload={onReload}
        />
      ) : (
        <MissView
          groups={missYears}
          showClass={showClass}
          openQuestion={openQuestion}
          onToggle={(next) =>
            setOpenQuestion(
              openQuestion?.year === next.year && openQuestion.question === next.question ? null : next,
            )
          }
        />
      )}
    </section>
  );
}

function StatChip({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-white/8 bg-[#1f1f1f] px-2 sm:px-2.5">
      <span className="text-[10px] font-extrabold tracking-[0.08em] text-[#808080]">{label}</span>
      <span className="text-[13px] font-black tabular-nums text-white">
        {value}
        {hint ? <span className="ml-0.5 text-[11px] font-bold text-[#777]">{hint}</span> : null}
      </span>
    </div>
  );
}

function StatusView({
  students,
  sessionIds,
  showClass,
  onDeleted,
  onReload,
}: {
  students: ReportStudent[];
  sessionIds: string[];
  showClass: boolean;
  onDeleted: (student: ReportStudent) => void;
  onReload?: () => void | Promise<void>;
}) {
  return (
    <div>
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <h3 className="text-[13px] font-bold">제출 현황</h3>
          <p className="text-[10px] text-[#666]">휴지통으로 지울 수 있습니다</p>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {students.map((student) => (
            <StudentStatusCard
              key={`${student.grade}-${student.classNumber}-${student.studentNumber}`}
              student={student}
              sessionIds={sessionIds}
              showClass={showClass}
              onDeleted={onDeleted}
              onReload={onReload}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StudentStatusCard({
  student,
  sessionIds,
  showClass,
  onDeleted,
  onReload,
}: {
  student: ReportStudent;
  sessionIds: string[];
  showClass: boolean;
  onDeleted: (student: ReportStudent) => void;
  onReload?: () => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cells = sessionIds.map((id) => student.bySession[id]);
  const submitted = cells.filter((cell) => cell?.submitted).length;
  const graded = cells.filter((cell) => cell?.submitted && cell.score != null).length;
  const mean = studentAverage(student, sessionIds);
  const band = cells.find((cell) => cell?.band)?.band ?? null;
  const status =
    submitted === 0 ? "missing" : submitted < sessionIds.length ? "partial" : graded < submitted ? "pending" : "done";
  const canDelete = submitted > 0 && sessionIds.length > 0;

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await deleteStudentSubmissions({
        grade: student.grade,
        classNumber: student.classNumber,
        studentNumber: student.studentNumber,
        sessionIds,
      });
      onDeleted(student);
      setConfirming(false);
      await onReload?.();
    } catch {
      setError("삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={cn(
        "relative rounded-[5px] border px-2 py-1.5 sm:px-2.5 sm:py-2",
        status === "missing" && "border-white/8 bg-[#171717] text-[#7a7a7a]",
        status === "partial" && "border-[#c4a574]/35 bg-[#1a1712]",
        status === "pending" && "border-white/12 bg-[#1f1f1f]",
        status === "done" && "border-white/10 bg-[#1f1f1f]",
      )}
    >
      {confirming ? (
        <div className="space-y-2">
          <p className="text-[13px] font-bold leading-5 text-white">
            {studentName(student, showClass)} 제출을 지울까요?
          </p>
          <p className="text-[11px] leading-4 text-[#9a9a9a]">지금 보고 있는 회차 기록이 사라집니다.</p>
          {error ? <p className="text-[11px] font-bold text-[#ff8a90]">{error}</p> : null}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setError("");
              }}
              className="h-9 rounded-[4px] bg-white/8 text-[12px] font-bold text-[#d0d0d0]"
            >
              취소
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className="h-9 rounded-[4px] bg-[#e50914] text-[12px] font-bold text-white disabled:opacity-60"
            >
              {busy ? "지우는 중" : "삭제"}
            </button>
          </div>
        </div>
      ) : (
        <>
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-bold text-white">{studentName(student, showClass)}</p>
        <div className="flex shrink-0 items-center gap-1">
        <span
          className={cn(
            "rounded-[3px] px-1.5 py-0.5 text-[10px] font-extrabold",
            status === "done" && "bg-[#e50914] text-white",
            status === "partial" && "bg-[#c4a574]/20 text-[#e8c48a]",
            status === "pending" && "bg-white/10 text-[#d0d0d0]",
            status === "missing" && "bg-white/5 text-[#777]",
          )}
        >
          {status === "done" ? "제출" : status === "partial" ? "부분" : status === "pending" ? "채점 전" : "미제출"}
        </span>
        {canDelete ? (
          <button
            type="button"
            aria-label={`${studentName(student, showClass)} 제출 삭제`}
            onClick={() => setConfirming(true)}
            className="grid h-8 w-8 place-items-center rounded-[4px] text-[#8a8a8a] hover:bg-[#e50914]/15 hover:text-[#ff8a90]"
          >
            <TrashIcon />
          </button>
        ) : null}
        </div>
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <p className="text-lg font-black tabular-nums text-white sm:text-xl">{formatScore(mean)}</p>
        {band ? (
          <p className="text-[11px] font-bold" style={{ color: GRADE_TONES[band - 1] }}>
            {bandLabel(band)}
          </p>
        ) : (
          <p className="text-[11px] text-[#555]">
            {sessionIds.length ? `${submitted}/${sessionIds.length}` : "—"}
          </p>
        )}
      </div>
      {sessionIds.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {sessionIds.map((id) => {
            const cell = student.bySession[id];
            return (
              <span
                key={id}
                title={getSession(id)?.label ?? id}
                className={cn(
                  "h-1.5 w-3 rounded-full",
                  cell?.submitted
                    ? cell.score != null
                      ? "bg-[#e50914]"
                      : "bg-[#c4a574]"
                    : "bg-white/12",
                )}
              />
            );
          })}
        </div>
      ) : null}
        </>
      )}
    </article>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 7.5h14" />
      <path d="M9.2 7.5V5.8A1.3 1.3 0 0 1 10.5 4.5h3A1.3 1.3 0 0 1 14.8 5.8V7.5" />
      <path d="M16.6 7.5v10.2a1.4 1.4 0 0 1-1.4 1.4H8.8a1.4 1.4 0 0 1-1.4-1.4V7.5" />
      <path d="M10.2 11v5.2M13.8 11v5.2" />
    </svg>
  );
}

function MissView({
  groups,
  showClass,
  openQuestion,
  onToggle,
}: {
  groups: {
    year: number;
    papers: number;
    hottest: { question: number; rate: number; wrong: number }[];
    questions: {
      question: number;
      wrong: number;
      total: number;
      rate: number;
      students: ReportStudent[];
    }[];
  }[];
  showClass: boolean;
  openQuestion: { year: number; question: number } | null;
  onToggle: (next: { year: number; question: number }) => void;
}) {
  if (groups.length === 0) {
    return (
      <p className="rounded-[4px] border border-white/8 bg-[#1f1f1f] px-4 py-6 text-sm text-[#b3b3b3]">
        선택한 연도·과목에 채점된 오답 기록이 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.year} className="rounded-[6px] border border-white/10 bg-[#1a1a1a] p-3 sm:p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-extrabold tracking-[0.16em] text-[#e50914]">틀린 문항</p>
              <h3 className="mt-1 text-lg font-bold">{group.year}년 종합</h3>
            </div>
            <p className="text-xs text-[#808080]">채점 답안 {group.papers}부</p>
          </div>

          {group.hottest.some((item) => item.wrong > 0) ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {group.hottest
                .filter((item) => item.wrong > 0)
                .map((item) => (
                  <span
                    key={item.question}
                    className="rounded-[4px] border border-[#e50914]/30 bg-[#e50914]/10 px-2.5 py-1 text-xs font-bold text-[#ffb4b8]"
                  >
                    {item.question}번 · {formatPercent(item.rate)}
                  </span>
                ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[#808080]">이 연도에서 틀린 문항이 없습니다.</p>
          )}

          <div className="mt-4 grid grid-cols-5 gap-1.5 sm:grid-cols-10">
            {group.questions.map((item) => {
              const active = openQuestion?.year === group.year && openQuestion.question === item.question;
              const heat = Math.min(1, item.rate / 70);
              return (
                <button
                  key={item.question}
                  type="button"
                  onClick={() => onToggle({ year: group.year, question: item.question })}
                  className={cn(
                    "rounded-[4px] border px-1 py-2 text-center",
                    active ? "border-white/40" : "border-white/8",
                  )}
                  style={{
                    background: `rgba(229, 9, 20, ${0.08 + heat * 0.42})`,
                  }}
                >
                  <p className="text-[11px] font-black">{item.question}</p>
                  <p className="text-[10px] font-bold text-[#ffd0d2]">{item.wrong ? formatPercent(item.rate) : "—"}</p>
                </button>
              );
            })}
          </div>

          {openQuestion?.year === group.year
            ? (() => {
                const item = group.questions.find((row) => row.question === openQuestion.question);
                if (!item) return null;
                return (
                  <div className="mt-3 rounded-[4px] border border-white/8 bg-black/35 px-3 py-3">
                    <p className="text-sm font-bold">
                      {item.question}번 · 오답 {item.wrong}명 / {item.total}부
                    </p>
                    {item.students.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.students.map((student) => (
                          <span
                            key={`${student.grade}-${student.classNumber}-${student.studentNumber}`}
                            className="rounded-[4px] bg-white/8 px-2 py-1 text-xs font-bold"
                          >
                            {studentName(student, showClass)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-[#808080]">이 문항을 틀린 학생이 없습니다.</p>
                    )}
                  </div>
                );
              })()
            : null}
        </section>
      ))}
    </div>
  );
}
