"""Personal records — one per exercise, per user."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import NotFoundError
from app.models import PersonalRecord
from app.services import to_decimal


async def list_records(
    session: AsyncSession, user_id: uuid.UUID
) -> list[PersonalRecord]:
    """Newest record first, which is where the app puts a new one.

    Ordered by when the record was created rather than last changed, so editing
    an old lift doesn't make it jump to the top of a list the user knows.
    """
    result = await session.scalars(
        select(PersonalRecord)
        .where(PersonalRecord.user_id == user_id)
        .order_by(PersonalRecord.created_at.desc(), PersonalRecord.id.desc())
    )
    return list(result)


async def _find(
    session: AsyncSession, user_id: uuid.UUID, exercise: str
) -> PersonalRecord | None:
    return await session.scalar(
        select(PersonalRecord).where(
            PersonalRecord.user_id == user_id,
            func.lower(PersonalRecord.exercise) == exercise.lower(),
        )
    )


async def save_record(
    session: AsyncSession, user_id: uuid.UUID, *, exercise: str, weight: float
) -> PersonalRecord:
    """Create the record for this exercise, or replace its weight.

    Idempotent by exercise name, matched case-insensitively — the app's screen
    has one Save button for both "new PR" and "I lifted more", and its inline
    edit sends a whole record rather than a patch.
    """
    weight_kg = to_decimal(weight)
    existing = await _find(session, user_id, exercise)

    if existing is None:
        record = PersonalRecord(
            user_id=user_id, exercise=exercise, weight_kg=weight_kg
        )
        session.add(record)
        try:
            await session.commit()
        except IntegrityError:
            # Two saves for the same exercise raced; the unique index picked a
            # winner. The row exists now, so take the update path instead.
            await session.rollback()
            existing = await _find(session, user_id, exercise)
            if existing is None:  # pragma: no cover - the index says otherwise
                raise
        else:
            return record

    # Saving "bench press" over "Bench Press" adopts the new spelling: the app
    # offers no other way to fix a name, since the row's own name is read-only.
    changed = existing.weight_kg != weight_kg or existing.exercise != exercise
    if changed:
        existing.exercise = exercise
        existing.weight_kg = weight_kg
        await session.commit()
        # updated_at is set by the database, so the in-memory row is stale the
        # moment the UPDATE lands. Reading it would otherwise fire a lazy
        # refresh, which asyncio can't do implicitly — an explicit one here is
        # the difference between a response and a MissingGreenlet.
        await session.refresh(existing)
    # Nothing changed, so updated_at stays put — it is the date on the row, and
    # re-saving the same number shouldn't make an old record look fresh.
    return existing


async def delete_record(
    session: AsyncSession, user_id: uuid.UUID, record_id: int
) -> None:
    record = await session.get(PersonalRecord, record_id)
    # Someone else's record is reported missing rather than forbidden: whether
    # an id exists is not this user's business.
    if record is None or record.user_id != user_id:
        raise NotFoundError("That record no longer exists.")
    await session.delete(record)
    await session.commit()
