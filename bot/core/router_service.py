"""Map free text to high-level actions."""

from __future__ import annotations

from enum import Enum


class MainMenuAction(str, Enum):
    NEW_ORDER = "new_order"
    MENU = "menu"
    CART = "cart"
    REPEAT_LAST = "repeat_last"
    CONTACT = "contact"
    UNKNOWN = "unknown"


def route_main_menu_text(text: str) -> MainMenuAction:
    if text == "طلب جديد":
        return MainMenuAction.NEW_ORDER
    if text == "المنيو":
        return MainMenuAction.MENU
    if text == "سلة الطلب":
        return MainMenuAction.CART
    if text == "إعادة آخر طلب":
        return MainMenuAction.REPEAT_LAST
    if text == "تواصل مع المطعم":
        return MainMenuAction.CONTACT
    return MainMenuAction.UNKNOWN
