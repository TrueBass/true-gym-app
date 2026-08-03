"""Request and response shapes.

Everything serialises as camelCase, because the client that consumes it is
JavaScript — `accessToken`, not `access_token`. Requests accept either spelling.
"""

import re
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Annotated

from email_validator import EmailNotValidError, validate_email
from pydantic import AfterValidator, BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

# Same rule the app enforces on its own signup form.
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9._-]{3,20}$")
MIN_PASSWORD_LENGTH = 6
# Argon2 is happy with any length; the cap is so a megabyte of "password" can't
# be used to make the server do expensive work.
MAX_PASSWORD_LENGTH = 128
# Both match their columns: personal_records.exercise is VARCHAR(100) and
# weight_kg is NUMERIC(6, 2).
MAX_EXERCISE_LENGTH = 100
MAX_LIFT_KG = 9999.99
# weights.weight_kg is NUMERIC(5, 2) — a body weight, not a barbell.
MAX_BODY_WEIGHT_KG = 999.99

if TYPE_CHECKING:
    from app.models import PersonalRecord, Weight


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, from_attributes=True
    )


def _clean_username(value: str) -> str:
    """The app tolerates a typed-in leading @, so the API does too."""
    cleaned = value.strip().lstrip("@")
    if not USERNAME_PATTERN.match(cleaned):
        raise ValueError(
            "Usernames are 3-20 characters: letters, numbers, dot, dash or underscore."
        )
    return cleaned


def _clean_email(value: str) -> str:
    try:
        parsed = validate_email(value.strip(), check_deliverability=False)
    except EmailNotValidError:
        # Deliberately vaguer than the library's own message, which explains
        # rather more about parsing than a signup form needs to.
        raise ValueError("Enter a valid email address.") from None
    # Stored folded, so an address can only ever belong to one account.
    return parsed.normalized.lower()


def _check_password(value: str) -> str:
    if len(value) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")
    if len(value) > MAX_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at most {MAX_PASSWORD_LENGTH} characters.")
    return value


Username = Annotated[str, AfterValidator(_clean_username)]
Email = Annotated[str, AfterValidator(_clean_email)]
Password = Annotated[str, AfterValidator(_check_password)]


class SignUpRequest(ApiModel):
    username: Username
    email: Email
    password: Password


class LogInRequest(ApiModel):
    # Not the `Email` type: an existing account's address is matched, not
    # created, and a stricter parser than the one that accepted it would lock
    # the owner out. Folding is all this needs.
    email: str
    password: str


class RefreshRequest(ApiModel):
    refresh_token: str


class UserOut(ApiModel):
    id: uuid.UUID
    username: str
    email: str


class TokenPair(ApiModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    # Seconds until the access token expires, so the client can refresh ahead of
    # time instead of finding out through a 401.
    expires_in: int


class AuthResponse(ApiModel):
    user: UserOut
    tokens: TokenPair


class ChangeEmailRequest(ApiModel):
    new_email: Email
    current_password: str


class ChangeUsernameRequest(ApiModel):
    username: Username
    current_password: str


class ChangePasswordRequest(ApiModel):
    current_password: str
    new_password: Password


class DeleteAccountRequest(ApiModel):
    password: str


def _clean_exercise(value: str) -> str:
    cleaned = " ".join(value.split())  # collapse stray double spaces while trimming
    if not cleaned:
        raise ValueError("Enter an exercise name.")
    if len(cleaned) > MAX_EXERCISE_LENGTH:
        raise ValueError(
            f"Exercise names are at most {MAX_EXERCISE_LENGTH} characters."
        )
    return cleaned


def _check_lift(value: float) -> float:
    if value <= 0:
        raise ValueError("Enter a weight greater than 0.")
    if value > MAX_LIFT_KG:
        raise ValueError("That weight looks too large.")
    return value


Exercise = Annotated[str, AfterValidator(_clean_exercise)]
# Bounded by the column, not by opinion: weight_kg is NUMERIC(6, 2), and a
# larger number would fail in the driver as a 500 rather than as a sentence the
# user can read.
Lift = Annotated[float, AfterValidator(_check_lift)]


class PersonalRecordIn(ApiModel):
    exercise: Exercise
    weight: Lift


class PersonalRecordOut(ApiModel):
    id: int
    exercise: str
    weight: float
    updated_at: datetime

    @classmethod
    def of(cls, record: "PersonalRecord") -> "PersonalRecordOut":
        # Built by hand rather than from attributes: the column is weight_kg and
        # carries a Decimal, while the app reads `weight` and expects a number.
        return cls(
            id=record.id,
            exercise=record.exercise,
            weight=float(record.weight_kg),
            updated_at=record.updated_at,
        )


def _check_body_weight(value: float) -> float:
    if value <= 0:
        raise ValueError("Enter a weight greater than 0.")
    if value > MAX_BODY_WEIGHT_KG:
        raise ValueError("That weight looks too large.")
    return value


BodyWeight = Annotated[float, AfterValidator(_check_body_weight)]


class WeightIn(ApiModel):
    kg: BodyWeight


class WeightOut(ApiModel):
    id: int
    kg: float
    recorded_at: datetime

    @classmethod
    def of(cls, entry: "Weight") -> "WeightOut":
        return cls(id=entry.id, kg=float(entry.weight_kg), recorded_at=entry.recorded_at)


class WeightStats(ApiModel):
    """What the weight screen shows above the history list.

    Computed here rather than on the device: the deltas the app derives today
    need every entry loaded to find the oldest, and the averages don't exist in
    the app at all — they come from the bot, where they read better than a bare
    latest number does.
    """

    latest: WeightOut | None
    entry_count: int
    # Latest minus the entry before it, and minus the very first — the two
    # deltas the screen already puts under the sparkline.
    since_last: float | None
    since_start: float | None
    # Rolling averages, each with the number of entries behind it so the client
    # can tell "steady at 80" from "one weigh-in this month". Spelled out rather
    # than as average_7d, which camel-cases into the unreadable average7D.
    seven_day_average: float | None
    seven_day_entries: int
    thirty_day_average: float | None
    thirty_day_entries: int
    # The 7-day average against the 30-day one: which way the recent weeks are
    # going, a question single readings are too noisy to answer. Null until the
    # month holds something the week doesn't — before that the two averages
    # cover the same readings and their difference is zero by construction, not
    # because the weight is steady.
    trend: str | None
    trend_delta: float | None
