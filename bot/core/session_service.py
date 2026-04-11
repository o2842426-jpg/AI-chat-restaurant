"""Per-chat session state (future: FSM / Redis). Placeholder."""

from __future__ import annotations

from typing import Any, Dict


def get_session(chat_id: int) -> Dict[str, Any]:
    _ = chat_id
    return {}


def set_session_value(chat_id: int, key: str, value: Any) -> None:
    _ = (chat_id, key, value)
