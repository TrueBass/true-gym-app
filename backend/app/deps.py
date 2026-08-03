"""Shared FastAPI dependencies."""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AuthError
from app.models import User
from app.security import read_access_token

SessionDep = Annotated[AsyncSession, Depends(get_session)]

# auto_error=False so a missing header lands in the handler below and comes back
# in the same {"detail": ...} shape as every other failure the app renders.
_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise AuthError("Not signed in.")

    user_id = read_access_token(credentials.credentials)
    if user_id is None:
        raise AuthError("Your session has expired. Please log in again.")

    user = await session.get(User, user_id)
    if user is None:
        # Signed token, deleted account: the token stays valid until it expires,
        # so the account going away has to be caught here.
        raise AuthError("Account not found.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
