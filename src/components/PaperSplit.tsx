"use client";

import { examViewerUrls, nearbyExamSessions, warmExamSession, type ExamSession } from "@/lib/exams";
import { Notice } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5] as const;

type Props = {
  session: ExamSession;
  paperUrl: string | null;
  solutionUrl: string | null;
};

export function PaperSplit({ session, paperUrl, solutionUrl }: Props) {
  const files = useMemo(() => examViewerUrls(session), [session]);

  useEffect(() => {
    warmExamSession(session);
    for (const item of nearbyExamSessions(session)) warmExamSession(item);
  }, [files.paper, files.solution, session]);
  const [paper, setPaper] = useState(paperUrl);
  const [solution, setSolution] = useState(solutionUrl);
  const [pane, setPane] = useState<"paper" | "solution">("paper");
  const [error, setError] = useState("");

  useEffect(() => {
    setPaper(paperUrl);
    setSolution(solutionUrl);
    setError("");
  }, [paperUrl, solutionUrl, session.id]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col px-2 py-2 sm:px-3">
      {error ? (
        <div className="mb-2">
          <Notice tone="warn">{error}</Notice>
        </div>
      ) : null}
      <div className="mb-2 grid grid-cols-2 gap-1.5 lg:hidden">
        {(["paper", "solution"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setPane(id)}
            className={cn(
              "h-11 rounded-[4px] text-[13px] font-bold",
              pane === id ? "bg-[#e50914] text-white" : "bg-white/8 text-[#b3b3b3]",
            )}
          >
            {id === "paper" ? "시험지" : "해설지"}
          </button>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-2">
        <div className={cn("min-h-0", pane === "paper" ? "block" : "hidden lg:block")}>
          <PaperPane
            title="시험지"
            active={pane === "paper"}
            url={paper}
            fileUrl={files.paper}
            openUrl={files.paperOpen}
          />
        </div>
        <div className={cn("min-h-0", pane === "solution" ? "block" : "hidden lg:block")}>
          <PaperPane
            title="해설지"
            active={pane === "solution"}
            url={solution}
            fileUrl={files.solution}
            openUrl={files.solutionOpen}
          />
        </div>
      </div>
    </div>
  );
}

function isImageSrc(src: string) {
  return /\.(png|jpe?g|webp|gif)(\?|$)/i.test(src);
}

function useWideScreen() {
  const [wide, setWide] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setWide(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return wide;
}

function PaperPane({
  title,
  active,
  url,
  fileUrl,
  openUrl,
}: {
  title: string;
  active: boolean;
  url: string | null;
  fileUrl: string | null;
  openUrl: string | null;
}) {
  const wide = useWideScreen();
  const visible = active || wide;
  const src = url ?? fileUrl;
  const href = url ?? openUrl ?? fileUrl;
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const scroller = useRef<HTMLDivElement>(null);

  function applyZoom(next: number) {
    const value = Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], Math.max(ZOOM_STEPS[0], next));
    zoomRef.current = value;
    setZoom(value);
  }

  function bumpZoom(direction: 1 | -1) {
    const index = ZOOM_STEPS.reduce((best, step, stepIndex) => {
      return Math.abs(step - zoomRef.current) < Math.abs(ZOOM_STEPS[best] - zoomRef.current)
        ? stepIndex
        : best;
    }, 0);
    applyZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, index + direction))]);
  }

  useEffect(() => {
    const pane = scroller.current;
    if (!pane) return;
    const host = pane;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      bumpZoom(event.deltaY < 0 ? 1 : -1);
    };
    let pinching = false;
    let startDist = 1;
    let startZoom = 1;
    function distance(a: Touch, b: Touch) {
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }
    function onStart(event: TouchEvent) {
      if (event.touches.length !== 2) return;
      pinching = true;
      startDist = distance(event.touches[0], event.touches[1]) || 1;
      startZoom = zoomRef.current;
    }
    function onMove(event: TouchEvent) {
      if (!pinching || event.touches.length !== 2) return;
      event.preventDefault();
      applyZoom(startZoom * (distance(event.touches[0], event.touches[1]) / startDist));
    }
    function onEnd(event: TouchEvent) {
      if (event.touches.length < 2) pinching = false;
    }
    host.addEventListener("wheel", onWheel, { passive: false });
    host.addEventListener("touchstart", onStart, { passive: true });
    host.addEventListener("touchmove", onMove, { passive: false });
    host.addEventListener("touchend", onEnd);
    host.addEventListener("touchcancel", onEnd);
    return () => {
      host.removeEventListener("wheel", onWheel);
      host.removeEventListener("touchstart", onStart);
      host.removeEventListener("touchmove", onMove);
      host.removeEventListener("touchend", onEnd);
      host.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[4px] border border-[#333] bg-[#1f1f1f]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/8 px-3 py-1.5">
        <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-[4px] bg-white/8 px-0.5">
            <button
              type="button"
              title="축소"
              aria-label={`${title} 축소`}
              onClick={() => bumpZoom(-1)}
              disabled={zoom <= ZOOM_STEPS[0]}
              className="grid h-11 w-11 place-items-center text-white disabled:opacity-35 sm:h-8 sm:w-8"
            >
              <ZoomIcon minus />
            </button>
            <button
              type="button"
              title="원래 크기"
              onClick={() => applyZoom(1)}
              className="min-w-11 text-center text-[11px] font-bold tabular-nums text-white"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              title="확대"
              aria-label={`${title} 확대`}
              onClick={() => bumpZoom(1)}
              disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              className="grid h-11 w-11 place-items-center text-white disabled:opacity-35 sm:h-8 sm:w-8"
            >
              <ZoomIcon />
            </button>
          </div>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-stone-300"
            >
              새 탭
            </a>
          ) : null}
        </div>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto bg-[#0a0d12]">
        {src && visible ? (
          <div
            className="relative min-h-full min-w-full"
            style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
          >
            {isImageSrc(src) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={title} decoding="async" className="mx-auto h-full w-full object-contain" />
            ) : (
              <iframe
                title={title}
                src={src}
                className="h-full min-h-[70vh] w-full border-0 bg-white lg:min-h-full"
                allow="autoplay"
                allowFullScreen
              />
            )}
          </div>
        ) : src && !visible ? (
          <div className="h-full" />
        ) : (
          <div className="grid h-full place-items-center px-6 text-center">
            <p className="text-sm text-stone-400">이 회차 파일이 아직 없습니다.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function ZoomIcon({ minus = false }: { minus?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.2" strokeWidth="1.8" />
      <path d="M15.2 15.2 21 21" strokeWidth="1.8" strokeLinecap="round" />
      <path d={minus ? "M7.6 10.5h5.8" : "M10.5 7.6v5.8M7.6 10.5h5.8"} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
