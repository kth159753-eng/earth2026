"use client";

import { ensureOmrCode } from "@/lib/actions/teacher";
import type { ExamSession } from "@/lib/exams";
import type { ClassConfig } from "@/lib/types";
import { omrUrl as buildOmrUrl } from "@/lib/config";
import { classLabel, cn, formatClock, gradeLabel } from "@/lib/utils";
import Link from "next/link";
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

  return (
    <div
      className={cn(
        "relative isolate min-h-[calc(100dvh-72px)] overflow-hidden bg-[#141414]",
        immersive && "fixed inset-0 z-50 min-h-dvh",
      )}
    >
      <div className="starfield" />
      <div className="vignette" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-[4%] py-6 lg:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[13px] font-bold tracking-[0.28em]">
              <b className="text-[22px] font-black tracking-[-0.08em] text-[#e50914]">E</b>
              LIVE
            </p>
            <h1 className="mt-1 font-serif text-[42px] font-bold leading-[0.9] tracking-[-0.06em] text-white sm:text-[56px]">
              {session.label}
            </h1>
            <p className="mt-2 text-sm text-[#b3b3b3]">
              {session.subjectName} · 20문항 · {now || "--:--:--"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setImmersive((value) => !value)}
            className="h-10 rounded-[4px] bg-[rgba(109,109,110,0.7)] px-4 text-sm font-bold"
          >
            {immersive ? "몰입 종료" : "몰입 모드"}
          </button>
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[1fr_320px]">
          <section
            className={cn(
              "relative overflow-hidden rounded-[4px] bg-black/55 px-4 py-8 text-center shadow-[0_16px_40px_rgba(0,0,0,0.7)] sm:px-8",
              alarm && "alarm-flash",
            )}
          >
            <p className="text-[12px] font-bold tracking-[0.2em] text-[#808080]">남은 시간</p>
            <div
              className={cn(
                "clock-glow mt-2 text-[56px] font-black leading-none tracking-[-0.04em] text-white sm:text-[88px] md:text-[108px]",
                remaining <= 60 && remaining > 0 && "text-[#e50914]",
                alarm && "text-[#e50914]",
              )}
            >
              {display.hours !== "00" ? `${display.hours}:` : null}
              {display.minutes}:{display.seconds}
            </div>
            <div className="nf-progress mx-auto mt-6 max-w-xl">
              <span style={{ width: `${progress * 100}%` }} />
            </div>

            <div className="mx-auto mt-8 grid max-w-md grid-cols-3 gap-2">
              <TimeField label="시" value={hours} max={3} onChange={setHours} />
              <TimeField label="분" value={minutes} max={59} onChange={setMinutes} />
              <TimeField label="초" value={seconds} max={59} onChange={setSeconds} />
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <HallButton onClick={applyDuration}>시간 적용</HallButton>
              <HallButton onClick={running ? pause : start} accent>
                {running ? "일시정지" : "▶ 시작"}
              </HallButton>
              <HallButton onClick={reset}>리셋</HallButton>
            </div>
            {alarm ? (
              <p className="mt-5 text-sm font-bold text-[#e50914]">시험 종료 · 답안을 제출하세요</p>
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
      <span className="mb-1 block text-[11px] font-semibold text-[#808080]">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-10 w-full rounded-[4px] border border-[#555] bg-[rgba(22,22,22,0.66)] text-center text-lg font-bold text-white"
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
        "h-10 rounded-[4px] px-5 text-sm font-bold",
        accent
          ? "bg-white text-black hover:bg-white/75"
          : "bg-[rgba(109,109,110,0.7)] text-white hover:bg-[rgba(109,109,110,0.4)]",
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
