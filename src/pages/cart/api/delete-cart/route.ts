"use server";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { eq } from "drizzle-orm";
import { cart_item } from "@/src/db/schema";

export async function POST(request: Request) {
  const cartItemId = await request.json();

  await db.delete(cart_item).where(eq(cart_item.id, cartItemId));
  return NextResponse.json("success");
}
