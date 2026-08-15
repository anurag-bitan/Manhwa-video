import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { sessionStorage } from "aws-amplify/utils";

const region = import.meta.env.VITE_COGNITO_REGION;
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
const googleEnabled = import.meta.env.VITE_COGNITO_GOOGLE_ENABLED === "true";
const cognitoDomain = String(import.meta.env.VITE_COGNITO_DOMAIN || "")
  .trim()
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");

if (!region || !userPoolId || !userPoolClientId) {
  throw new Error(
    "Cognito is not configured. Set VITE_COGNITO_REGION, " +
      "VITE_COGNITO_USER_POOL_ID, and VITE_COGNITO_CLIENT_ID.",
  );
}

if (!userPoolId.startsWith(`${region}_`)) {
  throw new Error("The Cognito user pool ID does not match VITE_COGNITO_REGION.");
}

if (googleEnabled && !cognitoDomain) {
  throw new Error(
    "Google sign-in is enabled but VITE_COGNITO_DOMAIN is not configured.",
  );
}

const browserOrigin = window.location.origin;
const oauthConfig = googleEnabled
  ? {
      domain: cognitoDomain,
      scopes: ["openid", "email", "profile"],
      redirectSignIn: [`${browserOrigin}/auth/callback`],
      redirectSignOut: [`${browserOrigin}/login`],
      responseType: "code",
    }
  : null;

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId,
      userPoolClientId,
      signUpVerificationMethod: "code",
      loginWith: {
        email: true,
        ...(oauthConfig ? { oauth: oauthConfig } : {}),
      },
    },
  },
});

// Limit token persistence to the current browser tab. The backend remains the
// authorization boundary and verifies every access token independently.
cognitoUserPoolsTokenProvider.setKeyValueStorage(sessionStorage);

export const cognitoConfig = {
  region,
  userPoolId,
  userPoolClientId,
  googleEnabled,
  cognitoDomain,
  redirectSignIn: `${browserOrigin}/auth/callback`,
  redirectSignOut: `${browserOrigin}/login`,
};
