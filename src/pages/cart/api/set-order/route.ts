"use server";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { eq, inArray } from "drizzle-orm";
import { cart_item, order_item, orders, products, users } from "@/src/db/schema";
import { v4 as uuidv4 } from "uuid";
import { sendSalesMessageTelegram } from "@/src/shared/api/telegram/telegram-sales";

export async function POST(request: Request) {
  const [userId, cartProductsId, cartItemsId] = await request.json();

  const cartProuctsPrice = await db
    .select({id:products.id ,stock: products.stock, price: products.price })
    .from(products)
    .where(inArray(products.id, cartProductsId));

  const cartItemsQuantity = await db
    .select({
      product: cart_item.product,
      quantity: cart_item.quantity,
    })
    .from(cart_item)
    .where(inArray(cart_item.id, cartItemsId));

  const orderId = uuidv4();
  const orderInsertItems = cartItemsQuantity.map((item, index) => {
    return {
      id: uuidv4(),
      order: orderId,
      product: item.product,
      quantity: item.quantity,
      price: cartProuctsPrice[index].price,
    };
  });

  await db.insert(order_item).values(orderInsertItems);
  await db.delete(cart_item).where(inArray(cart_item.id, cartItemsId));


  const total = orderInsertItems.reduce(
    (acc, curr) => acc + curr.quantity * curr.price,
    0,
  );
  const user = await db.select().from(users).where(eq(users.id, userId));
  await db.insert(orders).values({
    id: orderId,
    user: userId,
    addresses: (user[0] as any)?.address,
    price: total,
    status: "pending",
    pay_method: "card",
    delivery: true,
  });
  cartItemsQuantity.forEach(async (item) => {
    const productItem = cartProuctsPrice.find(
      (product) => product.id == item.product,
    );

    await db
      .update(products)
      .set({ stock: productItem!.stock - item.quantity })
      .where(eq(products.id, item.product));
  });
  const message = `Оформлен заказ ${orderId} %0AПользователя ${user[0].firstName} ${user[0]?.lastName} %0AАдресс ${user[0]?.address} %0AТоваров в заказе ${orderInsertItems.length} %0AСумма заказа ${total} %0AПочта: ${user[0].email} %0AНомер телефона: ${user[0]?.phone ? user[0].phone : "Не найдено"} %0AДля получения подробной информации зайдите в панель заказов`;
  await sendSalesMessageTelegram(message);
  return NextResponse.json("success");
}
