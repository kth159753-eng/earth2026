"use client";

import { CHOICE_COUNT, EXAM_SESSIONS, QUESTION_COUNT } from "@/lib/exams";
import { createClient } from "@/lib/supabase/client";
import type { OmrMeta } from "@/lib/types";
import { classLabel, cn, gradeLabel, studentLabel } from "@/lib/utils";
import { useMemo, useState } from "react";

export function OmrForm({ code, meta }: { code: string; meta: OmrMeta }) {
  const session = EXAM_SESSIONS.find((item) => item.id === meta.session_id);
  const [studentNumber, setStudentNumber] = useState(1);
  const [answers, setAnswers] = useState<number[]>(
    Array.from({ length: QUESTION_COUNT }, () => 0),
  );
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const roster = useMemo(
    () => Array.from({ length: meta.student_count }, (_, index) => index + 1),
    [meta.student_count],
  );

  function setAnswer(question: number, choice: number) {
    setAnswers((current) => {
      const next = [...current];
      next[question] = current[question] === choice ? 0 : choice;
      return next;
    });
    setDone(false);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (answers.some((value) => value < 1)) {
      setError("1번부터 20번까지 모두 선택해 주세요.");
      return;
    }
    setPending(true);
    try {
      const supabase = createClient();
      const { error: submitError } = await supabase.rpc("submit_omr", {
        p_code: code,
        p_student_number: studentNumber,
        p_answers: answers,
      });
      if (submitError) {
        setError("제출에 실패했습니다. 번호와 회차를 확인해 주세요.");
        return;
      }
      setDone(true);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-4 py-6">
      <p className="text-[11px] tracking-[0.28em] text-gold/80">EARTH 2026 OMR</p>
      <h1 className="mt-2 text-2xl font-semibold">{session?.label ?? "모의고사"}</h1>
      <p className="mt-1 text-sm text-stone-400">
        {gradeLabel(meta.grade)} {classLabel(meta.class_number)} · 이름 없이 번호만 입력합니다
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm text-stone-300">출석번호</span>
          <select
            value={studentNumber}
            onChange={(event) => {
              setStudentNumber(Number(event.target.value));
              setDone(false);
            }}
            className="h-12 w-full rounded-xl border border-white/10 bg-black/40 px-3"
          >
            {roster.map((number) => (
              <option key={number} value={number}>
                {studentLabel(number)}
              </option>
            ))}
          </select>
        </label>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          {Array.from({ length: QUESTION_COUNT }, (_, question) => (
            <div
              key={question}
              className="grid grid-cols-[52px_1fr] items-center border-b border-white/8 last:border-b-0"
            >
              <div className="bg-white/5 py-3 text-center text-sm font-semibold text-gold-bright">
                {question + 1}
              </div>
              <div className="flex justify-around px-2 py-2">
                {Array.from({ length: CHOICE_COUNT }, (_, choice) => {
                  const value = choice + 1;
                  const selected = answers[question] === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAnswer(question, value)}
                      className={cn(
                        "grid h-11 w-11 place-items-center rounded-full border text-sm",
                        selected
                          ? "border-gold bg-gold text-ink"
                          : "border-stone-500 text-stone-300",
                      )}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {error ? (
          <p className="rounded-xl border border-rose-400/20 bg-rose-950/40 px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}
        {done ? (
          <p className="rounded-xl border border-teal/25 bg-teal/10 px-4 py-3 text-sm text-teal">
            제출이 완료되었습니다. 수정이 필요하면 다시 제출할 수 있습니다.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="h-13 w-full rounded-2xl bg-gold text-base font-bold text-ink disabled:opacity-50"
        >
          {pending ? "제출 중..." : "OMR 제출"}
        </button>
      </form>
    </main>
  );
}
