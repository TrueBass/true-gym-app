from fastapi import APIRouter, status

from app.deps import CurrentUser, SessionDep
from app.schemas import (
    AuthResponse,
    ChangeEmailRequest,
    ChangePasswordRequest,
    ChangeUsernameRequest,
    DeleteAccountRequest,
    ProfileRequest,
    UserOut,
)
from app.services import account

router = APIRouter(prefix="/account", tags=["account"])


@router.patch("/email", response_model=UserOut)
async def change_email(
    body: ChangeEmailRequest, user: CurrentUser, session: SessionDep
) -> UserOut:
    updated = await account.change_email(
        session, user, new_email=body.new_email, current_password=body.current_password
    )
    return UserOut.model_validate(updated)


@router.patch("/username", response_model=UserOut)
async def change_username(
    body: ChangeUsernameRequest, user: CurrentUser, session: SessionDep
) -> UserOut:
    """No screen calls this yet — the app's account page has rows for email and
    password only. The rule it enforces is already written down in storage.js,
    so the endpoint exists rather than waiting to be reverse-engineered later.
    """
    updated = await account.change_username(
        session, user, username=body.username, current_password=body.current_password
    )
    return UserOut.model_validate(updated)


@router.patch("/profile", response_model=UserOut)
async def update_profile(
    body: ProfileRequest, user: CurrentUser, session: SessionDep
) -> UserOut:
    """Height and goal weight. Send only the field you're changing — an omitted
    one keeps its value, and an explicit null clears it.

    No current password here, unlike the routes above: these aren't credentials.
    """
    updated = await account.update_profile(session, user, body)
    return UserOut.model_validate(updated)


@router.patch("/password", response_model=AuthResponse)
async def change_password(
    body: ChangePasswordRequest, user: CurrentUser, session: SessionDep
) -> AuthResponse:
    """Returns a new token pair along with the user: changing the password ends
    every session, and without a replacement that would include this one."""
    tokens = await account.change_password(
        session,
        user,
        current_password=body.current_password,
        new_password=body.new_password,
    )
    return AuthResponse(user=UserOut.model_validate(user), tokens=tokens)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    body: DeleteAccountRequest, user: CurrentUser, session: SessionDep
) -> None:
    await account.delete_account(session, user, body.password)
