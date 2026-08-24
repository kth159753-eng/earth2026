"use client";

import { IdentityRow } from "@/components/ClassIdentity";
import { OmrCardSheet } from "@/components/OmrCardSheet";
import type { InkStroke, SoloTool } from "@/components/SoloPaper";
import { readActiveClass, subscribeActiveClass, writeActiveClass } from "@/lib/active-class";
import { getAnswerKey, saveSoloArchive } from "@/lib/data";
import { BASE_PATH } from "@/lib/config";
import {
  QUESTION_COUNT,
  defaultPoints,
  examViewerUrls,
  type ExamSession,
} from "@/lib/exams";
import { cn, formatClock } from "@/lib/utils";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

type Result = {
  score: number;
  total: number;
  wrong: number[];
};

function storageKey(sessionId: string) {
  return `earth-solo-${sessionId}`;
}

export function SoloStudy({
  session,
  guest = false,
  initialGrade,
  initialClass,
  onBack,
}: {
  session: ExamSession;
  guest?: boolean;
  initialGrade?: number;
  initialClass?: number;
  onBack?: () => void;
}) {
  const router = useRouter();
  const files = useMemo(() => examViewerUrls(session), [session]);
  const paperSrc = files.paper && !files.paper.includes("drive.google.com") ? files.paper : null;
  const [tool, setTool] = useState<SoloTool>("pen");
  const [color, setColor] = useState<(typeof COLORS)[number]["value"]>(COLORS[0].value);
  const [omrOpen, setOmrOpen] = useState(false);
  const [omrDesktop, setOmrDesktop] = useState(true);
  const [wide, setWide] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const paperPane = useRef<HTMLDivElement>(null);
  const [grade, setGrade] = useState(initialGrade ?? 3);
  const [classNumber, setClassNumber] = useState(initialClass ?? 1);
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
      const raw = localStorage.getItem("earth-omr-sidebar");
      if (raw === "0") setOmrDesktop(false);
      if (raw === "1") setOmrDesktop(true);
    } catch {
      /* ignore */
    }
  }, []);

  useLayoutEffect(() => {
    setHeaderSlot(document.getElementById("earth-header-timer"));
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  function setOmrDesktopPersist(next: boolean) {
    setOmrDesktop(next);
    try {
      localStorage.setItem("earth-omr-sidebar", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(session.id));
      if (!raw) {
        setAnswers(Array(QUESTION_COUNT).fill(0));
        setStrokes([]);
        setCurrent(0);
        setResult(null);
        if (guest && initialGrade) setGrade(initialGrade);
        if (guest && initialClass) setClassNumber(initialClass);
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
      if (guest && initialGrade) setGrade(initialGrade);
      else if (saved.grade) setGrade(saved.grade);
      if (guest && initialClass) setClassNumber(initialClass);
      else if (saved.classNumber) setClassNumber(saved.classNumber);
      if (saved.studentNumber) setStudentNumber(saved.studentNumber);
      setCurrent(0);
      setResult(null);
    } catch {
      setAnswers(Array(QUESTION_COUNT).fill(0));
      setStrokes([]);
    }
  }, [guest, initialClass, initialGrade, session.id]);

  useEffect(() => {
    if (guest) return;
    return subscribeActiveClass((next) => {
      if (!next) return;
      setGrade(next.grade);
      setClassNumber(next.classNumber);
    });
  }, [guest]);

  useEffect(() => {
    if (guest) return;
    const current = readActiveClass();
    writeActiveClass({
      grade,
      classNumber,
      sessionId: current?.sessionId ?? session.id,
      running: current?.running ?? false,
    });
  }, [classNumber, grade, guest, session.id]);

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
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undoStroke();
        return;
      }
      if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        bumpZoom(1);
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        bumpZoom(-1);
        return;
      }
      if (event.key === "0") {
        event.preventDefault();
        setZoom(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const pane = paperPane.current;
    if (!pane) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      bumpZoom(event.deltaY < 0 ? 1 : -1);
    };
    pane.addEventListener("wheel", onWheel, { passive: false });
    return () => pane.removeEventListener("wheel", onWheel);
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

  function bumpZoom(direction: 1 | -1) {
    setZoom((current) => {
      const index = ZOOM_STEPS.reduce((best, step, stepIndex) => {
        return Math.abs(step - current) < Math.abs(ZOOM_STEPS[best] - current) ? stepIndex : best;
      }, 0);
      return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, index + direction))];
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
      setMessage("이 회차 정답이 아직 없습니다.");
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
    if (guest) return;
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
    <OmrCardSheet
      title="OMR 카드"
      subtitle={session.label}
      answers={answers}
      current={current}
      onAnswer={setAnswer}
      onFocus={setCurrent}
      onCollapse={() => {
        setOmrOpen(false);
        setOmrDesktopPersist(false);
      }}
      identity={
        <IdentityRow
          tone="exam"
          grade={grade}
          classNumber={classNumber}
          studentNumber={studentNumber}
          onGrade={setGrade}
          onClass={setClassNumber}
          onStudent={setStudentNumber}
        />
      }
      footer={
        <div>
          {message ? <p className="mb-2 text-xs leading-5 text-[#8a1020]">{message}</p> : null}
          {result ? (
            <div className="mb-2 border border-[#c41e3a] bg-[#fffdf6] px-3 py-2 text-sm">
              <p className="font-black text-[#141414]">
                {result.score} / {result.total}점
              </p>
              <p className="mt-1 text-xs font-bold text-[#5a3a3a]">
                {result.wrong.length === 0
                  ? "만점입니다."
                  : `틀린 문항 ${result.wrong.join(", ")}`}
              </p>
            </div>
          ) : null}
          <div className={cn("grid gap-2", guest ? "grid-cols-1" : "grid-cols-[1fr_auto]")}>
            <button
              type="button"
              onClick={() => void gradePaper()}
              disabled={saving}
              className="h-11 rounded-[2px] bg-[#c41e3a] text-sm font-black text-white hover:bg-[#a01830] disabled:opacity-60"
            >
              {saving ? "보관소로 이동 중..." : "채점하기"}
            </button>
            {guest ? null : (
              <button
                type="button"
                onClick={() => router.push("/vault/")}
                className="h-11 rounded-[2px] border border-[#141414] bg-[#fffdf6] px-4 text-sm font-black text-[#141414]"
              >
                보관소
              </button>
            )}
          </div>
        </div>
      }
    />
  );

  const timer = (
    <SoloTimerBar
      minutes={minutes}
      seconds={seconds}
      remaining={remaining}
      running={running}
      alarm={alarm}
      onMinutes={setMinutes}
      onSeconds={setSeconds}
      onApply={applyDuration}
      onToggle={running ? pauseTimer : startTimer}
    />
  );
  const timerInHeader = Boolean(headerSlot && wide && !guest);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0f0f0f]">
      {timerInHeader && headerSlot ? createPortal(timer, headerSlot) : null}
      <div className="z-10 shrink-0 border-b border-white/8 bg-[#141414]/95 px-2 py-1.5 backdrop-blur-sm sm:px-4">
        <div className="flex items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="h-10 shrink-0 rounded-[4px] bg-white/10 px-3 text-xs font-bold text-white"
            >
              메뉴
            </button>
          ) : null}
          <div className="hidden min-w-0 md:block md:w-[180px] xl:w-[220px]">
            <p className="truncate text-sm font-bold">{session.label}</p>
            <p className="text-[11px] text-[#808080]">
              {current + 1}번 · 선지만 칠해도 OMR에 입력됩니다
            </p>
          </div>
          <div className="min-w-0 flex-1">
            {timerInHeader ? null : timer}
          </div>
          <button
            type="button"
            onClick={() => {
              if (wide) setOmrDesktopPersist(!omrDesktop);
              else setOmrOpen((value) => !value);
            }}
            className={cn(
              "h-10 shrink-0 rounded-[4px] px-3 text-xs font-bold",
              (wide ? omrDesktop : omrOpen)
                ? "bg-[#e50914] text-white"
                : "bg-white/10 text-white",
            )}
          >
            {wide && omrDesktop ? "OMR 접기" : "OMR"}
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
          <span className="mx-0.5 hidden h-6 w-px shrink-0 bg-white/15 sm:block" />
          <div className="flex shrink-0 items-center gap-1 rounded-[4px] bg-white/8 px-1 py-0.5">
            <button
              type="button"
              title="축소"
              aria-label="시험지 축소"
              onClick={() => bumpZoom(-1)}
              disabled={zoom <= ZOOM_STEPS[0]}
              className="grid h-10 w-10 place-items-center rounded-[4px] text-white disabled:opacity-35 sm:h-9 sm:w-9"
            >
              <ZoomIcon minus />
            </button>
            <button
              type="button"
              title="원래 크기"
              onClick={() => setZoom(1)}
              className="min-w-12 text-center text-xs font-bold tabular-nums text-white"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              title="확대"
              aria-label="시험지 확대"
              onClick={() => bumpZoom(1)}
              disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              className="grid h-10 w-10 place-items-center rounded-[4px] text-white disabled:opacity-35 sm:h-9 sm:w-9"
            >
              <ZoomIcon />
            </button>
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={paperPane} className="absolute inset-0 overflow-auto">
          <div className="flex min-h-full min-w-full justify-safe-center px-2 py-3 sm:px-4 sm:py-4">
            {paperSrc ? (
              <SoloPaper
                src={paperSrc}
                tool={tool}
                color={color}
                strokes={strokes}
                onStrokes={setStrokes}
                onMark={markFromPaper}
                zoom={zoom}
              />
            ) : (
              <p className="py-24 text-center text-sm text-[#808080]">이 회차 시험지가 없습니다.</p>
            )}
          </div>
        </div>
        {omrDesktop ? (
          <div className="pointer-events-none absolute inset-y-2 right-2 hidden w-[260px] md:block xl:inset-y-3 xl:right-3 xl:w-[300px]">
            <div className="pointer-events-auto h-full min-h-0">{omrCard}</div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOmrDesktopPersist(true)}
            className="absolute top-1/2 right-0 hidden -translate-y-1/2 rounded-l-[4px] border border-r-0 border-white/10 bg-[#c41e3a] px-2 py-8 text-[11px] font-black tracking-[0.18em] text-white md:block"
          >
            OMR
          </button>
        )}
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

function SoloTimerBar({
  minutes,
  seconds,
  remaining,
  running,
  alarm,
  onMinutes,
  onSeconds,
  onApply,
  onToggle,
}: {
  minutes: number;
  seconds: number;
  remaining: number;
  running: boolean;
  alarm: boolean;
  onMinutes: (value: number) => void;
  onSeconds: (value: number) => void;
  onApply: () => void;
  onToggle: () => void;
}) {
  const clock = formatClock(remaining);
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-[4px] border px-1.5 py-1 sm:gap-1.5",
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
          onChange={(event) => onMinutes(Math.max(0, Number(event.target.value) || 0))}
          className="h-8 w-10 rounded-[4px] border border-white/15 bg-black/40 text-center text-sm text-white sm:w-11"
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
          onChange={(event) => onSeconds(Math.min(59, Math.max(0, Number(event.target.value) || 0)))}
          className="h-8 w-10 rounded-[4px] border border-white/15 bg-black/40 text-center text-sm text-white sm:w-11"
        />
      </label>
      <button
        type="button"
        onClick={onApply}
        className="h-8 rounded-[4px] bg-white/10 px-2 text-[11px] font-bold text-white"
      >
        적용
      </button>
      <p
        className={cn(
          "min-w-[3.5rem] text-center text-sm font-black tabular-nums sm:min-w-[4.25rem] sm:text-base",
          alarm || remaining <= 60 ? "text-[#e50914]" : "text-white",
        )}
      >
        {clock.label}
      </p>
      <button
        type="button"
        onClick={onToggle}
        className="h-8 rounded-[4px] bg-[#e50914] px-2.5 text-[11px] font-bold text-white"
      >
        {running ? "정지" : "시작"}
      </button>
      <button
        type="button"
        onClick={onApply}
        className="h-8 rounded-[4px] bg-white/10 px-2 text-[11px] font-bold text-white"
      >
        리셋
      </button>
    </div>
  );
}

function ZoomIcon({ minus = false }: { minus?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.2" strokeWidth="1.8" />
      <path d="M15.2 15.2 21 21" strokeWidth="1.8" strokeLinecap="round" />
      <path d={minus ? "M7.6 10.5h5.8" : "M10.5 7.6v5.8M7.6 10.5h5.8"} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
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

