from fastapi import APIRouter, status

from app.deps import CurrentUser, SessionDep
from app.schemas import PingCreate, PingOut, PingRespond
from app.services import pings

router = APIRouter(prefix="/pings", tags=["pings"])


@router.get("/received", response_model=list[PingOut])
async def list_received(user: CurrentUser, session: SessionDep) -> list[PingOut]:
    """Invitations sent to this user — who they'd be training with, and when."""
    return [
        PingOut.of(ping, viewer_id=user.id)
        for ping in await pings.received(session, user.id)
    ]


@router.get("/sent", response_model=list[PingOut])
async def list_sent(user: CurrentUser, session: SessionDep) -> list[PingOut]:
    """Invitations this user sent, and what came of them."""
    return [
        PingOut.of(ping, viewer_id=user.id)
        for ping in await pings.sent(session, user.id)
    ]


@router.post("", response_model=PingOut, status_code=status.HTTP_201_CREATED)
async def send_ping(
    body: PingCreate, user: CurrentUser, session: SessionDep
) -> PingOut:
    """Invite someone to train at a given time.

    By username, which is what the sender typed and what uniquely identifies an
    account. The same person cannot be invited to the same slot twice — a second
    identical ping is the first one sent again, not a new invitation.
    """
    ping = await pings.send(session, user, username=body.username, at=body.at)
    return PingOut.of(ping, viewer_id=user.id)


@router.patch("/{ping_id}", response_model=PingOut)
async def respond_to_ping(
    ping_id: int, body: PingRespond, user: CurrentUser, session: SessionDep
) -> PingOut:
    """Accept or decline an invitation. Only the recipient can answer, and they
    may change that answer — plans fall through."""
    ping = await pings.respond(session, user, ping_id, body.status)
    return PingOut.of(ping, viewer_id=user.id)


@router.delete("/{ping_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_ping(ping_id: int, user: CurrentUser, session: SessionDep) -> None:
    """Withdraw an invitation. The sender's to take back — a recipient declines
    instead, which the sender can see."""
    await pings.cancel(session, user, ping_id)
