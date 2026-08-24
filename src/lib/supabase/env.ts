function normalizeSupabaseUrl(value: string) {
  return value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "")
    .replace(/\/auth\/v1$/i, "");
}

const FALLBACK_URL = "https://cvfivbtvchypbeciulef.supabase.co";
const FALLBACK_KEY = "sb_publishable_9IBkfrtsi7tTaQtZ1G74iA_iHYBP9xq";

export function supabaseUrl() {
  return (
    normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || "") || FALLBACK_URL
  );
}

export function supabasePublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    FALLBACK_KEY
  );
}
