"""Price calculations for cart lines and orders."""

from __future__ import annotations

from typing import Iterable

from .types import CartLine


def line_subtotal(unit_price: float, quantity: int) -> float:
    return float(unit_price) * int(quantity)


def order_lines_total(lines: Iterable[CartLine]) -> float:
    return sum(line.subtotal for line in lines)
