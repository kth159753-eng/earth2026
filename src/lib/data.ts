import { DEFAULT_SESSION_ID, defaultPoints, emptyAnswers } from "@/lib/exams";
import { createClient } from "@/lib/supabase/client";
import type {
  AnswerKey,
  ClassConfig,
  ClassSummary,
  GradedRow,
  Profile,
  Submission,
} from "@/lib/types";
import { average } from "@/lib/utils";

async function currentUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function metaText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function ensureTeacherProfile(input?: {
  username?: string;
  full_name?: string;
}): Promise<Profile | null> {
  const user = await currentUser();
  if (!user) return null;
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, username, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) return existing;

  const fromMetaName = metaText(user.user_metadata?.full_name);
  const fromMetaUser = metaText(user.user_metadata?.username).toLowerCase();
  const fullName = (input?.full_name || fromMetaName || "교사").trim().slice(0, 20);
  const requested = (input?.username || fromMetaUser).trim().toLowerCase();
  const fallback = `user_${user.id.replace(/-/g, "").slice(0, 8)}`;
  const username = /^[a-z0-9_]{4,20}$/.test(requested) ? requested : fallback;

  const write = async (nextUsername: string, nextName: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          username: nextUsername,
          full_name: nextName.length >= 2 ? nextName : "교사",
        },
        { onConflict: "id" },
      )
      .select("id, username, full_name")
      .maybeSingle();
    if (error) return null;
    return data;
  };

  return (await write(username, fullName)) ?? (await write(fallback, fullName));
}

export async function getProfile(): Promise<Profile | null> {
  return ensureTeacherProfile();
}

export async function getClassConfigs(): Promise<ClassConfig[]> {
  const user = await currentUser();
  if (!user) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("class_configs")
    .select("id, teacher_id, grade, class_number, student_count")
    .eq("teacher_id", user.id)
    .order("grade", { ascending: true })
    .order("class_number", { ascending: true });
  return data ?? [];
}

export async function getAnswerKey(sessionId: string): Promise<AnswerKey | null> {
  const user = await currentUser();
  if (!user) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("answer_keys")
    .select("id, teacher_id, session_id, answers, points")
    .eq("teacher_id", user.id)
    .eq("session_id", sessionId)
    .maybeSingle();
  return data;
}

export function fallbackAnswerKey(sessionId: string, teacherId: string): AnswerKey {
  return {
    id: "",
    teacher_id: teacherId,
    session_id: sessionId,
    answers: emptyAnswers(),
    points: defaultPoints(),
  };
}

export async function getExamAssets(sessionId: string) {
  const user = await currentUser();
  if (!user) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("exam_assets")
    .select("paper_path, solution_path")
    .eq("teacher_id", user.id)
    .eq("session_id", sessionId)
    .maybeSingle();
  return data;
}

export async function getSignedAssetUrl(path: string | null) {
  if (!path) return null;
  const supabase = createClient();
  const { data } = await supabase.storage
    .from("exam-files")
    .createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}

export async function getOmrCodes(sessionId: string) {
  const user = await currentUser();
  if (!user) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("omr_codes")
    .select("id, teacher_id, session_id, grade, class_number, code")
    .eq("teacher_id", user.id)
    .eq("session_id", sessionId);
  return data ?? [];
}

export async function getSubmissionsForSession(sessionId: string) {
  const codes = await getOmrCodes(sessionId);
  if (codes.length === 0) {
    return { codes, submissions: [] as (Submission & { grade: number; class_number: number })[] };
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("submissions")
    .select("id, omr_code_id, student_number, answers, score, wrong_questions, submitted_at")
    .in(
      "omr_code_id",
      codes.map((code) => code.id),
    );

  const codeMap = new Map(codes.map((code) => [code.id, code]));
  const submissions = (data ?? []).map((row) => {
    const code = codeMap.get(row.omr_code_id);
    return {
      ...row,
      grade: code?.grade ?? 0,
      class_number: code?.class_number ?? 0,
    };
  });

  return { codes, submissions };
}

export function buildRoster(
  studentCount: number,
  submissions: Submission[],
): GradedRow[] {
  const byNumber = new Map(submissions.map((row) => [row.student_number, row]));
  return Array.from({ length: studentCount }, (_, index) => {
    const studentNumber = index + 1;
    const row = byNumber.get(studentNumber);
    return {
      studentNumber,
      answers: row?.answers ?? [],
      score: row?.score ?? null,
      wrongQuestions: row?.wrong_questions ?? [],
      submittedAt: row?.submitted_at ?? null,
      submitted: Boolean(row),
    };
  });
}

export function summarizeClass(
  grade: number,
  classNumber: number,
  roster: number,
  rows: GradedRow[],
): ClassSummary {
  const submittedRows = rows.filter((row) => row.submitted);
  const gradedScores = submittedRows
    .map((row) => row.score)
    .filter((score): score is number => score !== null);
  return {
    grade,
    classNumber,
    submitted: submittedRows.length,
    roster,
    average: average(gradedScores),
    graded: gradedScores.length,
  };
}

export { DEFAULT_SESSION_ID };
