"use client";

import { deleteSoloArchive, listSoloArchives } from "@/lib/data";
import { CHOICE_COUNT, getSession } from "@/lib/exams";
import type { SoloArchive } from "@/lib/types";
import { classLabel, cn, gradeLabel, studentLabel } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getFullYear()}.${month}.${day} ${hours}:${minutes}`;
}

export function VaultBoard() {
  const [rows, setRows] = useState<SoloArchive[]>([]);
  const [ready, setReady] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    listSoloArchives()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setReady(true));
  }, []);

  async function remove(id: string) {
    await deleteSoloArchive(id);
    setRows((current) => current.filter((row) => row.id !== id));
    if (openId === id) setOpenId(null);
  }

  const selected = rows.find((row) => row.id === openId) ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-5 sm:py-6">
      <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] sm:text-[36px]">
        보관소
      </h1>
      <p className="mt-1 text-sm text-[#808080]">
        채점한 기록을 다시 열고, 휴대폰·태블릿·컴퓨터에서 같이 볼 수 있습니다.
      </p>

      {!ready ? <div className="min-h-[30vh]" /> : null}

      {ready && rows.length === 0 ? (
        <p className="mt-10 rounded-[4px] border border-white/8 bg-[#1f1f1f] px-4 py-10 text-center text-sm text-[#808080]">
          아직 채점 기록이 없습니다. 나혼자 학습에서 채점하면 여기에 쌓입니다.
        </p>
      ) : null}

      {selected ? (
        <SavedResult
          row={selected}
          onBack={() => setOpenId(null)}
          onDelete={() => void remove(selected.id)}
        />
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((row) => {
            const session = getSession(row.session_id);
            return (
              <article
                key={row.id}
                className="rounded-[4px] border border-white/8 bg-[#1f1f1f] p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-white">
                      {session?.label ?? row.session_id}
                    </p>
                    <p className="mt-1 text-sm text-[#808080]">
                      {gradeLabel(row.grade)} {classLabel(row.class_number)}{" "}
                      {studentLabel(row.student_number)} · {formatWhen(row.graded_at)}
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {row.score}
                    <span className="ml-1 text-sm font-medium text-[#808080]">/ {row.total}점</span>
                  </p>
                </div>
                <p className="mt-3 text-sm text-[#b3b3b3]">
                  {row.wrong_questions.length === 0
                    ? "만점입니다."
                    : `틀린 문항 ${row.wrong_questions.join(", ")}`}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenId(row.id)}
                    className="h-10 rounded-[4px] bg-[#e50914] px-4 text-sm font-bold text-white"
                  >
                    결과 보기
                  </button>
                  <Link
                    href={`/solo/${row.session_id}/`}
                    className="inline-flex h-10 items-center rounded-[4px] bg-white/10 px-4 text-sm font-bold text-white"
                  >
                    다시 풀기
                  </Link>
                  <button
                    type="button"
                    onClick={() => void remove(row.id)}
                    className="h-10 rounded-[4px] bg-white/10 px-4 text-sm font-bold text-white"
                  >
                    삭제
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SavedResult({
  row,
  onBack,
  onDelete,
}: {
  row: SoloArchive;
  onBack: () => void;
  onDelete: () => void;
}) {
  const session = getSession(row.session_id);
  const wrong = new Set(row.wrong_questions);

  return (
    <div className="mt-6 rounded-[4px] border border-white/8 bg-[#1f1f1f] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-white">{session?.label ?? row.session_id}</p>
          <p className="mt-1 text-sm text-[#808080]">
            {gradeLabel(row.grade)} {classLabel(row.class_number)} {studentLabel(row.student_number)}{" "}
            · {formatWhen(row.graded_at)}
          </p>
        </div>
        <p className="text-3xl font-bold text-white">
          {row.score}
          <span className="ml-1 text-sm font-medium text-[#808080]">/ {row.total}점</span>
        </p>
      </div>
      <p className="mt-3 text-sm text-[#b3b3b3]">
        {row.wrong_questions.length === 0
          ? "만점입니다."
          : `틀린 문항 ${row.wrong_questions.join(", ")}`}
      </p>

      <div className="mt-5 space-y-1">
        {row.answers.map((answer, question) => (
          <div
            key={question}
            className={cn(
              "grid grid-cols-[36px_1fr] items-center rounded-[4px] px-1 py-1",
              wrong.has(question + 1) && "bg-[#e50914]/12",
            )}
          >
            <span className="text-sm font-bold text-[#e50914]">{question + 1}</span>
            <div className="flex gap-1">
              {Array.from({ length: CHOICE_COUNT }, (_, index) => {
                const choice = index + 1;
                const selected = answer === choice;
                return (
                  <span
                    key={choice}
                    className={cn(
                      "grid h-9 flex-1 place-items-center rounded-full border text-xs",
                      selected
                        ? wrong.has(question + 1)
                          ? "border-[#e50914] bg-[#e50914] text-white"
                          : "border-[#46d369] bg-[#46d369] text-black"
                        : "border-white/20 text-[#d0d0d0]",
                    )}
                  >
                    {choice}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onBack}
          className="h-10 rounded-[4px] bg-white/10 px-4 text-sm font-bold text-white"
        >
          목록
        </button>
        <Link
          href={`/solo/${row.session_id}/`}
          className="inline-flex h-10 items-center rounded-[4px] bg-[#e50914] px-4 text-sm font-bold text-white"
        >
          다시 풀기
        </Link>
        <button
          type="button"
          onClick={onDelete}
          className="h-10 rounded-[4px] bg-white/10 px-4 text-sm font-bold text-white"
        >
          삭제
        </button>
      </div>
    </div>
  );
}
