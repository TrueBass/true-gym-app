from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # 3-20 characters of [a-zA-Z0-9._-], enforced in the schemas. Stored as the
    # user typed it and displayed that way; compared folded (see the index below).
    username: Mapped[str] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    personal_records: Mapped[list[PersonalRecord]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    weights: Mapped[list[Weight]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


# Both handles are unique case-insensitively. A username is the handle friends
# ping, so if "Alex" and "alex" could coexist a ping would have two possible
# recipients. Emails are stored already lowercased, which a plain unique column
# would cover; folding it here too keeps one rule for both and holds even if a
# row ever slips in unfolded.
Index("uq_users_username_lower", func.lower(User.username), unique=True)
Index("uq_users_email_lower", func.lower(User.email), unique=True)


class PersonalRecord(Base):
    """A user's best lift per exercise. One row per (user, exercise) — saving
    the same exercise again replaces the weight instead of adding a row."""

    __tablename__ = "personal_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    # No index of its own: the unique index below leads with user_id, which
    # covers every "this user's records" lookup and the foreign key too.
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE")
    )
    exercise: Mapped[str] = mapped_column(String(100))
    weight_kg: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="personal_records")


# Exercises are matched case-insensitively, so "Bench press" and "bench press"
# are the same record — whichever spelling was saved first keeps being shown.
Index(
    "uq_personal_records_user_exercise",
    PersonalRecord.user_id,
    func.lower(PersonalRecord.exercise),
    unique=True,
)


class Weight(Base):
    """One body-weight reading. Append-only: every trend on the weight screen is
    derived from the series, so editing a past entry would rewrite history."""

    __tablename__ = "weights"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE")
    )
    weight_kg: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="weights")


# Every read of this table is "this user's entries, newest first" — as one index
# that is a range scan rather than a scan-and-sort. Leading with user_id also
# makes it serve the foreign key, so the column needs no index of its own.
Index("ix_weights_user_recorded", Weight.user_id, Weight.recorded_at.desc())


class RefreshToken(Base):
    """One row per issued refresh token. Only the SHA-256 of the token is kept,
    so the database never holds anything that could resume a session.

    Used rows are revoked rather than deleted: a revoked token coming back is
    how a stolen one gives itself away."""

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="refresh_tokens")
