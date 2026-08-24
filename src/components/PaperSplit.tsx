"use client";

import { saveExamAsset } from "@/lib/actions/teacher";
import { examViewerUrls, type ExamSession } from "@/lib/exams";
import { useProfile } from "@/lib/profile-context";
import { createClient } from "@/lib/supabase/client";
import { Notice } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

type Props = {
  session: ExamSession;
  paperUrl: string | null;
  solutionUrl: string | null;
};

export function PaperSplit({ session, paperUrl, solutionUrl }: Props) {
  const profile = useProfile();
  const readOnly = profile?.role === "student";
  const files = useMemo(() => examViewerUrls(session), [session]);

  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    const hrefs = [files.paper, files.solution].filter(Boolean) as string[];
    const nodes = hrefs.map((href) => {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = href;
      document.head.appendChild(link);
      return link;
    });
    return () => {
      nodes.forEach((node) => node.remove());
    };
  }, [files.paper, files.solution]);
  const [paper, setPaper] = useState(paperUrl);
  const [solution, setSolution] = useState(solutionUrl);
  const [pane, setPane] = useState<"paper" | "solution">("paper");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setPaper(paperUrl);
    setSolution(solutionUrl);
  }, [paperUrl, solutionUrl, session.id]);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5 sm:py-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] sm:text-[36px] lg:text-[40px]">
            {session.label}
          </h1>
          <p className="mt-2 text-sm text-[#d0d0d0] sm:text-base">{session.subjectName}</p>
        </div>
      </div>
      {error ? <div className="mb-4"><Notice tone="warn">{error}</Notice></div> : null}
      {message ? <div className="mb-4"><Notice tone="ok">{message}</Notice></div> : null}
      <div className="mb-3 grid grid-cols-2 gap-2 lg:hidden">
        {(["paper", "solution"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setPane(id)}
            className={cn(
              "h-11 rounded-[4px] text-sm font-bold",
              pane === id ? "bg-[#e50914] text-white" : "bg-white/8 text-[#b3b3b3]",
            )}
          >
            {id === "paper" ? "시험지" : "해설지"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(pane === "paper" ? "block" : "hidden lg:block")}>
        <PaperPane
          title="시험지"
          readOnly={readOnly}
          active={pane === "paper"}
          url={paper}
          fileUrl={files.paper}
          openUrl={files.paperOpen}
          onUploaded={async (path, url) => {
            setError("");
            try {
              await saveExamAsset(session.id, "paper", path);
              setPaper(url);
              setMessage("시험지를 저장했습니다.");
            } catch {
              setError("시험지 저장에 실패했습니다.");
            }
          }}
        />
        </div>
        <div className={cn(pane === "solution" ? "block" : "hidden lg:block")}>
        <PaperPane
          title="해설지"
          readOnly={readOnly}
          active={pane === "solution"}
          url={solution}
          fileUrl={files.solution}
          openUrl={files.solutionOpen}
          onUploaded={async (path, url) => {
            setError("");
            try {
              await saveExamAsset(session.id, "solution", path);
              setSolution(url);
              setMessage("해설지를 저장했습니다.");
            } catch {
              setError("해설지 저장에 실패했습니다.");
            }
          }}
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
  readOnly = false,
  active,
  url,
  fileUrl,
  openUrl,
  onUploaded,
}: {
  title: string;
  readOnly?: boolean;
  active: boolean;
  url: string | null;
  fileUrl: string | null;
  openUrl: string | null;
  onUploaded: (path: string, url: string) => Promise<void>;
}) {
  const wide = useWideScreen();
  const visible = active || wide;
  const src = url ?? fileUrl;
  const href = url ?? openUrl ?? fileUrl;
  const [pending, setPending] = useState(false);

  async function upload(file: File) {
    setPending(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("auth");
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const kind = title === "시험지" ? "paper" : "solution";
      const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("exam-files").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = await supabase.storage.from("exam-files").createSignedUrl(path, 60 * 30);
      if (!data?.signedUrl) throw new Error("signed");
      await onUploaded(path, data.signedUrl);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[4px] border border-[#333] bg-[#1f1f1f]">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
        <div className="flex items-center gap-2">
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
          {readOnly ? null : (
            <label className="cursor-pointer">
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
              <span className="inline-flex h-8 items-center rounded-lg bg-white/8 px-3 text-xs">
                {pending ? "올리는 중..." : "파일 올리기"}
              </span>
            </label>
          )}
        </div>
      </div>
      <div className="min-h-[52dvh] bg-[#0a0d12] md:min-h-[62dvh] lg:min-h-[68vh]">
        {src && visible ? (
          isImageSrc(src) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={title} loading="lazy" decoding="async" className="mx-auto max-h-[58dvh] w-full object-contain md:max-h-[70dvh] lg:max-h-[78vh]" />
          ) : (
            <iframe
              title={title}
              src={src}
              loading="lazy"
              className="h-[58dvh] w-full border-0 bg-white md:h-[70dvh] lg:h-[78vh]"
              allowFullScreen
            />
          )
        ) : src && !visible ? (
          <div className="min-h-[52dvh] md:min-h-[62dvh] lg:min-h-[68vh]" />
        ) : (
          <div className="grid min-h-[52dvh] place-items-center px-6 text-center md:min-h-[62dvh] lg:min-h-[68vh]">
            <p className="text-sm text-stone-400">이 회차 파일이 아직 없습니다.</p>
          </div>
        )}
      </div>
    </section>
  );
}
