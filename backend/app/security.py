"""Password hashing and token minting. Nothing here touches the database."""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import Argon2Error

from app.config import settings

_hasher = PasswordHasher()

# Verified against when no account matched, so a failed login costs the same
# time as a successful one. Without it "no such email" returns in microseconds
# while a real email takes ~50ms, and that gap tells an attacker which emails
# are registered — exactly what the app's vague error message exists to hide.
_ABSENT_ACCOUNT_HASH = _hasher.hash("no-account-has-this-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    """True if the password matches. `None` burns the same time and fails."""
    try:
        return _hasher.verify(password_hash or _ABSENT_ACCOUNT_HASH, password)
    except Argon2Error:
        return False


def needs_rehash(password_hash: str) -> bool:
    """True when a hash predates the current argon2 parameters, so a successful
    login can quietly upgrade it."""
    return _hasher.check_needs_rehash(password_hash)


def create_access_token(user_id: uuid.UUID) -> tuple[str, int]:
    """The signed token and its lifetime in seconds — the client needs the
    lifetime to know when to refresh."""
    ttl = timedelta(minutes=settings.access_token_ttl_minutes)
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "iat": now, "exp": now + ttl, "typ": "access"}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, int(ttl.total_seconds())


def read_access_token(token: str) -> uuid.UUID | None:
    """The user id inside a valid, unexpired access token, else None."""
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        # Refresh tokens are opaque and never reach this function, but check the
        # claim rather than trusting that to stay true.
        if payload.get("typ") != "access":
            return None
        return uuid.UUID(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        return None


def new_refresh_token() -> tuple[str, str]:
    """A refresh token as (secret, hash). The secret goes to the client and is
    never stored; the hash is all the database keeps.

    Unlike the access token it carries no claims — it is pure randomness, which
    is what lets it be revoked, and revocation is the point of storing it.
    """
    secret = secrets.token_urlsafe(48)
    return secret, hash_refresh_token(secret)


def hash_refresh_token(secret: str) -> str:
    """Plain SHA-256 rather than argon2: there is no weak human-chosen password
    here to slow a guesser down for, just 384 bits of randomness, and lookups
    happen on every token refresh."""
    return hashlib.sha256(secret.encode()).hexdigest()


def refresh_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_ttl_days)
