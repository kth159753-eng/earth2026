"use client";

import { BrandMark, Button, Field, Notice, TextField } from "@/components/ui";
import { loginWithUsername, signUpTeacher } from "@/lib/auth";
import { getProfile } from "@/lib/data";
import { networkErrorMessage } from "@/lib/auth-errors";
import { siteUrl } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import {
  cn,
  validateName,
  validatePassword,
  validateUsername,
} from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function RolePick({
  role,
  onChange,
}: {
  role: UserRole | null;
  onChange: (role: UserRole) => void;
}) {
  return (
    <div className="block space-y-1.5">
      <span className="block text-[13px] font-medium text-[#b3b3b3]">구분</span>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["student", "학생"],
            ["teacher", "교사"],
          ] as const
        ).map(([id, label]) => (
          <label
            key={id}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2 rounded-[4px] border px-3 text-sm font-bold sm:h-10 sm:min-h-10",
              role === id
                ? "border-[#e50914] bg-[#e50914]/12 text-white"
                : "border-white/15 bg-black/30 text-[#c8c8c8]",
            )}
          >
            <input
              type="radio"
              name="auth-role"
              checked={role === id}
              onChange={() => onChange(id)}
              className="h-4 w-4 accent-[#e50914]"
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-[4%] py-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:py-8">
      <div className="starfield" />
      <div className="vignette" />
      <div className="relative w-full max-w-[440px]">
        <div className="mb-4 sm:mb-5">
          <BrandMark />
        </div>
        <section className="rounded-[4px] bg-[#1f1f1f] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.7)] sm:p-6">
          <p className="flex items-center gap-1.5 text-[13px] font-bold tracking-[0.28em]">
            <b className="text-[22px] font-black tracking-[-0.08em] text-[#e50914]">E</b>
            시험
          </p>
          <h1 className="mt-1.5 text-[22px] font-bold leading-tight tracking-[-0.03em] text-white sm:text-[28px] md:text-[32px]">
            {title}
          </h1>
          {subtitle ? <p className="mt-2 text-sm leading-5 text-[#b3b3b3]">{subtitle}</p> : null}
          <div className="mt-4">{children}</div>
        </section>
      </div>
    </main>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!role) {
      setError("학생 또는 교사를 선택해 주세요.");
      return;
    }
    setPending(true);
    try {
      const data = await loginWithUsername(username, password, role);
      if (!data.ok) {
        setError(data.message || "비밀번호가 틀렸습니다.");
        return;
      }
      router.replace(data.role === "student" ? "/solo/" : "/exam/2025-03-I/");
    } catch {
      setError("비밀번호가 틀렸습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell title="지구과학 로그인">
      <form onSubmit={onSubmit} className="space-y-3">
        <RolePick role={role} onChange={setRole} />
        <Field label="아이디 입력">
          <TextField
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="아이디 입력"
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
      <div className="mt-4 flex items-center justify-between text-sm text-[#b3b3b3]">
        <Link href="/forgot-password/" className="hover:text-white">
          비밀번호 찾기
        </Link>
        <Link href="/signup/" className="hover:text-white">
          회원가입
        </Link>
      </div>
    </AuthShell>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
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

    if (!role) {
      setError("학생 또는 교사를 선택해 주세요.");
      return;
    }
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
      const result = await signUpTeacher({
        email: email.trim(),
        password,
        username: username.trim().toLowerCase(),
        full_name: fullName.trim(),
        role,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (result.needsLogin) {
        setInfo("가입이 완료되었습니다. 로그인에서 아이디로 들어와 주세요.");
        return;
      }
      router.replace(role === "student" ? "/solo/" : "/admin/");
    } catch (error) {
      setError(networkErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title={role === "teacher" ? "교사 회원가입" : role === "student" ? "학생 회원가입" : "회원가입"}
      subtitle={
        role === "student"
          ? "학생으로 가입하면 기출학습과 보관소를 이용합니다."
          : role === "teacher"
            ? "교사로 가입하면 교실 시험장과 채점을 이용합니다."
            : "학생 또는 교사를 고른 뒤 가입해 주세요."
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <RolePick role={role} onChange={setRole} />
        <Field label="이름">
          <TextField
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="이름"
            required
          />
        </Field>
        <Field label="아이디" hint="영문/숫자 4~20자">
          <TextField
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="아이디"
            required
          />
        </Field>
        <Field label="이메일" hint="비밀번호 찾기용">
          <TextField
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="이메일"
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
      <p className="mt-6 text-center text-sm text-[#b3b3b3]">
        이미 계정이 있나요?{" "}
        <Link href="/" className="text-white hover:underline">
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
    } catch (error) {
      setError(networkErrorMessage(error));
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
      <p className="mt-6 text-center text-sm text-[#b3b3b3]">
        <Link href="/" className="hover:text-white">
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
      const profile = await getProfile();
      router.replace(profile?.role === "student" ? "/solo/" : "/exam/2025-03-I/");
    } catch (error) {
      setError(networkErrorMessage(error));
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
