"use client";

import { BASE_PATH } from "@/lib/config";
import { QUESTION_COUNT } from "@/lib/exams";
import { cn } from "@/lib/utils";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Pdfjs = typeof import("pdfjs-dist");
type PdfDoc = Awaited<ReturnType<Pdfjs["getDocument"]>["promise"]>;

let pdfjsLoader: Promise<Pdfjs> | null = null;
const pdfDocs = new Map<string, Promise<PdfDoc>>();

function loadPdfjs() {
  if (!pdfjsLoader) {
    pdfjsLoader = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `${BASE_PATH}/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return pdfjsLoader;
}

function loadPdf(src: string) {
  const cached = pdfDocs.get(src);
  if (cached) return cached;
  const pending = loadPdfjs().then((pdfjs) =>
    pdfjs.getDocument({
      url: src,
      disableStream: true,
      disableRange: true,
      disableAutoFetch: false,
    }).promise,
  );
  pdfDocs.set(src, pending);
  return pending;
}

function bitmapWidth(cssWidth: number) {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const cap = cssWidth < 720 ? 1.2 : 1.5;
  return Math.max(280, Math.round(Math.min(cssWidth, 860) * Math.min(dpr, cap)));
}

export type InkStroke = {
  id: string;
  page: number;
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
  mark?: number;
  question?: number;
  omrChoice?: number;
};

export type SoloTool = "pen" | "erase" | 1 | 2 | 3 | 4 | 5;

type Props = {
  src: string;
  tool: SoloTool;
  color: string;
  strokes: InkStroke[];
  onStrokes: (next: InkStroke[] | ((current: InkStroke[]) => InkStroke[])) => void;
  onMark: (choice: number, question?: number) => void;
};

type PageSize = { width: number; height: number };

const EMPTY_STROKES: InkStroke[] = [];

export function SoloPaper({ src, tool, color, strokes, onStrokes, onMark }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [error, setError] = useState("");
  const [renderWidth, setRenderWidth] = useState(0);
  const widthRef = useRef(0);

  useEffect(() => {
    setPages([]);
    setSizes([]);
    setError("");
    widthRef.current = 0;
  }, [src]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let timer = 0;
    const apply = (width: number) => {
      if (width <= 0) return;
      if (Math.abs(width - widthRef.current) < 40 && widthRef.current) return;
      widthRef.current = width;
      setRenderWidth(width);
    };
    const update = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => apply(Math.floor(host.clientWidth)), 280);
    };
    apply(Math.floor(host.clientWidth));
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [src]);

  useEffect(() => {
    if (!renderWidth) return;
    let cancelled = false;
    const pixelWidth = bitmapWidth(renderWidth);

    async function render() {
      setError("");
      try {
        const document = await loadPdf(src);
        const nextPages: HTMLCanvasElement[] = [];
        const nextSizes: PageSize[] = [];
        for (let index = 1; index <= document.numPages; index += 1) {
          const page = await document.getPage(index);
          const unscaled = page.getViewport({ scale: 1 });
          const scale = pixelWidth / unscaled.width;
          const viewport = page.getViewport({ scale });
          const canvas = window.document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) continue;
          await page.render({ canvasContext: context, viewport, intent: "display" }).promise;
          nextPages.push(canvas);
          nextSizes.push({ width: canvas.width, height: canvas.height });
          if (!cancelled) {
            setPages(nextPages.slice());
            setSizes(nextSizes.slice());
          }
        }
      } catch {
        if (!cancelled) setError("시험지를 불러오지 못했습니다.");
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [src, renderWidth]);

  const strokesByPage = useMemo(() => {
    const grouped = new Map<number, InkStroke[]>();
    for (const stroke of strokes) {
      const list = grouped.get(stroke.page);
      if (list) list.push(stroke);
      else grouped.set(stroke.page, [stroke]);
    }
    return grouped;
  }, [strokes]);

  return (
    <div ref={hostRef} className="mx-auto w-full max-w-[860px] space-y-3 sm:space-y-4">
      {error ? <p className="py-20 text-center text-sm text-[#808080]">{error}</p> : null}
      {!error && pages.length === 0 ? (
        <p className="py-20 text-center text-sm text-[#808080]">시험지를 열고 있습니다...</p>
      ) : null}
      {pages.map((page, index) => (
        <PaperPage
          key={`${src}-${index}`}
          pageIndex={index}
          bitmap={page}
          size={sizes[index]}
          tool={tool}
          color={color}
          strokes={strokesByPage.get(index) ?? EMPTY_STROKES}
          onStrokes={onStrokes}
          onMark={onMark}
          pageCount={pages.length}
        />
      ))}
    </div>
  );
}

const PaperPage = memo(function PaperPage({
  pageIndex,
  bitmap,
  size,
  tool,
  color,
  strokes,
  onStrokes,
  onMark,
  pageCount,
}: {
  pageIndex: number;
  bitmap: HTMLCanvasElement;
  size?: PageSize;
  tool: SoloTool;
  color: string;
  strokes: InkStroke[];
  onStrokes: (next: InkStroke[] | ((current: InkStroke[]) => InkStroke[])) => void;
  onMark: (choice: number, question?: number) => void;
  pageCount: number;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<InkStroke | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    bitmap.className = "block h-auto w-full select-none";
    bitmap.style.width = "100%";
    frame.replaceChildren(bitmap);
  }, [bitmap]);

  useEffect(() => {
    const canvas = inkRef.current;
    if (!canvas || !size) return;
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      drawStroke(context, stroke, canvas.width);
    }
  }, [strokes, size]);

  const pointFromEvent = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = inkRef.current;
    if (!canvas) return null;
    const box = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    };
  }, []);

  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = pointFromEvent(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "erase") {
      onStrokes((current) =>
        current.filter((stroke) => stroke.page !== pageIndex || !hitsStroke(stroke, point)),
      );
      return;
    }
    if (typeof tool === "number") {
      const located = locateMark(pageIndex, pageCount, point.x, point.y);
      const mark: InkStroke = {
        id: `${Date.now()}-${Math.random()}`,
        page: pageIndex,
        color,
        width: 0.018,
        points: [point],
        mark: tool,
        question: located?.question,
        omrChoice: tool,
      };
      onStrokes((current) => [...current, mark]);
      onMark(tool, located?.question);
      return;
    }
    drawing.current = {
      id: `${Date.now()}-${Math.random()}`,
      page: pageIndex,
      color,
      width: 0.0046,
      points: [point],
    };
  }

  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = pointFromEvent(event);
    const stroke = drawing.current;
    const canvas = inkRef.current;
    if (!point || !stroke || !canvas) return;
    stroke.points.push(point);
    const context = canvas.getContext("2d");
    if (!context) return;
    drawStroke(context, { ...stroke, points: stroke.points.slice(-2) }, canvas.width);
  }

  function pointerUp() {
    const stroke = drawing.current;
    drawing.current = null;
    if (!stroke || stroke.points.length < 1) return;
    const last = stroke.points[stroke.points.length - 1] ?? stroke.points[0];
    const located = last ? locateMark(pageIndex, pageCount, last.x, last.y) : null;
    const check = isCheckStroke(stroke);
    const nextStroke: InkStroke = {
      ...stroke,
      question: located?.question,
      omrChoice: check ? located?.choice : undefined,
    };
    onStrokes((current) => [...current, nextStroke]);
    if (check && located) onMark(located.choice, located.question);
  }

  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-[2px] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
      <div ref={frameRef} />
      <canvas
        ref={inkRef}
        className={cn(
          "absolute inset-0 h-full w-full touch-none",
          tool === "erase" ? "cursor-cell" : "cursor-crosshair",
        )}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      />
    </div>
  );
});

function drawStroke(context: CanvasRenderingContext2D, stroke: InkStroke, width: number) {
  const size = Math.max(2, stroke.width * width);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  if (stroke.mark) {
    const point = stroke.points[0];
    if (!point) return;
    context.globalAlpha = 0.82;
    context.beginPath();
    context.arc(point.x * context.canvas.width, point.y * context.canvas.height, size, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    return;
  }
  if (stroke.points.length < 2) return;
  context.globalAlpha = 0.92;
  context.lineWidth = size;
  context.beginPath();
  context.moveTo(stroke.points[0].x * context.canvas.width, stroke.points[0].y * context.canvas.height);
  for (const point of stroke.points.slice(1)) {
    context.lineTo(point.x * context.canvas.width, point.y * context.canvas.height);
  }
  context.stroke();
  context.globalAlpha = 1;
}

function hitsStroke(stroke: InkStroke, point: { x: number; y: number }) {
  const threshold = stroke.mark ? 0.03 : 0.018;
  return stroke.points.some((item) => {
    const dx = item.x - point.x;
    const dy = item.y - point.y;
    return dx * dx + dy * dy <= threshold * threshold;
  });
}

function isCheckStroke(stroke: InkStroke) {
  if (stroke.points.length < 2) return true;
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  let length = 0;
  for (let index = 0; index < stroke.points.length; index += 1) {
    const point = stroke.points[index];
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
    if (index > 0) {
      const prev = stroke.points[index - 1];
      const dx = point.x - prev.x;
      const dy = point.y - prev.y;
      length += Math.hypot(dx, dy);
    }
  }
  const box = Math.max(maxX - minX, maxY - minY);
  return box < 0.055 || (box < 0.08 && length < 0.16);
}

function locateMark(pageIndex: number, pageCount: number, x: number, y: number) {
  const pages = Math.max(1, pageCount);
  const questionsPerPage = Math.ceil(QUESTION_COUNT / pages);
  const rows = Math.max(1, Math.ceil(questionsPerPage / 2));
  const col = x < 0.5 ? 0 : 1;
  const row = Math.min(rows - 1, Math.max(0, Math.floor(y * rows)));
  const localIndex = col * rows + row;
  if (localIndex >= questionsPerPage) return null;
  const question = pageIndex * questionsPerPage + localIndex;
  if (question < 0 || question >= QUESTION_COUNT) return null;

  const cellY = y * rows - row;
  const choiceStart = 0.34;
  const choice =
    cellY < choiceStart
      ? 1
      : Math.min(5, Math.floor(((cellY - choiceStart) / (1 - choiceStart)) * 5) + 1);
  return { question, choice };
}
