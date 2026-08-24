"use client";

import { BASE_PATH } from "@/lib/config";
import { QUESTION_COUNT } from "@/lib/exams";
import { noteInkPointer, shouldAcceptInk } from "@/lib/ink-pointer";
import {
  buildPageOmrMap,
  hitChoiceBox,
  locateFromMap,
  strokeCentroid,
  type PageOmrMap,
} from "@/lib/paper-omr";
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
  if (typeof window === "undefined") return Math.round(cssWidth * 1.5);
  const dpr = window.devicePixelRatio || 1;
  const narrow = window.innerWidth < 768;
  const tablet = window.innerWidth < 1024;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const max = narrow ? 1400 : tablet ? 1800 : 2400;
  const scale = coarse || narrow ? Math.min(Math.max(dpr, 1), 1.75) : Math.min(Math.max(dpr, 1), 2.25);
  return Math.min(max, Math.max(640, Math.round(cssWidth * scale)));
}

function yieldPaint() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      return;
    }
    setTimeout(resolve, 0);
  });
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
  zoom?: number;
};

type PageSize = { width: number; height: number };

const EMPTY_STROKES: InkStroke[] = [];

export function SoloPaper({ src, tool, color, strokes, onStrokes, onMark, zoom = 1 }: Props) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [maps, setMaps] = useState<PageOmrMap[]>([]);
  const [error, setError] = useState("");
  const [baseWidth, setBaseWidth] = useState(0);
  const widthRef = useRef(0);

  useEffect(() => {
    setPages([]);
    setSizes([]);
    setMaps([]);
    setError("");
  }, [src]);

  useEffect(() => {
    const host = measureRef.current;
    if (!host) return;
    let timer = 0;
    const apply = (width: number) => {
      if (width <= 0) return;
      if (Math.abs(width - widthRef.current) < 24 && widthRef.current) return;
      widthRef.current = width;
      setBaseWidth(width);
    };
    const update = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => apply(Math.floor(host.clientWidth)), 220);
    };
    apply(Math.floor(host.clientWidth));
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [src]);

  const renderWidth = Math.min(baseWidth || 860, 860);

  useEffect(() => {
    if (!baseWidth) return;
    let cancelled = false;
    const pixelWidth = bitmapWidth(renderWidth);
    const coarse =
      typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

    async function render() {
      setError("");
      try {
        const document = await loadPdf(src);
        const nextPages: HTMLCanvasElement[] = [];
        const nextSizes: PageSize[] = [];
        const nextMaps: PageOmrMap[] = [];
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
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = coarse ? "medium" : "high";
          await page.render({ canvasContext: context, viewport, intent: "display" }).promise;
          nextPages.push(canvas);
          nextSizes.push({ width: canvas.width, height: canvas.height });
          if (!cancelled) {
            setPages(nextPages.slice());
            setSizes(nextSizes.slice());
          }
          await yieldPaint();
          if (cancelled) return;
          const content = await page.getTextContent();
          const items = content.items.flatMap((item) => {
            if (!("str" in item) || !item.str) return [];
            const transform = item.transform;
            return [
              {
                str: item.str,
                x: transform[4] / unscaled.width,
                y: 1 - transform[5] / unscaled.height,
              },
            ];
          });
          nextMaps.push(buildPageOmrMap(items));
          if (!cancelled) setMaps(nextMaps.slice());
          if (index < document.numPages) await yieldPaint();
        }
      } catch {
        if (!cancelled) setError("시험지를 불러오지 못했습니다.");
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [src, baseWidth, renderWidth]);

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
    <div ref={measureRef} className="w-full">
    <div
      className="mx-auto space-y-3 sm:space-y-4"
      style={{ width: Math.max(1, Math.round(renderWidth * zoom)) }}
    >
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
          omrMap={maps[index]}
        />
      ))}
    </div>
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
  omrMap,
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
  omrMap?: PageOmrMap;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<InkStroke | null>(null);
  const drawingId = useRef<number | null>(null);
  const drawingType = useRef<string>("");

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    bitmap.className = "block h-auto w-full select-none";
    bitmap.style.width = "100%";
    bitmap.style.height = "auto";
    bitmap.style.imageRendering = "auto";
    frame.replaceChildren(bitmap);
  }, [bitmap]);

  useEffect(() => {
    const canvas = inkRef.current;
    if (!canvas || !size) return;
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { desynchronized: true, alpha: true });
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      drawStroke(context, stroke, canvas.width);
    }
  }, [strokes, size]);

  const pointFromClient = useCallback((clientX: number, clientY: number) => {
    const canvas = inkRef.current;
    if (!canvas) return null;
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    return {
      x: (clientX - box.left) / box.width,
      y: (clientY - box.top) / box.height,
    };
  }, []);

  function discardStroke() {
    drawing.current = null;
    drawingId.current = null;
    drawingType.current = "";
  }

  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    noteInkPointer(event);
    if (event.pointerType === "pen" && drawingType.current === "touch") {
      discardStroke();
    }
    if (!shouldAcceptInk(event)) return;
    if (drawingId.current != null && drawingId.current !== event.pointerId) return;

    const point = pointFromClient(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingId.current = event.pointerId;
    drawingType.current = event.pointerType;

    if (tool === "erase") {
      onStrokes((current) =>
        current.filter((stroke) => stroke.page !== pageIndex || !hitsStroke(stroke, point)),
      );
      return;
    }
    if (typeof tool === "number") {
      const located =
        locateFromMap(omrMap, point) ?? locateMark(pageIndex, pageCount, point.x, point.y);
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
      width: event.pointerType === "pen" ? 0.0038 : 0.0046,
      points: [point],
    };
  }

  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    noteInkPointer(event);
    if (event.pointerType === "pen" && event.buttons === 0) return;
    if (drawingId.current !== event.pointerId) return;
    if (!shouldAcceptInk(event) && event.pointerType === "touch") {
      discardStroke();
      return;
    }

    const stroke = drawing.current;
    const canvas = inkRef.current;
    if (!stroke || !canvas) return;
    const samples =
      typeof event.nativeEvent.getCoalescedEvents === "function"
        ? event.nativeEvent.getCoalescedEvents()
        : [event.nativeEvent];
    const context = canvas.getContext("2d");
    if (!context) return;
    for (const sample of samples) {
      const point = pointFromClient(sample.clientX, sample.clientY);
      if (!point) continue;
      stroke.points.push(point);
      drawStroke(context, { ...stroke, points: stroke.points.slice(-2) }, canvas.width);
    }
  }

  function pointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    noteInkPointer(event);
    if (drawingId.current != null && drawingId.current !== event.pointerId) return;
    const stroke = drawing.current;
    discardStroke();
    if (!stroke || stroke.points.length < 1) return;
    const last = stroke.points[stroke.points.length - 1] ?? stroke.points[0];
    const focus = strokeCentroid(stroke.points);
    const boxed = hitChoiceBox(omrMap, focus) ?? (last ? hitChoiceBox(omrMap, last) : null);
    const located =
      boxed ??
      (isCheckStroke(stroke)
        ? locateFromMap(omrMap, focus) ??
          (last ? locateFromMap(omrMap, last) : null) ??
          (last ? locateMark(pageIndex, pageCount, last.x, last.y) : null)
        : null);
    const nextStroke: InkStroke = {
      ...stroke,
      question: located?.question,
      omrChoice: located?.choice,
    };
    onStrokes((current) => [...current, nextStroke]);
    if (located) onMark(located.choice, located.question);
  }

  return (
    <div
      className="relative mx-auto w-full overflow-hidden rounded-[2px] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 1200px" }}
    >
      <div ref={frameRef} />
      <canvas
        ref={inkRef}
        className={cn(
          "absolute inset-0 h-full w-full touch-none select-none",
          tool === "erase" ? "cursor-cell" : "cursor-crosshair",
        )}
        style={{ touchAction: "none", WebkitUserSelect: "none" }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onLostPointerCapture={pointerUp}
        onPointerEnter={(event) => noteInkPointer(event)}
      />
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
