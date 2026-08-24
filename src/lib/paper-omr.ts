export type PaperPoint = { x: number; y: number };

export type PaperTextItem = {
  str: string;
  x: number;
  y: number;
};

export type ChoiceHit = {
  question: number;
  choice: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type QuestionBand = {
  question: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type PageOmrMap = {
  questions: QuestionBand[];
  choices: ChoiceHit[];
};

const CHOICE_MARK: Record<string, number> = {
  "①": 1,
  "②": 2,
  "③": 3,
  "④": 4,
  "⑤": 5,
};

function columnOf(x: number) {
  return x < 0.48 ? 0 : 1;
}

function columnRange(column: number) {
  return column === 0 ? { x0: 0.05, x1: 0.495 } : { x0: 0.495, x1: 0.95 };
}

function parseQuestion(text: string) {
  const match = text.trim().match(/^([1-9]|1[0-9]|20)\.$/);
  return match ? Number(match[1]) : null;
}

function parseChoice(text: string) {
  const trimmed = text.trim();
  const mark = trimmed[0];
  return mark ? CHOICE_MARK[mark] ?? null : null;
}

function isQuestionNumber(item: PaperTextItem) {
  const number = parseQuestion(item.str);
  if (!number) return false;
  if (item.x > 0.12 && item.x < 0.48) return false;
  if (item.x > 0.54) return false;
  return true;
}

export function buildPageOmrMap(items: PaperTextItem[]): PageOmrMap {
  const questions = items
    .filter(isQuestionNumber)
    .map((item) => ({
      number: parseQuestion(item.str) as number,
      x: item.x,
      y: item.y,
      column: columnOf(item.x),
    }))
    .sort((a, b) => a.number - b.number || a.y - b.y);

  const unique: typeof questions = [];
  for (const item of questions) {
    if (unique.some((row) => row.number === item.number)) continue;
    unique.push(item);
  }

  const bands: QuestionBand[] = unique.map((item) => {
    const next = unique
      .filter((row) => row.column === item.column && row.y > item.y + 0.01)
      .sort((a, b) => a.y - b.y)[0];
    const range = columnRange(item.column);
    return {
      question: item.number - 1,
      x0: range.x0,
      x1: range.x1,
      y0: Math.max(0, item.y - 0.012),
      y1: next ? next.y - 0.006 : 0.94,
    };
  });

  const rawChoices = items
    .map((item) => {
      const choice = parseChoice(item.str);
      if (!choice) return null;
      return { choice, x: item.x, y: item.y, column: columnOf(item.x) };
    })
    .filter((item): item is { choice: number; x: number; y: number; column: number } => Boolean(item));

  const grouped = new Map<number, Array<{ choice: number; x: number; y: number }>>();
  for (const choice of rawChoices) {
    const owner = bands.find(
      (band) =>
        choice.x >= band.x0 &&
        choice.x <= band.x1 &&
        choice.y >= band.y0 &&
        choice.y <= band.y1,
    );
    if (!owner) continue;
    const list = grouped.get(owner.question) ?? [];
    list.push({ choice: choice.choice, x: choice.x, y: choice.y });
    grouped.set(owner.question, list);
  }

  const hits: ChoiceHit[] = [];
  for (const [question, list] of grouped) {
    const picked = pickChoices(list);
    hits.push(...boxesForChoices(question, picked));
  }

  return { questions: bands, choices: hits };
}

function pickChoices(list: Array<{ choice: number; x: number; y: number }>) {
  if (list.length <= 5) {
    const byChoice = new Map<number, { choice: number; x: number; y: number }>();
    for (const item of list) byChoice.set(item.choice, item);
    return [...byChoice.values()].sort((a, b) => a.choice - b.choice);
  }

  const clusters: Array<Array<{ choice: number; x: number; y: number }>> = [];
  for (const item of list) {
    const near = clusters.find((cluster) =>
      cluster.some((member) => Math.hypot(member.x - item.x, member.y - item.y) < 0.16),
    );
    if (near) near.push(item);
    else clusters.push([item]);
  }

  clusters.sort((a, b) => {
    const ua = new Set(a.map((item) => item.choice)).size;
    const ub = new Set(b.map((item) => item.choice)).size;
    if (ub !== ua) return ub - ua;
    const ya = a.reduce((sum, item) => sum + item.y, 0) / a.length;
    const yb = b.reduce((sum, item) => sum + item.y, 0) / b.length;
    return yb - ya;
  });

  const byChoice = new Map<number, { choice: number; x: number; y: number }>();
  for (const item of clusters[0] ?? list) byChoice.set(item.choice, item);
  return [...byChoice.values()].sort((a, b) => a.choice - b.choice);
}

function boxesForChoices(
  question: number,
  items: Array<{ choice: number; x: number; y: number }>,
): ChoiceHit[] {
  if (items.length === 0) return [];
  const xs = items.map((item) => item.x);
  const ys = items.map((item) => item.y);
  const horizontal = Math.max(...ys) - Math.min(...ys) < 0.022;
  const vertical = Math.max(...xs) - Math.min(...xs) < 0.06;

  if (horizontal) {
    const sorted = [...items].sort((a, b) => a.x - b.x);
    return sorted.map((item, index) => {
      const prev = sorted[index - 1];
      const next = sorted[index + 1];
      return {
        question,
        choice: item.choice,
        x0: prev ? (prev.x + item.x) / 2 : item.x - 0.03,
        x1: next ? (item.x + next.x) / 2 : item.x + 0.075,
        y0: item.y - 0.022,
        y1: item.y + 0.032,
      };
    });
  }

  if (vertical) {
    const sorted = [...items].sort((a, b) => a.y - b.y);
    return sorted.map((item, index) => {
      const prev = sorted[index - 1];
      const next = sorted[index + 1];
      return {
        question,
        choice: item.choice,
        x0: item.x - 0.03,
        x1: Math.min(0.95, item.x + 0.34),
        y0: prev ? (prev.y + item.y) / 2 : item.y - 0.016,
        y1: next ? (item.y + next.y) / 2 : item.y + 0.02,
      };
    });
  }

  return items.map((item) => ({
    question,
    choice: item.choice,
    x0: item.x - 0.035,
    x1: item.x + 0.08,
    y0: item.y - 0.018,
    y1: item.y + 0.02,
  }));
}

function contains(hit: ChoiceHit, point: PaperPoint) {
  return point.x >= hit.x0 && point.x <= hit.x1 && point.y >= hit.y0 && point.y <= hit.y1;
}

function center(hit: ChoiceHit) {
  return { x: (hit.x0 + hit.x1) / 2, y: (hit.y0 + hit.y1) / 2 };
}

export function hitChoiceBox(
  map: PageOmrMap | undefined,
  point: PaperPoint,
): { question: number; choice: number } | null {
  if (!map) return null;
  const inside = map.choices.find((hit) => contains(hit, point));
  return inside ? { question: inside.question, choice: inside.choice } : null;
}

export function locateFromMap(
  map: PageOmrMap | undefined,
  point: PaperPoint,
): { question: number; choice: number } | null {
  const inside = hitChoiceBox(map, point);
  if (inside) return inside;
  if (!map) return null;

  let best: { question: number; choice: number; dist: number } | null = null;
  for (const hit of map.choices) {
    const mid = center(hit);
    const dist = Math.hypot(point.x - mid.x, point.y - mid.y);
    if (!best || dist < best.dist) {
      best = { question: hit.question, choice: hit.choice, dist };
    }
  }
  if (best && best.dist <= 0.055) {
    return { question: best.question, choice: best.choice };
  }

  const band = map.questions.find(
    (item) =>
      point.x >= item.x0 &&
      point.x <= item.x1 &&
      point.y >= item.y0 &&
      point.y <= item.y1,
  );
  if (!band) return null;
  const inBand = map.choices.filter((hit) => hit.question === band.question);
  if (inBand.length === 0) return { question: band.question, choice: 1 };
  inBand.sort((a, b) => {
    const da = Math.hypot(point.x - center(a).x, point.y - center(a).y);
    const db = Math.hypot(point.x - center(b).x, point.y - center(b).y);
    return da - db;
  });
  return { question: band.question, choice: inBand[0].choice };
}

export function strokeCentroid(points: PaperPoint[]) {
  if (points.length === 0) return { x: 0.5, y: 0.5 };
  const sum = points.reduce(
    (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}
