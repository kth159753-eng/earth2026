"use client";

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
import { useMemo, useState } from "react";

function classKey(grade: number, classNumber: number) {
  return `${grade}-${classNumber}`;
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
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-none sm:flex-row sm:items-center sm:gap-2">
      <span className="shrink-0 text-[10px] font-extrabold tracking-[0.16em] text-[#808080]">
        {label}
      </span>
      <div className="flex min-w-0 overflow-hidden rounded-[5px] border border-white/10 bg-black/40">
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                "h-9 min-w-0 flex-1 px-2 text-[12px] font-bold transition duration-150 sm:h-8 sm:flex-none sm:px-3 sm:text-[13px]",
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

export function ScoreReportBoard({ report }: { report: ScoreReport }) {
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

  const sessionIds = useMemo(() => {
    return report.sessionIds.filter((id) => {
      const session = getSession(id);
      if (!session) return false;
      if (year !== "all" && session.year !== year) return false;
      if (subject !== "all" && session.subject !== subject) return false;
      return true;
    });
  }, [report.sessionIds, subject, year]);

  const students = useMemo(() => {
    return report.students.filter((student) => {
      if (picked === "all") return true;
      return classKey(student.grade, student.classNumber) === picked;
    });
  }, [picked, report.students]);

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
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">성적 대시보드</h2>
          <p className="mt-1 text-sm text-[#808080]">제출과 오답을 학급 단위로 한눈에 봅니다.</p>
        </div>
        <div className="flex w-full overflow-hidden rounded-[5px] border border-white/10 bg-black/40 sm:w-auto">
          {(
            [
              ["status", "제출 현황"],
              ["misses", "연도별 틀린 문항"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={cn(
                "h-10 flex-1 px-3 text-sm font-bold sm:flex-none sm:px-4",
                view === id ? "bg-[#e50914] text-white" : "text-[#b4b4b4] hover:bg-white/[0.06] hover:text-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 rounded-[6px] border border-white/10 bg-[#1a1a1a] p-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <FilterGroup
            label="연도"
            value={String(year)}
            onChange={(value) => setYear(value === "all" ? "all" : Number(value))}
            options={[
              { id: "all", label: "전체" },
              { id: "2025", label: "2025년" },
              { id: "2026", label: "2026년" },
            ]}
          />
          <span className="hidden h-6 w-px bg-white/10 sm:block" />
          <FilterGroup
            label="과목"
            value={subject}
            onChange={(value) => setSubject(value as "all" | "I" | "II")}
            options={[
              { id: "all", label: "지I·지II" },
              { id: "I", label: "지I" },
              { id: "II", label: "지II" },
            ]}
          />
        </div>

        <div className="flex flex-col gap-2 rounded-[6px] border border-[#c4a574]/25 bg-[#1a1a1a] p-2 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="shrink-0 px-1 text-[10px] font-extrabold tracking-[0.16em] text-[#c4a574]">
            학급
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {classes.map((item) => {
              const id = classKey(item.grade, item.classNumber);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPicked(id)}
                  className={cn(
                    "rounded-[4px] px-3 py-1.5 text-sm font-bold",
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
                "rounded-[4px] px-3 py-1.5 text-sm font-bold",
                picked === "all" ? "bg-[#e50914] text-white" : "bg-white/5 text-stone-300",
              )}
            >
              전체 학급
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="응시" value={`${stats.taken}명`} hint={`명단 ${stats.roster}명`} />
        <StatCard label="미제출" value={`${stats.missing}명`} />
        <StatCard label="회차" value={`${stats.sessions}개`} />
        <StatCard label="평균" value={formatScore(stats.average)} />
      </div>

      {view === "status" ? (
        <StatusView
          sessionStats={sessionStats}
          students={students}
          sessionIds={sessionIds}
          showClass={showClass}
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

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[4px] border border-white/8 bg-[#1f1f1f] px-3 py-3 sm:px-4">
      <p className="text-[10px] font-extrabold tracking-[0.16em] text-[#808080]">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-[#666]">{hint}</p> : null}
    </div>
  );
}

function StatusView({
  sessionStats,
  students,
  sessionIds,
  showClass,
}: {
  sessionStats: { id: string; label: string; submitted: number; average: number | null }[];
  students: ReportStudent[];
  sessionIds: string[];
  showClass: boolean;
}) {
  return (
    <div className="space-y-4">
      {sessionStats.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {sessionStats.map((item) => (
            <div key={item.id} className="rounded-[4px] border border-white/8 bg-[#1f1f1f] px-3 py-2.5">
              <p className="truncate text-[11px] font-bold text-[#b3b3b3]">{item.label}</p>
              <p className="mt-1 text-lg font-black tabular-nums">{formatScore(item.average)}</p>
              <p className="text-[11px] text-[#666]">제출 {item.submitted}명</p>
            </div>
          ))}
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-end justify-between gap-3">
          <h3 className="text-sm font-bold">제출 현황</h3>
          <p className="text-[11px] text-[#666]">제출 · 부분 · 미제출 · 채점 전</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {students.map((student) => (
            <StudentStatusCard
              key={`${student.grade}-${student.classNumber}-${student.studentNumber}`}
              student={student}
              sessionIds={sessionIds}
              showClass={showClass}
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
}: {
  student: ReportStudent;
  sessionIds: string[];
  showClass: boolean;
}) {
  const cells = sessionIds.map((id) => student.bySession[id]);
  const submitted = cells.filter((cell) => cell?.submitted).length;
  const graded = cells.filter((cell) => cell?.submitted && cell.score != null).length;
  const mean = studentAverage(student, sessionIds);
  const band = cells.find((cell) => cell?.band)?.band ?? null;
  const status =
    submitted === 0 ? "missing" : submitted < sessionIds.length ? "partial" : graded < submitted ? "pending" : "done";

  return (
    <article
      className={cn(
        "rounded-[6px] border px-3 py-2.5",
        status === "missing" && "border-white/8 bg-[#171717] text-[#7a7a7a]",
        status === "partial" && "border-[#c4a574]/35 bg-[#1a1712]",
        status === "pending" && "border-white/12 bg-[#1f1f1f]",
        status === "done" && "border-white/10 bg-[#1f1f1f]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-bold text-white">{studentName(student, showClass)}</p>
        <span
          className={cn(
            "shrink-0 rounded-[3px] px-1.5 py-0.5 text-[10px] font-extrabold",
            status === "done" && "bg-[#e50914] text-white",
            status === "partial" && "bg-[#c4a574]/20 text-[#e8c48a]",
            status === "pending" && "bg-white/10 text-[#d0d0d0]",
            status === "missing" && "bg-white/5 text-[#777]",
          )}
        >
          {status === "done" ? "제출" : status === "partial" ? "부분" : status === "pending" ? "채점 전" : "미제출"}
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-xl font-black tabular-nums text-white">{formatScore(mean)}</p>
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
    </article>
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
