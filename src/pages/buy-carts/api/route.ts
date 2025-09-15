"use server";
import { db } from "@/src/db";
import { orders, order_item, products, users } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type PublicUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const orderId = params.id;

  // 1) заказ + публичные поля пользователя
  const orderWithUser = await db
    .select({
      order: {
        id: orders.id,
        price: orders.price,
        status: orders.status,
        createdAt: orders.createAt,
        userId: orders.user,
      },
      user: {
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
      },
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.user))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (orderWithUser.length === 0) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { order, user } = orderWithUser[0];

  // 2) позиции заказа + продукты
  const rows = await db
    .select({
      product: {
        id: products.id,
        name: products.name,
        brand: products.brand,
        image: products.image,  // uuid на таблицу images
        currentPrice: products.price,
        category: products.category,
      },
      quantity: order_item.quantity,
      priceAtPurchase: order_item.price, // цена в момент заказа
    })
    .from(order_item)
    .innerJoin(products, eq(products.id, order_item.product))
    .where(eq(order_item.order, order.id));

  const orderItems = rows.map(({ product, quantity, priceAtPurchase }) => ({
    ...product,
    quantity,
    priceAtPurchase,
    total: priceAtPurchase * quantity,
  }));

  const orderTotal = orderItems.reduce((sum, it) => sum + it.total, 0);

  return NextResponse.json({
    user: user as PublicUser,
    orderDetails: {
      id: order.id,
      total: order.price,          // сумма, сохранённая в orders
      createdAt: order.createdAt,  // orders.createAt => алиас выше
      status: order.status,
      orderItems,
      orderTotal,                  // пересчитано по позициям
    },
  });
}
