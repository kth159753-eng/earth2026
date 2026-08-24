"use client";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";

let browserClient: SupabaseClient | null = null;

function fetchWithoutPublishableBearer(key: string): typeof fetch {
  return (input, init) => {
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
    if (input instanceof Request) {
      return fetch(new Request(input, { ...init, headers }));
    }
    return fetch(input, { ...init, headers });
  };
}

export function createClient() {
  if (browserClient) return browserClient;
  const url = supabaseUrl();
  const key = supabasePublicKey();
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
