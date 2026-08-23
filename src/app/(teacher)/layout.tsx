import { SetupNeeded } from "@/components/SetupNeeded";
import { TeacherShell } from "@/components/TeacherShell";
import { getProfile } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/utils";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return <SetupNeeded />;
  }

  const profile = await getProfile();
  if (!profile) {
    redirect("/");
  }

  return (
    <Suspense fallback={<div className="min-h-dvh bg-void" />}>
      <TeacherShell profile={profile}>{children}</TeacherShell>
    </Suspense>
  );
}
