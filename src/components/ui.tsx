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
    <label className="block space-y-2">
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

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", compact && "gap-2")}>
      <p className="text-[22px] font-black tracking-[-0.07em] text-[#e50914] sm:text-[26px]">
        EARTH
      </p>
      <div className={cn("leading-tight", compact && "hidden sm:block")}>
        <p className="text-[11px] font-semibold text-[#b3b3b3]">2026</p>
        <p className="text-[11px] text-[#808080]">지구과학</p>
        <p className="text-[11px] text-[#808080]">실전 모의고사</p>
      </div>
    </div>
  );
}
