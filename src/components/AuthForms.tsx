"use client";

import { BrandMark, Button, Field, Notice, TextField } from "@/components/ui";
import { loginWithUsername } from "@/lib/auth";
import { isSupabaseConfigured, siteUrl } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import {
  validateName,
  validatePassword,
  validateUsername,
} from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="starfield" />
      <div className="vignette" />
      <div className="relative w-full max-w-[440px]">
        <div className="mb-8 flex justify-center">
          <BrandMark />
        </div>
        <section className="glass rounded-3xl p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-50">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-stone-400">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </section>
      </div>
    </main>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!isSupabaseConfigured()) {
      setError("Supabase 환경 변수를 먼저 설정해 주세요.");
      return;
    }
    setPending(true);
    try {
      const data = await loginWithUsername(username, password);
      if (!data.ok) {
        setError(data.message || "로그인에 실패했습니다.");
        return;
      }
      router.replace("/exam/2025-03-I/");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell title="교사 로그인" subtitle="아이디와 비밀번호로 교실 시험장을 엽니다.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="아이디">
          <TextField
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="teacher01"
            required
          />
        </Field>
        <Field label="비밀번호">
          <TextField
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호"
            required
          />
        </Field>
        {error ? <Notice tone="warn">{error}</Notice> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "확인 중..." : "입장하기"}
        </Button>
      </form>
      <div className="mt-6 flex items-center justify-between text-sm text-stone-400">
        <Link href="/forgot-password" className="hover:text-gold-bright">
          비밀번호 찾기
        </Link>
        <Link href="/signup" className="hover:text-gold-bright">
          회원가입
        </Link>
      </div>
    </AuthShell>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");

    if (!validateName(fullName)) {
      setError("이름은 2~20자로 입력해 주세요.");
      return;
    }
    if (!validateUsername(username)) {
      setError("아이디는 영문, 숫자, 밑줄 4~20자입니다.");
      return;
    }
    if (!validatePassword(password)) {
      setError("비밀번호는 8자 이상, 영문과 숫자를 함께 사용해 주세요.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const { data: available, error: checkError } = await supabase.rpc(
        "is_username_available",
        { p_username: username.trim() },
      );
      if (checkError) {
        setError("아이디 확인에 실패했습니다. SQL 설정을 확인해 주세요.");
        return;
      }
      if (available === false) {
        setError("이미 사용 중인 아이디입니다.");
        return;
      }

      const { data, error: signError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: username.trim().toLowerCase(),
            full_name: fullName.trim(),
          },
          emailRedirectTo: `${siteUrl()}/exam/2025-03-I/`,
        },
      });
      if (signError) {
        setError("회원가입에 실패했습니다. 이메일 형식을 확인해 주세요.");
        return;
      }
      if (!data.session) {
        setInfo("가입이 접수되었습니다. 메일함에서 인증을 완료해 주세요.");
        return;
      }
      router.replace("/admin/");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="교사 회원가입"
      subtitle="이름과 아이디, 복구용 이메일, 비밀번호를 등록합니다."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="이름">
          <TextField
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="홍길동"
            required
          />
        </Field>
        <Field label="아이디" hint="영문/숫자 4~20자">
          <TextField
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="earth_teacher"
            required
          />
        </Field>
        <Field label="이메일" hint="비밀번호 찾기용">
          <TextField
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teacher@school.kr"
            required
          />
        </Field>
        <Field label="비밀번호" hint="8자 이상, 영문+숫자">
          <TextField
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        <Field label="비밀번호 확인">
          <TextField
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </Field>
        {error ? <Notice tone="warn">{error}</Notice> : null}
        {info ? <Notice tone="ok">{info}</Notice> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "등록 중..." : "계정 만들기"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-stone-400">
        이미 계정이 있나요?{" "}
        <Link href="/" className="text-gold-bright hover:underline">
          로그인
        </Link>
      </p>
    </AuthShell>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");
    setPending(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${siteUrl()}/reset-password/` },
      );
      if (resetError) {
        setError("메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setInfo("입력하신 주소로 재설정 안내를 보냈습니다. 메일함을 확인해 주세요.");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="비밀번호 찾기"
      subtitle="가입 시 입력한 이메일로 재설정 링크를 보냅니다."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="이메일">
          <TextField
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        {error ? <Notice tone="warn">{error}</Notice> : null}
        {info ? <Notice tone="ok">{info}</Notice> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "전송 중..." : "재설정 메일 보내기"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-stone-400">
        <Link href="/" className="hover:text-gold-bright">
          로그인으로 돌아가기
        </Link>
      </p>
    </AuthShell>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!validatePassword(password)) {
      setError("비밀번호는 8자 이상, 영문과 숫자를 함께 사용해 주세요.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setPending(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("재설정 세션이 만료되었습니다. 메일을 다시 받아 주세요.");
        return;
      }
      router.replace("/exam/2025-03-I/");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell title="새 비밀번호" subtitle="새로운 비밀번호를 두 번 입력해 주세요.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="새 비밀번호">
          <TextField
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        <Field label="비밀번호 확인">
          <TextField
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </Field>
        {error ? <Notice tone="warn">{error}</Notice> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "변경 중..." : "비밀번호 변경"}
        </Button>
      </form>
    </AuthShell>
  );
}
