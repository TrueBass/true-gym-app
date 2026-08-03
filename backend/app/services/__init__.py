from decimal import Decimal


def to_decimal(value: float | None) -> Decimal | None:
    """Convert a number off the wire for a NUMERIC column.

    Through str, not float: Decimal(80.4) is 80.40000000000000568…, and the
    column would round that on the way in — a value the user never typed,
    arrived at by a route nobody reading the row could reconstruct.
    """
    return None if value is None else Decimal(str(value))
