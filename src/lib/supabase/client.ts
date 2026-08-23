import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";

export function createClient() {
  const url = supabaseUrl();
  const key = supabasePublicKey();
  if (!url || !key) {
    throw new Error("Supabase 환경 변수가 없습니다.");
  }
  return createBrowserClient(url, key);
}
