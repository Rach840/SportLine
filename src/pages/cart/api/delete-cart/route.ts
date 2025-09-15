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

  // ожидаем строку id; на всякий случай поддержим { id }
  const id =
    typeof payload === "string"
      ? payload
      : typeof payload === "object" && payload !== null && typeof (payload as any).id === "string"
        ? (payload as any).id
        : undefined;

  if (!id) {
    return NextResponse.json({ error: "Invalid cart item id" }, { status: 400 });
  }

  const deleted = await db
    .delete(cart_item)
    .where(eq(cart_item.id, id)) // важно: сначала колонка, потом значение
    .returning({ id: cart_item.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Cart item not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "success", id: deleted[0].id });
}
