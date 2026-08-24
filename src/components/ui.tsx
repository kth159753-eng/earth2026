import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-[13px] font-medium text-[#b3b3b3]">
        {label}
        {hint ? <span className="font-normal text-[#808080]">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function TextField({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-12 w-full rounded-[4px] border border-[#555] bg-[rgba(22,22,22,0.66)] px-3.5 text-base text-white outline-none transition duration-100 sm:h-10 sm:text-sm",
        "placeholder:text-[#555] focus:border-white",
        className,
      )}
    />
  );
}

export function Button({
  children,
  className,
  variant = "gold",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "gold" | "ghost" | "line" | "danger" | "dark";
}) {
  const styles = {
    gold: "bg-[#e50914] text-white hover:bg-[#c00710] active:bg-[#95050c]",
    ghost: "bg-[rgba(109,109,110,0.7)] text-white hover:bg-[rgba(109,109,110,0.4)]",
    line: "border border-white bg-transparent text-white hover:bg-white/10",
    danger: "bg-[#e50914] text-white hover:bg-[#c00710]",
    dark: "bg-white text-black hover:bg-white/75",
  } as const;

  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[4px] px-5 text-sm font-bold transition duration-100 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:min-h-10 sm:px-6",
        styles[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Notice({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "warn" | "ok";
}) {
  const toneClass =
    tone === "warn"
      ? "border-[#e50914]/40 bg-[#3d0205] text-white"
      : tone === "ok"
        ? "border-[#46d369]/30 bg-[#0d2a16] text-[#46d369]"
        : "border-[#333] bg-[#1f1f1f] text-[#b3b3b3]";
  return (
    <p className={cn("rounded-[4px] border px-4 py-3 text-sm leading-6", toneClass)}>
      {children}
    </p>
  );
}

export function SectionTitle({
  kicker,
  title,
  action,
}: {
  kicker?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker ? (
          <p className="mb-1 text-[11px] font-extrabold tracking-[0.22em] text-[#e50914]">
            {kicker}
          </p>
        ) : null}
        <h2 className="text-[20px] font-bold tracking-tight text-white sm:text-[22px]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function headerChipClass(active = false, kind: "nav" | "ghost" | "gold" = "nav") {
  return cn(
    "group relative inline-flex h-10 min-h-10 shrink-0 items-center gap-1.5 rounded-[5px] px-1.5 text-[12px] font-semibold tracking-tight",
    "active:translate-y-px sm:h-11 sm:min-h-11 sm:gap-2 sm:px-2.5 sm:text-[13px]",
    kind === "gold"
      ? "border border-[#ffd400]/40 bg-[#ffd400]/[0.08] text-[#ffd400]"
      : kind === "ghost"
        ? cn(
            "border border-white/[0.08] bg-black/35 text-[#c8c8c8]",
            "hover:border-white/16 hover:bg-white/[0.06] hover:text-white",
            active && "border-white/18 bg-white/[0.08] text-white",
          )
        : active
          ? "bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "text-[#b4b4b4] hover:bg-white/[0.05] hover:text-white",
  );
}

export function HeaderIconWell({
  active = false,
  tone = "neutral",
  children,
}: {
  active?: boolean;
  tone?: "neutral" | "gold" | "muted";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "grid h-6 w-6 shrink-0 place-items-center rounded-[5px] sm:h-7 sm:w-7",
        tone === "gold"
          ? "bg-[#ffd400] text-black shadow-[0_0_12px_rgba(255,212,0,0.28)]"
          : tone === "muted"
            ? "bg-white/[0.06] text-[#d0d0d0] group-hover:bg-white/10 group-hover:text-white"
            : active
              ? "bg-[#e50914] text-white shadow-[0_0_14px_rgba(229,9,20,0.42)]"
              : "bg-white/[0.06] text-[#d4d4d4] group-hover:bg-white/10 group-hover:text-white",
      )}
    >
      {children}
    </span>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex min-w-0 items-center", compact ? "gap-2" : "gap-2.5 sm:gap-3")}>
      <p className="shrink-0 text-[22px] font-bold tracking-[-0.07em] text-[#e50914] sm:text-[26px]">
        EARTH
      </p>
      {compact ? (
        <p className="truncate text-[11px] font-semibold text-[#b3b3b3]">2026</p>
      ) : (
        <p className="min-w-0 truncate whitespace-nowrap text-[clamp(10px,2.7vw,13px)] font-medium leading-none tracking-tight">
          <span className="font-semibold tabular-nums text-[#e8e8e8]">2026</span>
          <span className="mx-[0.42em] text-[#c4a574]" aria-hidden>
            ·
          </span>
          <span className="text-[#b8b8b8]">지구과학</span>
          <span className="mx-[0.42em] text-[#c4a574]" aria-hidden>
            ·
          </span>
          <span className="text-[#b8b8b8]">실전 모의고사</span>
        </p>
      )}
    </div>
  );
}
