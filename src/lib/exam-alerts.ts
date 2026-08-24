let audioCtx: AudioContext | null = null;
let speaking = false;

function context() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx || audioCtx.state === "closed") audioCtx = new Ctor();
  return audioCtx;
}

export function unlockExamAudio() {
  const ctx = context();
  if (ctx && ctx.state === "suspended") void ctx.resume();
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.getVoices();
    const warm = new SpeechSynthesisUtterance(" ");
    warm.volume = 0;
    warm.rate = 2;
    window.speechSynthesis.speak(warm);
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

export function stopExamAlerts() {
  speaking = false;
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function waitVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve();
  if (window.speechSynthesis.getVoices().length) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      resolve();
    };
    window.speechSynthesis.addEventListener("voiceschanged", done);
    window.setTimeout(done, 350);
  });
}

function pickVoice(kind: "female" | "male") {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const all = window.speechSynthesis.getVoices();
  const ko = all.filter((voice) => voice.lang.toLowerCase().startsWith("ko"));
  const pool = ko.length ? ko : all;
  if (!pool.length) return null;
  if (kind === "female") {
    return (
      pool.find((voice) => /female|yuna|heami|sunhi|heami|여|yuna/i.test(voice.name)) ??
      pool[0]
    );
  }
  return (
    pool.find((voice) => /male|insoo|jinho|minsu|guy|남/i.test(voice.name)) ??
    pool.find((voice) => !/female|yuna|heami|sunhi|여/i.test(voice.name)) ??
    pool[pool.length - 1]
  );
}

function speak(text: string, kind: "female" | "male") {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.volume = 1;
    if (kind === "female") {
      utterance.pitch = 1.12;
      utterance.rate = 0.92;
    } else {
      utterance.pitch = 0.58;
      utterance.rate = 1.18;
    }
    const voice = pickVoice(kind);
    if (voice) utterance.voice = voice;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

function playSiren(seconds = 3) {
  const ctx = context();
  if (!ctx) return wait(seconds * 1000);
  if (ctx.state === "suspended") void ctx.resume();

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.32, now + 0.04);
  gain.gain.setValueAtTime(0.32, now + seconds - 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

  let t = now;
  while (t < now + seconds) {
    osc.frequency.setValueAtTime(820, t);
    osc.frequency.setValueAtTime(560, t + 0.26);
    t += 0.52;
  }

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + seconds);
  return wait(seconds * 1000);
}

export async function playTenLeftAlert() {
  if (speaking) window.speechSynthesis?.cancel();
  speaking = true;
  await waitVoices();
  if (!speaking) return;
  await speak("10분 남았으요", "female");
  speaking = false;
}

export async function playFiveLeftAlert() {
  if (speaking) window.speechSynthesis?.cancel();
  speaking = true;
  await playSiren(3);
  if (!speaking) return;
  await waitVoices();
  for (let index = 0; index < 5; index += 1) {
    if (!speaking) return;
    await speak("비상!", "male");
  }
  speaking = false;
}
