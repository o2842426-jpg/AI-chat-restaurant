"""Reply / inline keyboards."""

from aiogram.types import (
    ReplyKeyboardMarkup,
    KeyboardButton,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
)

CATEGORIES = ["Burgers", "Pizza", "Drinks", "Extras"]


def main_menu_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="طلب جديد")],
            [KeyboardButton(text="المنيو")],
            [KeyboardButton(text="سلة الطلب")],
            [KeyboardButton(text="إعادة آخر طلب")],
            [KeyboardButton(text="تواصل مع المطعم")],
        ],
        resize_keyboard=True,
    )


def categories_keyboard() -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(text=cat, callback_data=f"cat:{cat}")]
        for cat in CATEGORIES
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def menu_items_keyboard(items) -> InlineKeyboardMarkup:
    buttons = []
    for item in items:
        buttons.append(
            [
                InlineKeyboardButton(
                    text=f"{item.name} - {item.price:.2f}",
                    callback_data=f"item:{item.id}",
                )
            ]
        )
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def add_to_order_keyboard(item_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="1", callback_data=f"add:{item_id}:1"),
                InlineKeyboardButton(text="2", callback_data=f"add:{item_id}:2"),
                InlineKeyboardButton(text="3", callback_data=f"add:{item_id}:3"),
                InlineKeyboardButton(text="4", callback_data=f"add:{item_id}:4"),
                InlineKeyboardButton(text="5", callback_data=f"add:{item_id}:5"),
            ],
            [InlineKeyboardButton(text="⬅ رجوع للفئات", callback_data="back:categories")],
        ]
    )


def upsell_keyboard(suggested_item_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="✅ نعم، أضف",
                    callback_data=f"upsell_yes:{suggested_item_id}",
                ),
                InlineKeyboardButton(text="❌ لا شكراً", callback_data="upsell_no"),
            ],
        ]
    )


def customer_review_keyboard() -> InlineKeyboardMarkup:
    """Approve or edit collected customer data before confirming the order."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="✅ تأكيد البيانات",
                    callback_data="customer_confirm_yes",
                ),
                InlineKeyboardButton(
                    text="✏️ تعديل البيانات",
                    callback_data="customer_confirm_edit",
                ),
            ]
        ]
    )
