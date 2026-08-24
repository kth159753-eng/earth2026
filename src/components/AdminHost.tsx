"use client";

import { AdminConsole } from "@/components/AdminConsole";
import {
  buildRoster,
  fallbackAnswerKey,
  getAnswerKey,
  getClassConfigs,
  getSubmissionsForSession,
  getTeacherScoreReport,
  summarizeClass,
} from "@/lib/data";
import { DEFAULT_SESSION_ID, getSession } from "@/lib/exams";
import type { ClassConfig, ClassSummary, GradedRow, ScoreReport } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

type DashboardClass = {
  grade: number;
  classNumber: number;
  studentCount: number;
  rows: GradedRow[];
  summary: ClassSummary;
};

export function AdminHost({ sessionId }: { sessionId: string }) {
  const session = getSession(sessionId) ?? getSession(DEFAULT_SESSION_ID)!;
  const [classConfigs, setClassConfigs] = useState<ClassConfig[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [points, setPoints] = useState<number[]>([]);
  const [gradeCuts, setGradeCuts] = useState<number[]>([]);
  const [dashboard, setDashboard] = useState<DashboardClass[]>([]);
  const [report, setReport] = useState<ScoreReport>({ students: [], sessionIds: [] });
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const configs = await getClassConfigs();
    const [key, { submissions }, scoreReport] = await Promise.all([
      getAnswerKey(session.id),
      getSubmissionsForSession(session.id),
      getTeacherScoreReport(configs),
    ]);
    const answerKey = key ?? fallbackAnswerKey(session.id, "");
    setClassConfigs(configs);
    setReport(scoreReport);
    setAnswers(answerKey.answers);
    setPoints(answerKey.points);
    let cuts = answerKey.grade_cuts ?? [];
    try {
      const local = localStorage.getItem(`earth-cuts-${session.id}`);
      if ((!cuts || cuts.length < 9) && local) cuts = JSON.parse(local) as number[];
    } catch {
      cuts = answerKey.grade_cuts ?? [];
    }
    setGradeCuts(cuts);
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
    return <div className="min-h-[20vh]" />;
  }

  return (
    <AdminConsole
      sessionId={session.id}
      sessionLabel={session.label}
      classConfigs={classConfigs}
      initialAnswers={answers}
      initialPoints={points}
      initialCuts={gradeCuts}
      dashboard={dashboard}
      report={report}
      onReload={load}
    />
  );
}
