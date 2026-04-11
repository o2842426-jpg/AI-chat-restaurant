"""Telegram message edit / send helpers."""

from aiogram.types import CallbackQuery


async def edit_or_send_followup(
    callback: CallbackQuery, text: str, reply_markup=None
) -> None:
    """
    Try to edit the callback message; on failure send a new message so the user always sees a reply.
    """
    msg = callback.message
    if msg is None:
        await callback.bot.send_message(
            callback.from_user.id, text, reply_markup=reply_markup
        )
        return
    try:
        await msg.edit_text(text, reply_markup=reply_markup)
    except Exception:
        try:
            await msg.answer(text, reply_markup=reply_markup)
        except Exception:
            await callback.bot.send_message(
                callback.from_user.id, text, reply_markup=reply_markup
            )
