"""Training invitations between two accounts."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.errors import ConflictError, DomainError, NotFoundError
from app.models import Ping, PingStatus, User
from app.services import auth

# Both sides of every ping are loaded up front. A list of twenty rendered as
# "@sam at 18:00" would otherwise be twenty extra queries, and under asyncio a
# lazy load isn't slow — it raises.
_WITH_USERS = (selectinload(Ping.from_user), selectinload(Ping.to_user))


def _ensure_aware(at: datetime) -> datetime:
    """A time without a zone is read as UTC.

    The app sends ISO strings ending in Z, so this is a guard for other callers
    rather than a conversion anyone should rely on.
    """
    return at if at.tzinfo is not None else at.replace(tzinfo=timezone.utc)


async def send(
    session: AsyncSession, sender: User, *, username: str, at: datetime
) -> Ping:
    # Truncated to the minute, which is the resolution people actually pick and
    # the one the spam guard has to work at. Kept to the microsecond, two pings
    # a second apart are different slots to the unique constraint and the same
    # slot to everyone reading them.
    at = _ensure_aware(at).replace(second=0, microsecond=0)
    if at <= datetime.now(timezone.utc):
        raise DomainError("Pick a time in the future.")

    recipient = await auth.find_by_username(session, username)
    if recipient is None:
        # The username is a handle people share, so confirming one exists gives
        # nothing away that @-mentioning them wouldn't.
        raise NotFoundError(f"No user called @{username.lstrip('@')}.")
    if recipient.id == sender.id:
        raise ConflictError("You can't ping yourself.")

    # Read now, used after the rollback below: rolling back expires every loaded
    # object, and reading an attribute off one then triggers a lazy refresh that
    # asyncio can't service — the failure lands as a 500 on top of the 409.
    handle = recipient.username

    ping = Ping(from_user_id=sender.id, to_user_id=recipient.id, at=at)
    session.add(ping)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ConflictError(f"You've already pinged @{handle} for that time.") from None

    # Reloaded with both users attached, since the response renders one of them.
    return await _get(session, ping.id)


async def _get(session: AsyncSession, ping_id: int) -> Ping:
    ping = await session.scalar(
        select(Ping).where(Ping.id == ping_id).options(*_WITH_USERS)
    )
    if ping is None:
        raise NotFoundError("That ping no longer exists.")
    return ping


async def _listed(session: AsyncSession, where) -> list[Ping]:
    result = await session.scalars(
        select(Ping).where(where).options(*_WITH_USERS).order_by(Ping.at.desc())
    )
    return list(result)


async def sent(session: AsyncSession, user_id: uuid.UUID) -> list[Ping]:
    """Invitations this user sent, latest training time first."""
    return await _listed(session, Ping.from_user_id == user_id)


async def received(session: AsyncSession, user_id: uuid.UUID) -> list[Ping]:
    """Invitations to this user. Same ordering as the sent tab, so the two tabs
    read the same way — where to split upcoming from past is the client's call,
    since only it knows the device's clock and timezone."""
    return await _listed(session, Ping.to_user_id == user_id)


async def respond(
    session: AsyncSession, user: User, ping_id: int, status: str
) -> Ping:
    """Accept or decline. Only the recipient can, and a ping they can't see is
    reported missing rather than forbidden — the sender's copy is not theirs to
    answer, and ids are not worth confirming."""
    ping = await session.scalar(
        select(Ping)
        .where(Ping.id == ping_id, Ping.to_user_id == user.id)
        .options(*_WITH_USERS)
    )
    if ping is None:
        raise NotFoundError("That ping no longer exists.")

    # Answering twice is allowed: plans change, and an accepted invitation the
    # user can no longer make is exactly the one they need to take back.
    ping.status = PingStatus(status)
    ping.responded_at = datetime.now(timezone.utc)
    await session.commit()
    return ping


async def cancel(session: AsyncSession, user: User, ping_id: int) -> None:
    """Withdraw a ping. The sender's to take back; the recipient declines
    instead, which is an answer rather than an erasure."""
    ping = await session.scalar(
        select(Ping).where(Ping.id == ping_id, Ping.from_user_id == user.id)
    )
    if ping is None:
        raise NotFoundError("That ping no longer exists.")
    await session.delete(ping)
    await session.commit()
