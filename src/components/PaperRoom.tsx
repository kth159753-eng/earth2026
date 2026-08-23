"use client";

import { PaperSplit } from "@/components/PaperSplit";
import { getExamAssets, getSignedAssetUrl } from "@/lib/data";
import type { ExamSession } from "@/lib/exams";
import { useEffect, useState } from "react";

export function PaperRoom({ session }: { session: ExamSession }) {
  const [paperUrl, setPaperUrl] = useState<string | null>(null);
  const [solutionUrl, setSolutionUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getExamAssets(session.id)
      .then(async (assets) => {
        const [paper, solution] = await Promise.all([
          getSignedAssetUrl(assets?.paper_path ?? null),
          getSignedAssetUrl(assets?.solution_path ?? null),
        ]);
        if (!cancelled) {
          setPaperUrl(paper);
          setSolutionUrl(solution);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session.id]);

  return (
    <PaperSplit session={session} paperUrl={paperUrl} solutionUrl={solutionUrl} />
  );
}
