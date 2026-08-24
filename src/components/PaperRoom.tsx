"use client";

import { PaperSplit } from "@/components/PaperSplit";
import { getExamAssets, getSignedAssetUrl } from "@/lib/data";
import { examViewerUrls, type ExamSession } from "@/lib/exams";
import { useEffect, useMemo, useState } from "react";

export function PaperRoom({ session }: { session: ExamSession }) {
  const files = useMemo(() => examViewerUrls(session), [session]);
  const [paperUrl, setPaperUrl] = useState<string | null>(files.paper);
  const [solutionUrl, setSolutionUrl] = useState<string | null>(files.solution);

  useEffect(() => {
    setPaperUrl(files.paper);
    setSolutionUrl(files.solution);
    let cancelled = false;
    getExamAssets(session.id)
      .then(async (assets) => {
        const [paper, solution] = await Promise.all([
          getSignedAssetUrl(assets?.paper_path ?? null),
          getSignedAssetUrl(assets?.solution_path ?? null),
        ]);
        if (cancelled) return;
        if (paper) setPaperUrl(paper);
        if (solution) setSolutionUrl(solution);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [files.paper, files.solution, session.id]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <PaperSplit session={session} paperUrl={paperUrl} solutionUrl={solutionUrl} />
    </div>
  );
}
