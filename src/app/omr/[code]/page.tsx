import { OmrForm } from "@/components/OmrForm";
import { createClient } from "@/lib/supabase/server";
import type { OmrMeta } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/utils";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OmrPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!isSupabaseConfigured() || !code) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_omr_meta", { p_code: code });
  const meta = data as OmrMeta | null;
  if (error || !meta?.session_id) notFound();

  return <OmrForm code={code} meta={meta} />;
}
