"use client";

import { OmrForm } from "@/components/OmrForm";
import { ScanMenu } from "@/components/ScanMenu";
import { StudentReport } from "@/components/StudentReport";
import { StudentTabs, type StudentTabId } from "@/components/StudentTabs";
import { isSupabaseConfigured } from "@/lib/config";
import { getSession } from "@/lib/exams";
import { createClient } from "@/lib/supabase/client";
import type { OmrMeta } from "@/lib/types";
import { classLabel, gradeLabel } from "@/lib/utils";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const SoloStudy = dynamic(
  () => import("@/components/SoloStudy").then((mod) => ({ default: mod.SoloStudy })),
  {
    ssr: false,
    loading: () => <main className="min-h-dvh bg-[#141414]" />,
  },
);

type Side = "main" | "pair";

function OmrInner() {
  const searchParams = useSearchParams();
  const code = searchParams.get("c") ?? "";
  const pair = searchParams.get("p") ?? "";
  const [meta, setMeta] = useState<OmrMeta | null>(null);
  const [pairMeta, setPairMeta] = useState<OmrMeta | null>(null);
  const [pairReady, setPairReady] = useState(!pair);
  const [tab, setTab] = useState<StudentTabId | null>(null);
  const [picked, setPicked] = useState<Side | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured() || !code) {
      setError("유효하지 않은 코드입니다.");
      return;
    }
    const supabase = createClient();
    supabase.rpc("get_omr_meta", { p_code: code }).then(({ data, error: rpcError }) => {
      const next = data as OmrMeta | null;
      if (rpcError || !next?.session_id) {
        setError("유효하지 않은 코드입니다.");
        return;
      }
      setMeta(next);
    });
    if (!pair) {
      setPairMeta(null);
      setPairReady(true);
      return;
    }
    setPairReady(false);
    supabase.rpc("get_omr_meta", { p_code: pair }).then(({ data }) => {
      const next = data as OmrMeta | null;
      setPairMeta(next?.session_id ? next : null);
      setPairReady(true);
    });
  }, [code, pair]);

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <p className="text-stone-400">{error}</p>
      </main>
    );
  }

  if (!meta || !pairReady) {
    return <main className="min-h-dvh bg-[#141414]" />;
  }

  const mainSession = getSession(meta.session_id);
  const pairSession = pairMeta ? getSession(pairMeta.session_id) : null;
  const canPick = Boolean(pair && pairMeta && pairSession && mainSession);
  const classLine = `${gradeLabel(meta.grade)} ${classLabel(meta.class_number)}`;
  const examLine = mainSession
    ? `${mainSession.year}년 ${mainSession.month}월 · ${classLine}`
    : classLine;

  function changeTab(next: StudentTabId) {
    setTab(next);
    setPicked(null);
  }

  const active =
    picked === "pair" && pairMeta && pairSession
      ? { code: pair, meta: pairMeta, session: pairSession }
      : { code, meta, session: mainSession };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#141414]">
      <StudentTabs active={tab} onChange={changeTab} />
      <div className={`min-h-0 flex-1 ${tab === "solo" ? "overflow-hidden" : "overflow-auto"}`}>
        {!tab ? (
          <ScanMenu
            title="무엇을 할까요?"
            subtitle={examLine}
            choices={[
              { id: "omr", title: "OMR 입력", hint: "교실에서 답을 제출합니다." },
              { id: "solo", title: "[나혼자] 기출학습", hint: "시험지를 풀고 바로 채점합니다." },
              {
                id: "report",
                title: "보관소",
                hint: "수업시간 보고서와 나혼자 학습 보고서를 나눠 봅니다.",
              },
            ]}
            onPick={(id) => setTab(id as StudentTabId)}
          />
        ) : tab === "report" ? (
          <StudentReport />
        ) : canPick && !picked ? (
          <ScanMenu
            title="과목을 선택하세요"
            subtitle={examLine}
            choices={[
              { key: "main" as const, session: mainSession! },
              { key: "pair" as const, session: pairSession! },
            ]
              .sort((a, b) => a.session.subject.localeCompare(b.session.subject))
              .map((item) => ({
                id: item.key,
                title: item.session.subject === "I" ? "지I" : "지II",
                hint: item.session.label,
              }))}
            onPick={(id) => setPicked(id as Side)}
          />
        ) : !active.session ? (
          <main className="grid min-h-[50vh] place-items-center px-6 text-center">
            <p className="text-stone-400">회차 정보를 찾지 못했습니다.</p>
          </main>
        ) : tab === "solo" ? (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <SoloStudy
              session={active.session}
              guest
              initialGrade={active.meta.grade}
              initialClass={active.meta.class_number}
            />
          </div>
        ) : (
          <OmrForm code={active.code} meta={active.meta} />
        )}
      </div>
    </div>
  );
}

export default function OmrPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#141414]" />}>
      <OmrInner />
    </Suspense>
  );
}
