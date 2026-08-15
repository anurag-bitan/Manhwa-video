import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { user, loading, refreshUser } = useAuth();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Processing authentication...");

  useEffect(() => {
    if (loading) return;

    const finish = async () => {
      if (!user) {
        await refreshUser();
      }

      setStatus("success");
      setMessage("Authentication successful! Redirecting...");

      setTimeout(() => {
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
      console.error("Cognito callback failed:", error);
      setStatus("error");
      setMessage(error.message || "Authentication failed");
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    });
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
