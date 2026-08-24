"use client";

import { gradeAnswers, listStudentPapers } from "@/lib/data";
import { defaultPoints, getSession } from "@/lib/exams";
import { officialAnswers } from "@/lib/official-keys";
import type { ReportSource, StudentPaper } from "@/lib/types";
import { classLabel, cn, formatScore, gradeLabel, studentLabel } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

type ScoreFilter = "all" | "high" | "mid" | "low";
type SourceFilter = "all" | ReportSource;
type RetryItem = {
  sessionId: string;
  label: string;
  question: number;
  point: number;
  picked: number;
  correct: number;
};

function pointOf(question: number) {
  return defaultPoints()[question - 1] ?? 2;
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}.${day} ${hours}:${minutes}`;
}

function paperGrade(row: StudentPaper) {
  const live = gradeAnswers(row.session_id, row.answers);
  if (live.graded) return live;
  if (row.source === "class" && row.wrong_questions.length === 0 && row.score === 0) {
    return { score: row.score, total: row.total, wrongQuestions: row.wrong_questions, graded: false };
  }
  return {
    score: row.score,
    total: row.total,
    wrongQuestions: row.wrong_questions,
    graded: true,
  };
}

function matchesFilters(row: StudentPaper, year: number | "all", scoreFilter: ScoreFilter) {
  const session = getSession(row.session_id);
  if (year !== "all" && session?.year !== year) return false;
  const graded = paperGrade(row);
  if (scoreFilter === "all") return true;
  if (!graded.graded) return false;
  if (scoreFilter === "high" && graded.score < 40) return false;
  if (scoreFilter === "mid" && (graded.score < 20 || graded.score >= 40)) return false;
  if (scoreFilter === "low" && graded.score >= 20) return false;
  return true;
}

export function StudentReport() {
  const [classroom, setClassroom] = useState<StudentPaper[]>([]);
  const [solo, setSolo] = useState<StudentPaper[]>([]);
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<SourceFilter>("all");
  const [year, setYear] = useState<number | "all">("all");
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  const [retry, setRetry] = useState<{
    year: number;
    focus: number;
    source: ReportSource;
    items: RetryItem[];
  } | null>(null);

  useEffect(() => {
    listStudentPapers()
      .then((rows) => {
        setClassroom(rows.classroom);
        setSolo(rows.solo);
      })
      .catch(() => {
        setClassroom([]);
        setSolo([]);
      })
      .finally(() => setReady(true));
  }, []);

  const classPapers = useMemo(
    () => classroom.filter((row) => matchesFilters(row, year, scoreFilter)),
    [classroom, scoreFilter, year],
  );
  const soloPapers = useMemo(
    () => solo.filter((row) => matchesFilters(row, year, scoreFilter)),
    [scoreFilter, solo, year],
  );

  function openRetry(row: StudentPaper, question: number) {
    const session = getSession(row.session_id);
    if (!session) return;
    const pool = row.source === "class" ? classroom : solo;
    const items = pool.flatMap((item) => {
      const itemSession = getSession(item.session_id);
      if (itemSession?.year !== session.year) return [];
      const key = officialAnswers(item.session_id);
      if (!key) return [];
      return paperGrade(item).wrongQuestions.map((wrong) => ({
        sessionId: item.session_id,
        label: itemSession.label,
        question: wrong,
        point: pointOf(wrong),
        picked: item.answers[wrong - 1] ?? 0,
        correct: key[wrong - 1] ?? 0,
      }));
    });
    const unique = new Map<string, RetryItem>();
    for (const item of items) unique.set(`${item.sessionId}-${item.question}`, item);
    const list = [...unique.values()].sort(
      (a, b) => a.question - b.question || a.sessionId.localeCompare(b.sessionId),
    );
    if (list.length === 0) return;
    setRetry({ year: session.year, focus: question, source: row.source, items: list });
  }

  if (retry) {
    return <RetryBoard state={retry} onBack={() => setRetry(null)} />;
  }

  const visibleClass = source !== "solo";
  const visibleSolo = source !== "class";
  const emptyAll = classPapers.length === 0 && soloPapers.length === 0;

  return (
    <main className="mx-auto w-full max-w-4xl px-3 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-5 md:px-6">
      <h1 className="text-[22px] font-black tracking-tight sm:text-[28px] md:text-[32px]">보관소</h1>
      <p className="mt-1.5 max-w-xl text-[13px] leading-6 text-[#9a9a9a] sm:text-sm">
        수업시간에 낸 보고서와 나혼자 학습 보고서를 나눠 둡니다.
      </p>

      <div className="mt-4">
        <div className="grid grid-cols-3 gap-1 rounded-[8px] bg-[#1a1a1a] p-1 sm:max-w-lg">
          {(
            [
              { id: "all", label: "전체", count: classPapers.length + soloPapers.length },
              { id: "class", label: "수업시간", count: classPapers.length },
              { id: "solo", label: "나혼자", count: soloPapers.length },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSource(item.id)}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-[6px] px-1 py-1.5",
                source === item.id ? "bg-[#e50914] text-white" : "text-[#c8c8c8]",
              )}
            >
              <span className="text-[13px] font-black sm:text-sm">{item.label}</span>
              <span className="text-[10px] font-bold tabular-nums opacity-80">{item.count}건</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <FilterRow
          label="연도"
          value={String(year)}
          onChange={(value) => setYear(value === "all" ? "all" : Number(value))}
          options={[
            { id: "all", label: "전체" },
            { id: "2025", label: "2025" },
            { id: "2026", label: "2026" },
          ]}
        />
        <FilterRow
          label="점수"
          value={scoreFilter}
          onChange={(value) => setScoreFilter(value as ScoreFilter)}
          options={[
            { id: "all", label: "전체" },
            { id: "high", label: "40↑" },
            { id: "mid", label: "20~39" },
            { id: "low", label: "20↓" },
          ]}
        />
      </div>

      {!ready ? <div className="min-h-[20vh]" /> : null}

      {ready && emptyAll ? (
        <p className="mt-6 rounded-[8px] border border-white/8 bg-[#1f1f1f] px-4 py-8 text-center text-sm leading-6 text-[#808080]">
          아직 보관된 보고서가 없습니다.
          <span className="mt-1 block text-[#9a9a9a]">
            교실 OMR을 내면 수업시간 칸에, 나혼자 학습에서 채점하면 나혼자 칸에 쌓입니다.
          </span>
        </p>
      ) : null}

      <div
        className={cn(
          "mt-4 space-y-5 md:space-y-6",
          source === "all" && "xl:grid xl:grid-cols-2 xl:items-start xl:gap-5 xl:space-y-0",
        )}
      >
        {visibleClass ? (
          <ReportSection
            source="class"
            title="수업시간에 한 보고서"
            hint="교실에서 OMR로 제출한 시험입니다."
            empty="아직 수업시간에 제출한 보고서가 없습니다."
            rows={classPapers}
            onRetry={openRetry}
          />
        ) : null}
        {visibleSolo ? (
          <ReportSection
            source="solo"
            title="나혼자학습으로 한 보고서"
            hint="스스로 풀고 바로 채점한 시험입니다."
            empty="아직 나혼자 학습 보고서가 없습니다."
            rows={soloPapers}
            onRetry={openRetry}
          />
        ) : null}
      </div>
    </main>
  );
}

function ReportSection({
  source,
  title,
  hint,
  empty,
  rows,
  onRetry,
}: {
  source: ReportSource;
  title: string;
  hint: string;
  empty: string;
  rows: StudentPaper[];
  onRetry: (row: StudentPaper, question: number) => void;
}) {
  const classroom = source === "class";
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[10px] border",
        classroom ? "border-[#e50914]/35 bg-[#1a1212]" : "border-[#c4a574]/35 bg-[#19160f]",
      )}
    >
      <header
        className={cn(
          "flex items-start gap-3 px-3 py-3 sm:px-4 sm:py-3.5",
          classroom ? "bg-[#e50914]/16" : "bg-[#c4a574]/14",
        )}
      >
        <span
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-[8px] text-[11px] font-black tracking-tight text-white sm:h-12 sm:w-12",
            classroom ? "bg-[#e50914]" : "bg-[#8a6a32]",
          )}
        >
          {classroom ? "수업" : "혼자"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-black leading-tight sm:text-[20px]">{title}</h2>
          <p className="mt-0.5 text-[12px] leading-5 text-[#c0c0c0] sm:text-[13px]">{hint}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black tabular-nums sm:text-xs",
            classroom ? "bg-[#e50914]/25 text-[#ffc4c7]" : "bg-[#c4a574]/25 text-[#ead7b0]",
          )}
        >
          {rows.length}건
        </span>
      </header>

      {rows.length === 0 ? (
        <p className="px-4 py-7 text-center text-sm leading-6 text-[#808080]">{empty}</p>
      ) : (
        <div className="divide-y divide-white/8">
          {rows.map((row) => (
            <PaperCard key={row.id} row={row} onRetry={onRetry} />
          ))}
        </div>
      )}
    </section>
  );
}

function PaperCard({
  row,
  onRetry,
}: {
  row: StudentPaper;
  onRetry: (row: StudentPaper, question: number) => void;
}) {
  const session = getSession(row.session_id);
  const graded = paperGrade(row);
  const classroom = row.source === "class";

  return (
    <article className="px-3 py-3.5 sm:px-4 sm:py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-black leading-tight sm:text-lg">
            {session?.label ?? row.session_id}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[#8d8d8d] sm:text-xs">
            {session ? `${session.year}년 ${session.month}월` : ""}
            {" · "}
            {gradeLabel(row.grade)} {classLabel(row.class_number)} {studentLabel(row.student_number)}
            {formatWhen(row.graded_at) ? ` · ${formatWhen(row.graded_at)}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {graded.graded ? (
            <p className="text-[26px] font-black leading-none tabular-nums sm:text-[30px]">
              {formatScore(graded.score)}
              <span className="ml-0.5 text-[12px] font-bold text-[#808080]">/{graded.total}</span>
            </p>
          ) : (
            <p className="rounded-[4px] bg-white/8 px-2 py-1 text-[12px] font-black text-[#c4a574]">채점 전</p>
          )}
        </div>
      </div>

      <p
        className={cn(
          "mt-3 text-[10px] font-extrabold tracking-[0.16em]",
          classroom ? "text-[#ff8a90]" : "text-[#c4a574]",
        )}
      >
        오답 문항
      </p>
      {!graded.graded ? (
        <p className="mt-1 text-sm text-[#808080]">정답이 등록되면 오답이 표시됩니다.</p>
      ) : graded.wrongQuestions.length === 0 ? (
        <p className="mt-1 text-sm font-bold text-[#46d369]">만점입니다.</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {graded.wrongQuestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => onRetry(row, question)}
              className={cn(
                "min-h-9 rounded-[5px] px-2.5 text-[12px] font-bold sm:min-h-8",
                classroom
                  ? "border border-[#e50914]/40 bg-[#e50914]/12 text-[#ffb4b8]"
                  : "border border-[#c4a574]/40 bg-[#c4a574]/12 text-[#ead7b0]",
              )}
            >
              {question}번 · {pointOf(question)}점
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function FilterRow({
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
    <div className="flex items-center gap-2 rounded-[8px] border border-white/10 bg-[#1a1a1a] p-1.5">
      <span className="w-8 shrink-0 px-1 text-[10px] font-extrabold tracking-[0.14em] text-[#808080]">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 overflow-hidden rounded-[5px] bg-black/40">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "h-10 min-w-0 flex-1 text-[12px] font-bold sm:h-9 sm:text-[13px]",
              value === option.id ? "bg-[#e50914] text-white" : "text-[#b4b4b4]",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RetryBoard({
  state,
  onBack,
}: {
  state: { year: number; focus: number; source: ReportSource; items: RetryItem[] };
  onBack: () => void;
}) {
  const [index, setIndex] = useState(() =>
    Math.max(0, state.items.findIndex((item) => item.question === state.focus)),
  );
  const [fresh, setFresh] = useState<Record<string, number>>({});
  const item = state.items[index];
  if (!item) return null;
  const key = `${item.sessionId}-${item.question}`;
  const chosen = fresh[key] ?? 0;
  const checked = chosen > 0;
  const correct = chosen === item.correct;
  const classroom = state.source === "class";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col px-3 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 h-11 w-fit rounded-[6px] bg-white/8 px-4 text-sm font-bold text-[#d0d0d0]"
      >
        보관소로
      </button>
      <p
        className={cn(
          "text-[10px] font-extrabold tracking-[0.18em]",
          classroom ? "text-[#e50914]" : "text-[#c4a574]",
        )}
      >
        {classroom ? "수업시간" : "나혼자학습"} · {state.year}년 오답
      </p>
      <h1 className="mt-1 text-[22px] font-bold">틀린 문항만 다시 풀기</h1>
      <p className="mt-1 text-sm text-[#9a9a9a]">
        예전에 고른 오답이 보이고, 새 답을 고르면 바로 맞았는지 알려 줍니다.
      </p>

      <div className="mt-4 rounded-[8px] border border-white/10 bg-[#1f1f1f] p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-lg font-black">
              {item.question}번 · {item.point}점
            </p>
            <p className="mt-0.5 text-xs text-[#808080]">{item.label}</p>
          </div>
          <p className="text-xs font-bold text-[#808080]">
            {index + 1}/{state.items.length}
          </p>
        </div>

        <p className="mt-4 text-[11px] font-extrabold tracking-[0.14em] text-[#c4a574]">내가 골랐던 오답</p>
        <p className="mt-1 text-base font-black text-[#ffb4b8]">{item.picked ? `${item.picked}번` : "표시 없음"}</p>

        <p className="mt-4 text-[11px] font-extrabold tracking-[0.14em] text-[#808080]">새 답 고르기</p>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((choice) => {
            const selected = chosen === choice;
            const wasWrong = item.picked === choice;
            return (
              <button
                key={choice}
                type="button"
                onClick={() => setFresh((current) => ({ ...current, [key]: choice }))}
                className={cn(
                  "relative h-12 rounded-[6px] text-base font-black",
                  selected
                    ? correct
                      ? "bg-[#46d369] text-black"
                      : "bg-[#e50914] text-white"
                    : "bg-white/8 text-white",
                )}
              >
                {choice}
                {wasWrong ? (
                  <span className="absolute -top-1.5 right-1 text-[9px] font-bold text-[#c4a574]">이전</span>
                ) : null}
              </button>
            );
          })}
        </div>
        {checked ? (
          <p className={cn("mt-3 text-sm font-bold", correct ? "text-[#46d369]" : "text-[#ff8a90]")}>
            {correct ? "정답입니다." : `오답입니다. 정답은 ${item.correct}번입니다.`}
          </p>
        ) : (
          <p className="mt-3 text-sm text-[#808080]">선지를 고르면 바로 채점됩니다.</p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
          className="h-12 rounded-[6px] bg-white/8 text-sm font-bold disabled:opacity-35"
        >
          이전 문항
        </button>
        <button
          type="button"
          disabled={index >= state.items.length - 1}
          onClick={() => setIndex((value) => Math.min(state.items.length - 1, value + 1))}
          className="h-12 rounded-[6px] bg-white/8 text-sm font-bold disabled:opacity-35"
        >
          다음 문항
        </button>
      </div>
    </main>
  );
}
