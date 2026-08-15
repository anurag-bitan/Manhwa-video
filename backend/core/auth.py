"""Cognito JWT verification for protected FastAPI routes."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import hmac
import logging
import re
from typing import Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import (
    InvalidTokenError,
    PyJWKClientConnectionError,
    PyJWKClientError,
)

from core.config import settings


logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


class AuthenticationConfigurationError(RuntimeError):
    """Raised when the backend's Cognito settings are absent or unsafe."""


@dataclass(frozen=True)
class AuthenticatedUser:
    """Identity derived only from a verified Cognito access token."""

    sub: str
    username: str | None
    groups: tuple[str, ...]
    claims: dict[str, Any]


class CognitoTokenVerifier:
    """Verify Cognito access-token signatures and authorization claims."""

    def __init__(
        self,
        region: str,
        user_pool_id: str,
        app_client_id: str,
        issuer: str = "",
    ):
        region = region.strip()
        user_pool_id = user_pool_id.strip()
        app_client_id = app_client_id.strip()

        if not region or not user_pool_id or not app_client_id:
            raise AuthenticationConfigurationError(
                "COGNITO_REGION, COGNITO_USER_POOL_ID, and "
                "COGNITO_APP_CLIENT_ID must all be configured."
            )
        if not re.fullmatch(r"[a-z]{2}(?:-gov)?-[a-z]+-\d", region):
            raise AuthenticationConfigurationError("COGNITO_REGION is invalid.")
        if not re.fullmatch(r"[A-Za-z0-9-]+_[A-Za-z0-9]+", user_pool_id):
            raise AuthenticationConfigurationError("COGNITO_USER_POOL_ID is invalid.")
        if not user_pool_id.startswith(f"{region}_"):
            raise AuthenticationConfigurationError(
                "COGNITO_USER_POOL_ID does not belong to COGNITO_REGION."
            )
        if not re.fullmatch(r"[A-Za-z0-9]+", app_client_id):
            raise AuthenticationConfigurationError(
                "COGNITO_APP_CLIENT_ID is invalid."
            )

        original_issuer = (
            f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}"
        )
        updated_issuer = (
            f"https://issuer-cognito-idp.{region}.amazonaws.com/{user_pool_id}"
        )
        configured_issuer = issuer.strip().rstrip("/")
        if configured_issuer and configured_issuer not in {
            original_issuer,
            updated_issuer,
        }:
            raise AuthenticationConfigurationError(
                "COGNITO_ISSUER does not match the configured pool."
            )

        self.app_client_id = app_client_id
        self.issuer = configured_issuer or original_issuer
        self.jwks_url = f"{self.issuer}/.well-known/jwks.json"
        self._jwks_client = PyJWKClient(
            self.jwks_url,
            cache_keys=True,
            max_cached_keys=16,
            cache_jwk_set=True,
            lifespan=3600,
        )

    def verify(self, token: str) -> dict[str, Any]:
        if not token or len(token) > 16_384:
            raise InvalidTokenError("Malformed access token")

        signing_key = self._jwks_client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=self.issuer,
            leeway=30,
            options={
                # Cognito access tokens identify the app client with client_id,
                # not the ID token's aud claim.
                "verify_aud": False,
                "require": [
                    "client_id",
                    "exp",
                    "iat",
                    "iss",
                    "sub",
                    "token_use",
                ],
            },
        )

        client_id = claims.get("client_id")
        token_use = claims.get("token_use")
        subject = claims.get("sub")
        if not isinstance(client_id, str) or not hmac.compare_digest(
            client_id, self.app_client_id
        ):
            raise InvalidTokenError("Access token has the wrong app client")
        if token_use != "access":
            raise InvalidTokenError("An access token is required")
        if not isinstance(subject, str) or not subject:
            raise InvalidTokenError("Access token has no subject")

        return claims


@lru_cache(maxsize=1)
def get_cognito_verifier() -> CognitoTokenVerifier:
    return CognitoTokenVerifier(
        region=settings.cognito_region,
        user_pool_id=settings.cognito_user_pool_id,
        app_client_id=settings.cognito_app_client_id,
        issuer=settings.cognito_issuer,
    )


def _unauthorized(detail: str = "Invalid or expired access token") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthenticatedUser:
    if credentials is None:
        raise _unauthorized("Authentication required")

    try:
        verifier = get_cognito_verifier()
    except AuthenticationConfigurationError:
        logger.exception("Cognito authentication is not configured correctly")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is not configured",
        )

    try:
        claims = await run_in_threadpool(verifier.verify, credentials.credentials)
    except PyJWKClientConnectionError:
        logger.exception("Could not retrieve Cognito signing keys")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is temporarily unavailable",
        )
    except (InvalidTokenError, PyJWKClientError, ValueError, TypeError):
        raise _unauthorized()

    raw_groups = claims.get("cognito:groups", [])
    groups = (
        tuple(group for group in raw_groups if isinstance(group, str))
        if isinstance(raw_groups, list)
        else ()
    )
    username = claims.get("username")

    return AuthenticatedUser(
        sub=claims["sub"],
        username=username if isinstance(username, str) else None,
        groups=groups,
        claims=claims,
    )
