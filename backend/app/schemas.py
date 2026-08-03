"""Request and response shapes.

Everything serialises as camelCase, because the client that consumes it is
JavaScript — `accessToken`, not `access_token`. Requests accept either spelling.
"""

import re
import uuid
from typing import Annotated

from email_validator import EmailNotValidError, validate_email
from pydantic import AfterValidator, BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

# Same rule the app enforces on its own signup form.
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9._-]{3,20}$")
MIN_PASSWORD_LENGTH = 6
# Argon2 is happy with any length; the cap is so a megabyte of "password" can't
# be used to make the server do expensive work.
MAX_PASSWORD_LENGTH = 128


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
