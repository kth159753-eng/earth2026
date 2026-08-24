export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${BASE_PATH}`;
  }
  return "http://localhost:3000";
}

export function omrUrl(code: string) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : siteUrl();
  const base =
    typeof window !== "undefined" ? BASE_PATH : process.env.NEXT_PUBLIC_BASE_PATH || "";
  return `${origin}${base}/omr/?c=${encodeURIComponent(code)}`;
}

export function isSupabaseConfigured() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "");
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  return Boolean(url && key);
}
