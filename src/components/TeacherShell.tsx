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
    <div className="min-h-dvh bg-void text-stone-100">
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-void/90 px-3 py-3 backdrop-blur">
        <BrandMark compact />
        <button
          type="button"
          className="rounded-lg border border-white/15 px-3 py-2 text-sm"
          onClick={() => setOpen((value) => !value)}
        >
          회차
        </button>
      </div>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          aria-label="닫기"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[240px] overflow-y-auto border-r border-white/8 bg-[#0b0e13] px-3 py-5 transition-transform",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="mb-6 px-2">
          <BrandMark />
        </div>
        <div className="mb-5 rounded-2xl border border-white/8 bg-white/3 px-3 py-3">
          <p className="text-[11px] tracking-wider text-stone-500">교사</p>
          <p className="mt-1 truncate text-sm font-medium text-stone-100">
            {profile.full_name}
          </p>
          <p className="truncate text-xs text-stone-500">{profile.username}</p>
        </div>
        {Object.entries(grouped).map(([year, sessions]) => (
          <div key={year} className="mb-5">
            <p className="px-2 pb-2 text-[11px] font-semibold tracking-[0.18em] text-gold/70">
              {year}
            </p>
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

      <div className="lg:pl-[240px]">
        <header className="sticky top-0 z-20 border-b border-white/8 bg-void/80 px-3 py-3 backdrop-blur sm:px-5 lg:top-0">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <nav className="grid grid-cols-3 gap-2 md:flex">
              {NAV.map((item) => {
                const active = section === item.id;
                return (
                  <Link
                    key={item.id}
                    href={hrefFor(item.id, sessionId)}
                    className={cn(
                      "rounded-full px-3 py-2 text-center text-[13px] font-medium transition sm:px-4",
                      active
                        ? "bg-gold text-ink"
                        : "bg-white/5 text-stone-300 hover:bg-white/10",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <Button variant="ghost" className="h-10 self-end md:self-auto" onClick={logout}>
              로그아웃
            </Button>
          </div>
        </header>
        <div className="min-h-[calc(100dvh-72px)]">{children}</div>
      </div>
    </div>
  );
}

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
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "block rounded-xl px-3 py-2.5 text-[13px] transition",
        active
          ? "bg-gold/15 text-gold-bright ring-1 ring-gold/30"
          : "text-stone-400 hover:bg-white/5 hover:text-stone-200",
      )}
    >
      <span className="block font-medium tracking-tight">{session.label}</span>
      <span className="mt-0.5 block text-[11px] text-stone-500">
        {session.subjectName}
      </span>
    </Link>
  );
}
