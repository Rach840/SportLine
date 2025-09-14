"use server";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { and, eq } from "drizzle-orm";
import { cart_item } from "@/src/db/schema";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  const [cartId, product] = await request.json();

  const productExists = await db
    .select()
    .from(cart_item)
    .where(and(eq(cart_item.cart, cartId), eq(cart_item.product, product.id)));

  if (productExists.length) {
    await db
      .update(cart_item)
      .set({ quantity: productExists[0].quantity + 1 })
      .where(and(eq(cart_item.cart, cartId), eq(cart_item.product, product.id)));
  } else {
    await db.insert(cart_item).values({
      id: uuidv4(),
      cart: cartId,
      product: product.id,
      quantity: 1,
    });
  }
  return NextResponse.json(product);
}
