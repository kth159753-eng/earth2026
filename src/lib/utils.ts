export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function formatScore(score: number | null) {
  if (score === null || Number.isNaN(score)) return "—";
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return {
    hours: pad2(hours),
    minutes: pad2(minutes),
    seconds: pad2(seconds),
    label: hours > 0 ? `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}` : `${pad2(minutes)}:${pad2(seconds)}`,
  };
}

export function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export { isSupabaseConfigured, siteUrl } from "@/lib/config";

export function gradeLabel(grade: number) {
  return `${grade}학년`;
}

export function classLabel(classNumber: number) {
  return `${classNumber}반`;
}

export function studentLabel(studentNumber: number) {
  return `${studentNumber}번`;
}

export function validateUsername(username: string) {
  return /^[a-zA-Z0-9_]{4,20}$/.test(username);
}

export function validateName(name: string) {
  return name.trim().length >= 2 && name.trim().length <= 20;
}

export function validatePassword(password: string) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function genericAuthError() {
  return "비밀번호가 틀렸습니다.";
}
