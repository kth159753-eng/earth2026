import { createClient } from "@/lib/supabase/client";
import { genericAuthError } from "@/lib/utils";

type LoginResult = {
  ok: boolean;
  message?: string;
};

export async function loginWithUsername(
  username: string,
  password: string,
): Promise<LoginResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { ok: false, message: "서버 설정이 완료되지 않았습니다." };
  }

  const response = await fetch(`${url}/functions/v1/teacher-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anon}`,
      apikey: anon,
    },
    body: JSON.stringify({
      username: username.trim().toLowerCase(),
      password,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    access_token?: string;
    refresh_token?: string;
    message?: string;
  };

  if (!response.ok || !data.ok || !data.access_token || !data.refresh_token) {
    return { ok: false, message: data.message || genericAuthError() };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (error) {
    return { ok: false, message: genericAuthError() };
  }
  return { ok: true };
}

export async function logoutTeacher() {
  const supabase = createClient();
  await supabase.auth.signOut();
}
