"use client";

import { SetupNeeded } from "@/components/SetupNeeded";
import { TeacherShell } from "@/components/TeacherShell";
import { isSupabaseConfigured } from "@/lib/config";
import { getProfile, peekTeacherProfile } from "@/lib/data";
import { ProfileProvider } from "@/lib/profile-context";
import type { Profile } from "@/lib/types";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

export function TeacherGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setReady(true);
      return;
    }

    let cancelled = false;
    peekTeacherProfile()
      .then((next) => {
        if (cancelled) return;
        if (!next) {
          router.replace("/");
          return;
        }
        setProfile(next);
        setReady(true);
        void getProfile().then((full) => {
          if (!cancelled && full) setProfile(full);
        });
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

  useEffect(() => {
    if (!profile || profile.role !== "student") return;
    if (pathname.startsWith("/exam") || pathname.startsWith("/admin")) {
      router.replace("/solo/");
    }
  }, [pathname, profile, router]);

  if (!isSupabaseConfigured()) {
    return <SetupNeeded />;
  }

  if (!ready || !profile) {
    return <div className="min-h-dvh bg-void" />;
  }

  if (profile.role === "student" && (pathname.startsWith("/exam") || pathname.startsWith("/admin"))) {
    return <div className="min-h-dvh bg-void" />;
  }

  return (
    <Suspense fallback={<div className="min-h-dvh bg-void" />}>
      <ProfileProvider profile={profile}>
        <TeacherShell profile={profile}>{children}</TeacherShell>
      </ProfileProvider>
    </Suspense>
  );
}
