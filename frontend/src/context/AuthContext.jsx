import React, {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  autoSignIn,
  confirmSignIn,
  confirmSignUp,
  fetchUserAttributes,
  getCurrentUser,
  resendSignUpCode,
  signIn,
  signInWithRedirect,
  signOut,
  signUp,
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { cognitoConfig } from "../lib/cognitoClient";
import { normalizeAuthError } from "../lib/authErrors";
import { AuthContextValue } from "./authContextValue";

const AUTH_FLOW_KEY = "cognito_email_auth_flow";

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

async function readCurrentUser() {
  const currentUser = await getCurrentUser();
  const attributes = await fetchUserAttributes();

  return {
    id: currentUser.userId,
    username: currentUser.username,
    email:
      attributes.email ||
      currentUser.signInDetails?.loginId ||
      currentUser.username,
    attributes,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await readCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();

    const stopListening = Hub.listen("auth", ({ payload }) => {
      if (["signedIn", "tokenRefresh"].includes(payload.event)) {
        refreshUser();
      }
      if (payload.event === "signedOut") {
        setUser(null);
        setLoading(false);
      }
    });

    return stopListening;
  }, [refreshUser]);

  const startExistingUserSignIn = async (email) => {
    const result = await signIn({
      username: email,
      options: {
        authFlowType: "USER_AUTH",
        preferredChallenge: "EMAIL_OTP",
      },
    });

    if (result.nextStep.signInStep === "CONFIRM_SIGN_UP") {
      const resendResult = await resendSignUpCode({ username: email });
      sessionStorage.setItem(AUTH_FLOW_KEY, "signUp");
      return resendResult;
    }

    if (result.nextStep.signInStep !== "CONFIRM_SIGN_IN_WITH_EMAIL_CODE") {
      throw new Error(
        `Cognito returned an unexpected sign-in step: ${result.nextStep.signInStep}`,
      );
    }

    sessionStorage.setItem(AUTH_FLOW_KEY, "signIn");
    return result;
  };

  const resendOtp = async (rawEmail) => {
    const email = normalizeEmail(rawEmail);
    const flow = sessionStorage.getItem(AUTH_FLOW_KEY);

    try {
      if (flow === "signUp") {
        const result = await resendSignUpCode({ username: email });
        return { data: result, error: null };
      }

      return {
        data: await startExistingUserSignIn(email),
        error: null,
      };
    } catch (error) {
      return { data: null, error: normalizeAuthError(error) };
    }
  };

  const sendOtp = async (rawEmail, mode = "signIn") => {
    const email = normalizeEmail(rawEmail);

    try {
      if (mode === "signIn") {
        return {
          data: await startExistingUserSignIn(email),
          error: null,
        };
      }

      const result = await signUp({
        username: email,
        options: {
          userAttributes: { email },
          autoSignIn: { authFlowType: "USER_AUTH" },
        },
      });

      if (result.nextStep.signUpStep !== "CONFIRM_SIGN_UP") {
        throw new Error(
          `Cognito returned an unexpected sign-up step: ${result.nextStep.signUpStep}`,
        );
      }

      sessionStorage.setItem(AUTH_FLOW_KEY, "signUp");
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: normalizeAuthError(error) };
    }
  };

  const verifyOtp = async (rawEmail, rawToken) => {
    const email = normalizeEmail(rawEmail);
    const token = rawToken.trim();
    const flow = sessionStorage.getItem(AUTH_FLOW_KEY);

    try {
      if (flow === "signUp") {
        const confirmation = await confirmSignUp({
          username: email,
          confirmationCode: token,
        });

        if (confirmation.nextStep.signUpStep === "COMPLETE_AUTO_SIGN_IN") {
          const result = await autoSignIn();
          if (result.nextStep.signInStep !== "DONE") {
            throw new Error(
              `Cognito returned an unexpected auto sign-in step: ${result.nextStep.signInStep}`,
            );
          }
        } else if (confirmation.nextStep.signUpStep === "DONE") {
          await startExistingUserSignIn(email);
          return {
            data: { session: false, newSignInCodeSent: true },
            error: null,
          };
        } else {
          throw new Error(
            `Cognito returned an unexpected confirmation step: ${confirmation.nextStep.signUpStep}`,
          );
        }
      } else if (flow === "signIn") {
        const result = await confirmSignIn({ challengeResponse: token });
        if (result.nextStep.signInStep !== "DONE") {
          throw new Error(
            `Cognito returned an unexpected confirmation step: ${result.nextStep.signInStep}`,
          );
        }
      } else {
        const expiredSession = new Error("The email sign-in session expired.");
        expiredSession.name = "EmailSignInSessionExpired";
        throw expiredSession;
      }

      sessionStorage.removeItem(AUTH_FLOW_KEY);
      await refreshUser();
      return { data: { session: true }, error: null };
    } catch (error) {
      return { data: null, error: normalizeAuthError(error) };
    }
  };

  const signInWithGoogle = async () => {
    if (!cognitoConfig.googleEnabled) {
      return {
        data: null,
        error: normalizeAuthError({ name: "OAuthNotConfigured" }),
      };
    }

    try {
      await signInWithRedirect({ provider: "Google" });
      return { data: { redirecting: true }, error: null };
    } catch (error) {
      return {
        data: null,
        error: normalizeAuthError(error, {
          fallbackTitle: "Google sign-in failed",
          fallbackMessage: "We could not start Google sign-in. Please try again.",
        }),
      };
    }
  };

  const logout = async () => {
    sessionStorage.removeItem(AUTH_FLOW_KEY);
    await signOut();
  };

  const value = {
    user,
    loading,
    sendOtp,
    resendOtp,
    verifyOtp,
    signInWithGoogle,
    googleEnabled: cognitoConfig.googleEnabled,
    logout,
    refreshUser,
  };

  return (
    <AuthContextValue.Provider value={value}>
      {!loading && children}
    </AuthContextValue.Provider>
  );
};
