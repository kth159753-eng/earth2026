import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";

export function createClient() {
  const url = supabaseUrl();
  const key = supabasePublicKey();
  if (!url || !key) {
    throw new Error("Supabase 환경 변수가 없습니다.");
  }
  return createSupabaseClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
