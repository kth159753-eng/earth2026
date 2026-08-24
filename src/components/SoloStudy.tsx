"use client";

import type { InkStroke, SoloTool } from "@/components/SoloPaper";
import { getAnswerKey, saveSoloArchive } from "@/lib/data";
import { BASE_PATH } from "@/lib/config";
import {
  QUESTION_COUNT,
  defaultPoints,
  examViewerUrls,
  type ExamSession,
} from "@/lib/exams";
import { classLabel, cn, formatClock, gradeLabel, studentLabel } from "@/lib/utils";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SoloPaper = dynamic(
  () => import("@/components/SoloPaper").then((mod) => ({ default: mod.SoloPaper })),
  {
    ssr: false,
    loading: () => (
      <p className="py-24 text-center text-sm text-[#808080]">시험지를 열고 있습니다...</p>
    ),
  },
);

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
  const router = useRouter();
  const files = useMemo(() => examViewerUrls(session), [session]);
  const paperSrc = files.paper && !files.paper.includes("drive.google.com") ? files.paper : null;
  const [tool, setTool] = useState<SoloTool>("pen");
  const [color, setColor] = useState<(typeof COLORS)[number]["value"]>(COLORS[0].value);
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
  const [saving, setSaving] = useState(false);
  const [minutes, setMinutes] = useState(30);
  const [seconds, setSeconds] = useState(0);
  const [remaining, setRemaining] = useState(30 * 60);
  const [running, setRunning] = useState(false);
  const [alarm, setAlarm] = useState(false);
  const endAt = useRef<number | null>(null);

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
    }, 800);
    return () => window.clearTimeout(timer);
  }, [answers, strokes, grade, classNumber, studentNumber, session.id]);

  useEffect(() => {
    const nodes = [
      Object.assign(document.createElement("link"), {
        rel: "prefetch",
        href: `${BASE_PATH}/pdf.worker.min.mjs`,
      }),
    ];
    if (paperSrc) {
      nodes.push(
        Object.assign(document.createElement("link"), {
          rel: "prefetch",
          as: "fetch",
          href: paperSrc,
        }),
      );
    }
    nodes.forEach((node) => document.head.appendChild(node));
    return () => nodes.forEach((node) => node.remove());
  }, [paperSrc]);

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

  useEffect(() => {
    const tick = () => {
      if (!running || !endAt.current) return;
      const next = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) {
        setRunning(false);
        setAlarm(true);
        playAlarm();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z" || event.shiftKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      undoStroke();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function applyDuration() {
    const next = Math.max(0, minutes * 60 + seconds);
    setRemaining(next);
    setAlarm(false);
    setRunning(false);
    endAt.current = null;
  }

  function startTimer() {
    const next = remaining <= 0 ? Math.max(1, minutes * 60 + seconds) : remaining;
    endAt.current = Date.now() + next * 1000;
    setRemaining(next);
    setAlarm(false);
    setRunning(true);
  }

  function pauseTimer() {
    setRunning(false);
    endAt.current = null;
  }

  function setAnswer(question: number, choice: number) {
    setAnswers((currentAnswers) => {
      const next = [...currentAnswers];
      next[question] = currentAnswers[question] === choice ? 0 : choice;
      return next;
    });
    setCurrent(question);
    setResult(null);
  }

  const markFromPaper = useCallback((choice: number, questionIndex = current) => {
    const question = Math.min(QUESTION_COUNT - 1, Math.max(0, questionIndex));
    setAnswers((currentAnswers) => {
      const next = [...currentAnswers];
      next[question] = choice;
      return next;
    });
    setCurrent(question);
    setResult(null);
  }, [current]);

  function undoStroke() {
    setStrokes((currentStrokes) => {
      const last = currentStrokes[currentStrokes.length - 1];
      const question = last?.question;
      const choice = last?.omrChoice ?? last?.mark;
      if (question !== undefined && choice) {
        setAnswers((currentAnswers) => {
          if (currentAnswers[question] !== choice) return currentAnswers;
          const next = [...currentAnswers];
          next[question] = 0;
          return next;
        });
      }
      return currentStrokes.slice(0, -1);
    });
  }

  function resetWork() {
    setStrokes([]);
    setAnswers(Array(QUESTION_COUNT).fill(0));
    setCurrent(0);
    setResult(null);
    setMessage("");
  }

  async function gradePaper() {
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
    const total = points.reduce((sum, value) => sum + value, 0);
    setMessage("");
    setResult({ score, total, wrong });
    setSaving(true);
    try {
      await saveSoloArchive({
        sessionId: session.id,
        grade,
        classNumber,
        studentNumber,
        answers,
        score,
        total,
        wrongQuestions: wrong,
      });
      router.push("/vault/");
    } catch {
      setMessage("채점은 끝났습니다. 보관소 이동에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const omrCard = (
    <aside className="flex h-full max-h-full flex-col rounded-[4px] border border-[#333] bg-[#1f1f1f]">
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
        <div className="mt-2 px-1 pb-2">
          {message ? <p className="mb-2 text-xs leading-5 text-[#f0c8c8]">{message}</p> : null}
          {result ? (
            <div className="mb-2 rounded-[4px] bg-black/30 px-3 py-2 text-sm">
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
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              onClick={() => void gradePaper()}
              disabled={saving}
              className="h-12 rounded-[4px] bg-[#e50914] text-sm font-bold text-white hover:bg-[#c00710] disabled:opacity-60"
            >
              {saving ? "보관소로 이동 중..." : "채점하기"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/vault/")}
              className="h-12 rounded-[4px] bg-white/10 px-4 text-sm font-bold text-white"
            >
              보관소
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  const clock = formatClock(remaining);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0f0f0f]">
      <div className="z-10 shrink-0 border-b border-white/8 bg-[#141414]/95 px-2 py-1.5 backdrop-blur-sm sm:px-4">
        <div className="flex items-center gap-2">
          <div className="hidden min-w-0 md:block md:w-[180px] xl:w-[220px]">
            <p className="truncate text-sm font-bold">{session.label}</p>
            <p className="text-[11px] text-[#808080]">
              {current + 1}번 · 선지만 칠해도 OMR에 입력됩니다
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "flex flex-wrap items-center justify-center gap-1.5 rounded-[4px] border px-1.5 py-1 sm:gap-2 sm:px-2",
                alarm ? "border-[#e50914] bg-[#e50914]/15" : "border-[#e50914]/70 bg-black/35",
              )}
            >
              <label className="flex items-center gap-1 text-[11px] text-[#808080]">
                분
                <input
                  type="number"
                  min={0}
                  max={180}
                  inputMode="numeric"
                  value={minutes}
                  onChange={(event) => setMinutes(Math.max(0, Number(event.target.value) || 0))}
                  className="h-10 w-11 rounded-[4px] border border-white/15 bg-black/40 text-center text-base text-white sm:h-8 sm:w-12 sm:text-sm"
                />
              </label>
              <label className="flex items-center gap-1 text-[11px] text-[#808080]">
                초
                <input
                  type="number"
                  min={0}
                  max={59}
                  inputMode="numeric"
                  value={seconds}
                  onChange={(event) => setSeconds(Math.min(59, Math.max(0, Number(event.target.value) || 0)))}
                  className="h-10 w-11 rounded-[4px] border border-white/15 bg-black/40 text-center text-base text-white sm:h-8 sm:w-12 sm:text-sm"
                />
              </label>
              <button
                type="button"
                onClick={applyDuration}
                className="h-10 rounded-[4px] bg-white/10 px-2 text-[11px] font-bold text-white sm:h-8"
              >
                적용
              </button>
              <p
                className={cn(
                  "min-w-[3.75rem] text-center text-lg font-black tabular-nums sm:min-w-[4.5rem] sm:text-base",
                  alarm || remaining <= 60 ? "text-[#e50914]" : "text-white",
                )}
              >
                {clock.label}
              </p>
              <button
                type="button"
                onClick={running ? pauseTimer : startTimer}
                className="h-10 rounded-[4px] bg-[#e50914] px-2.5 text-[11px] font-bold text-white sm:h-8 sm:px-3"
              >
                {running ? "정지" : "시작"}
              </button>
              <button
                type="button"
                onClick={applyDuration}
                className="h-10 rounded-[4px] bg-white/10 px-2 text-[11px] font-bold text-white sm:h-8"
              >
                리셋
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOmrOpen((value) => !value)}
            className="h-10 shrink-0 rounded-[4px] bg-[#e50914] px-3 text-xs font-bold text-white md:hidden"
          >
            OMR
          </button>
        </div>
        <div className="-mx-1 mt-1.5 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                "h-10 w-10 shrink-0 rounded-full border-2 sm:h-9 sm:w-9",
                color === item.value && tool === "pen"
                  ? "border-white"
                  : "border-transparent opacity-70",
              )}
              style={{ background: item.value }}
            />
          ))}
          <span className="mx-0.5 hidden h-6 w-px shrink-0 bg-white/15 sm:block" />
          {CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setTool(choice)}
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full border text-sm font-bold sm:h-9 sm:w-9",
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
              "h-10 shrink-0 rounded-[4px] px-3 text-xs font-bold sm:h-9",
              tool === "erase" ? "bg-white text-black" : "bg-white/10 text-white",
            )}
          >
            지우개
          </button>
          <button
            type="button"
            onClick={undoStroke}
            className="h-10 shrink-0 rounded-[4px] bg-white/10 px-3 text-xs font-bold sm:h-9"
          >
            실행 취소
          </button>
          <button
            type="button"
            onClick={resetWork}
            className="h-10 shrink-0 rounded-[4px] bg-white/10 px-3 text-xs font-bold sm:h-9"
          >
            초기화
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_240px] xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-h-0 justify-center overflow-auto px-2 py-3 sm:px-4 sm:py-4">
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
        <div className="hidden h-full min-h-0 md:block">{omrCard}</div>
      </div>

      {omrOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="닫기"
            onClick={() => setOmrOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 h-[min(82dvh,720px)] overflow-hidden rounded-t-xl pb-[env(safe-area-inset-bottom)] sm:inset-y-0 sm:right-0 sm:left-auto sm:h-auto sm:w-[min(380px,92vw)] sm:rounded-none">
            {omrCard}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function playAlarm() {
  try {
    const context = new AudioContext();
    const now = context.currentTime;
    [0, 0.35, 0.7].forEach((offset) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.12, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.28);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.3);
    });
  } catch {
    /* ignore */
  }
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
