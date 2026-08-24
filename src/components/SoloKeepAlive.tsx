"use client";

import { SoloStudy } from "@/components/SoloStudy";
import { EXAM_SESSIONS, getSession } from "@/lib/exams";
import { useEffect, useState } from "react";

const KEEP = 2;

export function SoloKeepAlive({ sessionId }: { sessionId: string }) {
  const [seen, setSeen] = useState([sessionId]);

  useEffect(() => {
    setSeen((current) => {
      if (current[0] === sessionId) return current;
      return [sessionId, ...current.filter((id) => id !== sessionId)].slice(0, KEEP);
    });
  }, [sessionId]);

  return (
    <div className="relative h-full min-h-0 flex-1">
      {seen.map((id) => {
        const session = getSession(id) ?? EXAM_SESSIONS[0];
        const active = id === sessionId;
        return (
          <div
            key={id}
            className={active ? "absolute inset-0 flex flex-col" : "hidden"}
            aria-hidden={!active}
          >
            <SoloStudy session={session} />
          </div>
        );
      })}
    </div>
  );
}
