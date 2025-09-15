"use server";
import { db } from "@/src/db";
import { orders, users } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { sendSalesMessageTelegram } from "@/src/shared/api/telegram/telegram-sales";

// удобные типобезопасные константы статусов (соответствуют order_status enum)
const STATUS_DELIVERED: typeof orders.$inferInsert["status"] = "delivered";
const STATUS_CANCELLED: typeof orders.$inferInsert["status"] = "cancelled";

async function fetchPublicUser(userId: string) {
  const [u] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u;
}

export async function approveDeliver(orderId: string): Promise<void> {
  // 1) обновляем статус заказа и берём id пользователя одним шагом
  const [updated] = await db
    .update(orders)
    .set({ status: STATUS_DELIVERED })
    .where(eq(orders.id, orderId))
    .returning({ id: orders.id, userId: orders.user });

  if (!updated) {
    // ничего не обновилось — такого заказа нет
    return;
  }

  // 2) получаем публичные поля пользователя
  const u = await fetchPublicUser(updated.userId);
  const fullName =
    [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "Не указано";

  // 3) отправляем уведомление
  const message =
    `Заказ ${updated.id} %0A` +
    `Пользователь: ${fullName} — ДОСТАВЛЕН %0A` +
    `Почта: ${u?.email ?? "Не найдено"} %0A` +
    `Номер телефона: ${u?.phone ?? "Не найдено"}`;

  await sendSalesMessageTelegram(message);
}

export async function deniedDeliver(orderId: string): Promise<void> {
  // Для «не доставлен» в текущем enum нет FAILED — используем "cancelled".
  const [updated] = await db
    .update(orders)
    .set({ status: STATUS_CANCELLED })
    .where(eq(orders.id, orderId))
    .returning({ id: orders.id, userId: orders.user });

  if (!updated) {
    return;
  }

  const u = await fetchPublicUser(updated.userId);
  const fullName =
    [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "Не указано";

  const message =
    `!ЗАКАЗ НЕ ДОСТАВЛЕН! %0A` +
    `Заказ ${updated.id} %0A` +
    `Пользователь: ${fullName} — НЕ ДОСТАВЛЕН %0A` +
    `Почта: ${u?.email ?? "Не найдено"} %0A` +
    `Номер телефона: ${u?.phone ?? "Не найдено"} %0A` +
    `Свяжитесь с пользователем для выяснения подробностей`;

  await sendSalesMessageTelegram(message);
}
