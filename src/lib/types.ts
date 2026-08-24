export type Profile = {
  id: string;
  username: string;
  full_name: string;
};

export type ClassConfig = {
  id: string;
  teacher_id: string;
  grade: number;
  class_number: number;
  student_count: number;
};

export type AnswerKey = {
  id: string;
  teacher_id: string;
  session_id: string;
  answers: number[];
  points: number[];
  grade_cuts?: number[] | null;
};

export type OmrCode = {
  id: string;
  teacher_id: string;
  session_id: string;
  grade: number;
  class_number: number;
  code: string;
};

export type Submission = {
  id: string;
  omr_code_id: string;
  student_number: number;
  answers: number[];
  score: number | null;
  wrong_questions: number[] | null;
  submitted_at: string;
};

export type OmrMeta = {
  session_id: string;
  grade: number;
  class_number: number;
  student_count: number;
};

export type GradedRow = {
  studentNumber: number;
  answers: number[];
  score: number | null;
  wrongQuestions: number[];
  submittedAt: string | null;
  submitted: boolean;
};

export type ClassSummary = {
  grade: number;
  classNumber: number;
  submitted: number;
  roster: number;
  average: number | null;
  graded: number;
};

export type SoloArchive = {
  id: string;
  teacher_id: string;
  session_id: string;
  grade: number;
  class_number: number;
  student_number: number;
  answers: number[];
  score: number;
  total: number;
  wrong_questions: number[];
  graded_at: string;
};
