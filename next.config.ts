import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

function normalizeSupabaseUrl(value: string) {
  return value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "")
    .replace(/\/auth\/v1$/i, "");
}

const supabaseUrl =
  normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || "") ||
  "https://cvfivbtvchypbeciulef.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_9IBkfrtsi7tTaQtZ1G74iA_iHYBP9xq";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseKey,
  },
  ...(basePath
    ? {
        basePath,
        assetPrefix: basePath,
      }
    : {}),
};

export default nextConfig;
