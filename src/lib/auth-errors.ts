export function signupErrorMessage(error: { message?: string } | null) {
  const message = (error?.message || "").toLowerCase();
  if (message.includes("already registered") || message.includes("already been registered")) {
    return "이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해 주세요.";
  }
  if (message.includes("database")) {
    return "프로필 저장에 실패했습니다. Supabase SQL을 다시 실행했는지 확인해 주세요.";
  }
  if (message.includes("rate limit")) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (message.includes("password")) {
    return "비밀번호는 8자 이상, 영문과 숫자를 함께 사용해 주세요.";
  }
  if (message.includes("invalid") && message.includes("email")) {
    return "이메일 형식을 확인해 주세요.";
  }
  return "회원가입에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.";
}

export function networkErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("환경 변수")) {
    return "Supabase 키가 연결되어 있지 않습니다. .env.local을 만들고 개발 서버를 다시 시작해 주세요.";
  }
  if (message.toLowerCase().includes("failed to fetch")) {
    return "Supabase 주소에 연결하지 못했습니다. URL이 맞는지, 인터넷이 되는지를 확인해 주세요.";
  }
  return "연결에 실패했습니다. 설정과 인터넷 상태를 확인해 주세요.";
}
