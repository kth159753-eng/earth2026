"use client";

import { saveExamAsset } from "@/lib/actions/teacher";
import { publicExamPaths, type ExamSession } from "@/lib/exams";
import { createClient } from "@/lib/supabase/client";
import { Button, Notice } from "@/components/ui";
import { useEffect, useMemo, useState } from "react";

type Props = {
  session: ExamSession;
  paperUrl: string | null;
  solutionUrl: string | null;
};

export function PaperSplit({ session, paperUrl, solutionUrl }: Props) {
  const fallback = useMemo(() => publicExamPaths(session), [session]);
  const [paper, setPaper] = useState(paperUrl);
  const [solution, setSolution] = useState(solutionUrl);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.22em] text-gold/70">PREVIEW</p>
          <h1 className="text-2xl font-semibold tracking-tight">{session.label}</h1>
          <p className="text-sm text-stone-400">
            왼쪽은 시험지, 오른쪽은 해설지입니다. PDF 또는 이미지를 올리면 바로 보입니다.
          </p>
        </div>
      </div>
      {error ? <div className="mb-4"><Notice tone="warn">{error}</Notice></div> : null}
      {message ? <div className="mb-4"><Notice tone="ok">{message}</Notice></div> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <PaperPane
          title="시험지"
          url={paper}
          fallback={fallback.paper}
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
          fallback={fallback.solution}
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

function PaperPane({
  title,
  url,
  fallback,
  onUploaded,
}: {
  title: string;
  url: string | null;
  fallback: string;
  onUploaded: (path: string, url: string) => Promise<void>;
}) {
  const [src, setSrc] = useState(url ?? fallback);
  const [empty, setEmpty] = useState(!url);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (url) {
      setSrc(url);
      setEmpty(false);
      return;
    }
    let cancelled = false;
    fetch(fallback, { method: "HEAD" })
      .then((response) => {
        if (!cancelled && response.ok) {
          setSrc(fallback);
          setEmpty(false);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [url, fallback]);

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
      setSrc(data.signedUrl);
      setEmpty(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#10141b]">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
        <div className="flex items-center gap-2">
          {!empty ? (
            <a
              href={src}
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
        {empty ? (
          <div className="grid min-h-[68vh] place-items-center px-6 text-center">
            <div>
              <p className="text-lg text-stone-200">{title} 미리보기</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-stone-500">
                첨부하신 파일을 여기에 올려 주세요. 또는{" "}
                <code className="text-gold-bright">public/exams/{decodeURIComponent(fallback.split("/")[2] || "")}/</code>
                폴더에 paper.pdf / solution.pdf를 넣으면 자동으로 보입니다.
              </p>
              <div className="mt-5">
                <Button
                  variant="line"
                  className="h-10"
                  onClick={() => {
                    const probe = new Image();
                    probe.onload = () => {
                      setSrc(fallback.replace(".pdf", ".png"));
                      setEmpty(false);
                    };
                    probe.onerror = () => {
                      fetch(fallback, { method: "HEAD" })
                        .then((response) => {
                          if (response.ok) {
                            setSrc(fallback);
                            setEmpty(false);
                          }
                        })
                        .catch(() => undefined);
                    };
                    probe.src = fallback.replace(".pdf", ".png");
                  }}
                >
                  저장된 파일 확인
                </Button>
              </div>
            </div>
          </div>
        ) : src.toLowerCase().includes(".pdf") || src.includes("application/pdf") ? (
          <iframe title={title} src={src} className="h-[78vh] w-full border-0 bg-white" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={title} className="mx-auto max-h-[78vh] w-full object-contain" />
        )}
      </div>
    </section>
  );
}
