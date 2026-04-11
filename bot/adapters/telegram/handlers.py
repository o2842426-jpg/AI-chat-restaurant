"""Aiogram handlers — thin; domain logic in core/."""

from __future__ import annotations

import logging

from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton

from config import BOT_RESTAURANT_ID, KITCHEN_GROUP_ID
from db import SessionLocal
from models import (
    ensure_default_restaurant,
)
from sqlalchemy.orm import Session

from core.cart_service import get_cart_snapshot
from core.cart_mutation_service import add_item_for_user, remove_order_item
from core.menu_service import get_items_by_category, get_menu_row
from core.order_service import confirm_draft_for_bot_user, repeat_last_for_bot_user
from core.router_service import MainMenuAction, route_main_menu_text
from core.user_order_service import ensure_user, ensure_user_and_draft_order
from core.upsell_service import resolve_post_add_upsell
from core.customer_service import (
    resolve_customer_for_confirmation,
    apply_customer_text_for_input,
    reset_customer_for_edit,
    get_customer_input_step,
    set_draft_order_type,
)

from .keyboards import (
    add_to_order_keyboard,
    categories_keyboard,
    customer_review_keyboard,
    main_menu_keyboard,
    menu_items_keyboard,
    order_type_keyboard,
    upsell_keyboard,
)
from .messaging import edit_or_send_followup

logger = logging.getLogger(__name__)


async def start_handler(message: Message, bot: Bot) -> None:
    db: Session = SessionLocal()
    try:
        ensure_default_restaurant(db)
        ensure_user(db, message.from_user)
    finally:
        db.close()

    await message.answer(
        "أهلاً بك في نظام الطلبات 👋\nاختر من القائمة:",
        reply_markup=main_menu_keyboard(),
    )


async def new_order_flow(message: Message) -> None:
    db: Session = SessionLocal()
    try:
        ensure_user_and_draft_order(db, message.from_user)
    finally:
        db.close()

    await message.answer(
        "نوع الطلب؟",
        reply_markup=order_type_keyboard(),
    )


async def show_categories(message_or_callback) -> None:
    if isinstance(message_or_callback, Message):
        await message_or_callback.answer(
            "اختر الفئة:", reply_markup=categories_keyboard()
        )
    else:
        # Callback path: edit if possible, fallback to send.
        await edit_or_send_followup(
            message_or_callback,
            "اختر الفئة:",
            reply_markup=categories_keyboard(),
        )


async def show_cart(message: Message) -> None:
    db: Session = SessionLocal()
    try:
        user = ensure_user(db, message.from_user)
        snap = get_cart_snapshot(db, user.id)
    finally:
        db.close()

    if not snap:
        await message.answer("سلة الطلب فارغة حالياً.", reply_markup=main_menu_keyboard())
        return

    lines = ["سلة طلبك الحالية:"]
    keyboard_rows = []
    for line in snap.lines:
        lines.append(f"- {line.name} x{line.quantity} = {line.subtotal:.2f}")
        keyboard_rows.append(
            [
                InlineKeyboardButton(
                    text=f"🗑 إزالة {line.name}",
                    callback_data=f"remove:{line.order_item_id}",
                )
            ]
        )

    lines.append(f"\nالإجمالي التقريبي: {snap.total:.2f}")
    keyboard_rows.append(
        [InlineKeyboardButton(text="✅ تأكيد الطلب", callback_data="confirm_order")]
    )

    cart_keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_rows)
    await message.answer("\n".join(lines), reply_markup=cart_keyboard)


async def repeat_last_order(message: Message) -> None:
    db: Session = SessionLocal()
    try:
        user = ensure_user(db, message.from_user)
        ok, text = repeat_last_for_bot_user(db, user.id)
    finally:
        db.close()

    if not ok:
        await message.answer(text)
        return
    await message.answer(text)


async def text_handler(message: Message, bot: Bot) -> None:
    text = message.text or ""

    # Customer data collection mode (draft only).
    db: Session = SessionLocal()
    try:
        user = ensure_user(db, message.from_user)
        step = get_customer_input_step(db, user.id, BOT_RESTAURANT_ID)
        if step in ("name", "phone", "address", "table_number"):
            action, payload = apply_customer_text_for_input(
                db, user.id, BOT_RESTAURANT_ID, text
            )
            if action == "need_input":
                next_field = payload.get("field") or step
                label = payload.get("label") or next_field
                hint = payload.get("hint")
                if next_field == "table_number":
                    await message.answer(hint or "الرجاء إدخال رقم الطاولة:")
                elif next_field == "phone":
                    await message.answer("تم ✅ الآن أدخل رقم الهاتف:")
                elif next_field == "address":
                    await message.answer(f"تم ✅ الآن أدخل {label}:")
                else:
                    await message.answer(f"الرجاء أدخل {label}:")
            elif action == "review":
                if payload.get("mode") == "dine_in":
                    await message.answer(
                        "يرجى تأكيد بيانات الطاولة:\n"
                        f"🍽️ طاولة رقم: {payload.get('table_number', '')}",
                        reply_markup=customer_review_keyboard(),
                    )
                else:
                    customer = payload["customer"]
                    await message.answer(
                        "يرجى تأكيد بيانات العميل:\n"
                        f"الاسم: {customer['name']}\n"
                        f"الهاتف: {customer['phone']}\n"
                        f"العنوان: {customer['address']}",
                        reply_markup=customer_review_keyboard(),
                    )
            else:
                await message.answer("يرجى المحاولة مرة أخرى.")
            return
    finally:
        db.close()

    action = route_main_menu_text(text)

    if action == MainMenuAction.NEW_ORDER:
        await new_order_flow(message)
    elif action == MainMenuAction.MENU:
        await show_categories(message)
    elif action == MainMenuAction.CART:
        await show_cart(message)
    elif action == MainMenuAction.REPEAT_LAST:
        await repeat_last_order(message)
    elif action == MainMenuAction.CONTACT:
        await message.answer("يمكنك إرسال رسالتك الآن، وسيتم توصيلها للمطعم.")
    else:
        await message.answer(
            "استخدم الأزرار لطلب أسهل وأسرع 😊",
            reply_markup=main_menu_keyboard(),
        )


async def maybe_offer_upsell(
    callback: CallbackQuery,
    added_menu_item_id: int,
    draft_order_id: int,
    user_id: int,
) -> None:
    await callback.answer("تمت إضافة المنتج للطلب ✅", show_alert=False)

    db: Session = SessionLocal()
    try:
        offer = resolve_post_add_upsell(db, added_menu_item_id, draft_order_id, user_id)
    finally:
        db.close()

    if offer.kind in ("dynamic", "static") and offer.suggested_menu_item_id:
        await edit_or_send_followup(
            callback,
            offer.message,
            reply_markup=upsell_keyboard(offer.suggested_menu_item_id),
        )
        return

    await edit_or_send_followup(callback, offer.message)


async def callback_handler(callback: CallbackQuery, bot: Bot) -> None:
    data = callback.data or ""

    try:
        if data.startswith("cat:"):
            category = data.split(":", 1)[1]
            db: Session = SessionLocal()
            try:
                items = get_items_by_category(db, category)
            finally:
                db.close()

            if not items:
                await edit_or_send_followup(
                    callback,
                    "لا توجد منتجات في هذه الفئة حالياً.",
                )
                return

            await edit_or_send_followup(
                callback,
                f"فئة: {category}\nاختر المنتج:",
                reply_markup=menu_items_keyboard(items),
            )

        elif data.startswith("item:"):
            try:
                item_id = int(data.split(":", 1)[1])
            except Exception:
                await callback.answer("بيانات غير صالحة.", show_alert=True)
                return

            db: Session = SessionLocal()
            try:
                item = get_menu_row(db, item_id, BOT_RESTAURANT_ID)
            finally:
                db.close()

            if not item:
                await callback.answer("المنتج غير موجود.")
                return

            await edit_or_send_followup(
                callback,
                f"{item.name}\nالسعر: {item.price:.2f}",
                reply_markup=add_to_order_keyboard(item_id),
            )

        elif data.startswith("add:"):
            try:
                parts = data.split(":")
                # Supported formats:
                # - add:<menu_item_id>
                # - add:<menu_item_id>:<quantity>
                if len(parts) == 2:
                    item_id = int(parts[1])
                    qty = 1
                else:
                    item_id = int(parts[1])
                    qty = int(parts[2])
            except Exception:
                await callback.answer("بيانات غير صالحة.", show_alert=True)
                return
            if qty < 1:
                qty = 1
            if qty > 10:
                qty = 10

            db: Session = SessionLocal()
            order_id = None
            uid = None
            added_ok = False
            try:
                added_ok, uid, order_id = add_item_for_user(
                    db, callback.from_user, item_id, quantity=qty
                )
            finally:
                db.close()

            if not added_ok or not order_id or not uid:
                await callback.answer("المنتج غير موجود.", show_alert=True)
                return

            await maybe_offer_upsell(callback, item_id, order_id, uid)

        elif data.startswith("upsell_yes:"):
            try:
                suggested_id = int(data.split(":", 1)[1])
            except Exception:
                await callback.answer("بيانات غير صالحة.", show_alert=True)
                return

            db: Session = SessionLocal()
            try:
                added_ok, _, _ = add_item_for_user(
                    db, callback.from_user, suggested_id
                )
            finally:
                db.close()

            if not added_ok:
                await callback.answer("المنتج غير متاح حالياً.", show_alert=True)
                await edit_or_send_followup(
                    callback,
                    "يمكنك متابعة الطلب من «المنيو» أو «سلة الطلب».",
                )
                return

            await callback.answer(
                "تمت إضافة الاقتراح إلى طلبك ✅", show_alert=False
            )
            await edit_or_send_followup(
                callback,
                "تمت إضافة المنتج الإضافي إلى طلبك ✅\n"
                "يمكنك متابعة الطلب من «المنيو» أو «سلة الطلب».",
            )

        elif data == "upsell_no":
            await callback.answer("حسناً 👍", show_alert=False)
            await edit_or_send_followup(
                callback,
                "يمكنك متابعة الطلب من «المنيو» أو «سلة الطلب».",
            )

        elif data == "back:categories":
            await show_categories(callback)

        elif data.startswith("remove:"):
            try:
                order_item_id = int(data.split(":", 1)[1])
            except Exception:
                await callback.answer("بيانات غير صالحة.", show_alert=True)
                return

            db: Session = SessionLocal()
            try:
                remove_order_item(db, order_item_id, callback.from_user.id)
            finally:
                db.close()

            await callback.answer("تمت إزالة العنصر من السلة.", show_alert=False)
            fake_message = callback.message
            if fake_message is None:
                # Callback can be stale; at minimum ensure the user gets feedback.
                await callback.bot.send_message(
                    callback.from_user.id, "تمت إزالة العنصر من السلة."
                )
                return
            fake_message.from_user = callback.from_user
            await show_cart(fake_message)

        elif data.startswith("order_type:"):
            kind = data.split(":", 1)[1]
            if kind not in ("dine_in", "delivery"):
                await callback.answer("خيار غير صالح.", show_alert=True)
                return
            db: Session = SessionLocal()
            try:
                user = ensure_user(db, callback.from_user)
                set_draft_order_type(db, user.id, BOT_RESTAURANT_ID, kind)
            finally:
                db.close()
            await callback.answer("تم الاختيار ✅", show_alert=False)
            await edit_or_send_followup(
                callback,
                "لنبدأ طلباً جديداً. اختر الفئة:",
                reply_markup=categories_keyboard(),
            )

        elif data == "confirm_order":
            await confirm_order(callback, bot)
        elif data == "customer_confirm_yes":
            await finalize_order_with_customer(callback, bot)
        elif data == "customer_confirm_edit":
            await edit_customer_data(callback)
        else:
            # Unknown callback, ignore but avoid crash.
            await callback.answer()
    except Exception:
        logger.exception("callback_handler failed: data=%r", data)
        try:
            await callback.answer("حدث خطأ، حاول مرة أخرى.", show_alert=True)
        except Exception:
            # If callback can't be answered (expired), last resort is to do nothing.
            pass


async def confirm_order(callback: CallbackQuery, bot: Bot) -> None:
    db: Session = SessionLocal()
    try:
        user = ensure_user(db, callback.from_user)
        action, payload = resolve_customer_for_confirmation(
            db, user.id, BOT_RESTAURANT_ID
        )
    finally:
        db.close()

    if action == "no_draft":
        await callback.answer("لا يوجد طلب للتأكيد.", show_alert=True)
        return

    if action == "need_order_type":
        await callback.answer()
        msg = "نوع الطلب؟"
        if callback.message is not None:
            await callback.message.answer(msg, reply_markup=order_type_keyboard())
        else:
            await bot.send_message(callback.from_user.id, msg, reply_markup=order_type_keyboard())
        return

    if action == "need_input":
        field = payload.get("field")
        if field == "table_number":
            await callback.answer("تم ✅ الآن أدخل رقم الطاولة", show_alert=False)
            text = "تم ✅ الآن أدخل رقم الطاولة:"
            if callback.message is not None:
                await callback.message.answer(text)
            else:
                await bot.send_message(callback.from_user.id, text)
        elif field == "name":
            await callback.answer("تم ✅ الآن أدخل اسم العميل", show_alert=False)
            if callback.message is not None:
                await callback.message.answer("تم ✅ الآن أدخل اسم العميل:")
            else:
                await bot.send_message(callback.from_user.id, "تم ✅ الآن أدخل اسم العميل:")
        elif field == "phone":
            await callback.answer("تم ✅ الآن أدخل رقم الهاتف", show_alert=False)
            text = "تم ✅ الآن أدخل رقم الهاتف (مثل: 05XXXXXXXX):"
            if callback.message is not None:
                await callback.message.answer(text)
            else:
                await bot.send_message(callback.from_user.id, text)
        elif field == "address":
            await callback.answer("تم ✅ الآن أدخل العنوان", show_alert=False)
            if callback.message is not None:
                await callback.message.answer("تم ✅ الآن أدخل العنوان:")
            else:
                await bot.send_message(callback.from_user.id, "تم ✅ الآن أدخل العنوان:")
        else:
            await callback.answer("يرجى المحاولة مرة أخرى.", show_alert=True)
        return

    if action == "review":
        if payload.get("mode") == "dine_in":
            review_text = (
                "يرجى تأكيد بيانات الطاولة:\n"
                f"🍽️ طاولة رقم: {payload.get('table_number', '')}"
            )
        else:
            customer = payload["customer"]
            review_text = (
                "يرجى تأكيد بيانات العميل:\n"
                f"الاسم: {customer['name']}\n"
                f"الهاتف: {customer['phone']}\n"
                f"العنوان: {customer['address']}"
            )
        if callback.message is not None:
            await callback.message.answer(
                review_text, reply_markup=customer_review_keyboard()
            )
        else:
            await bot.send_message(
                callback.from_user.id,
                review_text,
                reply_markup=customer_review_keyboard(),
            )
        await callback.answer()
        return

    await callback.answer("يرجى المحاولة مرة أخرى.", show_alert=True)


async def finalize_order_with_customer(callback: CallbackQuery, bot: Bot) -> None:
    """
    Final confirmation after customer review button pressed.
    """
    db: Session = SessionLocal()
    try:
        user = ensure_user(db, callback.from_user)
        result = confirm_draft_for_bot_user(db, user.id)
    finally:
        db.close()

    if not result.ok:
        if result.error == "missing_customer":
            await callback.answer("يرجى إكمال بيانات العميل أولاً.", show_alert=True)
        elif result.error == "missing_table":
            await callback.answer("يرجى إدخال رقم الطاولة أولاً.", show_alert=True)
        elif result.error == "no_draft":
            await callback.answer("لا يوجد طلب للتأكيد.", show_alert=True)
        else:
            await callback.answer("تعذر تأكيد الطلب.", show_alert=True)
        return

    if KITCHEN_GROUP_ID != 0 and result.kitchen_text:
        try:
            await bot.send_message(chat_id=KITCHEN_GROUP_ID, text=result.kitchen_text)
        except Exception:
            logger.exception("kitchen send failed for order=%r", result.order_id)

    text = f"تم تأكيد طلبك بنجاح ✅\nرقم الطلب: #{result.order_id}"
    if callback.message is not None:
        await callback.message.answer(text)
    else:
        await bot.send_message(callback.from_user.id, text)
    await callback.answer()


async def edit_customer_data(callback: CallbackQuery) -> None:
    step_after = None
    db: Session = SessionLocal()
    try:
        user = ensure_user(db, callback.from_user)
        reset_customer_for_edit(db, user.id, BOT_RESTAURANT_ID)
        step_after = get_customer_input_step(db, user.id, BOT_RESTAURANT_ID)
    finally:
        db.close()

    msg = (
        "تم ✅ اكتب الآن رقم الطاولة:"
        if step_after == "table_number"
        else "تم ✅ اكتب الآن اسم العميل:"
    )
    if callback.message is not None:
        await callback.message.answer(msg)
    else:
        await callback.bot.send_message(callback.from_user.id, msg)
    await callback.answer()


def register_handlers(dp: Dispatcher) -> None:
    dp.message.register(start_handler, CommandStart())
    dp.message.register(text_handler, F.text)
    dp.callback_query.register(callback_handler)
