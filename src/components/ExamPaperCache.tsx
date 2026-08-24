"use client";

import { PaperRoom } from "@/components/PaperRoom";
import { EXAM_SESSIONS, getSession, nearbyExamSessions, warmExamSession } from "@/lib/exams";
import { useEffect, useState, type ReactNode } from "react";

const PAPER_KEEP = 2;

export function ExamWarmCache({ sessionId }: { sessionId: string }) {
  const session = getSession(sessionId) ?? EXAM_SESSIONS[0];

  useEffect(() => {
    warmExamSession(session);
    for (const item of nearbyExamSessions(session)) warmExamSession(item);
  }, [session]);

  return null;
}

function KeepAlive({
  sessionId,
  keep,
  render,
}: {
  sessionId: string;
  keep: number;
  render: (id: string, active: boolean) => ReactNode;
}) {
  const [seen, setSeen] = useState([sessionId]);

  useEffect(() => {
    setSeen((current) => {
      if (current[0] === sessionId) return current;
      return [sessionId, ...current.filter((id) => id !== sessionId)].slice(0, keep);
    });
  }, [keep, sessionId]);

  return (
    <div className="relative h-full min-h-0 flex-1">
      <ExamWarmCache sessionId={sessionId} />
      {seen.map((id) => {
        const session = getSession(id);
        if (!session) return null;
        const active = id === sessionId;
        return (
          <div
            key={id}
            className={active ? "absolute inset-0 flex flex-col" : "hidden"}
            aria-hidden={!active}
          >
            {render(id, active)}
          </div>
        );
      })}
    </div>
  );
}

export function PapersKeepAlive({ sessionId }: { sessionId: string }) {
  return (
    <KeepAlive
      sessionId={sessionId}
      keep={PAPER_KEEP}
      render={(id) => {
        const session = getSession(id);
        return session ? <PaperRoom session={session} /> : null;
      }}
    />
  );
}
