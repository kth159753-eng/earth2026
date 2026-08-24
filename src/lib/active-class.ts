export type ActiveClass = {
  grade: number;
  classNumber: number;
  sessionId: string;
  running: boolean;
};

const KEY = "earth-active-class";
const EVENT = "earth-active-class";

export function readActiveClass(): ActiveClass | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "null") as ActiveClass | null;
    if (
      !parsed ||
      parsed.grade < 1 ||
      parsed.grade > 3 ||
      parsed.classNumber < 1 ||
      parsed.classNumber > 15
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeActiveClass(value: ActiveClass | null) {
  if (typeof window === "undefined") return;
  if (value) localStorage.setItem(KEY, JSON.stringify(value));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeActiveClass(onChange: (value: ActiveClass | null) => void) {
  const emit = () => onChange(readActiveClass());
  window.addEventListener(EVENT, emit);
  window.addEventListener("storage", emit);
  emit();
  return () => {
    window.removeEventListener(EVENT, emit);
    window.removeEventListener("storage", emit);
  };
}
