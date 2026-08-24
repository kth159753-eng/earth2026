import { DEFAULT_SESSION_ID, EXAM_SESSIONS, defaultPoints, emptyAnswers } from "@/lib/exams";
import { bandFromScore, defaultGradeCuts } from "@/lib/grades";
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
  ReportStudent,
  ScoreReport,
  SoloArchive,
  Submission,
  UserRole,
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

function roleFromMeta(value: unknown, fallback: UserRole = "teacher"): UserRole {
  return value === "student" || value === "teacher" ? value : fallback;
}

function profileFromUser(
  user: { id: string; user_metadata?: Record<string, unknown> },
  input?: { username?: string; full_name?: string; role?: UserRole },
): Profile {
  const fromMetaName = metaText(user.user_metadata?.full_name);
  const fromMetaUser = metaText(user.user_metadata?.username).toLowerCase();
  const fullName = (input?.full_name || fromMetaName || "사용자").trim().slice(0, 20);
  const requested = (input?.username || fromMetaUser).trim().toLowerCase();
  const fallback = `user_${user.id.replace(/-/g, "").slice(0, 8)}`;
  return {
    id: user.id,
    username: /^[a-z0-9_]{4,20}$/.test(requested) ? requested : fallback,
    full_name: fullName.length >= 2 ? fullName : "사용자",
    role: input?.role ?? roleFromMeta(user.user_metadata?.role),
  };
}

function withRole(row: { id: string; username: string; full_name: string; role?: unknown }, fallback: UserRole): Profile {
  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    role: roleFromMeta(row.role, fallback),
  };
}

export async function ensureTeacherProfile(input?: {
  username?: string;
  full_name?: string;
  role?: UserRole;
}): Promise<Profile | null> {
  try {
    const user = await currentUser();
    if (!user) return null;
    const fallback = profileFromUser(user, input);
    const supabase = createClient();
    const full = await supabase
      .from("profiles")
      .select("id, username, full_name, role")
      .eq("id", user.id)
      .maybeSingle();
    const existing = full.error
      ? (
          await supabase
            .from("profiles")
            .select("id, username, full_name")
            .eq("id", user.id)
            .maybeSingle()
        ).data
      : full.data;
    if (existing) {
      const explicitMeta =
        user.user_metadata?.role === "student" || user.user_metadata?.role === "teacher";
      const dbRole = roleFromMeta(existing.role, fallback.role);
      const role = input?.role ?? (explicitMeta ? fallback.role : dbRole);
      if (role !== dbRole) {
        await supabase.from("profiles").update({ role }).eq("id", user.id);
      }
      return { ...withRole(existing, role), role };
    }

    const write = async (nextUsername: string, nextName: string) => {
      const payload = {
        id: user.id,
        username: nextUsername,
        full_name: nextName,
        role: fallback.role,
      };
      const withRoleCol = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" })
        .select("id, username, full_name, role")
        .maybeSingle();
      if (!withRoleCol.error && withRoleCol.data) return withRole(withRoleCol.data, fallback.role);
      const { data, error } = await supabase
        .from("profiles")
        .upsert(
          { id: user.id, username: nextUsername, full_name: nextName },
          { onConflict: "id" },
        )
        .select("id, username, full_name")
        .maybeSingle();
      if (error || !data) return null;
      return withRole(data, fallback.role);
    };

    return (
      (await write(fallback.username, fallback.full_name)) ??
      (await write(`user_${user.id.replace(/-/g, "").slice(0, 8)}`, fallback.full_name)) ??
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

export async function getTeacherScoreReport(configs: ClassConfig[]): Promise<ScoreReport> {
  const user = await currentUser();
  const supabase = createClient();
  const archives = await listSoloArchives();
  let codes: Array<{
    id: string;
    session_id: string;
    grade: number;
    class_number: number;
  }> = [];
  let submissions: Submission[] = [];

  if (user) {
    const { data: codeRows } = await supabase
      .from("omr_codes")
      .select("id, session_id, grade, class_number")
      .eq("teacher_id", user.id);
    codes = codeRows ?? [];
    if (codes.length > 0) {
      const { data } = await supabase
        .from("submissions")
        .select("id, omr_code_id, student_number, answers, score, wrong_questions, submitted_at")
        .in(
          "omr_code_id",
          codes.map((code) => code.id),
        );
      submissions = data ?? [];
    }
  }

  type Raw = {
    sessionId: string;
    grade: number;
    classNumber: number;
    studentNumber: number;
    score: number | null;
    submitted: boolean;
  };
  const raw = new Map<string, Raw>();
  const put = (next: Raw, prefer = false) => {
    const key = `${next.sessionId}|${next.grade}|${next.classNumber}|${next.studentNumber}`;
    const prev = raw.get(key);
    if (!prev) {
      raw.set(key, next);
      return;
    }
    if (prefer && next.score != null) raw.set(key, next);
    else if (prev.score == null && next.score != null) raw.set(key, next);
  };

  const codeMap = new Map(codes.map((code) => [code.id, code]));
  for (const row of submissions) {
    const code = codeMap.get(row.omr_code_id);
    if (!code) continue;
    put(
      {
        sessionId: code.session_id,
        grade: code.grade,
        classNumber: code.class_number,
        studentNumber: row.student_number,
        score: row.score,
        submitted: true,
      },
      true,
    );
  }
  for (const row of archives) {
    put({
      sessionId: row.session_id,
      grade: row.grade,
      classNumber: row.class_number,
      studentNumber: row.student_number,
      score: row.score,
      submitted: true,
    });
  }

  const roster =
    configs.length > 0
      ? configs
      : Array.from(
          new Set(
            [...raw.values()].map((item) => `${item.grade}-${item.classNumber}`),
          ),
        ).map((key) => {
          const [grade, classNumber] = key.split("-").map(Number);
          return { grade, class_number: classNumber, student_count: 40 };
        });

  const students = roster.flatMap((config) => {
    const count = "student_count" in config ? config.student_count : 40;
    return Array.from({ length: count }, (_, index) => {
      const studentNumber = index + 1;
      const bySession: ReportStudent["bySession"] = {};
      for (const session of EXAM_SESSIONS) {
        const cell = raw.get(
          `${session.id}|${config.grade}|${config.class_number}|${studentNumber}`,
        );
        if (!cell) continue;
        const cuts = officialCuts(session.id) ?? defaultGradeCuts(50);
        bySession[session.id] = {
          score: cell.score,
          band: bandFromScore(cell.score, cuts),
          submitted: cell.submitted,
        };
      }
      return {
        grade: config.grade,
        classNumber: config.class_number,
        studentNumber,
        bySession,
      };
    });
  });

  const sessionIds = EXAM_SESSIONS.map((session) => session.id).filter((id) =>
    students.some((student) => student.bySession[id]),
  );

  return { students, sessionIds };
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
