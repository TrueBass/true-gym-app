from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class AvatarKey(enum.StrEnum):
    """The nine avatars a user can pick, worst-to-best.

    A closed set as a database type, because it is one: the artwork ships inside
    the app, so a key the client doesn't know renders as nothing. Postgres
    rejecting an unknown value is better than a broken picture.

    These are the keys, never the pictures — `mobile/src/avatars.js` decides
    what each one looks like, and redrawing an avatar has to stay a change no
    migration hears about. Adding a tenth means ALTER TYPE ... ADD VALUE; that
    is deliberate friction, since every stored row keeps pointing at these.
    """

    HERE_TO_GAIN = "here_to_gain"
    HERE_TO_LOSE = "here_to_lose"
    WARMING_UP = "warming_up"
    CASUAL = "casual"
    REGULAR = "regular"
    CONSISTENT = "consistent"
    ADVANCED = "advanced"
    BATMAN = "batman"
    UNIT = "unit"


class PingStatus(enum.StrEnum):
    """Where an invitation stands.

    An enum rather than a table, unlike the avatars: these are states the code
    branches on, not rows anyone would add to. A tenth status would mean new
    behaviour, and no INSERT can supply that.
    """

    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # 3-20 characters of [a-zA-Z0-9._-], enforced in the schemas. Stored as the
    # user typed it and displayed that way; compared folded (see the index below).
    username: Mapped[str] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    # Body attributes rather than measurements: they change rarely and have one
    # current value, so they belong to the account. A starting weight is not
    # here — that is a reading, and it goes in `weights` with every other one,
    # which is what lets the trend series start at signup.
    #
    # Both nullable: signup asks for them, but a screen can be skipped and
    # accounts predating them have none.
    height_cm: Mapped[Decimal | None] = mapped_column(Numeric(4, 1), nullable=True)
    goal_weight_kg: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    # values_callable stores "batman" rather than SQLAlchemy's default of the
    # member name, "BATMAN" — the column should read as the same string the app
    # and the API pass around, not a second spelling of it.
    avatar: Mapped[AvatarKey | None] = mapped_column(
        Enum(
            AvatarKey,
            name="avatar_key",
            values_callable=lambda enum_type: [m.value for m in enum_type],
        ),
        nullable=True,
    )
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


class Ping(Base):
    """An invitation to train together at a given time.

    One row, not one per side: the sender reads it as sent and the recipient as
    received, and an answer lands in the single place both of them look. The
    on-device version had to keep two copies and mirror responses between them,
    which is a consistency problem this doesn't have.
    """

    __tablename__ = "pings"
    __table_args__ = (
        # The spam guard, as a constraint rather than a check in the service:
        # a check-then-insert races exactly when someone is hammering the
        # button, which is the case it exists for.
        UniqueConstraint("from_user_id", "to_user_id", "at", name="uq_ping_slot"),
        # Each tab reads one of these: mine, most recent first.
        Index("ix_pings_from_at", "from_user_id", "at"),
        Index("ix_pings_to_at", "to_user_id", "at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    from_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE")
    )
    to_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE")
    )
    # When the training is, not when the ping was sent — that's created_at.
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[PingStatus] = mapped_column(
        Enum(
            PingStatus,
            name="ping_status",
            values_callable=lambda enum_type: [m.value for m in enum_type],
        ),
        default=PingStatus.PENDING,
        server_default=PingStatus.PENDING.value,
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # foreign_keys has to be spelled out: two columns point at users, so
    # SQLAlchemy can't tell which side each relationship follows. Both are here
    # because every ping is rendered as the *other* person — their username and
    # avatar — and which one that is depends on who's asking.
    #
    # Deleting an account takes its pings in both directions with it, which the
    # ON DELETE CASCADE above does in the database rather than here.
    from_user: Mapped[User] = relationship(foreign_keys=[from_user_id])
    to_user: Mapped[User] = relationship(foreign_keys=[to_user_id])


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
