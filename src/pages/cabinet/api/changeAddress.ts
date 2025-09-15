"use server";

import { db } from "@/src/db";
import { addresses, users } from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";

type AddressInput = {
  id?: string;           // id адреса (если редактируем существующий)
  city: string;
  street: string;
  building?: number | null;
  entrance?: number | null;
  floor?: number | null;
  apartment?: number | null;
};

export async function updateAddress(userId: string, input: AddressInput) {
  const cookieStore = await cookies(); // не await

  try {
    const result = await db.transaction(async (tx) => {
      // 1) вставка или обновление адреса
      let savedAddress;
      if (input.id) {
        const [row] = await tx
          .update(addresses)
          .set({
            city: input.city,
            street: input.street,
            building: input.building ?? null,
            entrance: input.entrance ?? null,
            floor: input.floor ?? null,
            apartment: input.apartment ?? null,
          })
          .where(and(eq(addresses.id, input.id), eq(addresses.user, userId)))
          .returning();
        if (!row) throw new Error("Address not found or belongs to another user");
        savedAddress = row;
      } else {
        const [row] = await tx
          .insert(addresses)
          .values({
            user: userId,
            city: input.city,
            street: input.street,
            building: input.building ?? null,
            entrance: input.entrance ?? null,
            floor: input.floor ?? null,
            apartment: input.apartment ?? null,
          })
          .returning();
        savedAddress = row;
      }

      // 2) подготавливаем «публичного» пользователя без пароля
      const [publicUser] = await tx
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          phone: users.phone,
          role: users.role,
          createAt: users.createAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      // 3) можно вернуть и полный список адресов пользователя (если нужно хранить в cookie/стейте)
      const userAddresses = await tx
        .select()
        .from(addresses)
        .where(eq(addresses.user, userId));

      return { publicUser, userAddresses, savedAddress };
    });

    // Обновляем cookie безопасно — без пароля
    cookieStore.set(
      "user",
      JSON.stringify({ ...result.publicUser, addresses: result.userAddresses }),
      { path: "/", httpOnly: false, sameSite: "lax", secure: true }
    );

    return "Ваш профиль успешно изменён!";
  } catch (e) {
    console.error(e);
    return "Произошла ошибка!";
  }
}
