import { AdminConsole } from "@/components/AdminConsole";
import {
  buildRoster,
  fallbackAnswerKey,
  getAnswerKey,
  getClassConfigs,
  getSessionUser,
  getSubmissionsForSession,
  summarizeClass,
} from "@/lib/data";
import { DEFAULT_SESSION_ID, getSession } from "@/lib/exams";
import { redirect } from "next/navigation";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/");

  const query = await searchParams;
  const session = getSession(query.session ?? DEFAULT_SESSION_ID) ?? getSession(DEFAULT_SESSION_ID)!;
  const [configs, key, { submissions }] = await Promise.all([
    getClassConfigs(),
    getAnswerKey(session.id),
    getSubmissionsForSession(session.id),
  ]);

  const answerKey = key ?? fallbackAnswerKey(session.id, user.id);
  const dashboard = configs.map((config) => {
    const classSubmissions = submissions.filter(
      (row) => row.grade === config.grade && row.class_number === config.class_number,
    );
    const rows = buildRoster(config.student_count, classSubmissions);
    return {
      grade: config.grade,
      classNumber: config.class_number,
      studentCount: config.student_count,
      rows,
      summary: summarizeClass(config.grade, config.class_number, config.student_count, rows),
    };
  });

  return (
    <AdminConsole
      sessionId={session.id}
      sessionLabel={session.label}
      classConfigs={configs}
      initialAnswers={answerKey.answers}
      initialPoints={answerKey.points}
      dashboard={dashboard}
    />
  );
}
