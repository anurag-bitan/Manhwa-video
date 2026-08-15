import React, {
  createContext,
  useCallback,
  useContext,
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
  signOut,
  signUp,
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { cognitoConfig } from "../lib/cognitoClient";

const AuthContext = createContext();
const AUTH_FLOW_KEY = "cognito_email_auth_flow";

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function getErrorName(error) {
  const value = error?.name || error?.code || error?.__type || "";
  return value.split("#").pop();
}

function toPublicError(error) {
  if (error?.message === "password is required to signUp") {
    return {
      name: error?.name || "PasswordlessSignUpNotEnabled",
      message:
        "Cognito email OTP signup is not enabled. Enable Email message one-time password on the user pool and ALLOW_USER_AUTH on this app client.",
    };
  }

  return {
    name: error?.name || "CognitoAuthError",
    message: error?.message || "Authentication failed",
  };
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
      setUser(await readCurrentUser());
    } catch {
      setUser(null);
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
      return { data: null, error: toPublicError(error) };
    }
  };

  const sendOtp = async (rawEmail) => {
    const email = normalizeEmail(rawEmail);

    try {
      // Start with sign-up so one form works for both new and existing users.
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
      if (getErrorName(error) === "UsernameExistsException") {
        try {
          // A duplicate can be an unconfirmed account from a previous signup.
          // Resend its confirmation code before trying the confirmed-user flow.
          const result = await resendSignUpCode({ username: email });
          sessionStorage.setItem(AUTH_FLOW_KEY, "signUp");
          return { data: result, error: null };
        } catch (resendError) {
          const resendErrorName = getErrorName(resendError);
          const canBeConfirmedUser = [
            "InvalidParameterException",
            "NotAuthorizedException",
          ].includes(resendErrorName);

          if (!canBeConfirmedUser) {
            return { data: null, error: toPublicError(resendError) };
          }

          try {
            return {
              data: await startExistingUserSignIn(email),
              error: null,
            };
          } catch (signInError) {
            return { data: null, error: toPublicError(signInError) };
          }
        }
      }

      return { data: null, error: toPublicError(error) };
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
          throw new Error(
            "Account confirmed. Cognito sent a new sign-in code; enter that new code.",
          );
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
        throw new Error("The email sign-in session expired. Request a new code.");
      }

      sessionStorage.removeItem(AUTH_FLOW_KEY);
      await refreshUser();
      return { data: { session: true }, error: null };
    } catch (error) {
      return { data: null, error: toPublicError(error) };
    }
  };

  const signInWithGoogle = async () => ({
    data: null,
    error: {
      name: "GoogleNotConfigured",
      message: "Google sign-in is not configured yet.",
    },
  });

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
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
