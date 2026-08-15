const AUTH_ERROR_COPY = {
  UsernameExistsException: {
    title: "Account already exists",
    message: "An account already exists for this email. Sign in instead.",
    action: "signIn",
    actionLabel: "Sign in instead",
  },
  UserNotFoundException: {
    title: "No account found",
    message: "We could not find an account for this email. Create one first.",
    action: "signUp",
    actionLabel: "Create account",
  },
  AliasExistsException: {
    title: "Email already in use",
    message:
      "This email belongs to another account. Sign in to the existing account instead.",
    action: "signIn",
    actionLabel: "Sign in instead",
  },
  CodeMismatchException: {
    title: "Incorrect code",
    message: "That verification code is not correct. Check the email and try again.",
  },
  ExpiredCodeException: {
    title: "Code expired",
    message: "That verification code has expired. Request a new code to continue.",
  },
  TooManyRequestsException: {
    title: "Too many attempts",
    message: "Please wait a few minutes before trying again.",
  },
  LimitExceededException: {
    title: "Request limit reached",
    message: "Too many codes were requested. Please wait before requesting another.",
  },
  ForbiddenException: {
    title: "Request blocked",
    message: "This request was blocked for security reasons. Please try again later.",
  },
  NotAuthorizedException: {
    title: "Sign-in could not be completed",
    message: "Request a new code and try again.",
  },
  PasswordResetRequiredException: {
    title: "Account action required",
    message: "This account requires a password reset before it can sign in.",
  },
  UserAlreadyAuthenticatedException: {
    title: "Already signed in",
    message: "You are already signed in. Refresh the page to continue.",
  },
  OAuthSignInException: {
    title: "Google sign-in did not finish",
    message: "Google sign-in was cancelled or could not be completed. Please try again.",
  },
  OAuthNotConfigured: {
    title: "Google sign-in is unavailable",
    message: "Google sign-in has not been configured for this environment yet.",
  },
  EmailSignInSessionExpired: {
    title: "Sign-in session expired",
    message: "Return to the email step and request a new verification code.",
  },
  PasswordlessSignUpNotEnabled: {
    title: "Email sign-up is unavailable",
    message:
      "Email one-time-password sign-up is not enabled for this Cognito app client.",
  },
};

export function getAuthErrorName(error) {
  const value = error?.name || error?.code || error?.__type || "";
  return String(value).split("#").pop();
}

export function normalizeAuthError(error, options = {}) {
  const code = getAuthErrorName(error) || "CognitoAuthError";
  const rawMessage = String(error?.message || "");

  if (rawMessage === "password is required to signUp") {
    return {
      code: "PasswordlessSignUpNotEnabled",
      ...AUTH_ERROR_COPY.PasswordlessSignUpNotEnabled,
    };
  }

  if (/network|failed to fetch|load failed/i.test(rawMessage)) {
    return {
      code: "NetworkError",
      title: "Connection problem",
      message: "Check your internet connection and try again.",
    };
  }

  const configured = AUTH_ERROR_COPY[code];
  if (configured) {
    return { code, ...configured };
  }

  return {
    code,
    title: options.fallbackTitle || "Authentication failed",
    message:
      options.fallbackMessage ||
      "We could not complete that authentication request. Please try again.",
  };
}
