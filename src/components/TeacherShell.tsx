"use client";

import { ActiveClassControl } from "@/components/ClassIdentity";
import { BrandMark, Button } from "@/components/ui";
import { logoutTeacher } from "@/lib/auth";
import { EXAM_SESSIONS, groupSessionsByYear, type ExamSession } from "@/lib/exams";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const NAV = [
  { id: "exam", href: "/exam", label: "[교실] 모의고사", short: "교실" },
  { id: "solo", href: "/solo", label: "[나혼자] 기출학습", short: "나혼자" },
  { id: "papers", href: "/papers", label: "시험문제 & 정답지", short: "문제" },
  { id: "admin", href: "/admin", label: "관리자 페이지", short: "관리자" },
  { id: "vault", href: "/vault", label: "[보관소]", short: "보관소" },
] as const;

function currentSection(pathname: string) {
  if (pathname.startsWith("/solo")) return "solo";
  if (pathname.startsWith("/papers")) return "papers";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/vault")) return "vault";
  return "exam";
}

function sessionFromPath(pathname: string) {
  const match = pathname.match(/\/(exam|papers|solo)\/([^/]+)/);
  return match?.[2] ?? EXAM_SESSIONS[0].id;
}

function hrefFor(section: string, sessionId: string) {
  if (section === "admin") return `/admin/?session=${sessionId}`;
  if (section === "vault") return "/vault/";
  return `/${section}/${sessionId}/`;
}

export function TeacherShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const section = currentSection(pathname);
  const sessionId = searchParams.get("session") || sessionFromPath(pathname);
  const grouped = useMemo(() => groupSessionsByYear(), []);
  const solo = section === "solo";

  useEffect(() => {
    try {
      const raw = localStorage.getItem("earth-nav-sidebar");
      if (raw === "0") setDesktopOpen(false);
      if (raw === "1") setDesktopOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  function setDesktopSidebar(next: boolean) {
    setDesktopOpen(next);
    try {
      localStorage.setItem("earth-nav-sidebar", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  async function logout() {
    await logoutTeacher();
    router.replace("/");
  }

  return (
    <div className={cn("min-h-dvh bg-[#141414] text-white", solo && "flex h-dvh flex-col overflow-hidden")}>
      <div className="sticky top-0 z-40 flex items-center justify-between bg-gradient-to-b from-black/90 to-transparent px-[4%] py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:hidden">
        <BrandMark compact />
        <button
          type="button"
          className="min-h-11 rounded-[4px] bg-[rgba(109,109,110,0.7)] px-4 text-sm font-bold"
          onClick={() => setOpen((value) => !value)}
        >
          회차
        </button>
      </div>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/85 md:hidden"
          aria-label="닫기"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[min(280px,86vw)] overflow-y-auto border-r border-[#1f1f1f] bg-black px-2 py-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] transition-transform duration-[250ms] md:w-[240px] lg:w-[248px]",
          open ? "translate-x-0" : "-translate-x-full",
          desktopOpen ? "md:translate-x-0" : "md:-translate-x-full",
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-2 px-2">
          <BrandMark />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setDesktopSidebar(false);
            }}
            className="mt-1 hidden h-8 rounded-[4px] bg-white/10 px-2 text-[11px] font-bold text-white md:inline-flex md:items-center"
          >
            접기
          </button>
        </div>
        <div className="mb-4 rounded-[4px] bg-[#1f1f1f] px-3 py-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#808080] uppercase">
            프로필
          </p>
          <p className="mt-1 truncate text-sm font-bold text-white">{profile.full_name}</p>
        </div>
        {Object.entries(grouped).map(([year, sessions], index) => (
          <div key={year} className="mb-6">
            {index > 0 ? (
              <div className="mb-4 px-1">
                <div className="h-[2px] bg-[#c4a574]" />
                <div className="my-2.5 flex items-center gap-3">
                  <p className="text-[13px] font-bold tracking-[0.36em] text-[#c4a574]">{year}</p>
                  <span className="h-[3px] flex-1 bg-gradient-to-r from-[#c4a574] via-[#e50914]/70 to-transparent" />
                </div>
                <div className="h-px bg-white/20" />
              </div>
            ) : (
              <div className="mb-2 flex items-end justify-between px-2">
                <p className="text-[11px] font-semibold tracking-[0.28em] text-[#9a9a9a]">{year}</p>
                <span className="mb-1 ml-3 h-px flex-1 bg-gradient-to-r from-[#3a3a3a] to-transparent" />
              </div>
            )}
            <div className="space-y-1">
              {sessions.map((session) => (
                <SessionLink
                  key={session.id}
                  session={session}
                  active={session.id === sessionId}
                  href={hrefFor(section, session.id)}
                  onClick={() => setOpen(false)}
                />
              ))}
            </div>
          </div>
        ))}
      </aside>

      {desktopOpen ? null : (
        <button
          type="button"
          onClick={() => setDesktopSidebar(true)}
          className="fixed top-1/2 left-0 z-40 hidden -translate-y-1/2 rounded-r-[4px] border border-l-0 border-white/10 bg-black/90 px-2 py-8 text-[11px] font-bold tracking-[0.18em] text-white md:block"
        >
          회차
        </button>
      )}

      <div
        className={cn(
          "transition-[padding] duration-[250ms]",
          desktopOpen && "md:pl-[240px] lg:pl-[248px]",
          solo && "flex min-h-0 flex-1 flex-col overflow-hidden",
        )}
      >
        <header className="sticky top-0 z-20 shrink-0 bg-gradient-to-b from-black/88 to-transparent px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-[4%] sm:py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDesktopSidebar(!desktopOpen)}
              className="hidden h-10 shrink-0 rounded-[4px] bg-white/10 px-3 text-xs font-bold text-white md:inline-flex md:items-center"
            >
              {desktopOpen ? "회차 접기" : "회차"}
            </button>
            <nav className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5 text-[12px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2 sm:text-[13px]">
              {NAV.map((item) => {
                const active = section === item.id;
                return (
                  <Link
                    key={item.id}
                    href={hrefFor(item.id, sessionId)}
                    className={cn(
                      "shrink-0 rounded-[4px] px-2.5 py-2 transition duration-100 sm:px-4 sm:py-2.5",
                      active
                        ? "bg-white/10 font-bold text-white"
                        : "text-[#b3b3b3] hover:text-[#e5e5e5]",
                    )}
                  >
                    <span className="sm:hidden">{item.short}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <ActiveClassControl />
            <div id="earth-header-timer" className="hidden min-w-0 shrink-0 md:flex md:items-center" />
            <Button variant="ghost" className="h-10 shrink-0 px-3 sm:h-9 sm:px-5" onClick={logout}>
              로그아웃
            </Button>
          </div>
        </header>
        <div
          className={cn(
            "flex flex-col pb-[env(safe-area-inset-bottom)]",
            solo ? "min-h-0 flex-1 overflow-hidden" : "min-h-[calc(100dvh-72px)]",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

const HIGHLIGHT_MONTHS = new Set([6, 9, 11]);

function SessionLink({
  session,
  active,
  href,
  onClick,
}: {
  session: ExamSession;
  active: boolean;
  href: string;
  onClick: () => void;
}) {
  const isII = session.subject === "II";
  const official = HIGHLIGHT_MONTHS.has(session.month);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "relative block rounded-[4px] px-3 py-2.5 transition duration-150",
        active
          ? "bg-[#1c1c1c]"
          : "[@media(hover:hover)]:hover:bg-[#161616] active:bg-[#1a1a1a]",
      )}
    >
      <span
        className={cn(
          "absolute bottom-2 top-2 left-0 w-[2px] rounded-full",
          active ? "bg-[#e50914]" : official ? "bg-[#c4a574]" : "bg-transparent",
        )}
      />
      <span className="flex items-center justify-between gap-2">
        <span className={cn("text-[14px] font-semibold tracking-tight", active ? "text-white" : "text-[#ececec]")}>
          {session.month}월
        </span>
        <span className="flex items-center gap-1.5">
          {official ? (
            <span className="text-[9px] font-semibold tracking-[0.14em] text-[#c4a574]">
              평가원
            </span>
          ) : null}
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
              isII
                ? "bg-[#3a2614] text-[#e8b07a]"
                : "bg-[#132433] text-[#8ec8ea]",
            )}
          >
            {isII ? "지II" : "지I"}
          </span>
        </span>
      </span>
      <span className="mt-1 block text-[11px] text-[#8a8a8a]">{session.subjectName}</span>
    </Link>
  );
}
