"use server";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { eq } from "drizzle-orm";
import { cart_item } from "@/src/db/schema";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // поддерживаем оба формата: [id, quantity] и { id, quantity }
  let id: string | undefined;
  let quantity: number | undefined;

  if (Array.isArray(payload)) {
    [id, quantity] = payload as [string, number];
  } else if (payload && typeof payload === "object") {
    const p = payload as { id?: string; quantity?: number };
    id = p.id;
    quantity = p.quantity;
  }

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid cart item id" }, { status: 400 });
  }
  const q = Number(quantity);
  if (!Number.isInteger(q) || q < 1 || q > 10) {
    return NextResponse.json({ error: "Quantity must be 1..10" }, { status: 400 });
  }

  const [updated] = await db
    .update(cart_item)
    .set({ quantity: q })
    .where(eq(cart_item.id, id)) // важно: сначала колонка, потом значение
    .returning({ id: cart_item.id, quantity: cart_item.quantity });

  if (!updated) {
    return NextResponse.json({ error: "Cart item not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "success", cartItem: updated });
}
