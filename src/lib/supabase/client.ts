"use client";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";

let browserClient: SupabaseClient | null = null;

function readStoredAccessToken() {
  if (typeof window === "undefined") return null;
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const storageKey = window.localStorage.key(index);
      if (!storageKey?.startsWith("sb-") || !storageKey.includes("auth-token")) continue;
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "null") as {
        access_token?: string;
        currentSession?: { access_token?: string };
      } | null;
      const token = parsed?.access_token || parsed?.currentSession?.access_token;
      if (token) return token;
    }
  } catch {
    return null;
  }
  return null;
}

function fetchWithoutPublishableBearer(key: string): typeof fetch {
  const publishableBearer = `Bearer ${key}`;
  return (input, init) => {
    const headers = new Headers();
    if (input instanceof Request) {
      input.headers.forEach((value, name) => headers.set(name, value));
    }
    new Headers(init?.headers).forEach((value, name) => {
      if (
        name.toLowerCase() === "authorization" &&
        value === publishableBearer &&
        headers.get("Authorization") &&
        headers.get("Authorization") !== publishableBearer
      ) {
        return;
      }
      headers.set(name, value);
    });

    const current = headers.get("Authorization");
    if (!current || current === publishableBearer) {
      const token = readStoredAccessToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      } else if (current === publishableBearer) {
        headers.delete("Authorization");
      }
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
