"""Changes to an account.

Anything touching identity or credentials — email, username, password, deleting
the account — is gated on the current password, the way the app's own screens
ask for it. An access token is not proof of presence; it can be an unlocked
phone left on a bench, and the password is the part only the owner knows.

Height and goal weight are not gated. They are numbers a user retypes when a
goal moves, and nothing is lost by whoever holds the phone changing them.
"""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import security
from app.errors import ConflictError, ForbiddenError
from app.models import User
from app.schemas import ProfileRequest, TokenPair
from app.services import auth, to_decimal


async def _authorize(session: AsyncSession, user: User, password: str) -> None:
    if not security.verify_password(user.password_hash, password):
        raise ForbiddenError("Current password is incorrect.")
    if security.needs_rehash(user.password_hash):
        user.password_hash = security.hash_password(password)
        await session.commit()


async def change_email(
    session: AsyncSession, user: User, *, new_email: str, current_password: str
) -> User:
    await _authorize(session, user, current_password)

    if new_email == user.email:
        raise ConflictError("That is already your email.")
    if await auth.find_by_email(session, new_email):
        raise ConflictError("An account with that email already exists.")

    user.email = new_email
    await _commit_handle_change(session, "An account with that email already exists.")
    return user


async def change_username(
    session: AsyncSession, user: User, *, username: str, current_password: str
) -> User:
    await _authorize(session, user, current_password)

    if username == user.username:
        raise ConflictError("That is already your username.")
    existing = await auth.find_by_username(session, username)
    # Matching yourself case-insensitively is a re-capitalisation, not a clash.
    if existing is not None and existing.id != user.id:
        raise ConflictError("That username is taken.")

    user.username = username
    await _commit_handle_change(session, "That username is taken.")
    return user


async def _commit_handle_change(session: AsyncSession, taken_message: str) -> None:
    """Commits a change to a unique handle, translating the race into the same
    message the check a moment earlier would have given."""
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ConflictError(taken_message) from None


async def update_profile(
    session: AsyncSession, user: User, changes: ProfileRequest
) -> User:
    """Set height and goal weight, either or both.

    A field left out of the request is left alone; a field sent as null is
    cleared. Without that distinction the screen that edits only the goal would
    wipe the height every time it saved.
    """
    sent = changes.model_fields_set
    if "height_cm" in sent:
        user.height_cm = to_decimal(changes.height_cm)
    if "goal_weight_kg" in sent:
        user.goal_weight_kg = to_decimal(changes.goal_weight_kg)

    await session.commit()
    return user


async def change_password(
    session: AsyncSession, user: User, *, current_password: str, new_password: str
) -> TokenPair:
    """Sets the new password and hands back a fresh session.

    Every other session is dropped, because "change my password" is what you do
    when you think someone else has it, and leaving their phone logged in would
    make the change theatre. This device gets a new pair in the response so the
    user isn't logged out of the app they are currently holding.
    """
    await _authorize(session, user, current_password)

    user.password_hash = security.hash_password(new_password)
    await session.commit()

    await auth.end_all_sessions(session, user.id)
    return await auth.issue_session(session, user)


async def delete_account(session: AsyncSession, user: User, password: str) -> None:
    """Removes the account and, by cascade, its records, weights and sessions."""
    await _authorize(session, user, password)
    await session.delete(user)
    await session.commit()
