"use client";

import { cn } from "@/lib/utils";

export const STUDENT_TABS = [
  { id: "omr", short: "OMR", label: "OMR 입력" },
  { id: "solo", short: "나혼자", label: "[나혼자] 기출학습" },
  { id: "report", short: "보관소", label: "보관소" },
] as const;

export type StudentTabId = (typeof STUDENT_TABS)[number]["id"];

export function StudentTabs({
  active,
  onChange,
}: {
  active: StudentTabId | null;
  onChange: (id: StudentTabId) => void;
}) {
  return (
    <nav className="sticky top-0 z-30 shrink-0 border-b border-white/8 bg-[#141414] px-2 py-1.5 pt-[max(0.4rem,env(safe-area-inset-top))] sm:px-3">
      <div className="mx-auto flex max-w-4xl gap-1">
        {STUDENT_TABS.map((item) => {
          const selected = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                "h-10 min-w-0 flex-1 rounded-[5px] px-1.5 text-[12px] font-bold sm:h-11 sm:px-3 sm:text-sm",
                selected ? "bg-[#e50914] text-white" : "bg-white/6 text-[#c8c8c8]",
              )}
            >
              <span className="sm:hidden">{item.short}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
