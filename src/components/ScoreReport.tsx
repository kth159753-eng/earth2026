"use client";

import { getSession } from "@/lib/exams";
import { GRADE_TONES, bandLabel } from "@/lib/grades";
import type { ReportStudent, ScoreReport } from "@/lib/types";
import { average, classLabel, cn, formatScore, gradeLabel, studentLabel } from "@/lib/utils";
import { useMemo, useState } from "react";

function classKey(grade: number, classNumber: number) {
  return `${grade}-${classNumber}`;
}

function studentAverage(student: ReportStudent, sessionIds: string[]) {
  return average(
    sessionIds
      .map((id) => student.bySession[id]?.score)
      .filter((score): score is number => score != null),
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

  const [picked, setPicked] = useState(classes[0] ? classKey(classes[0].grade, classes[0].classNumber) : "all");
  const [year, setYear] = useState<number | "all">("all");
  const [subject, setSubject] = useState<"all" | "I" | "II">("all");

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
    return {
      taken,
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

  if (report.students.length === 0) {
    return (
      <p className="rounded-[4px] border border-white/8 bg-[#1f1f1f] px-4 py-6 text-sm text-[#b3b3b3]">
        아직 모인 성적이 없습니다. 채점하기에서 회차를 채점하거나, 기출학습을 보관하면 이곳에 쌓입니다.
      </p>
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">회차별 성적 보고서</h2>
        <p className="mt-1 text-sm text-[#808080]">
          모든 회차 점수를 학급·학생 단위로 모아 봅니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {classes.map((item) => {
          const id = classKey(item.grade, item.classNumber);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPicked(id)}
              className={cn(
                "rounded-[4px] px-3 py-1.5 text-sm",
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
            "rounded-[4px] px-3 py-1.5 text-sm",
            picked === "all" ? "bg-[#e50914] text-white" : "bg-white/5 text-stone-300",
          )}
        >
          전체 학급
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", 2025, 2026] as const).map((item) => (
          <button
            key={String(item)}
            type="button"
            onClick={() => setYear(item)}
            className={cn(
              "rounded-[4px] px-3 py-1.5 text-sm",
              year === item ? "bg-white/12 text-white" : "bg-white/5 text-stone-400",
            )}
          >
            {item === "all" ? "전체 연도" : `${item}년`}
          </button>
        ))}
        {(["all", "I", "II"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSubject(item)}
            className={cn(
              "rounded-[4px] px-3 py-1.5 text-sm",
              subject === item ? "bg-white/12 text-white" : "bg-white/5 text-stone-400",
            )}
          >
            {item === "all" ? "지I·지II" : item === "I" ? "지I" : "지II"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[4px] border border-white/8 bg-[#1f1f1f] px-4 py-3">
          <p className="text-xs text-[#808080]">응시</p>
          <p className="mt-1 text-2xl font-black">{stats.taken}명</p>
          <p className="text-xs text-[#666]">명단 {stats.roster}명</p>
        </div>
        <div className="rounded-[4px] border border-white/8 bg-[#1f1f1f] px-4 py-3">
          <p className="text-xs text-[#808080]">회차</p>
          <p className="mt-1 text-2xl font-black">{stats.sessions}개</p>
        </div>
        <div className="rounded-[4px] border border-white/8 bg-[#1f1f1f] px-4 py-3">
          <p className="text-xs text-[#808080]">평균</p>
          <p className="mt-1 text-2xl font-black">{formatScore(stats.average)}</p>
        </div>
      </div>

      {sessionStats.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {sessionStats.map((item) => (
            <div
              key={item.id}
              className="min-w-[148px] shrink-0 rounded-[4px] border border-white/8 bg-[#1f1f1f] px-3 py-2.5"
            >
              <p className="truncate text-[11px] font-bold text-[#b3b3b3]">{item.label}</p>
              <p className="mt-1 text-lg font-black">{formatScore(item.average)}</p>
              <p className="text-[11px] text-[#666]">제출 {item.submitted}명</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="-mx-3 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-[#808080]">
              <th className="sticky left-0 z-10 border-b border-white/8 bg-[#141414] px-3 py-2.5 text-left font-medium">
                학생
              </th>
              {sessionIds.map((id) => (
                <th
                  key={id}
                  className="border-b border-white/8 px-2 py-2.5 text-center font-medium"
                >
                  <span className="block text-[11px] leading-4">
                    {getSession(id)?.label.replace("20", "") ?? id}
                  </span>
                </th>
              ))}
              <th className="border-b border-white/8 px-3 py-2.5 text-center font-medium">평균</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const mean = studentAverage(student, sessionIds);
              return (
                <tr key={`${student.grade}-${student.classNumber}-${student.studentNumber}`}>
                  <td className="sticky left-0 z-10 border-b border-white/5 bg-[#141414] px-3 py-2 font-bold text-white">
                    {picked === "all"
                      ? `${gradeLabel(student.grade)} ${classLabel(student.classNumber)} ${studentLabel(student.studentNumber)}`
                      : studentLabel(student.studentNumber)}
                  </td>
                  {sessionIds.map((id) => {
                    const cell = student.bySession[id];
                    return (
                      <td key={id} className="border-b border-white/5 px-2 py-2 text-center">
                        {cell?.submitted ? (
                          <div>
                            <p className="font-black tabular-nums text-white">
                              {formatScore(cell.score)}
                            </p>
                            {cell.band ? (
                              <p
                                className="text-[10px] font-bold"
                                style={{ color: GRADE_TONES[cell.band - 1] }}
                              >
                                {bandLabel(cell.band)}
                              </p>
                            ) : (
                              <p className="text-[10px] text-[#555]">채점 전</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#444]">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="border-b border-white/5 px-3 py-2 text-center font-black tabular-nums text-white">
                    {formatScore(mean)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
