import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://kth159753-eng.github.io",
];

function corsHeaders(origin: string | null) {
  const allow =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[2];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return json({ ok: false, message: "Method not allowed" }, 405, origin);
  }

  let payload: { username?: string; password?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: "잘못된 요청입니다." }, 400, origin);
  }

  const username = payload.username?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";
  if (!/^[a-z0-9_]{4,20}$/.test(username) || password.length < 8) {
    return json({ ok: false, message: "비밀번호가 틀렸습니다." }, 401, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRole || !anonKey) {
    return json({ ok: false, message: "함수 설정이 필요합니다." }, 500, origin);
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    return json({ ok: false, message: "비밀번호가 틀렸습니다." }, 401, origin);
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(
    profile.id,
  );
  const email = userData.user?.email;
  if (userError || !email) {
    return json({ ok: false, message: "비밀번호가 틀렸습니다." }, 401, origin);
  }

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return json({ ok: false, message: "비밀번호가 틀렸습니다." }, 401, origin);
  }

  return json(
    {
      ok: true,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
    200,
    origin,
  );
});
