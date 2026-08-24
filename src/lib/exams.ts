export type SubjectCode = "I" | "II";

export type ExamSession = {
  id: string;
  label: string;
  year: number;
  month: number;
  subject: SubjectCode;
  subjectName: string;
};

const MONTHS = [3, 5, 6, 7, 9, 10, 11] as const;
const SUBJECT_II_MONTHS = new Set([5, 6, 7, 9, 10, 11]);

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

export function siblingSession(session: ExamSession) {
  const other = session.subject === "I" ? "II" : "I";
  return (
    EXAM_SESSIONS.find(
      (item) => item.year === session.year && item.month === session.month && item.subject === other,
    ) ?? null
  );
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

const LOCAL_EXAM_IDS = new Set([
  "2025-03-I",
  "2025-05-I",
  "2025-05-II",
  "2025-06-I",
  "2025-06-II",
  "2025-07-I",
  "2025-07-II",
  "2025-09-I",
  "2025-09-II",
  "2025-10-I",
  "2025-10-II",
  "2025-11-I",
  "2025-11-II",
  "2026-03-I",
  "2026-05-I",
  "2026-05-II",
  "2026-06-I",
  "2026-06-II",
  "2026-07-I",
  "2026-07-II",
]);

export function publicExamPaths(session: ExamSession) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const folder = session.id;
  return {
    paper: `${base}/exams/${folder}/paper.pdf`,
    solution: `${base}/exams/${folder}/solution.pdf`,
    paperImage: `${base}/exams/${folder}/paper.png`,
    solutionImage: `${base}/exams/${folder}/solution.png`,
  };
}

export function examViewerUrls(session: ExamSession) {
  const local = publicExamPaths(session);
  const drive = driveExamUrls(session);
  const hasLocal = LOCAL_EXAM_IDS.has(session.id);
  return {
    paper: drive.paper ?? (hasLocal ? local.paper : null),
    solution: drive.solution ?? (hasLocal ? local.solution : null),
    paperOpen: drive.paperOpen ?? (hasLocal ? local.paper : null),
    solutionOpen: drive.solutionOpen ?? (hasLocal ? local.solution : null),
    paperLocal: hasLocal ? local.paper : null,
    paperPdf: drive.paperPdf,
    paperDrive: drive.paper,
    solutionDrive: drive.solution,
  };
}

export const DRIVE_FOLDER_ID = "1mIe3iCTLheqtEvDUMSQ2mEmh_ZOiCrxQ";
export const DRIVE_FOLDER_URL =
  `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}`;

const DRIVE_FILE_LIST = [
  { id: "1z8SgBydCw9N_1Iz-CjUTFYEcCm5FJbk5", name: "2025_3월.pdf" },
  { id: "1O55NkyDlX53N5JD4GHscbTn8VIbglV3e", name: "2025_3월(답).pdf" },
  { id: "1RTH3VKHOR8txxkX4uD2FpmNxPjExMDgZ", name: "2025_5월.pdf" },
  { id: "1bb7SexzyqTBoT3fbv6o7In019nHLE93V", name: "2025_5월(답).pdf" },
  { id: "17YIq-8HrwSJB9blzLr3xhHXVXrg-gGn8", name: "2025_5월 지2.pdf" },
  { id: "11aRqFVzTi2i1kmA-KHQXfUyl7LnzrI7p", name: "2025_5월 지2(답).pdf" },
  { id: "1sHfOoU4jMKmjrDtEMJ_pEG2U3YAWNISQ", name: "2025_6월.pdf" },
  { id: "1RFZ0pUSHi1_gnXcat3IIXPpcQ8XojsAT", name: "2025_6월(답).pdf" },
  { id: "130JHSSXUbezxtWHM55VR7WCWeEFGeECG", name: "2025_6월 지2.pdf" },
  { id: "1U2SWEuvTbEFr7Lv5CsQCQDQfbJ0Nj3um", name: "2025_6월 지2(답).pdf" },
  { id: "1SB7VK3o0GZhjkY3F3YcqRGO0eYrbUGZ3", name: "2025_7월.pdf" },
  { id: "11qAPgEzp9uc4vSeZ_IfWqIhJKtKJwACP", name: "2025_7월(답).pdf" },
  { id: "1YoP788P6zc22kDPyJ3Qro-Vj3LVu6Rpv", name: "2025_7월 지2.pdf" },
  { id: "1-lVg8WJJzPReQWaK7McXcK6qEqtHIHLF", name: "2025_7월 지2(답).pdf" },
  { id: "1jbj-A18BZQTAtX9g1BEZtNKFVnWQmXFZ", name: "2025_9월.pdf" },
  { id: "1juDgDVjyjVibJfKI1AAb6rgKDJ3TWZN-", name: "2025_9월(답).pdf" },
  { id: "1aaaRGCb6NIbkn1dgzrtYxBem225X-DuW", name: "2025_9월 지2.pdf" },
  { id: "141XG9kHpKcgKfhVZAef4bRGvD1HVlwNR", name: "2025_9월 지2(답).pdf" },
  { id: "1tFTW_x15e9LUHEU0e8Yiv-MG8rUPg98b", name: "2025_10월.pdf" },
  { id: "1Xn7nWdn6NIjnrkBcHbQp7W8POMSCpGyN", name: "2025_10월(답).pdf" },
  { id: "1RkYkhYDWH3tRNDLpq_ETGbZViO4xwpVw", name: "2025_10월 지2.pdf" },
  { id: "1e1UCWB_kWEoCDLvsvUQpUwABcUDdN_jC", name: "2025_10월 지2(답).pdf" },
  { id: "1VyBJzyrroefVHRt_p5TiVpSts5XMZMA1", name: "2025_11월.pdf" },
  { id: "1OYBy3d5ScyQyQwHsExHTR_x48CQFkh8E", name: "2025_11월(답).pdf" },
  { id: "11jr2AP5Csyo6dflc8bwCfh_rIJhLqsd1", name: "2025_11월 지2.pdf" },
  { id: "1jQV8T85C7JcT7nv-oYYwp7u4UPNo20MP", name: "2025_11월 지2(답).pdf" },
  { id: "1Zrd92r9eUHMOZy6liYJU0EIVp4siOUma", name: "2026_3월.pdf" },
  { id: "1dbX-D41jTFrIiAmN6lX_IGlu_WNTLb0q", name: "2026_3월(답).pdf" },
  { id: "1aDLRZvdMO-16cIqYHnW5xhPeP7S1Cutj", name: "2026_5월.pdf" },
  { id: "1bXS0f-XSk2y9PiFCeej_CDTGUhmMtP5Z", name: "2026_5월(답).pdf" },
  { id: "1zLTQe0BWA1Rl-fSpnJa_m_NUtSTvdZs7", name: "2026_5월 지2.pdf" },
  { id: "1fAfb6l831_nA6a8CG3wBBrMUdWrS5-Pt", name: "2026_5월 지2(답).pdf" },
  { id: "1IwuWttAZc9PXZO-5uEp4XkGxqqg1fpox", name: "2026_6월.pdf" },
  { id: "1cyplEvcyq_3UiTAhjscHmQMRaCAddR0V", name: "2026_6월(답).pdf" },
  { id: "13_yUv0AMPXjpVbXpqtWwGM9ui35zIq92", name: "2026_6월 지2.pdf" },
  { id: "1rmxn9rmD1-gp2OFBwf7QBW-0EtVKBqaC", name: "2026_6월 지2(답).pdf" },
  { id: "1N7yc4nkhor2S_9HrnbYRjK9cecj8X94v", name: "2026_7월.pdf" },
  { id: "1EX85uo8JMx7qxVBcT7VEUGc_6hef57ha", name: "2026_7월(답).pdf" },
  { id: "1L0vasGSXTJFjeCinQ7E7yHUxVVdrUCvf", name: "2026_7월 지2.pdf" },
  { id: "1YS6gjJ86nhf0ja6G7ZJgT427NkfuzDZD", name: "2026_7월 지2(답).pdf" },
] as const;

function driveFileUrl(fileId: string, mode: "preview" | "view") {
  return mode === "preview"
    ? `https://drive.google.com/file/d/${fileId}/preview`
    : `https://drive.google.com/file/d/${fileId}/view`;
}

export function driveMediaUrl(fileId: string) {
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
}

function sessionIdFromDriveName(name: string) {
  const match = name.match(/^(\d{4})_(\d{1,2})월( 지2)?(\(답\))?\.pdf$/);
  if (!match) return null;
  const year = match[1];
  const month = String(Number(match[2])).padStart(2, "0");
  const subject = match[3] ? "II" : "I";
  return {
    sessionId: `${year}-${month}-${subject}`,
    kind: match[4] ? "solution" : "paper",
  } as const;
}

const DRIVE_FILES_BY_SESSION = DRIVE_FILE_LIST.reduce<
  Record<string, { paper?: string; solution?: string }>
>((map, file) => {
  const parsed = sessionIdFromDriveName(file.name);
  if (!parsed) return map;
  map[parsed.sessionId] ??= {};
  map[parsed.sessionId][parsed.kind] = file.id;
  return map;
}, {});

export function driveExamUrls(session: ExamSession) {
  const files = DRIVE_FILES_BY_SESSION[session.id] ?? {};
  return {
    paper: files.paper ? driveFileUrl(files.paper, "preview") : null,
    solution: files.solution ? driveFileUrl(files.solution, "preview") : null,
    paperOpen: files.paper ? driveFileUrl(files.paper, "view") : null,
    solutionOpen: files.solution ? driveFileUrl(files.solution, "view") : null,
    paperPdf: files.paper ? driveMediaUrl(files.paper) : null,
    solutionPdf: files.solution ? driveMediaUrl(files.solution) : null,
  };
}

export function driveExamFiles() {
  return DRIVE_FILE_LIST.map((file) => {
    const parsed = sessionIdFromDriveName(file.name);
    return parsed ? { ...file, ...parsed } : null;
  }).filter((file): file is NonNullable<typeof file> => Boolean(file));
}

export function nearbyExamSessions(session: ExamSession) {
  const index = EXAM_SESSIONS.findIndex((item) => item.id === session.id);
  const picked = new Map<string, ExamSession>();
  const add = (item?: ExamSession | null) => {
    if (!item || picked.has(item.id)) return;
    picked.set(item.id, item);
  };
  add(session);
  add(siblingSession(session));
  if (index >= 0) {
    add(EXAM_SESSIONS[index - 1]);
    add(EXAM_SESSIONS[index + 1]);
    add(EXAM_SESSIONS[index + 2]);
  }
  return [...picked.values()];
}

export function examWarmUrls(session: ExamSession) {
  return nearbyExamSessions(session).flatMap((item) => {
    const files = examViewerUrls(item);
    return [files.paper, files.solution].filter((href): href is string => Boolean(href));
  });
}

const warmedExams = new Set<string>();

export function warmExamSession(session: ExamSession) {
  if (typeof document === "undefined" || warmedExams.has(session.id)) return;
  warmedExams.add(session.id);
  const files = examViewerUrls(session);
  for (const href of [files.paper, files.solution]) {
    if (!href) continue;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = href;
    document.head.appendChild(link);
  }
}

export function warmExamCatalog(start?: ExamSession) {
  if (typeof window === "undefined") return;
  const queue = start
    ? [...nearbyExamSessions(start), ...EXAM_SESSIONS.filter((item) => item.id !== start.id)]
    : [...EXAM_SESSIONS];
  let index = 0;
  const tick = () => {
    const next = queue[index];
    index += 1;
    if (!next) return;
    warmExamSession(next);
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(tick);
    else window.setTimeout(tick, 180);
  };
  tick();
}
