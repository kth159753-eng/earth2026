"use client";

import { DEFAULT_SESSION_ID } from "@/lib/exams";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ExamIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/exam/${DEFAULT_SESSION_ID}/`);
  }, [router]);
  return <div className="min-h-dvh bg-void" />;
}
