"use client";

import { PaperRoom } from "@/components/PaperRoom";
import {
  EXAM_SESSIONS,
  getSession,
  nearbyExamSessions,
  warmExamCatalog,
  warmExamSession,
} from "@/lib/exams";
import { useEffect, useState } from "react";

const KEEP = 4;

export function ExamWarmCache({ sessionId }: { sessionId: string }) {
  const session = getSession(sessionId) ?? EXAM_SESSIONS[0];

  useEffect(() => {
    warmExamSession(session);
    for (const item of nearbyExamSessions(session)) warmExamSession(item);
    warmExamCatalog(session);
  }, [session]);

  return null;
}

export function PapersKeepAlive({ sessionId }: { sessionId: string }) {
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
            <PaperRoom session={session} />
          </div>
        );
      })}
    </div>
  );
}
