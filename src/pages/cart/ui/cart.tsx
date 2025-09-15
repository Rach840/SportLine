"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/src/shared/ui/button";
import { Frown, Minus, Plus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/src/shared/ui/sheet";
import { useMediaQuery } from "@/src/shared/hooks/use-media-query";
import { useAuth } from "@/src/app/layouts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/shared/ui/dialog";

// Типы для читаемости. Ожидаем старый формат ответа API: { orderItem: {...}, product: {...} }
type Product = {
  id: string;
  name: string;
  price: number;
  image: string | null; // uuid (images.id) или уже готовый URL
  brand?: string | null;
};

type OrderItemDTO = {
  id: string;         // cart_item.id
  quantity: number;
};

type CartRow = {
  orderItem: OrderItemDTO;
  product: Product;
};

export default function Cart() {
  const router = useRouter();
  const { user } = useAuth();
  const [cart, setCart] = useState<CartRow[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // В новой схеме адреса — таблица addresses, поэтому проверяем массив
  const hasAddress = Array.isArray((user as any)?.addresses)
    ? ((user as any).addresses as unknown[]).length > 0
    : Boolean((user as any)?.address); // на случай старой cookie

  useEffect(() => {
    let ignore = false;
    async function fetchProducts() {
      if (!user?.id) return;
      try {
        // оставляю прежний эндпоинт чтобы не ломать бэкенд
        const response = await fetch(`/api/cart/get-cart/${user.id}/cart`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Failed to load cart");
        const data: CartRow[] = await response.json();
        if (!ignore) setCart(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!ignore) setCart([]);
        console.error(e);
      }
    }
    fetchProducts();
    return () => {
      ignore = true;
    };
  }, [user?.id]);

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + (Number(item.product.price) || 0) * (item.orderItem.quantity || 0),
        0,
      ),
    [cart],
  );

  function productImageSrc(p: Product) {
    if (!p?.image) return "/placeholder.svg";
    // если это UUID (36 символов с дефисами), берём через наш image API
    const looksLikeUuid = typeof p.image === "string" && p.image.length >= 32 && p.image.includes("-");
    return looksLikeUuid ? `/api/images/${p.image}` : p.image;
  }

  async function updateQuantity(id: string, variant: "plus" | "minus"): Promise<void> {
    setCart((prev) => {
      const next = prev.map((row) =>
        row.orderItem.id === id
          ? {
            ...row,
            orderItem: {
              ...row.orderItem,
              quantity:
                variant === "plus"
                  ? Math.min(row.orderItem.quantity + 1, 10)
                  : Math.max(row.orderItem.quantity - 1, 1),
            },
          }
          : row,
      );
      return next;
    });

    // отправляем на бэкенд (оставляю прежний контракт: [id, quantity])
    const changed = cart.find((x) => x.orderItem.id === id);
    const newQty = changed
      ? variant === "plus"
        ? Math.min(changed.orderItem.quantity + 1, 10)
        : Math.max(changed.orderItem.quantity - 1, 1)
      : 1;

    try {
      const res = await fetch(`/api/cart/change-cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([id, newQty]),
      });
      if (!res.ok) throw new Error("Failed to change quantity");
    } catch (e) {
      console.error(e);
      // откатываем, если ошибка
      setCart((prev) =>
        prev.map((row) =>
          row.orderItem.id === id
            ? {
              ...row,
              orderItem: {
                ...row.orderItem,
                quantity:
                  variant === "plus"
                    ? Math.max(row.orderItem.quantity - 1, 1)
                    : Math.min(row.orderItem.quantity + 1, 10),
              },
            }
            : row,
        ),
      );
    }
  }

  async function deleteCart(id: string) {
    // оптимистично удаляем
    const prev = cart;
    setCart((c) => c.filter((x) => x.orderItem.id !== id));

    try {
      const res = await fetch(`/api/cart/delete-cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id),
      });
      if (!res.ok) throw new Error("Failed to delete");
    } catch (e) {
      console.error(e);
      // откат
      setCart(prev);
    }
  }

  async function createOrder() {
    if (!hasAddress) {
      setIsDialogOpen(true);
      return;
    }

    try {
      const cartItemsId = cart.map((item) => item.orderItem.id);
      const cartProductsId = cart.map((item) => item.product.id);

      const res = await fetch(`/api/orders/set-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // старый контракт: [userId, productIds[], cartItemIds[]]
        body: JSON.stringify([user?.id, cartProductsId, cartItemsId]),
      });

      setIsDialogOpen(true);

      if (res.ok) {
        router.push("/cabinet");
      }
    } catch (e) {
      console.error(e);
      setIsDialogOpen(true);
    }
  }

  const CartContent = () => (
    <div className="space-y-4">
      {cart?.map((item) => (
        <div
          key={item.orderItem.id}
          className="flex items-center justify-between border-b pb-4"
        >
          <div className="flex items-center space-x-4">
            <img
              src={productImageSrc(item.product)}
              alt={item.product.name}
              className="w-20 h-20 object-cover rounded"
            />
            <div>
              <h3 className="font-semibold">{item.product.name}</h3>
              <p className="text-gray-600">
                {Number(item.product.price).toFixed(2)}₽
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                onClick={() => updateQuantity(item.orderItem.id, "minus")}
                disabled={item.orderItem.quantity <= 1}
              >
                <Minus />
                <span className="sr-only">Decrease</span>
              </Button>

              <div className="flex-1 text-center">
                <div className="text-xl font-bold tracking-tighter">
                  {item.orderItem.quantity}
                </div>
              </div>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                onClick={() => updateQuantity(item.orderItem.id, "plus")}
                disabled={item.orderItem.quantity >= 10}
              >
                <Plus />
                <span className="sr-only">Increase</span>
              </Button>
            </div>

            <Button
              variant="destructive"
              onClick={() => deleteCart(item.orderItem.id)}
              size="icon"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {hasAddress
                ? "Ваш заказ оформлен"
                : "Для оформления заказа требуется указать адрес"}
            </DialogTitle>
            <DialogDescription className="text-lg">
              {hasAddress
                ? "Можете посмотреть в личном кабинете"
                : "Укажите адрес в личном кабинете"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4"></div>
          <DialogFooter>
            {hasAddress ? (
              <div className="w-full flex space-x-3 justify-end">
                <Button onClick={() => setIsDialogOpen(false)}>Закрыть</Button>
                <Button asChild>
                  <Link href="/cabinet">Перейти в личный кабинет</Link>
                </Button>
              </div>
            ) : (
              <Button asChild>
                <Link href="/cabinet">Перейти в личный кабинет</Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-between items-center pt-4">
        <p className="text-xl font-semibold">Сумма:</p>
        <p className="text-xl font-bold">{total.toFixed(2)}₽</p>
      </div>

      <Button
        onClick={createOrder}
        className="bg-[#FFB800] hover:bg-[#E5A600] text-black w-full"
      >
        Оформить заказ
      </Button>
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Ваша корзина</h1>
      {cart.length === 0 ? (
        <div className="flex items-center justify-center py-10 space-x-2">
          <p className="text-2xl font-bold align-center">Ваша корзина пуста</p>
          <Frown />
        </div>
      ) : isMobile ? (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button>Посмотреть корзину</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Ваша корзина</SheetTitle>
              <SheetDescription>
                Посмотрите, что вы добавили в корзину
              </SheetDescription>
            </SheetHeader>
            <CartContent />
          </SheetContent>
        </Sheet>
      ) : (
        <CartContent />
      )}
    </div>
  );
}
