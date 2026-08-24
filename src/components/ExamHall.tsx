"use client";

import { ensureOmrCode } from "@/lib/actions/teacher";
import { readActiveClass, writeActiveClass } from "@/lib/active-class";
import type { ExamSession } from "@/lib/exams";
import type { ClassConfig } from "@/lib/types";
import { omrUrl as buildOmrUrl } from "@/lib/config";
import { classLabel, cn, formatClock, gradeLabel } from "@/lib/utils";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

function ClockFace({
  display,
  remaining,
  alarm,
}: {
  display: { hours: string; minutes: string; seconds: string };
  remaining: number;
  alarm: boolean;
}) {
  return (
    <div
      className={cn(
        "clock-glow mx-auto font-black leading-none text-white",
        remaining <= 60 && remaining > 0 && "text-[#e50914]",
        alarm && "text-[#e50914]",
      )}
    >
      {display.hours !== "00" ? `${display.hours}:` : null}
      {display.minutes}:{display.seconds}
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
    return () => {
      cancelled = true;
    };
  }, [session.id, grade, classNumber, classes.length]);

  useEffect(() => {
    setOmrUrl(code ? buildOmrUrl(code) : "");
  }, [code]);

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
  }

  function start() {
    if (remaining <= 0) applyDuration();
    const next = remaining <= 0 ? hours * 3600 + minutes * 60 + seconds : remaining;
    endAt.current = Date.now() + next * 1000;
    setRemaining(next);
    setAlarm(false);
    setRunning(true);
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
      leaveFullscreen();
      return;
    }
    setImmersive(true);
    enterFullscreen();
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setImmersive(false);
        leaveFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative isolate min-h-[calc(100dvh-72px)] overflow-hidden bg-[#141414]">
      <div className="starfield" />
      <div className="vignette" />

      <div className="relative mx-auto flex h-full w-full max-w-[1400px] flex-col gap-4 px-[4%] py-4 sm:px-[3%] lg:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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

        <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[1fr_300px]">
          <section
            className={cn(
              "relative flex min-h-[52dvh] flex-col justify-center overflow-hidden rounded-[4px] bg-black px-3 py-6 text-center sm:min-h-[58vh] sm:px-8 sm:py-8",
              alarm && "alarm-flash",
            )}
          >
            <p className="text-base font-bold text-[#c8c8c8] sm:text-lg">남은 시간</p>
            <div className="mt-3" style={{ fontSize: "clamp(3.25rem, 18vw, 13rem)" }}>
              <ClockFace display={display} remaining={remaining} alarm={alarm} />
            </div>
            <div className="nf-progress mx-auto mt-6 h-2 w-full max-w-3xl sm:mt-8">
              <span style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="mx-auto mt-6 grid w-full max-w-lg grid-cols-3 gap-2 sm:mt-8 sm:gap-3">
              <TimeField label="시" value={hours} max={3} onChange={setHours} />
              <TimeField label="분" value={minutes} max={59} onChange={setMinutes} />
              <TimeField label="초" value={seconds} max={59} onChange={setSeconds} />
            </div>
            <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <HallButton onClick={applyDuration}>시간 적용</HallButton>
              <PlayPauseButton running={running} onClick={running ? pause : start} />
              <HallButton onClick={reset}>리셋</HallButton>
            </div>
            {alarm ? (
              <p className="mt-6 text-xl font-bold text-[#e50914]">시험 종료 · 답안을 제출하세요</p>
            ) : null}
          </section>

          <aside className="rounded-[4px] bg-[#1f1f1f] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
            {classes.length === 0 ? (
              <p className="text-sm leading-6 text-[#b3b3b3]">
                관리자 페이지에서 학년과 학급을 먼저 설정하면 학급별 QR이 생성됩니다.{" "}
                <Link href={`/admin/?session=${session.id}`} className="font-bold text-white">
                  설정하기
                </Link>
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={grade}
                    onChange={(event) => setGrade(Number(event.target.value))}
                    className="h-10 rounded-[4px] border border-[#555] bg-[rgba(22,22,22,0.66)] px-3 text-sm"
                  >
                    {grouped.grades.map((value) => (
                      <option key={value} value={value}>
                        {gradeLabel(value)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={classNumber}
                    onChange={(event) => setClassNumber(Number(event.target.value))}
                    className="h-10 rounded-[4px] border border-[#555] bg-[rgba(22,22,22,0.66)] px-3 text-sm"
                  >
                    {classOptions.map((row) => (
                      <option key={row.class_number} value={row.class_number}>
                        {classLabel(row.class_number)}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (omrUrl) void navigator.clipboard.writeText(omrUrl);
                  }}
                  className="mt-4 flex h-11 w-full items-center justify-center rounded-[4px] bg-[#e50914] text-sm font-bold text-white hover:bg-[#c00710]"
                >
                  [OMR 입력]
                </button>
                <p className="mt-2 text-center text-[11px] text-[#808080]">
                  단추를 누르면 학생 링크가 복사됩니다
                </p>

                <div className="mt-4 rounded-[2px] bg-white p-3">
                  {code ? (
                    <QRCodeSVG
                      value={omrUrl}
                      size={256}
                      level="M"
                      className="mx-auto h-auto w-full"
                      bgColor="#ffffff"
                      fgColor="#141414"
                    />
                  ) : (
                    <div className="grid h-56 place-items-center text-sm text-[#808080]">
                      QR 준비 중...
                    </div>
                  )}
                </div>
                <p className="mt-3 text-center text-sm text-white">
                  {gradeLabel(grade)} {classLabel(classNumber)}
                </p>
                <p className="mt-1 text-center font-mono text-[11px] text-[#555]">
                  {code ?? "--------"}
                </p>
              </>
            )}
          </aside>
        </div>
      </div>

      {immersive && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex flex-col bg-black text-white">
              <button
                type="button"
                onClick={toggleImmersive}
                className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 h-12 rounded-[4px] border border-white/25 bg-white/10 px-4 text-sm font-bold sm:right-6 sm:px-5 sm:text-base"
              >
                몰입 종료<span className="hidden sm:inline"> · ESC</span>
              </button>
              <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 sm:px-6">
                <p className="text-[clamp(1.75rem,5vw,3.5rem)] font-black leading-none tracking-[-0.04em] text-[#e50914]">
                  2027 대수능 {suneungCountdown()}
                </p>
                <p className="mt-3 text-[clamp(1rem,2.4vw,1.55rem)] font-semibold tracking-[0.06em] text-[#d7b4b4]">
                  2026년 11월 19일 목요일
                </p>
                <p className="mt-6 text-lg font-bold text-[#c8c8c8] sm:text-2xl">{session.label}</p>
                <p className="mt-2 text-base text-[#808080] sm:text-lg">남은 시간</p>
                <div className="mt-2 sm:mt-3" style={{ fontSize: "clamp(5.25rem, 26vw, 22rem)" }}>
                  <ClockFace display={display} remaining={remaining} alarm={alarm} />
                </div>
                <div className="nf-progress mx-auto mt-6 h-2 w-full max-w-5xl sm:mt-8">
                  <span style={{ width: `${progress * 100}%` }} />
                </div>
                {alarm ? (
                  <p className="mt-8 text-xl font-bold text-[#e50914] sm:text-3xl">시험 종료 · 답안을 제출하세요</p>
                ) : (
                  <div className="mt-8 sm:mt-10">
                    <PlayPauseButton running={running} onClick={running ? pause : start} />
                  </div>
                )}
                <div className="mt-8 w-[148px] sm:absolute sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))] sm:left-[max(1.5rem,env(safe-area-inset-left))] sm:mt-0 sm:w-[168px]">
                  <div className="rounded-[4px] bg-white p-2">
                    {code ? (
                      <QRCodeSVG
                        value={omrUrl}
                        size={168}
                        level="M"
                        className="mx-auto h-auto w-full"
                        bgColor="#ffffff"
                        fgColor="#141414"
                      />
                    ) : (
                      <div className="grid aspect-square place-items-center text-center text-xs text-[#808080]">
                        학급을 설정하면
                        <br />
                        QR이 보입니다
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-center text-sm text-[#d0d0d0]">
                    {gradeLabel(grade)} {classLabel(classNumber)}
                  </p>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
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
      className="h-14 w-full min-w-[120px] rounded-[4px] bg-[#3d3d3d] px-6 text-base font-bold text-white hover:bg-[#525252] sm:w-auto"
    >
      {children}
    </button>
  );
}

function PlayPauseButton({
  running,
  onClick,
}: {
  running: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={running ? "일시정지" : "시작"}
      className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-[#e50914] px-7 text-lg font-bold text-white hover:bg-[#c00710] sm:h-16 sm:w-auto"
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
