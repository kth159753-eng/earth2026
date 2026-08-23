import { PaperRoom } from "@/components/PaperRoom";
import { EXAM_SESSIONS, getSession } from "@/lib/exams";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return EXAM_SESSIONS.map((session) => ({ session: session.id }));
}

export default async function PapersPage({
  params,
}: {
  params: Promise<{ session: string }>;
}) {
  const { session: sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) notFound();
  return <PaperRoom session={session} />;
}
