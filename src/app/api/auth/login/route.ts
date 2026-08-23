import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { genericAuthError, isSupabaseConfigured, validateUsername } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, message: "서버 설정이 완료되지 않았습니다." },
      { status: 500 },
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: genericAuthError() }, { status: 400 });
  }

  const username = body.username?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!validateUsername(username) || password.length < 8) {
    return NextResponse.json({ ok: false, message: genericAuthError() }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ ok: false, message: genericAuthError() }, { status: 401 });
    }

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(
      profile.id,
    );
    const email = userData.user?.email;
    if (userError || !email) {
      return NextResponse.json({ ok: false, message: genericAuthError() }, { status: 401 });
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return NextResponse.json({ ok: false, message: genericAuthError() }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, message: "잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
