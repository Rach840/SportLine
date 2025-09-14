"use server";
import { db } from "@/src/db";
import { order_item, orders, products } from "@/src/db/schema";
import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await params;
  const userOrders = await db
    .select()
    .from(orders)
    .where(eq(user.id, orders.user));

  const ordersId = userOrders.map((order) => order.id);

  const orderItemsById = await db
    .select()
    .from(order_item)
    .where(inArray(order_item.order, ordersId));

  const orderItemsOnlyId = orderItemsById.map((items) => items.product);
  const cartItemsOnlyProducts = await db
    .select()
    .from(products)
    .where(inArray(products.id, orderItemsOnlyId));

  const orderItemsFull = userOrders.map((item) => {
    const orderItemsWithProduct = orderItemsById
      .filter((orderItem) => orderItem.order === item.id)
      .map((orderItem) => {
        const productByItem = cartItemsOnlyProducts.find(
          (product) => product.id === orderItem.product,
        );
        return {
          ...productByItem,
          quantity: orderItem.quantity,
          total: productByItem.price * orderItem.quantity,
        };
      });

    return {
      id: item.id,
      total: item.price,
      createdAt: item.createAt,
      status: item.status,
      orderItems: orderItemsWithProduct,
      orderTotal: orderItemsWithProduct.reduce(
        (total, orderItem) => total + orderItem.total,
        0,
      ),
    };
  });

  return NextResponse.json(orderItemsFull);
}
