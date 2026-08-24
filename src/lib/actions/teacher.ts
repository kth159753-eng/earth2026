import { nanoid } from "nanoid";
import { ensureTeacherProfile } from "@/lib/data";
import { QUESTION_COUNT, defaultPoints, emptyAnswers, getSession } from "@/lib/exams";
import { isCompleteAnswers, officialAnswers } from "@/lib/official-keys";
import { createClient } from "@/lib/supabase/client";
import { clamp } from "@/lib/utils";

async function requireTeacher() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user || !session.access_token) {
    throw new Error("로그인이 필요합니다.");
  }
  return { supabase, user };
}

function classSaveError(error: { message?: string; code?: string } | null) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (text.includes("42501") || text.includes("permission denied")) {
    return "데이터베이스 권한이 없습니다. Supabase SQL Editor에서 supabase/fix-signup.sql 을 실행해 주세요.";
  }
  if (text.includes("profiles") && (text.includes("foreign key") || text.includes("23503"))) {
    return "교사 프로필이 없어 저장하지 못했습니다. 다시 로그인한 뒤 저장해 주세요.";
  }
  if (text.includes("row-level security") || text.includes("42501")) {
    return "저장 권한이 없습니다. 다시 로그인한 뒤 시도해 주세요.";
  }
  return "학급 설정을 저장하지 못했습니다.";
}

export async function saveClassConfigs(
  rows: Array<{ grade: number; classNumber: number; studentCount: number }>,
) {
  const { supabase, user } = await requireTeacher();
  const profile = await ensureTeacherProfile();

  const cleaned = rows
    .filter(
      (row) =>
        row.grade >= 1 &&
        row.grade <= 3 &&
        row.classNumber >= 1 &&
        row.classNumber <= 15,
    )
    .map((row) => ({
      teacher_id: user.id,
      grade: row.grade,
      class_number: row.classNumber,
      student_count: clamp(row.studentCount, 1, 40),
    }));

  const { error: rpcError } = await supabase.rpc("save_class_configs", {
    p_rows: cleaned.map((row) => ({
      grade: row.grade,
      class_number: row.class_number,
      student_count: row.student_count,
    })),
  });
  if (!rpcError) return { ok: true };

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      username: profile?.username || `user_${user.id.replace(/-/g, "").slice(0, 8)}`,
      full_name: profile?.full_name || "교사",
    },
    { onConflict: "id" },
  );

  const { error: deleteError } = await supabase
    .from("class_configs")
    .delete()
    .eq("teacher_id", user.id);
  if (deleteError) throw new Error(classSaveError(rpcError ?? deleteError));

  if (cleaned.length > 0) {
    const { error } = await supabase.from("class_configs").insert(cleaned);
    if (error) throw new Error(classSaveError(error));
  }

  return { ok: true };
}

export async function saveAnswerKey(
  sessionId: string,
  answers: number[],
  points: number[],
  gradeCuts?: number[],
) {
  if (!getSession(sessionId)) throw new Error("존재하지 않는 회차입니다.");
  if (answers.length !== QUESTION_COUNT || points.length !== QUESTION_COUNT) {
    throw new Error("문항 수가 올바르지 않습니다.");
  }

  const safeAnswers = answers.map((value) => clamp(Math.round(value), 0, 5));
  const safePoints = points.map((value) => clamp(Math.round(value), 1, 5));
  const total = safePoints.reduce((sum, value) => sum + value, 0);
  const safeCuts = (gradeCuts ?? []).slice(0, 9).map((value) =>
    clamp(Math.round(value), 0, total),
  );

  const { supabase, user } = await requireTeacher();
  const payload: Record<string, unknown> = {
    teacher_id: user.id,
    session_id: sessionId,
    answers: safeAnswers,
    points: safePoints,
    updated_at: new Date().toISOString(),
  };
  if (safeCuts.length === 9) payload.grade_cuts = safeCuts;
  const { error } = await supabase.from("answer_keys").upsert(payload, {
    onConflict: "teacher_id,session_id",
  });
  if (error) {
    const { grade_cuts: _unused, ...withoutCuts } = payload;
    const { error: again } = await supabase.from("answer_keys").upsert(withoutCuts, {
      onConflict: "teacher_id,session_id",
    });
    if (again) throw new Error("정답을 저장하지 못했습니다.");
  }
  return { ok: true };
}

export async function ensureOmrCode(
  sessionId: string,
  grade: number,
  classNumber: number,
) {
  if (!getSession(sessionId)) throw new Error("존재하지 않는 회차입니다.");
  const { supabase, user } = await requireTeacher();

  const { data: existing } = await supabase
    .from("omr_codes")
    .select("code")
    .eq("teacher_id", user.id)
    .eq("session_id", sessionId)
    .eq("grade", grade)
    .eq("class_number", classNumber)
    .maybeSingle();

  if (existing?.code) return { code: existing.code as string };

  const code = nanoid(12);
  const { error } = await supabase.from("omr_codes").insert({
    teacher_id: user.id,
    session_id: sessionId,
    grade,
    class_number: classNumber,
    code,
  });

  if (error) {
    const { data: again } = await supabase
      .from("omr_codes")
      .select("code")
      .eq("teacher_id", user.id)
      .eq("session_id", sessionId)
      .eq("grade", grade)
      .eq("class_number", classNumber)
      .maybeSingle();
    if (again?.code) return { code: again.code as string };
    throw new Error("QR 코드를 만들지 못했습니다.");
  }

  return { code };
}

export async function gradeSession(sessionId: string) {
  if (!getSession(sessionId)) throw new Error("존재하지 않는 회차입니다.");
  const { supabase, user } = await requireTeacher();

  const { data: key } = await supabase
    .from("answer_keys")
    .select("answers, points")
    .eq("teacher_id", user.id)
    .eq("session_id", sessionId)
    .maybeSingle();

  const saved = key?.answers as number[] | undefined;
  const answers = isCompleteAnswers(saved)
    ? saved
    : officialAnswers(sessionId) ?? emptyAnswers();
  const points = (key?.points as number[] | undefined) ?? defaultPoints();

  if (!isCompleteAnswers(answers)) {
    throw new Error("먼저 20문항 정답을 모두 입력해 주세요.");
  }

  const { data: codes } = await supabase
    .from("omr_codes")
    .select("id")
    .eq("teacher_id", user.id)
    .eq("session_id", sessionId);

  if (!codes || codes.length === 0) {
    return { ok: true, graded: 0 };
  }

  const { data: submissions, error } = await supabase
    .from("submissions")
    .select("id, answers")
    .in(
      "omr_code_id",
      codes.map((code) => code.id),
    );
  if (error) throw new Error("제출 답안을 불러오지 못했습니다.");

  let graded = 0;
  for (const row of submissions ?? []) {
    const studentAnswers = row.answers as number[];
    const wrong: number[] = [];
    let score = 0;
    for (let index = 0; index < QUESTION_COUNT; index += 1) {
      if (studentAnswers[index] === answers[index]) {
        score += points[index] ?? 2;
      } else {
        wrong.push(index + 1);
      }
    }
    const { error: updateError } = await supabase
      .from("submissions")
      .update({ score, wrong_questions: wrong })
      .eq("id", row.id);
    if (!updateError) graded += 1;
  }

  return { ok: true, graded };
}

export async function saveExamAsset(
  sessionId: string,
  kind: "paper" | "solution",
  path: string,
) {
  if (!getSession(sessionId)) throw new Error("존재하지 않는 회차입니다.");
  const { supabase, user } = await requireTeacher();
  const column = kind === "paper" ? "paper_path" : "solution_path";

  const { data: existing } = await supabase
    .from("exam_assets")
    .select("id, paper_path, solution_path")
    .eq("teacher_id", user.id)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("exam_assets")
      .update({ [column]: path, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error("파일을 연결하지 못했습니다.");
  } else {
    const { error } = await supabase.from("exam_assets").insert({
      teacher_id: user.id,
      session_id: sessionId,
      paper_path: kind === "paper" ? path : null,
      solution_path: kind === "solution" ? path : null,
    });
    if (error) throw new Error("파일을 연결하지 못했습니다.");
  }

  return { ok: true };
}
