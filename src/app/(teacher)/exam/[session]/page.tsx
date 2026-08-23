import { ExamHall } from "@/components/ExamHall";
import { getClassConfigs } from "@/lib/data";
import { getSession } from "@/lib/exams";
import { notFound } from "next/navigation";

export default async function ExamPage({
  params,
}: {
  params: Promise<{ session: string }>;
}) {
  const { session: sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) notFound();
  const classes = await getClassConfigs();
  return <ExamHall session={session} classes={classes} />;
}
