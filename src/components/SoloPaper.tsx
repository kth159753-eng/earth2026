"use client";

import { BASE_PATH } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

export type InkStroke = {
  id: string;
  page: number;
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
  mark?: number;
};

export type SoloTool = "pen" | "erase" | 1 | 2 | 3 | 4 | 5;

type Props = {
  src: string;
  tool: SoloTool;
  color: string;
  strokes: InkStroke[];
  onStrokes: (next: InkStroke[] | ((current: InkStroke[]) => InkStroke[])) => void;
  onMark: (choice: number) => void;
};

type PageSize = { width: number; height: number };

export function SoloPaper({ src, tool, color, strokes, onStrokes, onMark }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    async function render() {
      setError("");
      const width = host.clientWidth || 800;
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `${BASE_PATH}/pdf.worker.min.mjs`;
        const document = await pdfjs.getDocument({ url: src, disableAutoFetch: false }).promise;
        const nextPages: HTMLCanvasElement[] = [];
        const nextSizes: PageSize[] = [];
        for (let index = 1; index <= document.numPages; index += 1) {
          const page = await document.getPage(index);
          const unscaled = page.getViewport({ scale: 1 });
          const scale = width / unscaled.width;
          const viewport = page.getViewport({ scale });
          const canvas = window.document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) continue;
          await page.render({ canvasContext: context, viewport }).promise;
          nextPages.push(canvas);
          nextSizes.push({ width: canvas.width, height: canvas.height });
        }
        if (!cancelled) {
          setPages(nextPages);
          setSizes(nextSizes);
        }
      } catch {
        if (!cancelled) setError("시험지를 불러오지 못했습니다.");
      }
    }

    const frame = window.requestAnimationFrame(() => {
      void render();
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [src]);

  return (
    <div ref={hostRef} className="mx-auto w-full max-w-[1100px] space-y-4">
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
          strokes={strokes.filter((stroke) => stroke.page === index)}
          onStrokes={onStrokes}
          onMark={onMark}
        />
      ))}
    </div>
  );
}

function PaperPage({
  pageIndex,
  bitmap,
  size,
  tool,
  color,
  strokes,
  onStrokes,
  onMark,
}: {
  pageIndex: number;
  bitmap: HTMLCanvasElement;
  size?: PageSize;
  tool: SoloTool;
  color: string;
  strokes: InkStroke[];
  onStrokes: (next: InkStroke[] | ((current: InkStroke[]) => InkStroke[])) => void;
  onMark: (choice: number) => void;
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
      const mark: InkStroke = {
        id: `${Date.now()}-${Math.random()}`,
        page: pageIndex,
        color,
        width: 0.018,
        points: [point],
        mark: tool,
      };
      onStrokes((current) => [...current, mark]);
      onMark(tool);
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
    if (!stroke || stroke.points.length < 2) return;
    onStrokes((current) => [...current, stroke]);
  }

  return (
    <div className="relative overflow-hidden rounded-[2px] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
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
}

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
