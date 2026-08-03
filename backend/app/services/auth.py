"""Accounts and sessions.

A session is an access token plus a refresh token. The app has no "remember me"
checkbox — every login is remembered — so the refresh token is long-lived and
the client renews silently; the access token stays short so a leaked one is
worth little.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import security
from app.errors import AuthError, ConflictError
from app.models import RefreshToken, User
from app.schemas import TokenPair

# One message for every way a login can fail, so the form can't be used to find
# out which emails have accounts.
_BAD_CREDENTIALS = "Incorrect email or password."
_DEAD_SESSION = "Your session has expired. Please log in again."


async def find_by_email(session: AsyncSession, email: str) -> User | None:
    return await session.scalar(
        select(User).where(func.lower(User.email) == email.strip().lower())
    )


async def find_by_username(session: AsyncSession, username: str) -> User | None:
    return await session.scalar(
        select(User).where(func.lower(User.username) == username.strip().lower())
    )


async def sign_up(
    session: AsyncSession, *, username: str, email: str, password: str
) -> User:
    if await find_by_email(session, email):
        raise ConflictError("An account with that email already exists.")
    if await find_by_username(session, username):
        raise ConflictError("That username is taken.")

    user = User(
        username=username, email=email, password_hash=security.hash_password(password)
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        # Two signups for the same handle can both pass the checks above and
        # race to the insert; the unique indexes settle it, and the loser is
        # told the same thing it would have been told a moment earlier.
        await session.rollback()
        raise ConflictError("That username or email is already taken.") from None
    return user


async def authenticate(session: AsyncSession, *, email: str, password: str) -> User:
    user = await find_by_email(session, email)
    # Verified even when no user matched — see security._ABSENT_ACCOUNT_HASH.
    if not security.verify_password(user.password_hash if user else None, password):
        raise AuthError(_BAD_CREDENTIALS)
    assert user is not None  # unreachable otherwise: the dummy hash never matches

    if security.needs_rehash(user.password_hash):
        user.password_hash = security.hash_password(password)
        await session.commit()
    return user


async def issue_session(session: AsyncSession, user: User) -> TokenPair:
    access_token, expires_in = security.create_access_token(user.id)
    secret, token_hash = security.new_refresh_token()

    session.add(
        RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=security.refresh_expires_at(),
        )
    )
    await session.commit()

    return TokenPair(
        access_token=access_token, refresh_token=secret, expires_in=expires_in
    )


async def rotate_session(session: AsyncSession, refresh_token: str) -> TokenPair:
    """Spend a refresh token and hand back a new pair.

    Rotation means a stolen token is only useful until the real client refreshes
    once. What happens after that is the interesting part: the theft turns into
    two clients holding the same spent token, and whoever presents it second is
    caught below.
    """
    stored = await session.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == security.hash_refresh_token(refresh_token)
        )
    )
    if stored is None:
        raise AuthError(_DEAD_SESSION)

    now = datetime.now(timezone.utc)
    if stored.revoked_at is not None:
        # An already-spent token came back. Either it was stolen after use or a
        # copy of it was, and there is no way to tell which holder is genuine —
        # so end every session and make both sides log in.
        await end_all_sessions(session, stored.user_id)
        raise AuthError(_DEAD_SESSION)
    if stored.expires_at <= now:
        raise AuthError(_DEAD_SESSION)

    user = await session.get(User, stored.user_id)
    if user is None:
        raise AuthError(_DEAD_SESSION)

    stored.revoked_at = now
    return await issue_session(session, user)


async def end_session(session: AsyncSession, refresh_token: str) -> None:
    """Log out.

    The row is deleted rather than revoked, and that difference is load-bearing:
    a revoked row that comes back means a token was spent twice, which is the
    theft signal above. A logged-out client that retries its refresh once — an
    ordinary race — would trip that signal and log the user out everywhere. A
    deleted row simply reads as unknown, so the retry gets a plain 401 and the
    user's other devices are left alone. The token is equally dead either way.

    Unknown tokens pass silently: the client is leaving regardless, and an error
    would only confirm which tokens exist.
    """
    await session.execute(
        delete(RefreshToken).where(
            RefreshToken.token_hash == security.hash_refresh_token(refresh_token)
        )
    )
    await session.commit()


async def end_all_sessions(session: AsyncSession, user_id: uuid.UUID) -> None:
    """Log a user out everywhere — after a password change, and after the theft
    signal above.

    Deletes rather than revokes, for the same reason logging out does. A
    password change is followed by the user's other phone waking up and
    refreshing on its own; if that met a revoked row it would read as a token
    spent twice, and the cascade would log the user out of the device they are
    holding. A deleted row is simply unknown, so the other phone gets a plain
    401 and stops there. Only rotation leaves revoked rows behind, which is what
    keeps them meaningful as a theft signal.
    """
    await session.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))
    await session.commit()
