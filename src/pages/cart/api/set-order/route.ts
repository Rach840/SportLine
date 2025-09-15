"use server";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { and, eq, inArray, gte } from "drizzle-orm";
import {
  cart_item,
  order_item,
  orders,
  products,
  users,
  addresses,
} from "@/src/db/schema";
import { v4 as uuidv4 } from "uuid";
import { sendSalesMessageTelegram } from "@/src/shared/api/telegram/telegram-sales";

type BodyLegacy = [userId: string, cartProductsId: string[], cartItemsId: string[]];
type BodyObj = { userId: string; cartProductsId: string[]; cartItemsId: string[] };

export async function POST(request: Request) {
  let userId: string;
  let cartItemsId: string[];

  try {
    const payload = await request.json();
    if (Array.isArray(payload)) {
      [userId, , cartItemsId] = payload as BodyLegacy;
    } else {
      const p = payload as BodyObj;
      userId = p.userId;
      cartItemsId = p.cartItemsId;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!userId || !Array.isArray(cartItemsId) || cartItemsId.length === 0) {
    return NextResponse.json({ error: "userId/cartItemsId required" }, { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      // 0) проверяем, что у пользователя есть адрес (новая схема)
      const [addr] = await tx
        .select()
        .from(addresses)
        .where(eq(addresses.user, userId))
        .limit(1);

      if (!addr) {
        throw new Error("NO_ADDRESS");
      }

      // 1) тянем позиции корзины пользователя с продуктами
      const items = await tx
        .select({
          cartItemId: cart_item.id,
          cartKey: cart_item.cart,
          productId: products.id,
          productPrice: products.price,
          stock: products.stock,
          quantity: cart_item.quantity,
          name: products.name,
          brand: products.brand,
        })
        .from(cart_item)
        .innerJoin(products, eq(products.id, cart_item.product))
        .where(and(inArray(cart_item.id, cartItemsId), eq(cart_item.cart, userId)));

      if (items.length === 0 || items.length !== cartItemsId.length) {
        throw new Error("CART_MISMATCH"); // нет таких позиций или не все принадлежат пользователю
      }

      // 2) проверяем склад
      const outOfStock = items.filter((x) => x.stock < x.quantity);
      if (outOfStock.length > 0) {
        return {
          status: "OUT_OF_STOCK" as const,
          details: outOfStock.map((x) => ({ productId: x.productId, left: x.stock })),
        };
      }

      // 3) считаем сумму и готовим позиции заказа
      const orderId = uuidv4();
      const orderItemsToInsert = items.map((x) => ({
        id: uuidv4(),
        order: orderId,
        product: x.productId,
        quantity: x.quantity,
        price: x.productPrice, // цена на момент заказа
      }));
      const total = items.reduce((acc, x) => acc + x.quantity * x.productPrice, 0);

      // 4) вставляем заказ
      await tx.insert(orders).values({
        id: orderId,
        user: userId,
        addresses: addr.id,
        status: "pending",   // enum: pending | paid | shipped | delivered | cancelled
        price: total,
        pay_method: "card",  // по умолчанию; подстрой под свой процесс
        delivery: true,
      });

      // 5) вставляем элементы заказа
      await tx.insert(order_item).values(orderItemsToInsert);

      // 6) удаляем позиции из корзины пользователя
      await tx
        .delete(cart_item)
        .where(and(inArray(cart_item.id, cartItemsId), eq(cart_item.cart, userId)));

      // 7) списываем со склада (защита от гонок: обновляем только если stock >= qty)
      for (const x of items) {
        const updated = await tx
          .update(products)
          .set({ stock: x.stock - x.quantity })
          .where(and(eq(products.id, x.productId), gte(products.stock, x.quantity)))
          .returning({ id: products.id });
        if (updated.length === 0) throw new Error("STOCK_RACE"); // кто-то опередил
      }

      // 8) подтягиваем пользователя для уведомления
      const [u] = await tx
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

      const addressStr = [
        addr.city,
        addr.street,
        addr.building && `д.${addr.building}`,
        addr.entrance && `подъезд ${addr.entrance}`,
        addr.floor && `этаж ${addr.floor}`,
        addr.apartment && `кв.${addr.apartment}`,
      ]
        .filter(Boolean)
        .join(", ");

      // 9) телеграм-уведомление
      const message =
        `Оформлен заказ ${orderId} %0A` +
        `Пользователь: ${[u?.firstName, u?.lastName].filter(Boolean).join(" ") || "Не указано"} %0A` +
        `Адрес: ${addressStr || "Не указан"} %0A` +
        `Товаров в заказе: ${orderItemsToInsert.length} %0A` +
        `Сумма заказа: ${total} %0A` +
        `Почта: ${u?.email ?? "Не найдено"} %0A` +
        `Номер телефона: ${u?.phone ?? "Не найдено"} %0A` +
        `Для подробностей зайдите в панель заказов`;
      await sendSalesMessageTelegram(message);

      return { status: "OK" as const, orderId };
    });

    if (result.status === "OUT_OF_STOCK") {
      return NextResponse.json(result, { status: 409 });
    }

    return NextResponse.json("success");
  } catch (e: any) {
    if (e?.message === "NO_ADDRESS") {
      return NextResponse.json({ error: "Address required" }, { status: 400 });
    }
    if (e?.message === "CART_MISMATCH") {
      return NextResponse.json({ error: "Cart items mismatch" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
