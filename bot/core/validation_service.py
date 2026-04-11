"""Input / business validation hooks (extend later)."""

from __future__ import annotations

from sqlalchemy.orm import Session


def validate_user_can_order(db: Session, user_id: int) -> bool:
    """Placeholder: always allow."""
    _ = (db, user_id)
    return True
