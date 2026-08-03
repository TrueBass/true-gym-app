"""Domain errors, so services can fail without importing HTTP.

Every message here reaches the user as-is — the app renders whatever comes back
in `detail` straight into the form's error line.
"""


class DomainError(Exception):
    status_code = 400


class AuthError(DomainError):
    status_code = 401


class ForbiddenError(DomainError):
    """Signed in, but not allowed to do this particular thing.

    Kept distinct from AuthError on purpose. A client that treats 401 as "the
    session died" — refresh, then log out — would throw the user out of the app
    for mistyping their current password on the change-email form, which is a
    401 only if you squint. The token was fine; the extra proof wasn't.
    """

    status_code = 403


class ConflictError(DomainError):
    """Valid request that collides with something already stored."""

    status_code = 409


class NotFoundError(DomainError):
    status_code = 404
