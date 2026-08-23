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
      <span className="flex items-center justify-between text-[13px] font-medium tracking-wide text-stone-300">
        {label}
        {hint ? <span className="font-normal text-stone-500">{hint}</span> : null}
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
        "h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-[15px] text-stone-100 outline-none transition",
        "placeholder:text-stone-600 focus:border-gold/50 focus:bg-black/50",
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
    gold: "bg-gold text-ink hover:bg-gold-bright",
    ghost: "bg-white/5 text-stone-200 hover:bg-white/10",
    line: "border border-white/15 bg-transparent text-stone-200 hover:border-gold/40 hover:text-gold-bright",
    danger: "bg-rose-900/70 text-rose-50 hover:bg-rose-800",
    dark: "bg-black/50 text-gold-bright hover:bg-black/70",
  } as const;

  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50",
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
      ? "border-rose-400/20 bg-rose-950/40 text-rose-100"
      : tone === "ok"
        ? "border-teal/25 bg-teal/10 text-teal"
        : "border-white/10 bg-white/5 text-stone-400";
  return (
    <p className={cn("rounded-xl border px-4 py-3 text-sm leading-6", toneClass)}>
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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker ? (
          <p className="mb-1 text-[11px] font-semibold tracking-[0.22em] text-gold/80 uppercase">
            {kicker}
          </p>
        ) : null}
        <h2 className="text-xl font-semibold tracking-tight text-stone-100">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", compact && "gap-2")}>
      <span className="relative grid h-10 w-10 place-items-center rounded-full border border-gold/35 bg-black/40">
        <span className="h-5 w-5 rounded-full bg-gradient-to-br from-gold-bright via-teal to-sky-900 shadow-[0_0_16px_rgba(212,175,120,0.35)]" />
        <span className="absolute inset-1 rounded-full border border-gold/20" />
      </span>
      <div className={cn(compact && "hidden sm:block")}>
        <p className="font-display text-[13px] tracking-[0.28em] text-gold-bright">
          EARTH 2026
        </p>
        <p className="text-[11px] text-stone-500">지구과학 실전 모의고사</p>
      </div>
    </div>
  );
}
