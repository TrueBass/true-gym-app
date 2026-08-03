from fastapi import APIRouter, status

from app.deps import CurrentUser, SessionDep
from app.schemas import (
    AuthResponse,
    LogInRequest,
    RefreshRequest,
    SignUpRequest,
    TokenPair,
    UserOut,
)
from app.services import auth

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def sign_up(body: SignUpRequest, session: SessionDep) -> AuthResponse:
    """Create an account and start a session — signing up logs you in, which is
    what the app's single form already assumes."""
    user = await auth.sign_up(
        session,
        username=body.username,
        email=body.email,
        password=body.password,
        height_cm=body.height_cm,
        goal_weight_kg=body.goal_weight_kg,
        weight_kg=body.weight_kg,
    )
    return AuthResponse(user=UserOut.model_validate(user), tokens=await auth.issue_session(session, user))


@router.post("/login", response_model=AuthResponse)
async def log_in(body: LogInRequest, session: SessionDep) -> AuthResponse:
    user = await auth.authenticate(session, email=body.email, password=body.password)
    return AuthResponse(user=UserOut.model_validate(user), tokens=await auth.issue_session(session, user))


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest, session: SessionDep) -> TokenPair:
    """Trade a refresh token for a new pair. Deliberately unauthenticated: the
    access token is expected to be expired by the time this is called."""
    return await auth.rotate_session(session, body.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def log_out(body: RefreshRequest, session: SessionDep) -> None:
    """Ends the session the refresh token belongs to, not every session — other
    devices stay logged in."""
    await auth.end_session(session, body.refresh_token)


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> UserOut:
    """Who the access token belongs to. The app calls this on launch to restore
    the session, in place of the local lookup it does today."""
    return UserOut.model_validate(user)
