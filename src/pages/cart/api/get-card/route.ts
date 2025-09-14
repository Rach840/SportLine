"use server";
import { db } from "@/src/db";
import { cart_item, products } from "@/src/db/schema";
import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await params;
  const cartItemsById = await db
    .select()
    .from(cart_item)
    .where(eq(cart_item.cart, user.id));
  const cartItemsOnlyId = cartItemsById.map((items) => items.product);
  const cartItemsOnlyProducts = await db
    .select()
    .from(products)
    .where(inArray(products.id, cartItemsOnlyId));
  const cartItemsFull = cartItemsById.map((item) => {
    const productItem = cartItemsOnlyProducts.find(
      (product) => product.id == item.product,
    );
    return {
      orderItem: item,
      product: productItem,
    };
  });

  return NextResponse.json(cartItemsFull);
}
