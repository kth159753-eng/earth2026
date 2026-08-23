import { nanoid } from "nanoid";
import { QUESTION_COUNT, defaultPoints, emptyAnswers, getSession } from "@/lib/exams";
import { createClient } from "@/lib/supabase/client";
import { clamp } from "@/lib/utils";

async function requireTeacher() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }
  return { supabase, user };
}

export async function saveClassConfigs(
  rows: Array<{ grade: number; classNumber: number; studentCount: number }>,
) {
  const { supabase, user } = await requireTeacher();

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

  const { error: deleteError } = await supabase
    .from("class_configs")
    .delete()
    .eq("teacher_id", user.id);
  if (deleteError) throw new Error("학급 설정을 저장하지 못했습니다.");

  if (cleaned.length > 0) {
    const { error } = await supabase.from("class_configs").insert(cleaned);
    if (error) throw new Error("학급 설정을 저장하지 못했습니다.");
  }

  return { ok: true };
}

export async function saveAnswerKey(
  sessionId: string,
  answers: number[],
  points: number[],
) {
  if (!getSession(sessionId)) throw new Error("존재하지 않는 회차입니다.");
  if (answers.length !== QUESTION_COUNT || points.length !== QUESTION_COUNT) {
    throw new Error("문항 수가 올바르지 않습니다.");
  }

  const safeAnswers = answers.map((value) => clamp(Math.round(value), 0, 5));
  const safePoints = points.map((value) => clamp(Math.round(value), 1, 5));

  const { supabase, user } = await requireTeacher();
  const { error } = await supabase.from("answer_keys").upsert(
    {
      teacher_id: user.id,
      session_id: sessionId,
      answers: safeAnswers,
      points: safePoints,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "teacher_id,session_id" },
  );
  if (error) throw new Error("정답을 저장하지 못했습니다.");
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

  const answers = (key?.answers as number[] | undefined) ?? emptyAnswers();
  const points = (key?.points as number[] | undefined) ?? defaultPoints();

  if (answers.some((value) => value < 1)) {
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
