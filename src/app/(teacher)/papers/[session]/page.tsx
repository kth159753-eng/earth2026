import { PaperSplit } from "@/components/PaperSplit";
import { getExamAssets, getSignedAssetUrl } from "@/lib/data";
import { getSession } from "@/lib/exams";
import { notFound } from "next/navigation";

export default async function PapersPage({
  params,
}: {
  params: Promise<{ session: string }>;
}) {
  const { session: sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) notFound();

  const assets = await getExamAssets(sessionId);
  const [paperUrl, solutionUrl] = await Promise.all([
    getSignedAssetUrl(assets?.paper_path ?? null),
    getSignedAssetUrl(assets?.solution_path ?? null),
  ]);

  return (
    <PaperSplit session={session} paperUrl={paperUrl} solutionUrl={solutionUrl} />
  );
}
