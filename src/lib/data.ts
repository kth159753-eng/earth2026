import { DEFAULT_SESSION_ID, defaultPoints, emptyAnswers } from "@/lib/exams";
import { defaultGradeCuts } from "@/lib/grades";
import {
  isCompleteAnswers,
  isCompleteCuts,
  officialAnswers,
  officialCuts,
} from "@/lib/official-keys";
import { createClient } from "@/lib/supabase/client";
import type {
  AnswerKey,
  ClassConfig,
  ClassSummary,
  GradedRow,
  Profile,
  SoloArchive,
  Submission,
} from "@/lib/types";
import { average } from "@/lib/utils";

async function currentUser() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
}

function metaText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function profileFromUser(
  user: { id: string; user_metadata?: Record<string, unknown> },
  input?: { username?: string; full_name?: string },
): Profile {
  const fromMetaName = metaText(user.user_metadata?.full_name);
  const fromMetaUser = metaText(user.user_metadata?.username).toLowerCase();
  const fullName = (input?.full_name || fromMetaName || "교사").trim().slice(0, 20);
  const requested = (input?.username || fromMetaUser).trim().toLowerCase();
  const fallback = `user_${user.id.replace(/-/g, "").slice(0, 8)}`;
  return {
    id: user.id,
    username: /^[a-z0-9_]{4,20}$/.test(requested) ? requested : fallback,
    full_name: fullName.length >= 2 ? fullName : "교사",
  };
}

export async function ensureTeacherProfile(input?: {
  username?: string;
  full_name?: string;
}): Promise<Profile | null> {
  try {
    const user = await currentUser();
    if (!user) return null;
    const fallback = profileFromUser(user, input);
    const supabase = createClient();
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, username, full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (existing) return existing;

    const write = async (nextUsername: string, nextName: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            username: nextUsername,
            full_name: nextName,
          },
          { onConflict: "id" },
        )
        .select("id, username, full_name")
        .maybeSingle();
      if (error) return null;
      return data;
    };

    return (
      (await write(fallback.username, fallback.full_name)) ??
      (await write(`user_${user.id.replace(/-/g, "").slice(0, 8)}`, "교사")) ??
      fallback
    );
  } catch {
    try {
      const user = await currentUser();
      return user ? profileFromUser(user, input) : null;
    } catch {
      return null;
    }
  }
}

export async function peekTeacherProfile(): Promise<Profile | null> {
  try {
    const user = await currentUser();
    return user ? profileFromUser(user) : null;
  } catch {
    return null;
  }
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

function applyOfficialKey(sessionId: string, key: AnswerKey): AnswerKey {
  return {
    ...key,
    answers: isCompleteAnswers(key.answers)
      ? key.answers
      : officialAnswers(sessionId) ?? key.answers,
    grade_cuts: isCompleteCuts(key.grade_cuts)
      ? key.grade_cuts
      : officialCuts(sessionId) ?? key.grade_cuts,
  };
}

export async function getAnswerKey(sessionId: string): Promise<AnswerKey | null> {
  const hasOfficial =
    Boolean(officialAnswers(sessionId)) || Boolean(officialCuts(sessionId));
  const user = await currentUser();
  if (!user) {
    return hasOfficial ? applyOfficialKey(sessionId, fallbackAnswerKey(sessionId, "")) : null;
  }
  const supabase = createClient();
  const full = await supabase
    .from("answer_keys")
    .select("id, teacher_id, session_id, answers, points, grade_cuts")
    .eq("teacher_id", user.id)
    .eq("session_id", sessionId)
    .maybeSingle();
  const saved = full.error
    ? (
        await supabase
          .from("answer_keys")
          .select("id, teacher_id, session_id, answers, points")
          .eq("teacher_id", user.id)
          .eq("session_id", sessionId)
          .maybeSingle()
      ).data
    : full.data;
  if (saved) return applyOfficialKey(sessionId, saved);
  return hasOfficial ? applyOfficialKey(sessionId, fallbackAnswerKey(sessionId, user.id)) : null;
}

export function fallbackAnswerKey(sessionId: string, teacherId: string): AnswerKey {
  const points = defaultPoints();
  const total = points.reduce((sum, value) => sum + value, 0);
  return {
    id: "",
    teacher_id: teacherId,
    session_id: sessionId,
    answers: officialAnswers(sessionId) ?? emptyAnswers(),
    points,
    grade_cuts: officialCuts(sessionId) ?? defaultGradeCuts(total),
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

const VAULT_KEY = "earth-vault";

function readLocalVault(): SoloArchive[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(VAULT_KEY) || "[]") as SoloArchive[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalVault(rows: SoloArchive[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(VAULT_KEY, JSON.stringify(rows.slice(0, 200)));
}

export async function saveSoloArchive(input: {
  sessionId: string;
  grade: number;
  classNumber: number;
  studentNumber: number;
  answers: number[];
  score: number;
  total: number;
  wrongQuestions: number[];
}): Promise<SoloArchive> {
  const user = await currentUser();
  const row: SoloArchive = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    teacher_id: user?.id ?? "",
    session_id: input.sessionId,
    grade: input.grade,
    class_number: input.classNumber,
    student_number: input.studentNumber,
    answers: input.answers,
    score: input.score,
    total: input.total,
    wrong_questions: input.wrongQuestions,
    graded_at: new Date().toISOString(),
  };

  if (user) {
    const supabase = createClient();
    const { data } = await supabase
      .from("solo_archives")
      .insert({
        teacher_id: user.id,
        session_id: row.session_id,
        grade: row.grade,
        class_number: row.class_number,
        student_number: row.student_number,
        answers: row.answers,
        score: row.score,
        total: row.total,
        wrong_questions: row.wrong_questions,
        graded_at: row.graded_at,
      })
      .select(
        "id, teacher_id, session_id, grade, class_number, student_number, answers, score, total, wrong_questions, graded_at",
      )
      .maybeSingle();
    if (data) {
      row.id = data.id;
      row.teacher_id = data.teacher_id;
    }
  }

  writeLocalVault([row, ...readLocalVault().filter((item) => item.id !== row.id)]);
  return row;
}

export async function listSoloArchives(): Promise<SoloArchive[]> {
  const local = readLocalVault();
  const user = await currentUser();
  if (!user) return local.sort((a, b) => b.graded_at.localeCompare(a.graded_at));

  const supabase = createClient();
  const { data } = await supabase
    .from("solo_archives")
    .select(
      "id, teacher_id, session_id, grade, class_number, student_number, answers, score, total, wrong_questions, graded_at",
    )
    .eq("teacher_id", user.id)
    .order("graded_at", { ascending: false });

  const remote = (data ?? []) as SoloArchive[];
  const seen = new Set(remote.map((row) => row.id));
  const merged = [...remote, ...local.filter((row) => !seen.has(row.id))];
  writeLocalVault(merged);
  return merged.sort((a, b) => b.graded_at.localeCompare(a.graded_at));
}

export async function deleteSoloArchive(id: string) {
  writeLocalVault(readLocalVault().filter((row) => row.id !== id));
  if (id.startsWith("local-")) return;
  const user = await currentUser();
  if (!user) return;
  const supabase = createClient();
  await supabase.from("solo_archives").delete().eq("id", id).eq("teacher_id", user.id);
}
