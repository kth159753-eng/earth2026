"use client";

import { ensureOmrCode } from "@/lib/actions/teacher";
import type { ExamSession } from "@/lib/exams";
import type { ClassConfig } from "@/lib/types";
import { classLabel, cn, formatClock, gradeLabel } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const [origin, setOrigin] = useState("");
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
    setOrigin(window.location.origin);
  }, []);

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
  const omrUrl = code && origin ? `${origin}/omr/${code}` : "";

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

  return (
    <div
      className={cn(
        "relative isolate min-h-[calc(100dvh-72px)] overflow-hidden",
        immersive && "fixed inset-0 z-50 min-h-dvh",
      )}
    >
      <div className="starfield opacity-80" />
      <div className="vignette" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(212,175,120,0.08),transparent_42%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] tracking-[0.28em] text-gold/70">LIVE EXAM HALL</p>
            <h1 className="mt-1 font-display text-xl tracking-[0.12em] text-gold-bright sm:text-2xl">
              {session.label}
            </h1>
            <p className="text-sm text-stone-500">{session.subjectName} · 20문항</p>
          </div>
          <button
            type="button"
            onClick={() => setImmersive((value) => !value)}
            className="rounded-full border border-white/15 px-4 py-2 text-xs tracking-wider text-stone-300"
          >
            {immersive ? "몰입 종료" : "몰입 모드"}
          </button>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
          <section
            className={cn(
              "relative overflow-hidden rounded-[32px] border border-gold/15 bg-black/45 px-4 py-8 text-center shadow-[0_0_80px_rgba(0,0,0,0.55)] sm:px-8",
              alarm && "alarm-flash",
            )}
          >
            <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full border border-gold/20 sm:h-36 sm:w-36">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(212,175,120,0.12)" strokeWidth="3" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="#d4af78"
                  strokeWidth="3"
                  strokeDasharray={`${progress * 327} 327`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="text-[11px] tracking-[0.42em] text-stone-500">REMAINING TIME</p>
            <div
              className={cn(
                "clock-glow mt-2 font-display text-[52px] leading-none tracking-[0.08em] text-gold-bright sm:text-[84px] md:text-[104px]",
                remaining <= 60 && remaining > 0 && "text-rose-200",
                alarm && "text-rose-100",
              )}
            >
              {display.hours !== "00" ? `${display.hours}:` : null}
              {display.minutes}:{display.seconds}
            </div>
            <p className="mt-4 font-display text-sm tracking-[0.35em] text-stone-500">
              LOCAL {now || "--:--:--"}
            </p>

            <div className="mx-auto mt-8 grid max-w-md grid-cols-3 gap-3">
              <TimeField label="시" value={hours} max={3} onChange={setHours} />
              <TimeField label="분" value={minutes} max={59} onChange={setMinutes} />
              <TimeField label="초" value={seconds} max={59} onChange={setSeconds} />
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <HallButton onClick={applyDuration}>시간 적용</HallButton>
              <HallButton onClick={running ? pause : start} accent>
                {running ? "일시정지" : "시작"}
              </HallButton>
              <HallButton onClick={reset}>리셋</HallButton>
            </div>
            {alarm ? (
              <p className="mt-5 text-sm tracking-wide text-rose-200">시험 종료 · 답안을 제출하세요</p>
            ) : null}
          </section>

          <aside className="rounded-[28px] border border-white/8 bg-black/50 p-5">
            {classes.length === 0 ? (
              <p className="text-sm leading-6 text-stone-400">
                관리자 페이지에서 학년과 학급을 먼저 설정하면 학급별 QR이 생성됩니다.{" "}
                <a href={`/admin?session=${session.id}`} className="text-gold-bright underline">
                  설정하기
                </a>
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={grade}
                    onChange={(event) => setGrade(Number(event.target.value))}
                    className="h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-sm"
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
                    className="h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-sm"
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
                  className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-gold text-sm font-bold tracking-[0.18em] text-ink"
                >
                  [OMR 입력]
                </button>
                <p className="mt-2 text-center text-[11px] text-stone-500">
                  단추를 누르면 학생 링크가 복사됩니다
                </p>

                <div className="mt-4 rounded-3xl bg-white p-4">
                  {code ? (
                    <QRCodeSVG
                      value={omrUrl}
                      size={256}
                      level="M"
                      className="mx-auto h-auto w-full"
                      bgColor="#ffffff"
                      fgColor="#111111"
                    />
                  ) : (
                    <div className="grid h-56 place-items-center text-sm text-stone-500">
                      QR 준비 중...
                    </div>
                  )}
                </div>
                <p className="mt-3 text-center text-sm text-stone-300">
                  {gradeLabel(grade)} {classLabel(classNumber)} 전용 코드
                </p>
                <p className="mt-1 text-center font-mono text-[11px] text-stone-600">
                  {code ?? "--------"}
                </p>
              </>
            )}
          </aside>
        </div>
      </div>
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
      <span className="mb-1 block text-[11px] tracking-wider text-stone-500">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full rounded-xl border border-white/10 bg-black/40 text-center font-display text-lg text-gold-bright"
      />
    </label>
  );
}

function HallButton({
  children,
  onClick,
  accent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 rounded-full px-5 text-sm tracking-wide",
        accent
          ? "bg-gold text-ink"
          : "border border-white/15 text-stone-200 hover:border-gold/40",
      )}
    >
      {children}
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
