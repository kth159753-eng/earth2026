"use client";

import { OmrCardSheet } from "@/components/OmrCardSheet";
import { gradeAnswers, saveClassArchive } from "@/lib/data";
import { EXAM_SESSIONS, QUESTION_COUNT } from "@/lib/exams";
import { createClient } from "@/lib/supabase/client";
import type { OmrMeta } from "@/lib/types";
import { classLabel, gradeLabel, studentLabel } from "@/lib/utils";
import { useMemo, useState } from "react";

export function OmrForm({
  code,
  meta,
  onBack,
}: {
  code: string;
  meta: OmrMeta;
  onBack?: () => void;
}) {
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
      const graded = gradeAnswers(meta.session_id, answers);
      try {
        await saveClassArchive({
          sessionId: meta.session_id,
          grade: meta.grade,
          classNumber: meta.class_number,
          studentNumber,
          answers,
          score: graded.score,
          total: graded.total,
          wrongQuestions: graded.wrongQuestions,
        });
      } catch {
        // 제출은 됐으니 보관소 저장 실패는 막지 않습니다.
      }
      setDone(true);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-xl flex-col px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:py-4">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 h-11 w-fit rounded-[4px] bg-white/8 px-4 text-sm font-bold text-[#d0d0d0]"
        >
          메뉴
        </button>
      ) : null}

      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <OmrCardSheet
            title={session?.label ?? "모의고사"}
            subtitle={`${gradeLabel(meta.grade)} ${classLabel(meta.class_number)} · 이름 없이 번호만`}
            answers={answers}
            onAnswer={setAnswer}
            identity={
              <label className="block">
                <span className="mb-1 block text-[10px] font-black tracking-[0.18em] text-[#c41e3a]">
                  출석번호
                </span>
                <select
                  value={studentNumber}
                  onChange={(event) => {
                    setStudentNumber(Number(event.target.value));
                    setDone(false);
                  }}
                  className="h-11 w-full rounded-[2px] border border-[#c41e3a] bg-[#fffdf6] px-3 text-base font-black text-[#141414]"
                >
                  {roster.map((number) => (
                    <option key={number} value={number}>
                      {studentLabel(number)}
                    </option>
                  ))}
                </select>
              </label>
            }
            footer={
              <div>
                {error ? (
                  <p className="mb-2 border border-[#c41e3a] bg-[#f8d5d8] px-3 py-2 text-xs font-bold text-[#8a1020]">
                    {error}
                  </p>
                ) : null}
                {done ? (
                  <p className="mb-2 border border-[#141414] bg-[#fffdf6] px-3 py-2 text-xs font-bold text-[#141414]">
                    제출이 완료되었습니다. 수정이 필요하면 다시 제출할 수 있습니다.
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={pending}
                  className="h-12 w-full rounded-[2px] bg-[#c41e3a] text-base font-black text-white disabled:opacity-50"
                >
                  {pending ? "제출 중..." : "OMR 제출"}
                </button>
              </div>
            }
          />
        </div>
      </form>
    </main>
  );
}
