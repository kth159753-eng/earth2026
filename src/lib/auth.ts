import { ensureTeacherProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";
import { genericAuthError } from "@/lib/utils";

type LoginResult = {
  ok: boolean;
  message?: string;
};

async function signInWithEmail(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) return false;
  await ensureTeacherProfile();
  return true;
}

async function loginWithEdgeFunction(username: string, password: string) {
  const url = supabaseUrl();
  const anon = supabasePublicKey();
  if (!url || !anon) return false;

  const response = await fetch(`${url}/functions/v1/teacher-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anon}`,
      apikey: anon,
    },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) return false;

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    access_token?: string;
    refresh_token?: string;
  };
  if (!data.ok || !data.access_token || !data.refresh_token) return false;

  const supabase = createClient();
  const { error } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (error) return false;
  await ensureTeacherProfile();
  return true;
}

export async function loginWithUsername(
  username: string,
  password: string,
): Promise<LoginResult> {
  const id = username.trim();
  if (!id || password.length < 8) {
    return { ok: false, message: genericAuthError() };
  }

  if (id.includes("@")) {
    const ok = await signInWithEmail(id, password);
    return ok ? { ok: true } : { ok: false, message: genericAuthError() };
  }

  const normalized = id.toLowerCase();
  try {
    if (await loginWithEdgeFunction(normalized, password)) {
      return { ok: true };
    }
  } catch {
    // Edge Function이 없어도 아래 RPC로 로그인합니다.
  }

  const supabase = createClient();
  const { data: email } = await supabase.rpc("teacher_login_email", {
    p_username: normalized,
  });
  if (typeof email === "string" && email.includes("@")) {
    const ok = await signInWithEmail(email, password);
    if (ok) return { ok: true };
  }

  return { ok: false, message: genericAuthError() };
}

export async function logoutTeacher() {
  const supabase = createClient();
  await supabase.auth.signOut();
}
