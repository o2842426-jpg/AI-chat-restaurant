"""Shared datatypes for services."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class CartLine:
    order_item_id: int
    menu_item_id: int
    name: str
    quantity: int
    unit_price: float
    subtotal: float


@dataclass
class CartSnapshot:
    order_id: int
    lines: List[CartLine]
    total: float

    @property
    def empty(self) -> bool:
        return not self.lines


@dataclass
class ConfirmOrderResult:
    ok: bool
    order_id: Optional[int] = None
    kitchen_text: Optional[str] = None
    error: Optional[str] = None


@dataclass
class PostAddUpsell:
    """Result of upsell resolution after adding an item (no Telegram)."""

    kind: str  # "dynamic" | "static" | "none" | "simple_followup"
    added_item_name: str
    message: str
    suggested_menu_item_id: Optional[int] = None
