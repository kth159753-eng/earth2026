export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${BASE_PATH}`;
  }
  return "http://localhost:3000";
}

export function omrUrl(code: string, pair?: string | null) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : siteUrl();
  const base =
    typeof window !== "undefined" ? BASE_PATH : process.env.NEXT_PUBLIC_BASE_PATH || "";
  const url = `${origin}${base}/omr/?c=${encodeURIComponent(code)}`;
  return pair ? `${url}&p=${encodeURIComponent(pair)}` : url;
}

export function isSupabaseConfigured() {
  return true;
}
