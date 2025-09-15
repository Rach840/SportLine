"use server";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { products } from "@/src/db/schema";
import { sql } from "drizzle-orm";

type LegacyBody = [productId: string | undefined, product: any, image?: string | null];
type ObjBody = { productId?: string; product: any; image?: string | null };

export async function POST(request: Request) {
  let productId: string | undefined;
  let product: any;
  let image: string | null | undefined;

  try {
    const payload = await request.json();
    if (Array.isArray(payload)) {
      [productId, product, image] = payload as LegacyBody;
    } else {
      ({ productId, product, image } = payload as ObjBody);
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // helpers
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const strOrNull = (v: unknown) => (typeof v === "string" ? v.trim() || null : null);
  const toInt = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };

  const name = str(product?.name);
  const brand = str(product?.brand);
  const category = str(product?.category);
  const description = strOrNull(product?.description);
  const gender = product?.gender ?? null; // "male" | "female" | "unisex" | null
  const size = product?.size ?? null;     // "xs" | "s" | "m" | "l" | "xl" | "xxl" | null
  const price = toInt(product?.price);
  const stock = toInt(product?.stock);
  const imageId = typeof image === "string" ? image : str(product?.image) || null;

  if (!name || !brand || !category || price === null || stock === null) {
    return NextResponse.json(
      { error: "Fields required: name, brand, category, price(int), stock(int)" },
      { status: 400 },
    );
  }
  if (price < 0 || stock < 0) {
    return NextResponse.json({ error: "price/stock must be >= 0" }, { status: 400 });
  }

  try {
    const [created] = await db
      .insert(products)
      .values({
        ...(productId ? { id: productId } : {}),
        name,
        brand,
        description,
        price,
        category,
        stock,
        image: imageId || null, // uuid из images.id, если есть
        gender: gender ?? undefined,
        size: size ?? undefined,
        // rating и createAt проставятся по умолчанию
      })
      .returning({
        id: products.id,
        name: products.name,
        brand: products.brand,
        description: products.description,
        price: products.price,
        stock: products.stock,
        image: products.image,
        gender: products.gender,
        size: products.size,
        category: products.category,
        createAt: products.createAt,
      });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    // ловим дубли id и прочие ограничения
    if (e?.code === "23505") {
      return NextResponse.json({ error: "Product with this id already exists" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
