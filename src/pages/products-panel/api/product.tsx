'use server'
import { db } from "@/src/db";
import { order_item, products } from "@/src/db/schema";
import { eq } from "drizzle-orm";

export async function getProduct(id: string) {
  const product = await db.select().from(products).where(eq(products.id, id));
  const productSaled = await db
    .select()
    .from(order_item)
    .where(eq(order_item.product, id));
  return [product[0], productSaled.length];
}
export async function deleteProduct(id:string) {
  await db.delete(products).where(eq(products.id, id));
}