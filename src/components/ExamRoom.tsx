"use client";

import { ExamHall } from "@/components/ExamHall";
import { getClassConfigs } from "@/lib/data";
import type { ExamSession } from "@/lib/exams";
import type { ClassConfig } from "@/lib/types";
import { useEffect, useState } from "react";

export function ExamRoom({ session }: { session: ExamSession }) {
  const [classes, setClasses] = useState<ClassConfig[]>([]);

  useEffect(() => {
    getClassConfigs().then(setClasses).catch(() => setClasses([]));
  }, []);

  return <ExamHall session={session} classes={classes} />;
}
