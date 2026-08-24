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
  nearbyExamSessions,
  warmExamCatalog,
  warmExamSession,
  type ExamSession,
} from "@/lib/exams";
import { useProfile } from "@/lib/profile-context";
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
  const profile = useProfile();
  const showVault = !guest && profile?.role !== "teacher";
  const files = useMemo(() => examViewerUrls(session), [session]);
  const localSrc = files.paperLocal;
  const driveSrc = files.paperDrive ?? (files.paper?.includes("drive.google.com") ? files.paper : null);
  const [localReady, setLocalReady] = useState(false);
  const [paperFailed, setPaperFailed] = useState(false);
  const paperSrc = localReady && localSrc && !paperFailed ? localSrc : null;
  const onPaperError = useCallback(() => setPaperFailed(true), []);
  const [tool, setTool] = useState<SoloTool>(guest ? "pan" : "pen");
  const [color, setColor] = useState<(typeof COLORS)[number]["value"]>(COLORS[0].value);
  const [omrOpen, setOmrOpen] = useState(false);
  const [omrDesktop, setOmrDesktop] = useState(true);
  const [wide, setWide] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const paperPane = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const [grade, setGrade] = useState(initialGrade ?? 3);
  const [classNumber, setClassNumber] = useState(initialClass ?? 1);
  const [studentNumber, setStudentNumber] = useState(1);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>(() => Array(QUESTION_COUNT).fill(0));
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const answersRef = useRef<number[]>(answers);
  const strokesRef = useRef<InkStroke[]>(strokes);
  const historyRef = useRef<Array<{ answers: number[]; strokes: InkStroke[] }>>([]);
  const [historySize, setHistorySize] = useState(0);
  answersRef.current = answers;
  strokesRef.current = strokes;
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
    const mq = window.matchMedia("(min-width: 1024px)");
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
    setPaperFailed(false);
    historyRef.current = [];
    setHistorySize(0);
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
    warmExamSession(session);
    for (const item of nearbyExamSessions(session)) warmExamSession(item);
    warmExamCatalog(session);
    const nodes = [
      Object.assign(document.createElement("link"), {
        rel: "prefetch",
        href: `${BASE_PATH}/pdf.worker.min.mjs`,
      }),
    ];
    nodes.forEach((node) => document.head.appendChild(node));
    return () => nodes.forEach((node) => node.remove());
  }, [session]);

  useEffect(() => {
    setLocalReady(false);
    setPaperFailed(false);
  }, [session.id]);

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
        undoWork();
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
        applyView(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const pane = paperPane.current;
    if (!pane) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey || event.deltaY)) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      bumpZoom(event.deltaY < 0 ? 1 : -1);
    };
    pane.addEventListener("wheel", onWheel, { passive: false });
    return () => pane.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const pane = paperPane.current;
    if (!pane) return;
    let pinching = false;
    let startDist = 1;
    let startZoom = 1;
    let startScroll = { left: 0, top: 0 };
    let startMid = { x: 0, y: 0 };

    function distance(a: Touch, b: Touch) {
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    function onStart(event: TouchEvent) {
      if (event.touches.length !== 2) return;
      pinching = true;
      startDist = distance(event.touches[0], event.touches[1]) || 1;
      startZoom = zoomRef.current;
      startScroll = { left: pane.scrollLeft, top: pane.scrollTop };
      const box = pane.getBoundingClientRect();
      startMid = {
        x: (event.touches[0].clientX + event.touches[1].clientX) / 2 - box.left,
        y: (event.touches[0].clientY + event.touches[1].clientY) / 2 - box.top,
      };
    }

    function onMove(event: TouchEvent) {
      if (!pinching || event.touches.length !== 2) return;
      event.preventDefault();
      const nextZoom = Math.min(3, Math.max(0.5, startZoom * (distance(event.touches[0], event.touches[1]) / startDist)));
      applyView(nextZoom);
      pane.scrollLeft = ((startScroll.left + startMid.x) / startZoom) * nextZoom - startMid.x;
      pane.scrollTop = ((startScroll.top + startMid.y) / startZoom) * nextZoom - startMid.y;
    }

    function onEnd(event: TouchEvent) {
      if (event.touches.length < 2) pinching = false;
    }

    pane.addEventListener("touchstart", onStart, { capture: true, passive: true });
    pane.addEventListener("touchmove", onMove, { capture: true, passive: false });
    pane.addEventListener("touchend", onEnd, { capture: true });
    pane.addEventListener("touchcancel", onEnd, { capture: true });
    return () => {
      pane.removeEventListener("touchstart", onStart, true);
      pane.removeEventListener("touchmove", onMove, true);
      pane.removeEventListener("touchend", onEnd, true);
      pane.removeEventListener("touchcancel", onEnd, true);
    };
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

  function persistDraft(nextAnswers: number[], nextStrokes: InkStroke[]) {
    try {
      localStorage.setItem(
        storageKey(session.id),
        JSON.stringify({ answers: nextAnswers, strokes: nextStrokes, grade, classNumber, studentNumber }),
      );
    } catch {
      /* ignore */
    }
  }

  function rememberWork() {
    historyRef.current = [
      ...historyRef.current.slice(-49),
      { answers: answersRef.current.slice(), strokes: strokesRef.current.slice() },
    ];
    setHistorySize(historyRef.current.length);
  }

  function applyDraft(nextAnswers: number[], nextStrokes: InkStroke[]) {
    answersRef.current = nextAnswers;
    strokesRef.current = nextStrokes;
    setAnswers(nextAnswers);
    setStrokes(nextStrokes);
    persistDraft(nextAnswers, nextStrokes);
  }

  function setAnswer(question: number, choice: number) {
    const currentAnswers = answersRef.current;
    const nextValue = currentAnswers[question] === choice ? 0 : choice;
    if (nextValue === currentAnswers[question]) return;
    rememberWork();
    const next = [...currentAnswers];
    next[question] = nextValue;
    applyDraft(next, strokesRef.current);
    setCurrent(question);
    setResult(null);
  }

  const markFromPaper = useCallback((choice: number, questionIndex = current) => {
    const question = Math.min(QUESTION_COUNT - 1, Math.max(0, questionIndex));
    const next = [...answersRef.current];
    next[question] = choice;
    answersRef.current = next;
    setAnswers(next);
    setCurrent(question);
    setResult(null);
  }, [current]);

  function handleStrokes(next: InkStroke[] | ((current: InkStroke[]) => InkStroke[])) {
    const current = strokesRef.current;
    const resolved = typeof next === "function" ? next(current) : next;
    if (resolved === current) return;
    rememberWork();
    applyDraft(answersRef.current, resolved);
  }

  function undoWork() {
    const snapshot = historyRef.current.pop();
    if (snapshot) {
      setHistorySize(historyRef.current.length);
      applyDraft(snapshot.answers, snapshot.strokes);
      setResult(null);
      setMessage("");
      return;
    }

    const currentStrokes = strokesRef.current;
    if (currentStrokes.length > 0) {
      const last = currentStrokes[currentStrokes.length - 1];
      const nextStrokes = currentStrokes.slice(0, -1);
      let nextAnswers = answersRef.current;
      const question = last?.question;
      const choice = last?.omrChoice ?? last?.mark;
      if (question !== undefined && choice && nextAnswers[question] === choice) {
        nextAnswers = [...nextAnswers];
        nextAnswers[question] = 0;
      }
      applyDraft(nextAnswers, nextStrokes);
      setResult(null);
      setMessage("");
      return;
    }

    const filled = answersRef.current
      .map((value, index) => (value > 0 ? index : -1))
      .filter((index) => index >= 0);
    if (filled.length === 0) return;
    const nextAnswers = [...answersRef.current];
    nextAnswers[filled[filled.length - 1]] = 0;
    applyDraft(nextAnswers, currentStrokes);
    setResult(null);
    setMessage("");
  }

  function applyView(nextZoom: number) {
    const z = Math.min(3, Math.max(0.5, nextZoom));
    zoomRef.current = z;
    setZoom(z);
  }

  function bumpZoom(direction: 1 | -1) {
    const index = ZOOM_STEPS.reduce((best, step, stepIndex) => {
      return Math.abs(step - zoomRef.current) < Math.abs(ZOOM_STEPS[best] - zoomRef.current)
        ? stepIndex
        : best;
    }, 0);
    applyView(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, index + direction))]);
  }

  function resetWork() {
    const emptyAnswers = Array(QUESTION_COUNT).fill(0);
    const hasWork = strokesRef.current.length > 0 || answersRef.current.some((value) => value > 0);
    if (!hasWork && zoomRef.current === 1 && !result) return;
    if (hasWork) rememberWork();
    applyDraft(emptyAnswers, []);
    setCurrent(0);
    setResult(null);
    setMessage("");
    applyView(1);
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
      if (showVault) router.push("/vault/");
    } catch {
      setMessage("채점은 끝났습니다. 보관소 저장에 실패했습니다.");
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
          <div className={cn("grid gap-2", showVault ? "grid-cols-[1fr_auto]" : "grid-cols-1")}>
            <button
              type="button"
              onClick={() => void gradePaper()}
              disabled={saving}
              className="h-11 rounded-[2px] bg-[#c41e3a] text-sm font-black text-white hover:bg-[#a01830] disabled:opacity-60"
            >
              {saving ? (showVault ? "보관소로 이동 중..." : "저장 중...") : "채점하기"}
            </button>
            {showVault ? (
              <button
                type="button"
                onClick={() => router.push("/vault/")}
                className="h-11 rounded-[2px] border border-[#141414] bg-[#fffdf6] px-4 text-sm font-black text-[#141414]"
              >
                보관소
              </button>
            ) : null}
          </div>
        </div>
      }
    />
  );

  function setMinutesLive(value: number) {
    const next = Math.max(0, value);
    setMinutes(next);
    if (!running) {
      setRemaining(next * 60 + seconds);
      setAlarm(false);
    }
  }

  function setSecondsLive(value: number) {
    const next = Math.min(59, Math.max(0, value));
    setSeconds(next);
    if (!running) {
      setRemaining(minutes * 60 + next);
      setAlarm(false);
    }
  }

  const timer = (
    <SoloTimerBar
      minutes={minutes}
      seconds={seconds}
      remaining={remaining}
      running={running}
      alarm={alarm}
      compact={Boolean(headerSlot && wide && !guest)}
      onMinutes={setMinutesLive}
      onSeconds={setSecondsLive}
      onStart={startTimer}
      onStop={pauseTimer}
      onReset={applyDuration}
    />
  );
  const timerInHeader = Boolean(headerSlot && wide && !guest);
  const topBar = Boolean(onBack || !timerInHeader);
  const omrButton = (
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
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0f0f0f]">
      {timerInHeader && headerSlot ? createPortal(timer, headerSlot) : null}
      <div className="z-10 shrink-0 border-b border-white/8 bg-[#141414] px-2 py-1.5 sm:px-4">
        {topBar ? (
          <div className="flex items-center gap-2">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="h-9 shrink-0 rounded-[4px] bg-white/10 px-3 text-xs font-bold text-white"
              >
                메뉴
              </button>
            ) : null}
            <p className="min-w-0 flex-1 truncate text-sm font-bold leading-5">
              {session.label}
            </p>
            {omrButton}
          </div>
        ) : null}
        {timerInHeader ? null : <div className={cn(topBar && "mt-1.5")}>{timer}</div>}
        <div className={cn("flex items-center gap-2 sm:gap-3", (topBar || !timerInHeader) && "mt-1.5")}>
          {topBar ? null : (
            <p className="min-w-0 max-w-[36vw] shrink-0 truncate text-sm font-bold leading-5 sm:max-w-[220px]">
              {session.label}
            </p>
          )}
          <div className="-mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
          <button
            type="button"
            title="지우개"
            onClick={() => setTool("erase")}
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full border sm:h-9 sm:w-9",
              tool === "erase" ? "border-white bg-white text-black" : "border-white/20 bg-white/10 text-white",
            )}
          >
            <EraserIcon />
          </button>
          <button
            type="button"
            title="화면 이동"
            onClick={() => setTool("pan")}
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full border sm:h-9 sm:w-9",
              tool === "pan" ? "border-white bg-white text-black" : "border-white/20 bg-white/10 text-white",
            )}
          >
            <PanIcon />
          </button>
          <span className="mx-0.5 hidden h-6 w-px shrink-0 bg-white/15 sm:block" />
          {CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setTool(choice)}
              className={cn(
                "hidden h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-bold sm:grid",
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
            title="되돌리기"
            onClick={undoWork}
            disabled={historySize === 0 && strokes.length === 0 && answers.every((value) => value === 0)}
            className="h-10 shrink-0 rounded-[4px] bg-white/10 px-2.5 text-xs font-bold text-white disabled:opacity-35 sm:h-9"
          >
            되돌리기
          </button>
          <button
            type="button"
            title="초기화"
            onClick={resetWork}
            disabled={strokes.length === 0 && answers.every((value) => value === 0) && zoom === 1 && !result}
            className="h-10 shrink-0 rounded-[4px] bg-[#e50914]/85 px-2.5 text-xs font-bold text-white disabled:opacity-35 sm:h-9"
          >
            초기화
          </button>
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
              onClick={() => applyView(1)}
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
          {topBar ? null : omrButton}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={paperPane} className="absolute inset-0 overflow-auto overscroll-contain">
          <div
            className="relative"
            style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, minHeight: "100%" }}
          >
            {paperSrc && !paperFailed ? (
              <div className="min-h-full min-w-full px-2 py-3 sm:px-4 sm:py-4">
                <SoloPaper
                  src={paperSrc}
                  tool={tool}
                  color={color}
                  strokes={strokes}
                  onStrokes={handleStrokes}
                  onMark={markFromPaper}
                  zoom={1}
                  onError={onPaperError}
                />
              </div>
            ) : driveSrc ? (
              <iframe
                title={`${session.label} 시험지`}
                src={driveSrc}
                className="pointer-events-none h-full w-full border-0 bg-white"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            ) : (
              <p className="py-24 text-center text-sm text-[#808080]">이 회차 시험지가 없습니다.</p>
            )}
          </div>
        </div>
        {omrDesktop ? (
          <div className="pointer-events-none absolute inset-y-2 right-2 hidden w-[260px] lg:block xl:inset-y-3 xl:right-3 xl:w-[300px]">
            <div className="pointer-events-auto h-full min-h-0">{omrCard}</div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOmrDesktopPersist(true)}
            className="absolute top-1/2 right-0 hidden -translate-y-1/2 rounded-l-[4px] border border-r-0 border-white/10 bg-[#c41e3a] px-2 py-8 text-[11px] font-black tracking-[0.18em] text-white lg:block"
          >
            OMR
          </button>
        )}
      </div>

      {omrOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
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
  compact = false,
  onMinutes,
  onSeconds,
  onStart,
  onStop,
  onReset,
}: {
  minutes: number;
  seconds: number;
  remaining: number;
  running: boolean;
  alarm: boolean;
  compact?: boolean;
  onMinutes: (value: number) => void;
  onSeconds: (value: number) => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}) {
  const clock = formatClock(remaining);
  const inputClass =
    "h-8 w-7 bg-transparent text-center text-[16px] font-bold tabular-nums text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-[4px] border px-1.5 py-1",
        compact ? "w-auto" : "w-full",
        alarm ? "border-[#e50914] bg-[#e50914]/15" : "border-[#e50914]/70 bg-black/35",
      )}
    >
      <div className="flex h-8 shrink-0 items-center rounded-[4px] bg-black/45 px-1">
        <label className="sr-only" htmlFor="solo-timer-min">제한 시간 분</label>
        <input
          id="solo-timer-min"
          type="number"
          min={0}
          max={180}
          inputMode="numeric"
          value={minutes}
          onChange={(event) => onMinutes(Math.max(0, Number(event.target.value) || 0))}
          className={inputClass}
        />
        <span className="px-0.5 text-xs font-bold text-[#808080]">:</span>
        <label className="sr-only" htmlFor="solo-timer-sec">제한 시간 초</label>
        <input
          id="solo-timer-sec"
          type="number"
          min={0}
          max={59}
          inputMode="numeric"
          value={seconds}
          onChange={(event) => onSeconds(Math.min(59, Math.max(0, Number(event.target.value) || 0)))}
          className={inputClass}
        />
      </div>
      <p
        className={cn(
          "min-w-0 flex-1 text-center font-black tabular-nums leading-none",
          compact ? "text-base" : "text-lg sm:text-xl",
          alarm || remaining <= 60 ? "text-[#e50914]" : "text-white",
        )}
      >
        {clock.label}
      </p>
      <div className="grid shrink-0 grid-cols-3 gap-1">
        <button
          type="button"
          onClick={onStart}
          disabled={running}
          className="h-8 min-w-11 rounded-[4px] bg-[#e50914] px-1.5 text-[11px] font-bold text-white disabled:bg-white/10 disabled:text-white/45"
        >
          시작
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={!running}
          className="h-8 min-w-11 rounded-[4px] bg-[#e50914] px-1.5 text-[11px] font-bold text-white disabled:bg-white/10 disabled:text-white/45"
        >
          정지
        </button>
        <button
          type="button"
          onClick={onReset}
          className="h-8 min-w-11 rounded-[4px] bg-white/12 px-1.5 text-[11px] font-bold text-white"
        >
          리셋
        </button>
      </div>
    </div>
  );
}

function EraserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" aria-hidden>
      <path d="M14.8 5.4 6.2 14a2.2 2.2 0 0 0 0 3.1l1.8 1.8h5.2L20 11.1z" />
      <path d="M8.2 19h9.6" />
    </svg>
  );
}

function PanIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" aria-hidden>
      <path d="M12 3.6v16.8M3.6 12h16.8" strokeLinecap="round" />
      <path d="m12 3.6 2.4 2.4M12 3.6 9.6 6M12 20.4l2.4-2.4M12 20.4l-2.4-2.4M3.6 12l2.4 2.4M3.6 12l2.4-2.4M20.4 12l-2.4 2.4M20.4 12l-2.4-2.4" strokeLinecap="round" />
    </svg>
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

