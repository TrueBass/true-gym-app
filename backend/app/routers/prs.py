from fastapi import APIRouter, status

from app.deps import CurrentUser, SessionDep
from app.schemas import PersonalRecordIn, PersonalRecordOut
from app.services import prs

router = APIRouter(prefix="/prs", tags=["prs"])


@router.get("", response_model=list[PersonalRecordOut])
async def list_prs(user: CurrentUser, session: SessionDep) -> list[PersonalRecordOut]:
    records = await prs.list_records(session, user.id)
    return [PersonalRecordOut.of(record) for record in records]


@router.post("", response_model=PersonalRecordOut)
async def save_pr(
    body: PersonalRecordIn, user: CurrentUser, session: SessionDep
) -> PersonalRecordOut:
    """Save a record. One endpoint for adding and for editing, because the
    exercise name identifies the record — posting an exercise that already has
    one replaces its weight instead of creating a second.
    """
    record = await prs.save_record(
        session, user.id, exercise=body.exercise, weight=body.weight
    )
    return PersonalRecordOut.of(record)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pr(record_id: int, user: CurrentUser, session: SessionDep) -> None:
    await prs.delete_record(session, user.id, record_id)
