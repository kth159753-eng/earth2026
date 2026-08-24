function errorText(error: { message?: string; code?: string } | null) {
  return `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
}

export function signupErrorMessage(error: { message?: string; code?: string } | null) {
  const message = errorText(error);
  if (message.includes("already registered") || message.includes("already been registered")) {
    return "이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해 주세요.";
  }
  if (message.includes("database") || message.includes("saving new user")) {
    return "가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
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
  if (message.includes("redirect")) {
    return "가입은 되었지만 이동 주소가 허용되지 않았습니다. 로그인에서 아이디로 들어와 주세요.";
  }
  return "회원가입에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.";
}

export function networkErrorMessage(_error: unknown) {
  return "연결에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}
