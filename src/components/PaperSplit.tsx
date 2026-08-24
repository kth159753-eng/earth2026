"use client";

import { saveExamAsset } from "@/lib/actions/teacher";
import { examViewerUrls, nearbyExamSessions, warmExamSession, type ExamSession } from "@/lib/exams";
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
    warmExamSession(session);
    for (const item of nearbyExamSessions(session)) warmExamSession(item);
  }, [files.paper, files.solution, session]);
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
    <div className="flex h-full min-h-0 flex-1 flex-col px-2 py-2 sm:px-3">
      {error ? <div className="mb-2"><Notice tone="warn">{error}</Notice></div> : null}
      {message ? <div className="mb-2"><Notice tone="ok">{message}</Notice></div> : null}
      <div className="mb-2 grid grid-cols-2 gap-1.5 lg:hidden">
        {(["paper", "solution"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setPane(id)}
            className={cn(
              "h-9 rounded-[4px] text-[13px] font-bold",
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
        <div className={cn("min-h-0", pane === "solution" ? "block" : "hidden lg:block")}>
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
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[4px] border border-[#333] bg-[#1f1f1f]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/8 px-3 py-1.5">
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
      <div className="min-h-0 flex-1 bg-[#0a0d12]">
        {src && visible ? (
          isImageSrc(src) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={title} loading="lazy" decoding="async" className="mx-auto h-full w-full object-contain" />
          ) : (
            <iframe
              title={title}
              src={src}
              className="h-full w-full border-0 bg-white"
              allow="autoplay"
              allowFullScreen
            />
          )
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
