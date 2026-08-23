"use client";

import { OmrForm } from "@/components/OmrForm";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import type { OmrMeta } from "@/lib/types";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function OmrInner() {
  const searchParams = useSearchParams();
  const code = searchParams.get("c") ?? "";
  const [meta, setMeta] = useState<OmrMeta | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured() || !code) {
      setError("유효하지 않은 코드입니다.");
      return;
    }
    const supabase = createClient();
    supabase
      .rpc("get_omr_meta", { p_code: code })
      .then(({ data, error: rpcError }) => {
        const next = data as OmrMeta | null;
        if (rpcError || !next?.session_id) {
          setError("유효하지 않은 코드입니다.");
          return;
        }
        setMeta(next);
      });
  }, [code]);

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <p className="text-stone-400">{error}</p>
      </main>
    );
  }

  if (!meta) {
    return <main className="min-h-dvh bg-void" />;
  }

  return <OmrForm code={code} meta={meta} />;
}

export default function OmrPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-void" />}>
      <OmrInner />
    </Suspense>
  );
}
