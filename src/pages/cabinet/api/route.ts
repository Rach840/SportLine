"use server";
import { db } from "@/src/db";
import { orders, order_item, products } from "@/src/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = params.id;

  // 1) все заказы пользователя
  const userOrders = await db
    .select({
      id: orders.id,
      status: orders.status,
      createdAt: orders.createAt,
      totalSaved: orders.price, // сумма, сохранённая в orders
    })
    .from(orders)
    .where(eq(orders.user, userId))
    .orderBy(desc(orders.createAt));

  if (userOrders.length === 0) {
    return NextResponse.json([]);
  }

  const orderIds = userOrders.map((o) => o.id);

  // 2) позиции этих заказов + продукты
  const rows = await db
    .select({
      orderId: order_item.order,
      product: {
        id: products.id,
        name: products.name,
        brand: products.brand,
        category: products.category,
        image: products.image,        // uuid на images.id
        currentPrice: products.price, // текущая цена товара
      },
      quantity: order_item.quantity,
      priceAtPurchase: order_item.price, // цена на момент заказа
    })
    .from(order_item)
    .innerJoin(products, eq(products.id, order_item.product))
    .where(inArray(order_item.order, orderIds));

  // 3) группируем по заказам
  const byOrder = new Map<string, {
    id: string;
    status: string;
    createdAt: Date;
    totalSaved: number;
    orderItems: Array<any>;
    orderTotal: number;
  }>();

  for (const o of userOrders) {
    byOrder.set(o.id, {
      id: o.id,
      status: o.status,
      createdAt: o.createdAt,
      totalSaved: o.totalSaved,
      orderItems: [],
      orderTotal: 0,
    });
  }

  for (const r of rows) {
    const entry = byOrder.get(r.orderId);
    if (!entry) continue;
    const total = r.priceAtPurchase * r.quantity;
    entry.orderItems.push({
      ...r.product,
      quantity: r.quantity,
      priceAtPurchase: r.priceAtPurchase,
      total,
    });
    entry.orderTotal += total;
  }

  // 4) финальный формат (совместим с твоим JSON)
  const result = Array.from(byOrder.values()).map((o) => ({
    id: o.id,
    total: o.totalSaved,       // из orders.price
    createdAt: o.createdAt,    // orders.createAt
    status: o.status,
    orderItems: o.orderItems,
    orderTotal: o.orderTotal,  // пересчитано из позиций
  }));

  return NextResponse.json(result);
}
