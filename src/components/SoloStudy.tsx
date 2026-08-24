"use client";

import { SoloPaper, type InkStroke, type SoloTool } from "@/components/SoloPaper";
import { getAnswerKey } from "@/lib/data";
import {
  QUESTION_COUNT,
  defaultPoints,
  examViewerUrls,
  type ExamSession,
} from "@/lib/exams";
import { classLabel, cn, gradeLabel, studentLabel } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

const COLORS = [
  { id: "black", value: "#141414", label: "검정" },
  { id: "red", value: "#e50914", label: "빨강" },
  { id: "green", value: "#16a34a", label: "초록" },
  { id: "blue", value: "#2563eb", label: "파랑" },
] as const;

const CHOICES = [1, 2, 3, 4, 5] as const;

type Result = {
  score: number;
  total: number;
  wrong: number[];
};

function storageKey(sessionId: string) {
  return `earth-solo-${sessionId}`;
}

export function SoloStudy({ session }: { session: ExamSession }) {
  const files = useMemo(() => examViewerUrls(session), [session]);
  const paperSrc = files.paper && !files.paper.includes("drive.google.com") ? files.paper : null;
  const [tool, setTool] = useState<SoloTool>("pen");
  const [color, setColor] = useState(COLORS[0].value);
  const [omrOpen, setOmrOpen] = useState(false);
  const [grade, setGrade] = useState(3);
  const [classNumber, setClassNumber] = useState(1);
  const [studentNumber, setStudentNumber] = useState(1);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>(() => Array(QUESTION_COUNT).fill(0));
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [keyAnswers, setKeyAnswers] = useState<number[] | null>(null);
  const [points, setPoints] = useState<number[]>(defaultPoints);
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(session.id));
      if (!raw) {
        setAnswers(Array(QUESTION_COUNT).fill(0));
        setStrokes([]);
        setCurrent(0);
        setResult(null);
        return;
      }
      const saved = JSON.parse(raw) as {
        answers?: number[];
        strokes?: InkStroke[];
        grade?: number;
        classNumber?: number;
        studentNumber?: number;
      };
      if (saved.answers?.length === QUESTION_COUNT) setAnswers(saved.answers);
      else setAnswers(Array(QUESTION_COUNT).fill(0));
      setStrokes(Array.isArray(saved.strokes) ? saved.strokes : []);
      if (saved.grade) setGrade(saved.grade);
      if (saved.classNumber) setClassNumber(saved.classNumber);
      if (saved.studentNumber) setStudentNumber(saved.studentNumber);
      setCurrent(0);
      setResult(null);
    } catch {
      setAnswers(Array(QUESTION_COUNT).fill(0));
      setStrokes([]);
    }
  }, [session.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(
        storageKey(session.id),
        JSON.stringify({ answers, strokes, grade, classNumber, studentNumber }),
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [answers, strokes, grade, classNumber, studentNumber, session.id]);

  useEffect(() => {
    let cancelled = false;
    getAnswerKey(session.id)
      .then((key) => {
        if (cancelled) return;
        setKeyAnswers(key?.answers ?? null);
        setPoints(key?.points ?? defaultPoints());
      })
      .catch(() => {
        if (!cancelled) setKeyAnswers(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session.id]);

  function setAnswer(question: number, choice: number) {
    setAnswers((currentAnswers) => {
      const next = [...currentAnswers];
      next[question] = currentAnswers[question] === choice ? 0 : choice;
      return next;
    });
    setCurrent(question);
    setResult(null);
  }

  function markFromPaper(choice: number) {
    const nextAnswers = [...answers];
    nextAnswers[current] = choice;
    setAnswers(nextAnswers);
    setResult(null);
    let nextQuestion = Math.min(QUESTION_COUNT - 1, current + 1);
    for (let index = 1; index < QUESTION_COUNT; index += 1) {
      const candidate = (current + index) % QUESTION_COUNT;
      if (nextAnswers[candidate] === 0) {
        nextQuestion = candidate;
        break;
      }
    }
    setCurrent(nextQuestion);
  }

  function gradePaper() {
    if (!keyAnswers || keyAnswers.some((value) => value < 1)) {
      setMessage("관리자 페이지에서 이 회차 정답을 먼저 저장해 주세요.");
      setResult(null);
      return;
    }
    if (answers.some((value) => value < 1)) {
      setMessage("1번부터 20번까지 답을 모두 칠해 주세요.");
      setResult(null);
      return;
    }
    const wrong: number[] = [];
    let score = 0;
    for (let index = 0; index < QUESTION_COUNT; index += 1) {
      if (answers[index] === keyAnswers[index]) score += points[index] ?? 2;
      else wrong.push(index + 1);
    }
    setMessage("");
    setResult({
      score,
      total: points.reduce((sum, value) => sum + value, 0),
      wrong,
    });
  }

  const omrCard = (
    <aside className="flex h-full flex-col rounded-[4px] border border-[#333] bg-[#1f1f1f]">
      <div className="border-b border-white/8 px-3 py-3">
        <p className="text-xs font-bold tracking-[0.16em] text-[#808080]">OMR 카드</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <IdField label="학년" value={grade} min={1} max={3} onChange={setGrade} />
          <IdField label="반" value={classNumber} min={1} max={15} onChange={setClassNumber} />
          <IdField label="번호" value={studentNumber} min={1} max={40} onChange={setStudentNumber} />
        </div>
        <p className="mt-2 text-[11px] text-[#808080]">
          {gradeLabel(grade)} {classLabel(classNumber)} {studentLabel(studentNumber)}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {Array.from({ length: QUESTION_COUNT }, (_, question) => (
          <div
            key={question}
            className={cn(
              "mb-1 grid grid-cols-[36px_1fr] items-center rounded-[4px] px-1 py-1",
              current === question && "bg-white/8",
            )}
          >
            <button
              type="button"
              onClick={() => setCurrent(question)}
              className="text-sm font-bold text-[#e50914]"
            >
              {question + 1}
            </button>
            <div className="flex gap-1">
              {CHOICES.map((choice) => {
                const selected = answers[question] === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setAnswer(question, choice)}
                    className={cn(
                      "grid h-9 flex-1 place-items-center rounded-full border text-xs",
                      selected
                        ? "border-[#e50914] bg-[#e50914] text-white"
                        : "border-white/20 text-[#d0d0d0]",
                    )}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/8 p-3">
        {message ? <p className="mb-2 text-xs leading-5 text-[#f0c8c8]">{message}</p> : null}
        {result ? (
          <div className="mb-3 rounded-[4px] bg-black/30 px-3 py-2 text-sm">
            <p className="font-bold text-white">
              {result.score} / {result.total}점
            </p>
            <p className="mt-1 text-xs text-[#b3b3b3]">
              {result.wrong.length === 0
                ? "만점입니다."
                : `틀린 문항 ${result.wrong.join(", ")}`}
            </p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={gradePaper}
          className="h-12 w-full rounded-[4px] bg-[#e50914] text-sm font-bold text-white hover:bg-[#c00710]"
        >
          채점하기
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-[calc(100dvh-72px)] flex-col bg-[#0f0f0f]">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-white/8 bg-[#141414]/95 px-3 py-2 backdrop-blur-sm sm:px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold sm:text-base">{session.label}</p>
          <p className="text-[11px] text-[#808080]">
            {session.subjectName} · {current + 1}번 · 선지 1~5를 시험지에 칠하면 OMR에 입력됩니다
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {COLORS.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.label}
              onClick={() => {
                setColor(item.value);
                setTool("pen");
              }}
              className={cn(
                "h-9 w-9 rounded-full border-2",
                color === item.value && tool === "pen"
                  ? "border-white"
                  : "border-transparent opacity-70",
              )}
              style={{ background: item.value }}
            />
          ))}
          <span className="mx-1 hidden h-6 w-px bg-white/15 sm:block" />
          {CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setTool(choice)}
              className={cn(
                "grid h-9 w-9 place-items-center rounded-full border text-sm font-bold",
                tool === choice
                  ? "border-[#e50914] bg-[#e50914] text-white"
                  : "border-white/20 text-[#d0d0d0]",
              )}
            >
              {choice}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTool("erase")}
            className={cn(
              "h-9 rounded-[4px] px-3 text-xs font-bold",
              tool === "erase" ? "bg-white text-black" : "bg-white/10 text-white",
            )}
          >
            지우개
          </button>
          <button
            type="button"
            onClick={() => setStrokes((currentStrokes) => currentStrokes.slice(0, -1))}
            className="h-9 rounded-[4px] bg-white/10 px-3 text-xs font-bold"
          >
            실행 취소
          </button>
          <button
            type="button"
            onClick={() => setOmrOpen((value) => !value)}
            className="h-9 rounded-[4px] bg-[#e50914] px-3 text-xs font-bold text-white lg:hidden"
          >
            OMR
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-h-0 overflow-auto px-3 py-4 sm:px-6">
          {paperSrc ? (
            <SoloPaper
              src={paperSrc}
              tool={tool}
              color={color}
              strokes={strokes}
              onStrokes={setStrokes}
              onMark={markFromPaper}
            />
          ) : (
            <p className="py-24 text-center text-sm text-[#808080]">이 회차 시험지가 없습니다.</p>
          )}
        </div>
        <div className="hidden min-h-0 lg:block">{omrCard}</div>
      </div>

      {omrOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="닫기"
            onClick={() => setOmrOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-[min(360px,92vw)]">
            {omrCard}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IdField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-[11px] text-[#808080]">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || min)))}
        className="h-10 w-full rounded-[4px] border border-white/10 bg-black/30 px-2 text-center text-base"
      />
    </label>
  );
}
