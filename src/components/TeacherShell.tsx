"use client";

import { ActiveClassControl } from "@/components/ClassIdentity";
import { ExamWarmCache, PapersKeepAlive } from "@/components/ExamPaperCache";
import { BrandMark, HeaderIconWell, headerChipClass } from "@/components/ui";
import { logoutTeacher } from "@/lib/auth";
import { BASE_PATH, appHref } from "@/lib/config";
import { EXAM_SESSIONS, groupSessionsByYear, warmExamSession, type ExamSession } from "@/lib/exams";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";

const TEACHER_NAV = [
  { id: "exam", href: "/exam", kicker: "교실", label: "모의고사", short: "교실" },
  { id: "solo", href: "/solo", kicker: "나혼자", label: "기출학습", short: "나혼자" },
  { id: "papers", href: "/papers", kicker: "자료", label: "문제·정답", short: "문제" },
  { id: "admin", href: "/admin", kicker: "관리", label: "관리자", short: "관리자" },
] as const;

const STUDENT_NAV = [
  { id: "solo", href: "/solo", kicker: "나혼자", label: "기출학습", short: "나혼자" },
  { id: "vault", href: "/vault", kicker: "보관", label: "보관소", short: "보관소" },
  { id: "papers", href: "/papers", kicker: "자료", label: "문제·정답", short: "문제" },
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
  const [pickedSession, setPickedSession] = useState<string | null>(null);
  const student = profile.role === "student";
  const NAV = student ? STUDENT_NAV : TEACHER_NAV;
  const section = currentSection(pathname);
  const solo = section === "solo";
  const papers = section === "papers";
  const pathSession = searchParams.get("session") || sessionFromPath(pathname);
  const sessionId = papers && pickedSession ? pickedSession : pathSession;
  const grouped = useMemo(() => groupSessionsByYear(), []);
  const dockSidebar = desktopOpen;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("earth-nav-sidebar");
      if (raw === "0") setDesktopOpen(false);
      if (raw === "1") setDesktopOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setPickedSession(null);
  }, [section]);

  useEffect(() => {
    function onPop() {
      const path = window.location.pathname.replace(BASE_PATH, "") || "/";
      setPickedSession(sessionFromPath(path));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
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
    <div className={cn("min-h-dvh bg-[#141414] text-white", (solo || papers) && "flex h-dvh flex-col overflow-hidden")}>
      {papers ? null : (
        <div className="sticky top-0 z-40 flex items-center justify-between bg-[#141414] px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-[4%] lg:hidden">
          <BrandMark compact />
          <button
            type="button"
            className={headerChipClass(open, "ghost")}
            onClick={() => setOpen((value) => !value)}
          >
            <HeaderIconWell active={open}>
              <PanelIcon open={open} />
            </HeaderIconWell>
            회차
          </button>
        </div>
      )}

      {open ? (
        <button
          type="button"
          className={cn("fixed inset-0 z-30 bg-black/85", dockSidebar && "lg:hidden")}
          aria-label="닫기"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex transition-transform duration-150",
          open ? "translate-x-0" : "-translate-x-full",
          dockSidebar ? "lg:translate-x-0" : "lg:-translate-x-full",
          open && "lg:translate-x-0",
        )}
      >
        <aside className="w-[min(252px,78vw)] overflow-y-auto bg-black px-2 py-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] md:w-[220px] lg:w-[228px]">
          <div className="mb-5 flex h-10 items-center px-2">
            <BrandMark compact />
          </div>
          <div className="mb-4 rounded-[4px] bg-[#1f1f1f] px-3 py-3">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#808080] uppercase">
              {student ? "학생" : "교사"}
            </p>
            <p className="mt-1 truncate text-sm font-bold text-white">{profile.full_name}</p>
          </div>
          {Object.entries(grouped).map(([year, sessions], index) => (
            <div key={year} className="mb-3">
              {index > 0 ? (
                <div className="mb-2 px-1">
                  <div className="h-[2px] bg-[#c4a574]" />
                  <div className="my-1.5 flex items-center gap-3">
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
              <div className="space-y-0">
                {sessions.map((session) => (
                  <SessionLink
                    key={session.id}
                    session={session}
                    active={session.id === sessionId}
                    href={hrefFor(section, session.id)}
                    soft={papers}
                    onClick={() => {
                      if (papers) {
                        setPickedSession(session.id);
                        window.history.pushState(null, "", appHref(hrefFor("papers", session.id)));
                      }
                      if (window.matchMedia("(max-width: 1023px)").matches) setOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </aside>
      </div>

      <div
        className={cn(
          "transition-[padding] duration-150",
          dockSidebar && "lg:pl-[228px] xl:pl-[236px]",
          (solo || papers) && "flex min-h-0 flex-1 flex-col overflow-hidden",
        )}
      >
        <header className="sticky top-0 z-20 shrink-0 border-b border-white/[0.06] bg-[#141414] px-2 py-1.5 sm:px-3 sm:py-2 lg:px-3 lg:pt-[max(0.5rem,env(safe-area-inset-top))] xl:pr-[4%]">
          <div className="flex flex-wrap items-center gap-1.5 md:flex-nowrap md:gap-2">
            <button
              type="button"
              onClick={() => {
                if (window.matchMedia("(min-width: 1024px)").matches) setDesktopSidebar(!desktopOpen);
                else setOpen((value) => !value);
              }}
              className={cn(headerChipClass(open && !dockSidebar, "ghost"), "inline-flex")}
            >
              <HeaderIconWell active={open && !dockSidebar}>
                <PanelIcon open={dockSidebar ? desktopOpen : open} />
              </HeaderIconWell>
              <span className="md:hidden">회차</span>
              <NavCopy kicker="회차" label={desktopOpen ? "접기" : "펼치기"} />
            </button>
            {student ? null : <ActiveClassControl />}
            <button
              type="button"
              className={cn(headerChipClass(false, "ghost"), "ml-auto md:order-last md:ml-0")}
              onClick={logout}
            >
              <HeaderIconWell tone="muted">
                <LogoutIcon />
              </HeaderIconWell>
              <span className="hidden sm:inline">로그아웃</span>
            </button>
            <nav className="flex min-w-0 basis-full items-center gap-0.5 overflow-x-auto rounded-[7px] border border-white/[0.08] bg-black/40 p-0.5 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden md:basis-auto md:flex-1 md:p-1">
              {NAV.map((item) => {
                const active = section === item.id;
                return (
                  <a
                    key={item.id}
                    href={appHref(hrefFor(item.id, sessionId))}
                    className={cn(headerChipClass(active), "flex-1 justify-center md:flex-none")}
                  >
                    <HeaderIconWell active={active}>
                      <NavIcon id={item.id} />
                    </HeaderIconWell>
                    <span className="md:hidden">{item.short}</span>
                    <NavCopy active={active} kicker={item.kicker} label={item.label} />
                    {active ? (
                      <span className="absolute top-1.5 bottom-1.5 left-0.5 w-[2px] rounded-full bg-[#e50914] md:top-2 md:bottom-2" />
                    ) : null}
                  </a>
                );
              })}
            </nav>
            <div id="earth-header-timer" className="hidden min-w-0 shrink-0 lg:flex lg:items-center lg:justify-end" />
          </div>
        </header>
        <div
          className={cn(
            "flex flex-col pb-[env(safe-area-inset-bottom)]",
            solo || papers ? "min-h-0 flex-1 overflow-hidden" : "min-h-[calc(100dvh-72px)]",
          )}
        >
          {papers ? <PapersKeepAlive sessionId={sessionId} /> : children}
          {solo ? <ExamWarmCache sessionId={sessionId} /> : null}
        </div>
      </div>
    </div>
  );
}

const HIGHLIGHT_MONTHS = new Set([6, 9, 11]);

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 fill-none stroke-current"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function NavCopy({
  kicker,
  label,
  active = false,
}: {
  kicker: string;
  label: string;
  active?: boolean;
}) {
  return (
    <span className="hidden leading-none md:flex md:flex-col">
      <span
        className={cn(
          "text-[8px] font-extrabold tracking-[0.18em]",
          active ? "text-[#e50914]" : "text-[#7d7d7d] group-hover:text-[#a8a8a8]",
        )}
      >
        {kicker}
      </span>
      <span className="mt-0.5 text-[13px] font-bold">{label}</span>
    </span>
  );
}

function PanelIcon({ open }: { open: boolean }) {
  return (
    <Icon>
      <rect x="4.2" y="5" width="15.6" height="14" rx="2.2" />
      <path d={open ? "M10 5v14" : "M14 5v14"} />
      <path d={open ? "M12.4 9h5M12.4 12h5M12.4 15h3.4" : "M6.4 9h5M6.4 12h5M6.4 15h3.4"} />
    </Icon>
  );
}

function NavIcon({ id }: { id: string }) {
  if (id === "exam") {
    return (
      <Icon>
        <circle cx="12" cy="12" r="7.4" />
        <path d="M12 7.6V12l3.1 1.8" />
        <path d="M12 4.2v1.3M19.8 12h-1.3" />
      </Icon>
    );
  }
  if (id === "solo") {
    return (
      <Icon>
        <circle cx="12" cy="8.4" r="2.7" />
        <path d="M6.6 18.2c.7-3.1 2.8-4.7 5.4-4.7s4.7 1.6 5.4 4.7" />
        <path d="M17.6 7.2c.8.8 1.2 1.8 1.2 3" />
      </Icon>
    );
  }
  if (id === "papers") {
    return (
      <Icon>
        <path d="M7.2 7.2h8.2v12H7.2z" />
        <path d="M9.4 4.8h8.2v12" />
        <path d="M9.4 11h3.8M9.4 13.8h4.6" />
      </Icon>
    );
  }
  if (id === "admin") {
    return (
      <Icon>
        <path d="M5 8.2h14M5 15.8h14" />
        <circle cx="9.2" cy="8.2" r="1.7" fill="currentColor" />
        <circle cx="14.8" cy="15.8" r="1.7" fill="currentColor" />
      </Icon>
    );
  }
  return (
    <Icon>
      <path d="M5 8.4h14l-1.1 10.4H6.1z" />
      <path d="M4.4 8.4h15.2V6.2H4.4z" />
      <path d="M10 13h4" />
    </Icon>
  );
}

function LogoutIcon() {
  return (
    <Icon>
      <path d="M10 7.1V6.3A1.5 1.5 0 0 1 11.5 4.8h6.1A1.5 1.5 0 0 1 19.1 6.3v11.4a1.5 1.5 0 0 1-1.5 1.5h-6.1A1.5 1.5 0 0 1 10 17.7v-.8" />
      <path d="M4.6 12H14M11.2 9.1 14.1 12l-2.9 2.9" />
    </Icon>
  );
}

function SessionLink({
  session,
  active,
  href,
  soft = false,
  onClick,
}: {
  session: ExamSession;
  active: boolean;
  href: string;
  soft?: boolean;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const isII = session.subject === "II";
  const official = HIGHLIGHT_MONTHS.has(session.month);

  return (
    <a
      href={appHref(href)}
      onClick={(event) => {
        if (soft && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          event.preventDefault();
        }
        onClick(event);
      }}
      onPointerEnter={() => warmExamSession(session)}
      onFocus={() => warmExamSession(session)}
      className={cn(
        "relative block cursor-pointer rounded-[4px] px-3 py-1.5 transition duration-150",
        active
          ? "bg-[#1c1c1c]"
          : "[@media(hover:hover)]:hover:bg-[#161616] active:bg-[#1a1a1a]",
      )}
    >
      <span
        className={cn(
          "absolute bottom-1.5 top-1.5 left-0 w-[2px] rounded-full",
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
      <span className="mt-0.5 block text-[11px] leading-tight text-[#8a8a8a]">{session.subjectName}</span>
    </a>
  );
}
