"use client";

import { SetupNeeded } from "@/components/SetupNeeded";
import { TeacherShell } from "@/components/TeacherShell";
import { isSupabaseConfigured } from "@/lib/config";
import { getProfile } from "@/lib/data";
import type { Profile } from "@/lib/types";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

export function TeacherGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setReady(true);
      return;
    }

    let cancelled = false;
    getProfile()
      .then((next) => {
        if (cancelled) return;
        if (!next) {
          router.replace("/");
          return;
        }
        setProfile(next);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setReady(true);
          router.replace("/");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!isSupabaseConfigured()) {
    return <SetupNeeded />;
  }

  if (!ready || !profile) {
    return <div className="min-h-dvh bg-void" />;
  }

  return (
    <Suspense fallback={<div className="min-h-dvh bg-void" />}>
      <TeacherShell profile={profile}>{children}</TeacherShell>
    </Suspense>
  );
}
