"use client";

import { ExamRoom } from "@/components/ExamRoom";
import { ExamWarmCache } from "@/components/ExamPaperCache";
import { getSession } from "@/lib/exams";
import { useEffect, useState } from "react";

const KEEP = 2;

export function ExamKeepAlive({ sessionId }: { sessionId: string }) {
  const [seen, setSeen] = useState([sessionId]);

  useEffect(() => {
    setSeen((current) => {
      if (current[0] === sessionId) return current;
      return [sessionId, ...current.filter((id) => id !== sessionId)].slice(0, KEEP);
    });
  }, [sessionId]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <ExamWarmCache sessionId={sessionId} />
      {seen.map((id) => {
        const session = getSession(id);
        if (!session) return null;
        const active = id === sessionId;
        return (
          <div
            key={id}
            className={active ? "flex min-h-0 flex-1 flex-col" : "hidden"}
            aria-hidden={!active}
          >
            <ExamRoom session={session} />
          </div>
        );
      })}
    </div>
  );
}
