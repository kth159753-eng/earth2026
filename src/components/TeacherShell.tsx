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
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between bg-gradient-to-b from-black/90 to-transparent px-[4%] py-3">
        <BrandMark compact />
        <button
          type="button"
          className="rounded-[4px] bg-[rgba(109,109,110,0.7)] px-3 py-2 text-sm font-bold"
          onClick={() => setOpen((value) => !value)}
        >
          회차
        </button>
      </div>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/85 lg:hidden"
          aria-label="닫기"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[232px] overflow-y-auto border-r border-[#1f1f1f] bg-black px-2 py-4 transition-transform duration-[250ms]",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
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

      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-20 bg-gradient-to-b from-black/88 to-transparent px-[4%] py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <nav className="flex flex-wrap gap-4 text-[13px]">
              {NAV.map((item) => {
                const active = section === item.id;
                return (
                  <Link
                    key={item.id}
                    href={hrefFor(item.id, sessionId)}
                    className={cn(
                      "transition duration-100",
                      active
                        ? "font-bold text-white"
                        : "text-[#b3b3b3] hover:text-[#e5e5e5]",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <Button variant="ghost" className="h-9 self-end md:self-auto" onClick={logout}>
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
        "block rounded-[2px] px-3 py-2 text-[13px] transition duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        active
          ? "bg-[#2f2f2f] text-white"
          : "text-[#b3b3b3] hover:z-[2] hover:scale-[1.03] hover:bg-[#1f1f1f] hover:text-white",
      )}
    >
      <span className="block font-bold tracking-tight">{session.label}</span>
      <span className="mt-0.5 block text-[11px] text-[#808080]">{session.subjectName}</span>
    </Link>
  );
}
