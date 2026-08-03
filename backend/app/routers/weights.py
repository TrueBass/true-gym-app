from fastapi import APIRouter, status

from app.deps import CurrentUser, SessionDep
from app.schemas import WeightIn, WeightOut, WeightStats
from app.services import weights

router = APIRouter(prefix="/weights", tags=["weights"])


@router.get("", response_model=list[WeightOut])
async def list_weights(user: CurrentUser, session: SessionDep) -> list[WeightOut]:
    entries = await weights.list_entries(session, user.id)
    return [WeightOut.of(entry) for entry in entries]


# Declared before /{entry_id} so "stats" is read as this route and not as an id.
@router.get("/stats", response_model=WeightStats)
async def weight_stats(user: CurrentUser, session: SessionDep) -> WeightStats:
    """Current weight, the deltas the screen shows, and 7/30-day averages."""
    return await weights.stats(session, user.id)


@router.post("", response_model=WeightOut, status_code=status.HTTP_201_CREATED)
async def add_weight(
    body: WeightIn, user: CurrentUser, session: SessionDep
) -> WeightOut:
    entry = await weights.add_entry(session, user.id, body.kg)
    return WeightOut.of(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_weight(entry_id: int, user: CurrentUser, session: SessionDep) -> None:
    await weights.delete_entry(session, user.id, entry_id)
