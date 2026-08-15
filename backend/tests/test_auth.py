from types import SimpleNamespace
import time
import unittest

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.exceptions import InvalidTokenError

from core.auth import CognitoTokenVerifier


REGION = "eu-north-1"
USER_POOL_ID = "eu-north-1_TestPool123"
APP_CLIENT_ID = "testclient123"


class StaticJwkClient:
    def __init__(self, public_key):
        self.public_key = public_key

    def get_signing_key_from_jwt(self, _token):
        return SimpleNamespace(key=self.public_key)


class CognitoTokenVerifierTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        cls.public_key = cls.private_key.public_key()

    def setUp(self):
        self.verifier = CognitoTokenVerifier(
            REGION,
            USER_POOL_ID,
            APP_CLIENT_ID,
        )
        self.verifier._jwks_client = StaticJwkClient(self.public_key)

    def make_token(self, **overrides):
        now = int(time.time())
        claims = {
            "sub": "cognito-subject-123",
            "iss": self.verifier.issuer,
            "client_id": APP_CLIENT_ID,
            "token_use": "access",
            "iat": now,
            "exp": now + 900,
            "username": "test-user",
        }
        claims.update(overrides)
        return jwt.encode(
            claims,
            self.private_key,
            algorithm="RS256",
            headers={"kid": "test-key"},
        )

    def test_accepts_valid_access_token(self):
        claims = self.verifier.verify(self.make_token())
        self.assertEqual(claims["sub"], "cognito-subject-123")

    def test_rejects_id_token(self):
        with self.assertRaises(InvalidTokenError):
            self.verifier.verify(self.make_token(token_use="id"))

    def test_rejects_token_for_another_app_client(self):
        with self.assertRaises(InvalidTokenError):
            self.verifier.verify(self.make_token(client_id="anotherclient"))


if __name__ == "__main__":
    unittest.main()
