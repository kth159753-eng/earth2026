"use client";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";

let browserClient: SupabaseClient | null = null;

function fetchWithoutPublishableBearer(key: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (input instanceof Request) {
      input.headers.forEach((value, name) => {
        if (!headers.has(name)) headers.set(name, value);
      });
    }
    const authorization = headers.get("Authorization");
    if (key.startsWith("sb_") && authorization === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    if (!headers.has("apikey")) {
      headers.set("apikey", key);
    }
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    return fetch(url, { ...init, headers });
  };
}

export function createClient() {
  const url = supabaseUrl();
  const key = supabasePublicKey();
  if (browserClient) return browserClient;
  browserClient = createSupabaseClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: { apikey: key },
      fetch: fetchWithoutPublishableBearer(key),
    },
  });
  return browserClient;
}
