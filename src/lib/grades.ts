export const GRADE_COUNT = 9;

export const GRADE_TONES = [
  "#e50914",
  "#f43f5e",
  "#fb7185",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#38bdf8",
  "#64748b",
  "#3f3f46",
];

export function defaultGradeCuts(total: number) {
  const safe = Math.max(1, total);
  const ratios = [0.88, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.18, 0];
  return ratios.map((ratio) => Math.round(safe * ratio));
}

export function normalizeCuts(cuts: number[] | null | undefined, total: number) {
  const fallback = defaultGradeCuts(total);
  if (!cuts || cuts.length < 9) return fallback;
  return Array.from({ length: 9 }, (_, index) => {
    const value = Math.round(Number(cuts[index]));
    return Number.isFinite(value) ? Math.max(0, Math.min(total, value)) : fallback[index];
  });
}

export function bandFromScore(score: number | null, cuts: number[]) {
  if (score === null || Number.isNaN(score)) return null;
  for (let index = 0; index < 9; index += 1) {
    if (score >= (cuts[index] ?? 0)) return index + 1;
  }
  return 9;
}

export function bandLabel(band: number) {
  return `${band}등급`;
}

export function countBands(scores: Array<number | null>, cuts: number[]) {
  const counts = Array.from({ length: 9 }, () => 0);
  for (const score of scores) {
    const band = bandFromScore(score, cuts);
    if (band) counts[band - 1] += 1;
  }
  return counts;
}
