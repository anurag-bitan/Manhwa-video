import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Lock,
  Mail,
  Shield,
  X,
} from "lucide-react";
import { showToast } from "../utils/toast";

function resolveRedirect(value) {
  const pathname = typeof value === "string" ? value : value?.pathname;
  if (
    typeof pathname !== "string" ||
    !pathname.startsWith("/") ||
    pathname.startsWith("//")
  ) {
    return null;
  }

  const search =
    typeof value?.search === "string" && value.search.startsWith("?")
      ? value.search
      : "";
  return `${pathname}${search}`;
}

function readSavedRedirect() {
  try {
    const saved = sessionStorage.getItem("auth_redirect");
    return saved ? JSON.parse(saved) : null;
  } catch {
    sessionStorage.removeItem("auth_redirect");
    return null;
  }
}

function createUiError(title, message) {
  return { title, message };
}

const AuthAlert = ({ error, onAction, onDismiss }) => {
  if (!error) return null;

  return (
    <div
      id="auth-error"
      role="alert"
      aria-live="assertive"
      className="rounded-xl border border-red-400/30 bg-red-500/15 p-4 text-left backdrop-blur-sm"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-100">
            {error.title || "Authentication failed"}
          </p>
          <p className="mt-1 text-sm leading-5 text-red-200/90">
            {error.message}
          </p>
          {error.action && error.actionLabel && (
            <button
              type="button"
              onClick={() => onAction(error.action)}
              className="mt-3 text-sm font-semibold text-white underline decoration-red-300/60 underline-offset-4 hover:decoration-white"
            >
              {error.actionLabel}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss authentication error"
          className="rounded-lg p-1 text-red-200/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const Login = () => {
  const {
    sendOtp,
    resendOtp,
    verifyOtp,
    signInWithGoogle,
    googleEnabled,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState("email");
  const [authMode, setAuthMode] = useState("signIn");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState(null);
  
  // ✅ SAFE redirect resolution
  const from =
    resolveRedirect(location.state?.from) ||
    resolveRedirect(readSavedRedirect()) ||
    "/upload";

  const otpInputs = useRef([]);

  const changeAuthMode = (nextMode) => {
    setAuthMode(nextMode);
    setError(null);
    setOtp("");
  };

  const handleAuthErrorAction = (nextMode) => {
    changeAuthMode(nextMode);
    setStep("email");
  };

  /* ---------------- Send OTP ---------------- */
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    
    if (!email) {
      setError(createUiError("Email required", "Enter your email to continue."));
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(
        createUiError(
          "Invalid email",
          "Enter a complete email address such as you@example.com.",
        ),
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await sendOtp(email, authMode);
      
      if (authError) {
        setError(authError);
        return;
      }

      setStep("otp");
      showToast.success(
        authMode === "signUp"
          ? "Account code sent. Check your email and spam folder."
          : "Sign-in code sent. Check your email and spam folder.",
      );
    } catch (err) {
      setError(
        createUiError(
          "Could not send code",
          err?.message || "Please try again in a moment.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Verify OTP ---------------- */
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();

    if (otp.length !== 6) {
      setError(
        createUiError("Incomplete code", "Enter all six verification digits."),
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await verifyOtp(email, otp);
      
      if (error) {
        setError(error);
        setOtp("");
        otpInputs.current[0]?.focus();
        return;
      }

      if (data.newSignInCodeSent) {
        setOtp("");
        otpInputs.current[0]?.focus();
        showToast.info(
          "Account confirmed. Enter the fresh sign-in code we just emailed you.",
        );
        return;
      }

      if (data.session) {
        showToast.success("Signed in successfully.");

        setTimeout(() => {
          navigate(from, { replace: true });
        }, 600);
      }
    } catch (err) {
      setError(
        createUiError(
          "Verification failed",
          err?.message || "Request a new code and try again.",
        ),
      );
      setOtp("");
      otpInputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError(null);
    setOtp("");

    try {
      const { error: resendError } = await resendOtp(email);
      if (resendError) {
        setError(resendError);
        return;
      }

      showToast.success("A new code was sent. Check your email and spam folder.");
    } catch (err) {
      setError(
        createUiError(
          "Could not resend code",
          err?.message || "Please wait a moment and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Google Sign In ---------------- */
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);

      const [pathname, query = ""] = from.split("?", 2);
      sessionStorage.setItem(
        "auth_redirect",
        JSON.stringify({
          pathname,
          search: query ? `?${query}` : "",
          state: null,
        }),
      );
    
      const { error: authError } = await signInWithGoogle();
    
      if (authError) {
        setError(authError);
        setLoading(false);
      }
    } catch (err) {
      setError(
        createUiError(
          "Google sign-in failed",
          err?.message || "Please try again.",
        ),
      );
      setLoading(false);
    }
  };

  /* ---------------- OTP Input Handlers ---------------- */
  const handleOtpChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;
    
    if (value.length > 1) value = value.slice(0, 1);
    
    const newOtp = otp.split('');
    newOtp[index] = value;
    setOtp(newOtp.join(''));
    
    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    setOtp(pastedData);
    
    const nextIndex = Math.min(pastedData.length, 5);
    otpInputs.current[nextIndex]?.focus();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (step === 'email') {
        handleSendOtp();
      } else if (otp.length === 6) {
        handleVerifyOtp();
      }
    }
  };

  // Auto-focus first OTP input when step changes
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        otpInputs.current[0]?.focus();
      }, 100);
    }
  }, [step]);


  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
     

      {/* Main Card */}
      <div className="relative mt-10 z-10 w-full max-w-md">
        <div className="backdrop-blur-2xl bg-white/10 rounded-3xl border border-white/20 shadow-2xl p-8 sm:p-10">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 mb-4 shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
              {step === "otp"
                ? "Check your email"
                : authMode === "signIn"
                  ? "Welcome back"
                  : "Create your account"}
            </h1>
            <p className="text-md font-semibold text-purple-400/80">
              {step === "email"
                ? authMode === "signIn"
                  ? "Sign in to continue to Manhwa AI"
                  : "Start creating with Manhwa AI"
                : `Code sent to ${email}`}
            </p>
          </div>

          {/* EMAIL STEP */}
          {step === "email" ? (
            <div className="space-y-5">
              <div
                role="tablist"
                aria-label="Choose sign in or account creation"
                className="grid grid-cols-2 rounded-xl border border-white/15 bg-black/15 p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === "signIn"}
                  onClick={() => changeAuthMode("signIn")}
                  disabled={loading}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
                    authMode === "signIn"
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-purple-200/70 hover:text-white"
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === "signUp"}
                  onClick={() => changeAuthMode("signUp")}
                  disabled={loading}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
                    authMode === "signUp"
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-purple-200/70 hover:text-white"
                  }`}
                >
                  Create account
                </button>
              </div>

              {/* Google is hidden until a Cognito domain and provider are configured. */}
              {googleEnabled && <>
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-transparent border border-gray-400/50 hover:bg-white/10 text-white font-semibold flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {loading ? "Connecting..." : "Continue with Google"}
              </button>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-white/10"></div>
                <span className="text-xs text-white font-medium">OR</span>
                <div className="flex-1 h-px bg-white/20"></div>
              </div>
              </>}

              {/* Email Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-300 w-5 h-5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={handleKeyPress}
                    placeholder="you@example.com"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "auth-error" : undefined}
                    className="w-full rounded-xl bg-transparent backdrop-blur-sm border border-white/20 py-3.5 pl-12 pr-4 text-white placeholder-gray-300/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 transition-all"
                    autoFocus
                  />
                </div>
              </div>

              <AuthAlert
                error={error}
                onAction={handleAuthErrorAction}
                onDismiss={() => setError(null)}
              />

              <button
                onClick={handleSendOtp}
                disabled={loading || !email}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  authMode === "signIn"
                    ? "Send sign-in code"
                    : "Create account & send code"
                )}
              </button>

              <p className="text-xs text-center text-purple-200/70 mt-6">
                By continuing, you agree to our{" "}
                <a href="#" className="underline hover:text-white transition-colors">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="underline hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </p>
            </div>
          ) : (
            /* OTP STEP */
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-sm font-medium text-purple-200 block text-center">
                  Enter 6-Digit Code
                </label>

                {/* OTP Input Grid */}
                <div className="flex gap-3 justify-center" onPaste={handleOtpPaste}>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <input
                      key={index}
                      ref={(el) => (otpInputs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={otp[index] || ''}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(event) => {
                        handleOtpKeyDown(index, event);
                        handleKeyPress(event);
                      }}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? "auth-error" : undefined}
                      className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-xl bg-white/10 backdrop-blur-sm border-2 border-white/20 text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 transition-all"
                      required
                    />
                  ))}
                </div>
              </div>

              <AuthAlert
                error={error}
                onAction={handleAuthErrorAction}
                onDismiss={() => setError(null)}
              />

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Continue"
                )}
              </button>

              <button
                onClick={() => {
                  setStep("email");
                  setOtp("");
                  setError(null);
                }}
                disabled={loading}
                className="w-full text-sm text-purple-200 hover:text-white flex items-center justify-center gap-2 py-2 transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Email
              </button>

              {/* Resend Code */}
              <div className="text-center">
                <button
                  onClick={() => {
                    handleResendOtp();
                  }}
                  disabled={loading}
                  className="text-sm text-purple-300 hover:text-white underline transition-colors disabled:opacity-50"
                >
                  Didn't receive code? Resend
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Security Note */}
        <div className="text-center mt-7 space-y-2">
          <div className="flex items-center mb-5 justify-center gap-2 text-sm text-gray-400">
            <Lock className="w-4 h-4" />
            <span>Secured by</span>
          </div>
          <div className="flex items-center justify-center gap-4 text-xs text-gray-300/50">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
              </svg>
              OAuth 2.0
            </span>
            <span className="text-gray-300/40">•</span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z" />
              </svg>
              256-bit Encryption
            </span>
            <span className="text-gray-300/40">•</span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
              </svg>
              GDPR Compliant
            </span>
          </div>
        </div>
      </div>

      <style>{`
          @keyframes blob {
            0%, 100% { transform: translate(0, 0) scale(1); }
            25% { transform: translate(20px, -50px) scale(1.1); }
            50% { transform: translate(-20px, 20px) scale(0.9); }
            75% { transform: translate(50px, 50px) scale(1.05); }
          }
          
          .animate-blob {
            animation: blob 7s infinite;
          }
          
          .animation-delay-2000 {
            animation-delay: 2s;
          }
          
          .animation-delay-4000 {
            animation-delay: 4s;
          }

          input[type="number"]::-webkit-inner-spin-button,
          input[type="number"]::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
        `}</style>
    </div>
  );
};

export default Login;
