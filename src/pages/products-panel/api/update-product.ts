"use server";

import { db } from "@/src/db";
import { products } from "@/src/db/schema";
import { eq } from "drizzle-orm";

type UpdateProductInput = {
  id: string;
  name?: string;
  description?: string | null;
  price?: number;
  stock?: number;
  category?: string;           // uuid → categories.id
  image?: string | null;       // uuid → images.id
  brand?: string;              // новое имя поля вместо manufacturer
  manufacturer?: string;       // алиас → brand
  gender?: "male" | "female" | "unisex" | null;
  size?: "xs" | "s" | "m" | "l" | "xl" | "xxl" | null;
};

export async function updateProduct(data: UpdateProductInput) {
  if (!data?.id) throw new Error("Product id is required");

  // формируем payload только из присланных ключей
  const payload: Partial<typeof products.$inferInsert> = {};

  if (typeof data.name === "string") payload.name = data.name.trim();
  if (typeof data.description !== "undefined")
    payload.description =
      data.description === null ? null : String(data.description).trim();

  if (typeof data.brand === "string" || typeof data.manufacturer === "string")
    payload.brand = (data.brand ?? data.manufacturer)!.trim();

  if (typeof data.category === "string") payload.category = data.category;
  if (typeof data.image !== "undefined") payload.image = data.image || null;

  if (typeof data.price !== "undefined") {
    const p = Number(data.price);
    if (!Number.isInteger(p) || p < 0) throw new Error("Invalid price");
    payload.price = p;
  }

  if (typeof data.stock !== "undefined") {
    const s = Number(data.stock);
    if (!Number.isInteger(s) || s < 0) throw new Error("Invalid stock");
    payload.stock = s;
  }

  if (typeof data.gender !== "undefined") payload.gender = data.gender ?? null;
  if (typeof data.size !== "undefined") payload.size = data.size ?? null;

  if (Object.keys(payload).length === 0) {
    // ничего не прислали для обновления
    return null;
  }

  try {
    const [updated] = await db
      .update(products)
      .set(payload)
      .where(eq(products.id, data.id))
      .returning({
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
      });

    return updated ?? null;
  } catch (e: any) {
    // 23503 — нарушение внешнего ключа (например, несуществующая category/image)
    if (e?.code === "23503") {
      throw new Error("Invalid category/image reference");
    }
    throw e;
  }
}
