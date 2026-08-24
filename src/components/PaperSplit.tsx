"use client";

import { saveExamAsset } from "@/lib/actions/teacher";
import { driveExamUrls, type ExamSession } from "@/lib/exams";
import { createClient } from "@/lib/supabase/client";
import { Notice } from "@/components/ui";
import { useEffect, useMemo, useState } from "react";

type Props = {
  session: ExamSession;
  paperUrl: string | null;
  solutionUrl: string | null;
};

export function PaperSplit({ session, paperUrl, solutionUrl }: Props) {
  const drive = useMemo(() => driveExamUrls(session), [session]);
  const [paper, setPaper] = useState(paperUrl);
  const [solution, setSolution] = useState(solutionUrl);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setPaper(paperUrl);
    setSolution(solutionUrl);
  }, [paperUrl, solutionUrl, session.id]);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[40px] font-bold leading-none tracking-[-0.03em]">
            {session.label}
          </h1>
          <p className="mt-2 text-base text-[#d0d0d0]">{session.subjectName}</p>
        </div>
      </div>
      {error ? <div className="mb-4"><Notice tone="warn">{error}</Notice></div> : null}
      {message ? <div className="mb-4"><Notice tone="ok">{message}</Notice></div> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <PaperPane
          title="시험지"
          url={paper}
          driveUrl={drive.paper}
          openUrl={drive.paperOpen}
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
        <PaperPane
          title="해설지"
          url={solution}
          driveUrl={drive.solution}
          openUrl={drive.solutionOpen}
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
  );
}

function isImageSrc(src: string) {
  return /\.(png|jpe?g|webp|gif)(\?|$)/i.test(src);
}

function PaperPane({
  title,
  url,
  driveUrl,
  openUrl,
  onUploaded,
}: {
  title: string;
  url: string | null;
  driveUrl: string | null;
  openUrl: string | null;
  onUploaded: (path: string, url: string) => Promise<void>;
}) {
  const src = url ?? driveUrl;
  const href = url ?? openUrl ?? driveUrl;
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
        </div>
      </div>
      <div className="min-h-[68vh] bg-[#0a0d12]">
        {src ? (
          isImageSrc(src) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={title} className="mx-auto max-h-[78vh] w-full object-contain" />
          ) : (
            <iframe
              title={title}
              src={src}
              className="h-[78vh] w-full border-0 bg-white"
              allow="autoplay"
              allowFullScreen
            />
          )
        ) : (
          <div className="grid min-h-[68vh] place-items-center px-6 text-center">
            <p className="text-sm text-stone-400">이 회차 파일이 아직 없습니다.</p>
          </div>
        )}
      </div>
    </section>
  );
}
