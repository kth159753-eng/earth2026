"use client";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";

let browserClient: SupabaseClient | null = null;

export function createClient() {
  const url = supabaseUrl();
  const key = supabasePublicKey();
  if (!url || !key) {
    throw new Error("Supabase 환경 변수가 없습니다.");
  }
  if (browserClient) return browserClient;
  browserClient = createSupabaseClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return browserClient;
}
