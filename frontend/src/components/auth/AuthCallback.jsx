import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { normalizeAuthError } from "../../lib/authErrors";

const wait = (milliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const AuthCallback = () => {
  const navigate = useNavigate();
  const { user, loading, refreshUser } = useAuth();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Processing authentication...");

  useEffect(() => {
    if (loading) return;

    let cancelled = false;
    let redirectTimer;

    const finish = async () => {
      const query = new URLSearchParams(window.location.search);
      if (query.has("error")) {
        const oauthError = new Error("Google sign-in was not completed.");
        oauthError.name = "OAuthSignInException";
        throw oauthError;
      }

      let currentUser = user;
      for (let attempt = 0; !currentUser && attempt < 8; attempt += 1) {
        currentUser = await refreshUser();
        if (!currentUser) await wait(350);
      }

      if (!currentUser) {
        const oauthError = new Error("No Cognito session was created.");
        oauthError.name = "OAuthSignInException";
        throw oauthError;
      }

      if (cancelled) return;
      setStatus("success");
      setMessage("Google sign-in succeeded. Redirecting...");

      redirectTimer = window.setTimeout(() => {
        const saved = sessionStorage.getItem("auth_redirect");
        sessionStorage.removeItem("auth_redirect");

        if (saved) {
          try {
            const { pathname, search, state } = JSON.parse(saved);
            navigate(`${pathname}${search || ""}`, {
              replace: true,
              state,
            });
            return;
          } catch {
            // Ignore invalid saved navigation and use the safe default below.
          }
        }

        navigate("/upload", { replace: true });
      }, 1000);
    };

    finish().catch((error) => {
      if (cancelled) return;
      const publicError = normalizeAuthError(error, {
        fallbackTitle: "Google sign-in failed",
        fallbackMessage: "Return to sign in and try again.",
      });
      setStatus("error");
      setMessage(publicError.message);
      redirectTimer = window.setTimeout(
        () => navigate("/login", { replace: true }),
        4000,
      );
    });

    return () => {
      cancelled = true;
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [loading, navigate, refreshUser, user]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="backdrop-blur-2xl bg-white/10 rounded-3xl border border-white/20 shadow-2xl p-8 sm:p-10 max-w-md w-full">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 mb-4">
            {status === "loading" && (
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
            )}
            {status === "success" && (
              <CheckCircle className="w-10 h-10 text-green-400" />
            )}
            {status === "error" && (
              <XCircle className="w-10 h-10 text-red-400" />
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {status === "loading" && "Authenticating..."}
              {status === "success" && "Success!"}
              {status === "error" && "Authentication Failed"}
            </h2>
            <p className="text-purple-200">{message}</p>
            {status === "error" && (
              <button
                type="button"
                onClick={() => navigate("/login", { replace: true })}
                className="mt-5 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
