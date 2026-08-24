"use client";

import { OmrForm } from "@/components/OmrForm";
import { isSupabaseConfigured } from "@/lib/config";
import { getSession } from "@/lib/exams";
import { createClient } from "@/lib/supabase/client";
import type { OmrMeta } from "@/lib/types";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function OmrInner() {
  const searchParams = useSearchParams();
  const code = searchParams.get("c") ?? "";
  const pair = searchParams.get("p") ?? "";
  const [meta, setMeta] = useState<OmrMeta | null>(null);
  const [pairMeta, setPairMeta] = useState<OmrMeta | null>(null);
  const [picked, setPicked] = useState<"main" | "pair" | null>(null);
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
      return;
    }
    supabase.rpc("get_omr_meta", { p_code: pair }).then(({ data }) => {
      const next = data as OmrMeta | null;
      setPairMeta(next?.session_id ? next : null);
    });
  }, [code, pair]);

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <p className="text-stone-400">{error}</p>
      </main>
    );
  }

  if (!meta) {
    return <main className="min-h-dvh bg-[#141414]" />;
  }

  const mainSession = getSession(meta.session_id);
  const pairSession = pairMeta ? getSession(pairMeta.session_id) : null;
  const canPick = Boolean(pair && pairMeta && pairSession && mainSession);

  if (canPick && !picked) {
    const options = [
      { key: "main" as const, session: mainSession!, code, meta },
      { key: "pair" as const, session: pairSession!, code: pair, meta: pairMeta! },
    ].sort((a, b) => a.session.subject.localeCompare(b.session.subject));

    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <p className="text-[11px] tracking-[0.28em] text-[#e50914]">EARTH 2026 OMR</p>
        <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.03em] sm:text-[36px]">
          과목을 선택하세요
        </h1>
        <p className="mt-2 text-sm text-[#808080]">
          {mainSession?.year}년 {mainSession?.month}월 · {meta.grade}학년 {meta.class_number}반
        </p>
        <div className="mt-8 grid gap-3">
          {options.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setPicked(item.key)}
              className="rounded-[4px] border border-white/10 bg-[#1f1f1f] px-5 py-5 text-left hover:border-[#e50914]"
            >
              <p className="text-2xl font-bold text-white">
                {item.session.subject === "I" ? "지I" : "지II"}
              </p>
              <p className="mt-1 text-sm text-[#808080]">{item.session.label}</p>
            </button>
          ))}
        </div>
      </main>
    );
  }

  const active = picked === "pair" && pairMeta ? { code: pair, meta: pairMeta } : { code, meta };
  return <OmrForm code={active.code} meta={active.meta} />;
}

export default function OmrPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#141414]" />}>
      <OmrInner />
    </Suspense>
  );
}
