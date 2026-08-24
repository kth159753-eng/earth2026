"use client";

import { AdminHost } from "@/components/AdminHost";
import { DEFAULT_SESSION_ID } from "@/lib/exams";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AdminInner() {
  const searchParams = useSearchParams();
  return <AdminHost sessionId={searchParams.get("session") ?? DEFAULT_SESSION_ID} />;
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh]" />}>
      <AdminInner />
    </Suspense>
  );
}
