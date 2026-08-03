"""Domain errors, so services can fail without importing HTTP.

Every message here reaches the user as-is — the app renders whatever comes back
in `detail` straight into the form's error line.
"""


class DomainError(Exception):
    status_code = 400


class AuthError(DomainError):
    status_code = 401


class ConflictError(DomainError):
    """Valid request that collides with something already stored."""

    status_code = 409


class NotFoundError(DomainError):
    status_code = 404
