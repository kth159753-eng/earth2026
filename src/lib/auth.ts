import { signupErrorMessage } from "@/lib/auth-errors";
import { ensureTeacherProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";
import { genericAuthError } from "@/lib/utils";

type LoginResult = {
  ok: boolean;
  message?: string;
};

type SignUpResult =
  | { ok: true; needsLogin?: boolean }
  | { ok: false; message: string };

type AuthJson = {
  access_token?: string;
  refresh_token?: string;
  msg?: string;
  error?: string;
  error_description?: string;
  message?: string;
};

async function authPost(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${supabaseUrl()}${path}`, {
    method: "POST",
    headers: {
      apikey: supabasePublicKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as AuthJson;
  return { response, json };
}

async function applySession(accessToken?: string, refreshToken?: string) {
  if (!accessToken || !refreshToken) return false;
  const supabase = createClient();
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return !error;
}

export async function signUpTeacher(input: {
  email: string;
  password: string;
  username: string;
  full_name: string;
}): Promise<SignUpResult> {
  const { response, json } = await authPost("/auth/v1/signup", {
    email: input.email,
    password: input.password,
    data: {
      username: input.username,
      full_name: input.full_name,
    },
  });

  const errorText = json.msg || json.error_description || json.message || json.error || "";
  const alreadyRegistered = errorText.toLowerCase().includes("already registered");

  if (!response.ok && !alreadyRegistered) {
    return { ok: false, message: signupErrorMessage({ message: errorText }) };
  }

  let signedIn = await applySession(json.access_token, json.refresh_token);
  if (!signedIn) {
    const signed = await authPost("/auth/v1/token?grant_type=password", {
      email: input.email,
      password: input.password,
    });
    signedIn = await applySession(signed.json.access_token, signed.json.refresh_token);
  }

  if (!signedIn) {
    if (alreadyRegistered) {
      return {
        ok: false,
        message: "이미 가입된 이메일입니다. 로그인에서 아이디로 들어와 주세요.",
      };
    }
    return { ok: true, needsLogin: true };
  }

  await ensureTeacherProfile({
    username: input.username,
    full_name: input.full_name,
  });
  return { ok: true };
}

async function signInWithEmail(email: string, password: string) {
  const signed = await authPost("/auth/v1/token?grant_type=password", {
    email,
    password,
  });
  if (!(await applySession(signed.json.access_token, signed.json.refresh_token))) {
    return false;
  }
  await ensureTeacherProfile();
  return true;
}

async function loginWithEdgeFunction(username: string, password: string) {
  const response = await fetch(`${supabaseUrl()}/functions/v1/teacher-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabasePublicKey(),
    },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) return false;

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    access_token?: string;
    refresh_token?: string;
  };
  if (!data.ok) return false;
  if (!(await applySession(data.access_token, data.refresh_token))) return false;
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
