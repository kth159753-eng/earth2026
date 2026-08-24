"use client";

import { AdminConsole } from "@/components/AdminConsole";
import {
  buildRoster,
  fallbackAnswerKey,
  getAnswerKey,
  getClassConfigs,
  getSubmissionsForSession,
  summarizeClass,
} from "@/lib/data";
import { DEFAULT_SESSION_ID, getSession } from "@/lib/exams";
import type { ClassConfig, ClassSummary, GradedRow } from "@/lib/types";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

type DashboardClass = {
  grade: number;
  classNumber: number;
  studentCount: number;
  rows: GradedRow[];
  summary: ClassSummary;
};

function AdminInner() {
  const searchParams = useSearchParams();
  const session =
    getSession(searchParams.get("session") ?? DEFAULT_SESSION_ID) ??
    getSession(DEFAULT_SESSION_ID)!;
  const [classConfigs, setClassConfigs] = useState<ClassConfig[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [points, setPoints] = useState<number[]>([]);
  const [dashboard, setDashboard] = useState<DashboardClass[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const [configs, key, { submissions }] = await Promise.all([
      getClassConfigs(),
      getAnswerKey(session.id),
      getSubmissionsForSession(session.id),
    ]);
    const answerKey = key ?? fallbackAnswerKey(session.id, "");
    setClassConfigs(configs);
    setAnswers(answerKey.answers);
    setPoints(answerKey.points);
    setDashboard(
      configs.map((config) => {
        const classSubmissions = submissions.filter(
          (row) => row.grade === config.grade && row.class_number === config.class_number,
        );
        const rows = buildRoster(config.student_count, classSubmissions);
        return {
          grade: config.grade,
          classNumber: config.class_number,
          studentCount: config.student_count,
          rows,
          summary: summarizeClass(
            config.grade,
            config.class_number,
            config.student_count,
            rows,
          ),
        };
      }),
    );
    setReady(true);
  }, [session.id]);

  useEffect(() => {
    setReady(false);
    load().catch(() => setReady(true));
  }, [load]);

  if (!ready) {
    return <div className="min-h-[50vh]" />;
  }

  return (
    <AdminConsole
      sessionId={session.id}
      sessionLabel={session.label}
      classConfigs={classConfigs}
      initialAnswers={answers}
      initialPoints={points}
      dashboard={dashboard}
      onReload={load}
    />
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh]" />}>
      <AdminInner />
    </Suspense>
  );
}
