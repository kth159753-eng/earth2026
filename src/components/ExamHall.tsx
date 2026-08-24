"use client";

import { ensureOmrCode } from "@/lib/actions/teacher";
import type { ExamSession } from "@/lib/exams";
import type { ClassConfig } from "@/lib/types";
import { omrUrl as buildOmrUrl } from "@/lib/config";
import { classLabel, cn, formatClock, gradeLabel } from "@/lib/utils";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
    const available = classes.filter((row) => row.grade === grade);
    if (!available.some((row) => row.class_number === classNumber)) {
      setClassNumber(available[0]?.class_number ?? 1);
    }
  }, [grade, classNumber, classes]);

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
    const id = window.setInterval(tick, 250);
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

  function ClockFace() {
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

  return (
    <div className="relative isolate min-h-[calc(100dvh-72px)] overflow-hidden bg-[#141414]">
      <div className="starfield" />
      <div className="vignette" />

      <div className="relative mx-auto flex h-full w-full max-w-[1400px] flex-col gap-4 px-[3%] py-4 lg:py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-bold leading-tight text-white sm:text-[28px]">
              {session.label}
            </h1>
            <p className="mt-1 text-base text-[#d0d0d0]">
              {session.subjectName} · 20문항 · {now || "--:--:--"}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleImmersive}
            className="h-12 rounded-[4px] bg-[#e50914] px-5 text-sm font-bold text-white hover:bg-[#c00710]"
          >
            몰입 모드
          </button>
        </div>

        <div className="grid items-stretch gap-4 xl:grid-cols-[1fr_300px]">
          <section
            className={cn(
              "relative flex min-h-[58vh] flex-col justify-center overflow-hidden rounded-[4px] bg-black px-4 py-8 text-center sm:min-h-[64vh] sm:px-8",
              alarm && "alarm-flash",
            )}
          >
            <p className="text-lg font-bold text-[#c8c8c8]">남은 시간</p>
            <div className="mt-3" style={{ fontSize: "clamp(5.5rem, 16vw, 13rem)" }}>
              <ClockFace />
            </div>
            <div className="nf-progress mx-auto mt-8 h-2 max-w-3xl">
              <span style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="mx-auto mt-8 grid w-full max-w-lg grid-cols-3 gap-3">
              <TimeField label="시" value={hours} max={3} onChange={setHours} />
              <TimeField label="분" value={minutes} max={59} onChange={setMinutes} />
              <TimeField label="초" value={seconds} max={59} onChange={setSeconds} />
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
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
                className="absolute right-6 top-6 z-10 h-12 rounded-[4px] border border-white/25 bg-white/10 px-5 text-base font-bold"
              >
                몰입 종료 · ESC
              </button>
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
                <p className="text-2xl font-bold text-[#c8c8c8]">{session.label}</p>
                <p className="mt-2 text-lg text-[#808080]">남은 시간</p>
                <div className="mt-4" style={{ fontSize: "clamp(8rem, 28vw, 20rem)" }}>
                  <ClockFace />
                </div>
                <div className="nf-progress mx-auto mt-10 h-2 w-full max-w-5xl">
                  <span style={{ width: `${progress * 100}%` }} />
                </div>
                {alarm ? (
                  <p className="mt-8 text-3xl font-bold text-[#e50914]">시험 종료 · 답안을 제출하세요</p>
                ) : (
                  <div className="mt-12">
                    <PlayPauseButton running={running} onClick={running ? pause : start} />
                  </div>
                )}
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
        className="h-12 w-full rounded-[4px] border border-[#777] bg-[#1a1a1a] text-center text-xl font-bold text-white"
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
      className="h-14 min-w-[120px] rounded-[4px] bg-[#3d3d3d] px-6 text-base font-bold text-white hover:bg-[#525252]"
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
      className="inline-flex h-16 items-center gap-3 rounded-full bg-[#e50914] px-7 text-lg font-bold text-white hover:bg-[#c00710]"
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
