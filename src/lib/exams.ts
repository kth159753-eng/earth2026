export type SubjectCode = "I" | "II";

export type ExamSession = {
  id: string;
  label: string;
  year: number;
  month: number;
  subject: SubjectCode;
  subjectName: string;
};

const MONTHS = [3, 5, 6, 7, 9, 10] as const;
const SUBJECT_II_MONTHS = new Set([5, 6, 9, 10]);

function makeSession(
  year: number,
  month: number,
  subject: SubjectCode,
): ExamSession {
  const subjectName = subject === "I" ? "지구과학 I" : "지구과학 II";
  const subjectTag = subject === "I" ? "지I" : "지II";
  return {
    id: `${year}-${String(month).padStart(2, "0")}-${subject}`,
    label: `${year}_${month}월_${subjectTag}`,
    year,
    month,
    subject,
    subjectName,
  };
}

function buildCatalog(): ExamSession[] {
  const sessions: ExamSession[] = [];

  for (const year of [2025, 2026]) {
    for (const month of MONTHS) {
      if (year === 2026 && month > 7) continue;
      sessions.push(makeSession(year, month, "I"));
      if (SUBJECT_II_MONTHS.has(month)) {
        sessions.push(makeSession(year, month, "II"));
      }
    }
  }

  return sessions;
}

export const EXAM_SESSIONS = buildCatalog();
export const DEFAULT_SESSION_ID = EXAM_SESSIONS[0].id;
export const QUESTION_COUNT = 20;
export const CHOICE_COUNT = 5;

export function getSession(id: string): ExamSession | undefined {
  return EXAM_SESSIONS.find((session) => session.id === id);
}

export function requireSession(id: string): ExamSession {
  const session = getSession(id);
  if (!session) {
    throw new Error("존재하지 않는 회차입니다.");
  }
  return session;
}

export function groupSessionsByYear(sessions = EXAM_SESSIONS) {
  return sessions.reduce<Record<number, ExamSession[]>>((groups, session) => {
    groups[session.year] ??= [];
    groups[session.year].push(session);
    return groups;
  }, {});
}

export function defaultPoints(): number[] {
  return Array.from({ length: QUESTION_COUNT }, (_, index) =>
    index < 10 ? 2 : 3,
  );
}

export function emptyAnswers(): number[] {
  return Array.from({ length: QUESTION_COUNT }, () => 0);
}

export function publicExamPaths(session: ExamSession) {
  const folder = encodeURIComponent(session.label);
  return {
    paper: `/exams/${folder}/paper.pdf`,
    solution: `/exams/${folder}/solution.pdf`,
    paperImage: `/exams/${folder}/paper.png`,
    solutionImage: `/exams/${folder}/solution.png`,
  };
}
