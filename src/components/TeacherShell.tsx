"use client";

import { BrandMark, Button } from "@/components/ui";
import { logoutTeacher } from "@/lib/auth";
import { EXAM_SESSIONS, groupSessionsByYear, type ExamSession } from "@/lib/exams";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

const NAV = [
  { id: "exam", href: "/exam", label: "실전 모의고사" },
  { id: "papers", href: "/papers", label: "시험문제 & 정답지" },
  { id: "admin", href: "/admin", label: "관리자 페이지" },
] as const;

function currentSection(pathname: string) {
  if (pathname.startsWith("/papers")) return "papers";
  if (pathname.startsWith("/admin")) return "admin";
  return "exam";
}

function sessionFromPath(pathname: string) {
  const match = pathname.match(/\/(exam|papers)\/([^/]+)/);
  return match?.[2] ?? EXAM_SESSIONS[0].id;
}

function hrefFor(section: string, sessionId: string) {
  if (section === "admin") return `/admin/?session=${sessionId}`;
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
  const section = currentSection(pathname);
  const sessionId = searchParams.get("session") || sessionFromPath(pathname);
  const grouped = useMemo(() => groupSessionsByYear(), []);

  async function logout() {
    await logoutTeacher();
    router.replace("/");
  }

  return (
    <div className="min-h-dvh bg-[#141414] text-white">
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
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="mb-5 px-2">
          <BrandMark />
        </div>
        <div className="mb-4 rounded-[4px] bg-[#1f1f1f] px-3 py-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#808080] uppercase">
            프로필
          </p>
          <p className="mt-1 truncate text-sm font-bold text-white">{profile.full_name}</p>
        </div>
        {Object.entries(grouped).map(([year, sessions]) => (
          <div key={year} className="mb-4">
            <p className="px-2 pb-2 text-[12px] font-extrabold text-white">{year}</p>
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

      <div className="md:pl-[240px] lg:pl-[248px]">
        <header className="sticky top-0 z-20 bg-gradient-to-b from-black/88 to-transparent px-[4%] py-3 sm:py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 text-[13px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2">
              {NAV.map((item) => {
                const active = section === item.id;
                return (
                  <Link
                    key={item.id}
                    href={hrefFor(item.id, sessionId)}
                    className={cn(
                      "shrink-0 rounded-[4px] px-3 py-2.5 transition duration-100 sm:px-4",
                      active
                        ? "bg-white/10 font-bold text-white"
                        : "text-[#b3b3b3] hover:text-[#e5e5e5]",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <Button variant="ghost" className="h-11 w-full sm:h-9 sm:w-auto sm:self-end lg:self-auto" onClick={logout}>
              로그아웃
            </Button>
          </div>
        </header>
        <div className="min-h-[calc(100dvh-72px)] pb-[env(safe-area-inset-bottom)]">{children}</div>
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
  const highlighted = HIGHLIGHT_MONTHS.has(session.month);
  const subjectColor = isII ? "text-[#ffb56a]" : "text-[#6ecbff]";

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "block rounded-[4px] px-3 py-2.5 text-[13px] transition duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        active
          ? "bg-[#2f2f2f]"
          : "[@media(hover:hover)]:hover:z-[2] [@media(hover:hover)]:hover:scale-[1.02] [@media(hover:hover)]:hover:bg-[#1f1f1f] active:bg-[#2a2a2a]",
        highlighted && !active && "bg-[#f6ff4d]/10",
      )}
    >
      <span className="flex flex-wrap items-center gap-x-0.5 font-bold tracking-tight">
        <span className={active ? "text-white" : "text-[#d4d4d4]"}>{session.year}_</span>
        <span
          className={cn(
            highlighted
              ? "rounded-[2px] bg-[#f6ff4d] px-1 text-[#141414] shadow-[inset_0_-1px_0_rgba(0,0,0,0.18)]"
              : active
                ? "text-white"
                : "text-[#d4d4d4]",
          )}
        >
          {session.month}월
        </span>
        <span className={active ? "text-white" : "text-[#8a8a8a]"}>_</span>
        <span className={subjectColor}>{isII ? "지II" : "지I"}</span>
      </span>
      <span className={cn("mt-0.5 block text-[11px] font-medium", subjectColor, "opacity-80")}>
        {session.subjectName}
      </span>
    </Link>
  );
}
