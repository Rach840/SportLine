"use server";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { eq } from "drizzle-orm";
import { cart_item, products } from "@/src/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const cartKey = params.id; // ключ корзины: user.id или session id

  // cart_item (id, quantity, cart, product) + продукт
  const rows = await db
    .select({
      orderItem: {
        id: cart_item.id,
        quantity: cart_item.quantity,
      },
      product: {
        id: products.id,
        name: products.name,
        price: products.price,
        image: products.image, // uuid из таблицы images (или ваш URL)
        brand: products.brand,
        category: products.category,
      },
    })
    .from(cart_item)
    .innerJoin(products, eq(products.id, cart_item.product))
    .where(eq(cart_item.cart, cartKey));

  return NextResponse.json(rows);
}
