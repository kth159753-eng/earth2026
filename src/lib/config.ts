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
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
