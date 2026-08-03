"""Body weight log and the trends read off it."""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import NotFoundError
from app.models import Weight
from app.schemas import WeightOut, WeightStats
from app.services import to_decimal

# Below this, a difference is the scale disagreeing with itself rather than the
# body changing. Same threshold the app's trend badge uses.
FLAT_KG = 0.2

GAINING, LOSING, HOLDING = "gaining", "losing", "holding"


async def list_entries(session: AsyncSession, user_id: uuid.UUID) -> list[Weight]:
    """Newest first — the screen reads the first entry as the current weight,
    and draws the sparkline from the head of the list."""
    result = await session.scalars(
        select(Weight)
        .where(Weight.user_id == user_id)
        .order_by(Weight.recorded_at.desc(), Weight.id.desc())
    )
    return list(result)


async def add_entry(session: AsyncSession, user_id: uuid.UUID, kg: float) -> Weight:
    """Append a reading. There is no update: every trend is read off the series,
    so an edited entry would quietly rewrite history."""
    entry = Weight(user_id=user_id, weight_kg=to_decimal(kg))
    session.add(entry)
    await session.commit()
    return entry


async def delete_entry(
    session: AsyncSession, user_id: uuid.UUID, entry_id: int
) -> None:
    entry = await session.get(Weight, entry_id)
    if entry is None or entry.user_id != user_id:
        raise NotFoundError("That entry no longer exists.")
    await session.delete(entry)
    await session.commit()


def _kg(value: float | None) -> float | None:
    """Rounds off binary-float noise. Every weight is two decimals by
    definition of the column, so 79.8 - 80.1 is -0.3, not -0.29999999999999716,
    and nothing is lost by saying so."""
    return None if value is None else round(value, 2)


def _direction(delta: float) -> str:
    if delta > FLAT_KG:
        return GAINING
    if delta < -FLAT_KG:
        return LOSING
    return HOLDING


async def stats(session: AsyncSession, user_id: uuid.UUID) -> WeightStats:
    now = datetime.now(timezone.utc)
    mine = Weight.user_id == user_id

    # The two most recent readings answer "current" and "since last" together.
    recent = list(
        await session.execute(
            select(Weight)
            .where(mine)
            .order_by(Weight.recorded_at.desc(), Weight.id.desc())
            .limit(2)
        )
    )
    if not recent:
        return WeightStats(
            latest=None,
            entry_count=0,
            since_last=None,
            since_start=None,
            seven_day_average=None,
            seven_day_entries=0,
            thirty_day_average=None,
            thirty_day_entries=0,
            trend=None,
            trend_delta=None,
        )

    latest = recent[0][0]
    previous = recent[1][0] if len(recent) > 1 else None
    first = await session.scalar(
        select(Weight)
        .where(mine)
        .order_by(Weight.recorded_at.asc(), Weight.id.asc())
        .limit(1)
    )
    entry_count = await session.scalar(
        select(func.count()).select_from(Weight).where(mine)
    )

    # One month of readings, averaged in Python: it is at most a few dozen rows,
    # and two SQL aggregates over overlapping windows would cost the same trip.
    cutoff_30 = now - timedelta(days=30)
    cutoff_7 = now - timedelta(days=7)
    month = (
        await session.execute(
            select(Weight.weight_kg, Weight.recorded_at).where(
                mine, Weight.recorded_at >= cutoff_30
            )
        )
    ).all()

    values_30 = [float(kg) for kg, _ in month]
    values_7 = [float(kg) for kg, at in month if at >= cutoff_7]
    average_30 = sum(values_30) / len(values_30) if values_30 else None
    average_7 = sum(values_7) / len(values_7) if values_7 else None

    # Only meaningful once the month holds readings the week doesn't. Otherwise
    # both averages run over the same rows and the difference is zero because
    # the windows overlap, which would show as "holding" on a single weigh-in.
    trend = trend_delta = None
    if average_7 is not None and len(values_30) > len(values_7):
        trend_delta = average_7 - average_30
        trend = _direction(trend_delta)

    latest_kg = float(latest.weight_kg)
    return WeightStats(
        latest=WeightOut.of(latest),
        entry_count=entry_count or 0,
        since_last=_kg(latest_kg - float(previous.weight_kg)) if previous else None,
        # None rather than 0.0 when there is only one entry: "no change yet" and
        # "back where you started" are different things to show.
        since_start=(
            _kg(latest_kg - float(first.weight_kg))
            if first is not None and first is not latest
            else None
        ),
        seven_day_average=_kg(average_7),
        seven_day_entries=len(values_7),
        thirty_day_average=_kg(average_30),
        thirty_day_entries=len(values_30),
        trend=trend,
        trend_delta=_kg(trend_delta),
    )
