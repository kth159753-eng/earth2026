import { SoloStudy } from "@/components/SoloStudy";
import { EXAM_SESSIONS, getSession } from "@/lib/exams";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return EXAM_SESSIONS.map((session) => ({ session: session.id }));
}

export default async function SoloPage({
  params,
}: {
  params: Promise<{ session: string }>;
}) {
  const { session: sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) notFound();
  return <SoloStudy session={session} />;
}
