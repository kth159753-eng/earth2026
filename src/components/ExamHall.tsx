"use client";

import { ensureOmrCode } from "@/lib/actions/teacher";
import { IdentityRow } from "@/components/ClassIdentity";
import { readActiveClass, subscribeActiveClass, writeActiveClass } from "@/lib/active-class";
import { siblingSession, type ExamSession } from "@/lib/exams";
import type { ClassConfig } from "@/lib/types";
import { omrUrl as buildOmrUrl } from "@/lib/config";
import {
  playFiveLeftAlert,
  playTenLeftAlert,
  stopExamAlerts,
  unlockExamAudio,
} from "@/lib/exam-alerts";
import { classLabel, cn, formatClock, gradeLabel } from "@/lib/utils";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((mod) => ({ default: mod.QRCodeSVG })),
  { ssr: false },
);

const SUNEUNG_2027 = new Date(2026, 10, 19);

function suneungCountdown(today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const exam = new Date(
    SUNEUNG_2027.getFullYear(),
    SUNEUNG_2027.getMonth(),
    SUNEUNG_2027.getDate(),
  );
  const days = Math.round((exam.getTime() - start.getTime()) / 86_400_000);
  return days > 0 ? `D-${days}` : days === 0 ? "D-DAY" : `D+${Math.abs(days)}`;
}

function clockTension(remaining: number, alarm: boolean) {
  if (alarm || remaining <= 5 * 60) return "panic" as const;
  if (remaining <= 10 * 60) return "hot" as const;
  if (remaining <= 15 * 60) return "warn" as const;
  return "calm" as const;
}

const SWEAT_COUNT = { calm: 0, warn: 8, hot: 16, panic: 28 } as const;
const SWEAT_DURATION = { warn: 2.1, hot: 1.35, panic: 0.75 } as const;

function SweatDrops({ level }: { level: Exclude<ReturnType<typeof clockTension>, "calm"> }) {
  const coarse =
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const count = coarse ? Math.ceil(SWEAT_COUNT[level] / 2) : SWEAT_COUNT[level];
  const duration = SWEAT_DURATION[level];
  return (
    <div className="sweat-layer" aria-hidden>
      {Array.from({ length: count }, (_, index) => {
        const left = 6 + ((index * 37) % 88);
        const top = (index % 5) * 10;
        const delay = ((index * 13) % 18) / 10;
        return (
          <span
            key={index}
            className={cn("sweat-drop", `sweat-drop-${level}`)}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              animationDuration: `${duration + (index % 5) * 0.08}s`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}

function ClockFace({
  display,
  remaining,
  alarm,
}: {
  display: { hours: string; minutes: string; seconds: string };
  remaining: number;
  alarm: boolean;
}) {
  const level = clockTension(remaining, alarm);
  return (
    <div className="relative mx-auto w-fit">
      {level !== "calm" ? <SweatDrops level={level} /> : null}
      <div
        className={cn(
          "clock-glow relative font-bold leading-none whitespace-nowrap text-white",
          level === "warn" && "clock-glow-warn",
          level === "hot" && "clock-glow-hot",
          level === "panic" && "clock-glow-panic",
        )}
      >
        {display.hours !== "00" ? `${display.hours}:` : null}
        {display.minutes}:{display.seconds}
      </div>
    </div>
  );
}

type Props = {
  session: ExamSession;
  classes: ClassConfig[];
};

export function ExamHall({ session, classes }: Props) {
  const grouped = useMemo(() => {
    const grades = Array.from(new Set(classes.map((row) => row.grade))).sort();
    return { grades, classes };
  }, [classes]);

  const [grade, setGrade] = useState(grouped.grades[0] ?? 3);
  const classOptions = classes.filter((row) => row.grade === grade);
  const [classNumber, setClassNumber] = useState(classOptions[0]?.class_number ?? 1);
  const [classReady, setClassReady] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const pairSession = useMemo(() => siblingSession(session), [session]);
  const [immersive, setImmersive] = useState(false);
  const [now, setNow] = useState("");
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [seconds, setSeconds] = useState(0);
  const [remaining, setRemaining] = useState(30 * 60);
  const [running, setRunning] = useState(false);
  const [alarm, setAlarm] = useState(false);
  const [omrUrl, setOmrUrl] = useState("");
  const endAt = useRef<number | null>(null);
  const alertPrev = useRef(30 * 60);
  const fired10 = useRef(false);
  const fired5 = useRef(false);

  useEffect(() => {
    if (classReady || classes.length === 0) return;
    const saved = readActiveClass();
    if (
      saved &&
      classes.some((row) => row.grade === saved.grade && row.class_number === saved.classNumber)
    ) {
      setGrade(saved.grade);
      setClassNumber(saved.classNumber);
    }
    setClassReady(true);
  }, [classReady, classes]);

  useEffect(() => {
    if (!classReady) return;
    return subscribeActiveClass((next) => {
      if (!next) return;
      if (
        !classes.some(
          (row) => row.grade === next.grade && row.class_number === next.classNumber,
        )
      ) {
        return;
      }
      setGrade((current) => (current === next.grade ? current : next.grade));
      setClassNumber((current) =>
        current === next.classNumber ? current : next.classNumber,
      );
    });
  }, [classReady, classes]);

  useEffect(() => {
    const available = classes.filter((row) => row.grade === grade);
    if (!available.some((row) => row.class_number === classNumber)) {
      setClassNumber(available[0]?.class_number ?? 1);
    }
  }, [grade, classNumber, classes]);

  useEffect(() => {
    if (!classReady || classes.length === 0) return;
    writeActiveClass({
      grade,
      classNumber,
      sessionId: session.id,
      running,
    });
    return () => {
      const current = readActiveClass();
      if (
        current &&
        current.grade === grade &&
        current.classNumber === classNumber &&
        current.sessionId === session.id
      ) {
        writeActiveClass({ ...current, running: false });
      }
    };
  }, [classReady, grade, classNumber, session.id, running, classes.length]);

  useEffect(() => {
    let cancelled = false;
    if (classes.length === 0) return;
    ensureOmrCode(session.id, grade, classNumber)
      .then((result) => {
        if (!cancelled) setCode(result.code);
      })
      .catch(() => {
        if (!cancelled) setCode(null);
      });
    if (pairSession) {
      ensureOmrCode(pairSession.id, grade, classNumber)
        .then((result) => {
          if (!cancelled) setPairCode(result.code);
        })
        .catch(() => {
          if (!cancelled) setPairCode(null);
        });
    } else {
      setPairCode(null);
    }
    return () => {
      cancelled = true;
    };
  }, [session.id, pairSession, grade, classNumber, classes.length]);

  useEffect(() => {
    setOmrUrl(code ? buildOmrUrl(code, pairCode) : "");
  }, [code, pairCode]);

  const codeI = session.subject === "I" ? code : pairCode;
  const codeII = session.subject === "II" ? code : pairCode;
  const urlI = codeI ? buildOmrUrl(codeI, codeII) : "";
  const urlII = codeII ? buildOmrUrl(codeII, codeI) : "";

  useEffect(() => {
    const tick = () => {
      const date = new Date();
      setNow(
        `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`,
      );
      if (running && endAt.current) {
        const next = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
        setRemaining(next);
        if (next === 0) {
          setRunning(false);
          setAlarm(true);
          playAlarm();
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const display = formatClock(remaining);
  const total = Math.max(1, hours * 3600 + minutes * 60 + seconds);
  const progress = Math.min(1, remaining / total);
  function applyDuration() {
    const next = hours * 3600 + minutes * 60 + seconds;
    setRemaining(next);
    setAlarm(false);
    setRunning(false);
    endAt.current = null;
    fired10.current = false;
    fired5.current = false;
    alertPrev.current = next;
    stopExamAlerts();
  }

  function start() {
    unlockExamAudio();
    if (remaining <= 0) applyDuration();
    const next = remaining <= 0 ? hours * 3600 + minutes * 60 + seconds : remaining;
    endAt.current = Date.now() + next * 1000;
    setRemaining(next);
    setAlarm(false);
    setRunning(true);
    alertPrev.current = next;
  }

  function pause() {
    setRunning(false);
    endAt.current = null;
  }

  function reset() {
    applyDuration();
  }

  function enterFullscreen() {
    const node = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const request = node.requestFullscreen || node.webkitRequestFullscreen;
    if (request) void Promise.resolve(request.call(node)).catch(() => undefined);
  }

  function leaveFullscreen() {
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      webkitFullscreenElement?: Element | null;
    };
    const active = document.fullscreenElement || doc.webkitFullscreenElement;
    const exit = document.exitFullscreen || doc.webkitExitFullscreen;
    if (active && exit) void Promise.resolve(exit.call(document)).catch(() => undefined);
  }

  function toggleImmersive() {
    if (immersive) {
      setImmersive(false);
      stopExamAlerts();
      leaveFullscreen();
      return;
    }
    unlockExamAudio();
    setImmersive(true);
    enterFullscreen();
  }

  useEffect(() => {
    if (!immersive || !running) {
      alertPrev.current = remaining;
      return;
    }
    const prev = alertPrev.current;
    alertPrev.current = remaining;
    if (!fired10.current && remaining > 0 && (remaining === 600 || (prev > 600 && remaining <= 600))) {
      fired10.current = true;
      void playTenLeftAlert();
    }
    if (!fired5.current && remaining > 0 && (remaining === 300 || (prev > 300 && remaining <= 300))) {
      fired5.current = true;
      void playFiveLeftAlert();
    }
  }, [immersive, remaining, running]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setImmersive(false);
        stopExamAlerts();
        leaveFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative isolate flex min-h-[calc(100dvh-72px)] flex-col overflow-x-hidden bg-[#141414] pb-[env(safe-area-inset-bottom)] lg:h-[calc(100dvh-72px)] lg:overflow-hidden">
      <div className="starfield" />
      <div className="vignette" />

      <div className="relative mx-auto flex min-h-0 w-full max-w-[1760px] flex-1 flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-[3%] sm:py-4">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold leading-tight text-white sm:text-[28px]">
              {session.label}
            </h1>
            <p className="mt-1 text-sm text-[#d0d0d0] sm:text-base">
              {session.subjectName} · 20문항 · {now || "--:--:--"}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleImmersive}
            className="h-12 w-full shrink-0 rounded-[4px] bg-[#e50914] px-5 text-sm font-bold text-white hover:bg-[#c00710] sm:w-auto"
          >
            몰입 모드
          </button>
        </div>

        <div className="grid min-h-0 flex-1 items-stretch gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.52fr)] xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,0.5fr)]">
          <section
            className={cn(
              "relative flex min-h-[38dvh] flex-col justify-center overflow-hidden rounded-[4px] bg-black px-3 py-5 text-center sm:min-h-[46dvh] sm:px-6 sm:py-7 lg:h-full lg:min-h-0 lg:px-8 lg:py-8",
              alarm && "alarm-flash",
            )}
          >
            <p className="text-sm font-bold text-[#c8c8c8] sm:text-lg">남은 시간</p>
            <div className="mt-2 sm:mt-3" style={{ fontSize: "clamp(2.6rem, 16vw, 14rem)" }}>
              <ClockFace display={display} remaining={remaining} alarm={alarm} />
            </div>
            <div className="nf-progress mx-auto mt-4 h-2 w-full max-w-3xl sm:mt-8">
              <span style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="mx-auto mt-4 grid w-full max-w-lg grid-cols-3 gap-2 sm:mt-8 sm:gap-3">
              <TimeField label="시" value={hours} max={3} onChange={setHours} />
              <TimeField label="분" value={minutes} max={59} onChange={setMinutes} />
              <TimeField label="초" value={seconds} max={59} onChange={setSeconds} />
            </div>
            <div className="mt-4 flex flex-col items-stretch justify-center gap-2 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <HallButton onClick={applyDuration}>시간 적용</HallButton>
              <PlayPauseButton running={running} onClick={running ? pause : start} />
              <HallButton onClick={reset}>리셋</HallButton>
            </div>
            {alarm ? (
              <p className="mt-6 text-xl font-bold text-[#e50914]">시험 종료 · 답안을 제출하세요</p>
            ) : null}
          </section>

          <aside className="flex min-h-0 flex-col rounded-[4px] bg-[#1f1f1f] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.5)] sm:p-5 lg:h-full">
            {classes.length === 0 ? (
              <p className="text-sm leading-6 text-[#b3b3b3]">
                관리자 페이지에서 학년과 학급을 먼저 설정하면 학급별 QR이 생성됩니다.{" "}
                <Link href={`/admin/?session=${session.id}`} className="font-bold text-white">
                  설정하기
                </Link>
              </p>
            ) : (
              <>
                <div className="shrink-0">
                  <IdentityRow
                    grade={grade}
                    classNumber={classNumber}
                    onGrade={setGrade}
                    onClass={(value) => {
                      const available = classes.filter((row) => row.grade === grade);
                      const exists = available.some((row) => row.class_number === value);
                      setClassNumber(exists ? value : available[0]?.class_number ?? value);
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (omrUrl) void navigator.clipboard.writeText(omrUrl);
                    }}
                    className="mt-3 flex h-12 w-full items-center justify-center rounded-[4px] bg-[#e50914] text-sm font-bold text-white hover:bg-[#c00710] sm:mt-4"
                  >
                    [OMR 입력]
                  </button>
                  <p className="mt-2 text-center text-[11px] text-[#808080]">
                    단추를 누르면 학생 링크가 복사됩니다
                  </p>
                </div>

                <div className="relative mt-3 min-h-[12rem] flex-1 sm:mt-4 sm:min-h-[16rem] lg:min-h-[220px]">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="aspect-square h-full max-h-full w-auto max-w-full rounded-[2px] bg-white p-[6%]">
                      {code ? (
                        <QRCodeSVG
                          value={omrUrl}
                          size={256}
                          level="M"
                          className="h-full w-full"
                          bgColor="#ffffff"
                          fgColor="#141414"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-sm text-[#808080]">
                          QR 준비 중...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <p className="mt-3 shrink-0 text-center text-sm text-white">
                  {gradeLabel(grade)} {classLabel(classNumber)}
                  {pairSession ? " · 지I / 지II 선택" : ""}
                </p>
                <p className="mt-1 shrink-0 text-center font-mono text-[11px] text-[#555]">
                  {code ?? "--------"}
                </p>
              </>
            )}
          </aside>
        </div>
      </div>

      {immersive && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[200] bg-[#070707] text-white">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(229,9,20,0.08),transparent_58%)]" />
              <button
                type="button"
                onClick={toggleImmersive}
                className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 h-10 rounded-[4px] border border-white/10 bg-white/5 px-3 text-xs font-bold text-[#b3b3b3] sm:right-6 sm:h-11 sm:px-4 sm:text-sm"
              >
                몰입 종료<span className="hidden sm:inline"> · ESC</span>
              </button>
              <div className="relative mx-auto flex h-full w-full max-w-[1680px] flex-col items-center justify-center px-4 py-6 sm:px-8">
                <div className="text-center">
                  <p className="text-[clamp(1.5rem,3.6vw,2.75rem)] font-bold leading-none tracking-[-0.04em] text-[#e50914]">
                    2027 대수능 {suneungCountdown()}
                  </p>
                  <p className="mt-3 text-[clamp(0.95rem,1.8vw,1.25rem)] tracking-[0.08em] text-[#c4a0a0]">
                    2026년 11월 19일 목요일
                  </p>
                  <p className="mt-4 text-[clamp(0.95rem,1.6vw,1.2rem)] font-semibold text-[#9a9a9a]">
                    {session.label}
                    <span className="mx-2 text-[#4a4a4a]">·</span>
                    {gradeLabel(grade)} {classLabel(classNumber)}
                  </p>
                </div>

                <div className="mt-4 grid w-full grid-cols-2 items-center gap-3 sm:mt-8 sm:grid-cols-[minmax(110px,176px)_minmax(0,1fr)_minmax(110px,176px)] sm:gap-6 lg:gap-8">
                  <div className="col-span-2 min-w-0 text-center sm:col-auto sm:order-2">
                    <p className="mb-2 text-[11px] tracking-[0.28em] text-[#6a6a6a] sm:text-xs">
                      남은 시간
                    </p>
                    <div
                      className="leading-none"
                      style={{ fontSize: "clamp(4.4rem, 23vw, 19.5rem)" }}
                    >
                      <ClockFace display={display} remaining={remaining} alarm={alarm} />
                    </div>
                    <div className="mx-auto mt-4 h-[3px] w-[min(100%,36rem)] overflow-hidden rounded-full bg-white/10 sm:mt-6">
                      <div
                        className="h-full rounded-full bg-[#e50914]"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="sm:order-1">
                    <ImmersiveQr label="지I" url={urlI} />
                  </div>
                  <div className="sm:order-3">
                    <ImmersiveQr label="지II" url={urlII} />
                  </div>
                </div>

                <div className="mt-8 sm:mt-10">
                  {alarm ? (
                    <p className="text-lg font-bold text-[#e50914] sm:text-2xl">
                      시험 종료 · 답안을 제출하세요
                    </p>
                  ) : (
                    <PlayPauseButton
                      running={running}
                      onClick={running ? pause : start}
                      compact
                    />
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function ImmersiveQr({
  label,
  url,
}: {
  label: string;
  url: string;
}) {
  return (
    <div className="mx-auto w-full">
      {url ? (
        <div className="aspect-square rounded-[6px] bg-white p-[8%]">
          <QRCodeSVG
            value={url}
            size={196}
            level="M"
            className="h-full w-full"
            bgColor="#ffffff"
            fgColor="#141414"
          />
        </div>
      ) : (
        <div className="relative aspect-square overflow-hidden rounded-[6px] ring-1 ring-white/8">
          <div className="absolute inset-0 bg-gradient-to-br from-[#5a1c22] via-[#1a1012] to-[#0b0b10]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_28%_18%,rgba(229,9,20,0.38),transparent_58%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25" />
          <div className="absolute -left-1/3 top-0 h-full w-[70%] rotate-12 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="absolute inset-[12%] rounded-[4px] border border-white/10 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="relative grid h-full place-items-center px-2">
            <div className="text-center">
              <p className="text-[10px] tracking-[0.28em] text-[#8a6868] sm:text-xs">이번 회차</p>
              <p className="mt-1 bg-gradient-to-r from-[#7a5050] via-[#f0c8c8] to-[#5a3838] bg-clip-text text-[clamp(0.95rem,2.4vw,1.4rem)] font-bold tracking-[0.16em] text-transparent">
                없음
              </p>
            </div>
          </div>
        </div>
      )}
      <p className="mt-2.5 text-center text-[20px] font-bold tracking-[0.18em] text-[#ffd400] sm:text-[21px]">
        {label}
      </p>
    </div>
  );
}

function TimeField({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-left">
      <span className="mb-1 block text-sm font-bold text-[#d0d0d0]">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-12 w-full rounded-[4px] border border-[#777] bg-[#1a1a1a] text-center text-lg font-bold text-white sm:text-xl"
      />
    </label>
  );
}

function HallButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-12 w-full min-w-[120px] rounded-[4px] bg-[#3d3d3d] px-6 text-base font-bold text-white hover:bg-[#525252] sm:h-14 sm:w-auto"
    >
      {children}
    </button>
  );
}

function PlayPauseButton({
  running,
  onClick,
  compact = false,
}: {
  running: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={running ? "일시정지" : "시작"}
      className={cn(
        "inline-flex items-center justify-center gap-3 bg-[#e50914] font-bold text-white hover:bg-[#c00710]",
        compact
          ? "h-12 rounded-[4px] px-6 text-sm sm:h-12 sm:w-auto"
          : "h-12 w-full rounded-full px-7 text-base sm:h-16 sm:w-auto sm:text-lg",
      )}
    >
      {running ? (
        <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden>
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden>
          <path d="M8 5.5v13l11-6.5L8 5.5z" />
        </svg>
      )}
      {running ? "일시정지" : "시작"}
    </button>
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
    // Autoplay restrictions should not break the exam screen.
  }
}
