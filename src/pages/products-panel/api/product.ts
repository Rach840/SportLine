"use server";

import { db } from "@/src/db";
import { products, order_item } from "@/src/db/schema";
import { eq, sql } from "drizzle-orm";

/** Вернёт товар и статистику продаж */
export async function getProduct(id: string) {
  // сам товар (публичные поля)
  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      brand: products.brand,
      description: products.description,
      price: products.price,
      stock: products.stock,
      image: products.image,
      category: products.category,
      gender: products.gender,
      size: products.size,
      rating: products.rating,
      createAt: products.createAt,
    })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!product) return [null, 0, 0] as const;

  // статистика по позициям заказа для этого товара
  const [agg] = await db
    .select({
      lines: sql<number>`cast(count(*) as int)`,
      units: sql<number>`coalesce(sum(${order_item.quantity}), 0)::int`,
    })
    .from(order_item)
    .where(eq(order_item.product, id));

  return [product, agg?.lines ?? 0, agg?.units ?? 0] as const; // [товар, кол-во строк, продано единиц]
}

/** Удалит товар, если он не участвует ни в одном заказе. Возвращает true/false. */
export async function deleteProduct(id: string): Promise<boolean> {
  // проверяем, используется ли товар в заказах
  const [used] = await db
    .select({ cnt: sql<number>`cast(count(*) as int)` })
    .from(order_item)
    .where(eq(order_item.product, id));

  if ((used?.cnt ?? 0) > 0) {
    // в схеме FK стоит RESTRICT — удаление всё равно упадёт.
    return false;
  }

  const res = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id });
  return res.length > 0;
}
