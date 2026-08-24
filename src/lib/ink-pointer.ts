const PALM_MAJOR_PX = 26;
const PEN_HOLD_MS = 1100;

let lastPenAt = 0;
let activePenCount = 0;

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function contactMajor(event: { width?: number; height?: number }) {
  return Math.max(event.width ?? 0, event.height ?? 0);
}

export function noteInkPointer(event: {
  pointerType: string;
  type?: string;
}) {
  if (event.pointerType !== "pen") return;
  lastPenAt = now();
  if (event.type === "pointerdown") activePenCount += 1;
  if (event.type === "pointerup" || event.type === "pointercancel") {
    activePenCount = Math.max(0, activePenCount - 1);
    lastPenAt = now();
  }
}

export function penIsWriting() {
  return activePenCount > 0 || now() - lastPenAt < PEN_HOLD_MS;
}

export function isPalmPointer(event: {
  pointerType: string;
  width?: number;
  height?: number;
}) {
  if (event.pointerType === "mouse" || event.pointerType === "pen") return false;
  if (event.pointerType !== "touch") return true;
  if (penIsWriting()) return true;
  return contactMajor(event) >= PALM_MAJOR_PX;
}

export function shouldAcceptInk(event: {
  pointerType: string;
  width?: number;
  height?: number;
}) {
  return !isPalmPointer(event);
}
