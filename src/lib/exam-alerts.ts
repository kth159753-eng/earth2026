let audioCtx: AudioContext | null = null;
let speaking = false;
let sirenNodes: { osc: OscillatorNode; stopAt: number }[] = [];

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
  const ctx = audioCtx;
  if (ctx) {
    for (const node of sirenNodes) {
      try {
        node.osc.stop();
      } catch {
        /* already stopped */
      }
    }
    sirenNodes = [];
  }
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

type VoiceKind = "child" | "uncle" | "young";

function pickVoice(kind: VoiceKind) {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const all = window.speechSynthesis.getVoices();
  const ko = all.filter((voice) => voice.lang.toLowerCase().startsWith("ko"));
  const pool = ko.length ? ko : all;
  if (!pool.length) return null;
  const female = pool.filter((voice) =>
    /female|yuna|heami|sunhi|sora|nari|heami|여|woman|girl|zira|samantha/i.test(voice.name),
  );
  const male = pool.filter((voice) =>
    /male|insoo|jinho|minsu|hyung|injoon|guy|남|man|david|mark|james/i.test(voice.name),
  );
  if (kind === "uncle") {
    return male[0] ?? pool.find((voice) => !female.includes(voice)) ?? pool[pool.length - 1];
  }
  return female[0] ?? pool[0];
}

function speak(text: string, kind: VoiceKind) {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.volume = 1;
    if (kind === "child") {
      utterance.pitch = 1.58;
      utterance.rate = 0.82;
    } else if (kind === "uncle") {
      utterance.pitch = 0.46;
      utterance.rate = 0.84;
    } else {
      utterance.pitch = 1.22;
      utterance.rate = 1.06;
    }
    const voice = pickVoice(kind);
    if (voice) utterance.voice = voice;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

function playSiren(seconds = 2.2) {
  const ctx = context();
  if (!ctx) return wait(seconds * 1000);
  if (ctx.state === "suspended") void ctx.resume();

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.34, now + 0.05);
  gain.gain.setValueAtTime(0.34, now + seconds - 0.14);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

  let t = now;
  while (t < now + seconds) {
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.linearRampToValueAtTime(520, t + 0.28);
    osc.frequency.linearRampToValueAtTime(880, t + 0.56);
    t += 0.56;
  }

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + seconds);
  sirenNodes.push({ osc, stopAt: now + seconds });
  return wait(seconds * 1000);
}

async function playAlert(run: () => Promise<void>) {
  if (speaking) window.speechSynthesis?.cancel();
  speaking = true;
  await playSiren(2.1);
  if (!speaking) return;
  await waitVoices();
  if (!speaking) return;
  await run();
  speaking = false;
}

export async function playFifteenLeftAlert() {
  await playAlert(() => speak("15분 남았어요", "child"));
}

export async function playTenLeftAlert() {
  await playAlert(() => speak("10분 남았다네", "uncle"));
}

export async function playFiveLeftAlert() {
  await playAlert(async () => {
    for (let index = 0; index < 5; index += 1) {
      if (!speaking) return;
      await speak("비상", "young");
    }
  });
}
