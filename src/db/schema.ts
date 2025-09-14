// schema.ts
import {
  pgTable, uuid, text, integer, boolean, timestamp, bytea,
  uniqueIndex, pgEnum
} from "drizzle-orm/pg-core";
import { relations, InferSelectModel, InferInsertModel } from "drizzle-orm";

/* ========================= Enums ========================= */
// Подправь значения под свой домен при необходимости.
export const userRoleEnum     = pgEnum("user_role", ["user", "admin", "manager"]);
export const orderStatusEnum  = pgEnum("order_status", ["pending", "paid", "shipped", "delivered", "cancelled"]);
export const payMethodEnum    = pgEnum("pay_method", ["card", "cash", "transfer"]);
export const productGenderEnum= pgEnum("product_gender", ["male", "female", "unisex"]);
export const productSizeEnum  = pgEnum("product_size", ["xs", "s", "m", "l", "xl", "xxl"]);

/* ========================= Core tables ========================= */

export const users = pgTable("users", {
  id:        uuid("id").defaultRandom().primaryKey(),
  firstName: text("firstName").notNull(),
  address:   text("address"),                 // как на диаграмме, хотя адреса вынесены в отдельную таблицу
  email:     text("email").notNull().unique(),
  phone:     text("phone"),
  password:  text("password").notNull(),
  role:      userRoleEnum("role").notNull().default("user"),
  lastName:  text("lastName"),
  createAt:  timestamp("createAt").notNull().defaultNow(),
});

export const images = pgTable("images", {
  id:         uuid("id").defaultRandom().primaryKey(),
  image_name: text("image_name").notNull(),
  image_data: bytea("image_data").notNull(),
});

export const categories = pgTable("categories", {
  id:          uuid("id").defaultRandom().primaryKey(),
  // На диаграмме тип у name проставлен как bigint — считаю это опечаткой; делаю text.
  name:        text("name").notNull().unique(),
  description: text("description"),
});

export const products = pgTable("products", {
  id:          uuid("id").defaultRandom().primaryKey(),
  brand:       text("brand").notNull(),
  category:    uuid("category").notNull().references(() => categories.id, { onDelete: "restrict", onUpdate: "cascade" }),
  name:        text("name").notNull(),
  description: text("description"),
  price:       integer("price").notNull(),
  gender:      productGenderEnum("gender"),
  size:        productSizeEnum("size"),
  rating:      integer("rating").notNull().default(0),
  createAt:    timestamp("createAt").notNull().defaultNow(),
  stock:       integer("stock").notNull(),
  image:       uuid("image").references(() => images.id, { onDelete: "set null" }),
});

export const addresses = pgTable("addresses", {
  id:        uuid("id").defaultRandom().primaryKey(),
  user:      uuid("user").notNull().references(() => users.id, { onDelete: "cascade" }),
  city:      text("city").notNull(),
  street:    text("street").notNull(),
  building:  integer("building"),
  entrance:  integer("entrance"),
  floor:     integer("floor"),
  apartment: integer("apartment"),
});

export const orders = pgTable("orders", {
  id:        uuid("id").defaultRandom().primaryKey(),
  user:      uuid("user").notNull().references(() => users.id, { onDelete: "restrict" }),
  // В диаграмме поле называется во множественном числе — оставляю как есть.
  addresses: uuid("addresses").notNull().references(() => addresses.id, { onDelete: "restrict" }),
  status:    orderStatusEnum("status").notNull().default("pending"),
  price:     integer("price").notNull(),
  pay_method:payMethodEnum("pay_method").notNull(),
  delivery:  boolean("delivery").notNull().default(true),
  createAt:  timestamp("createAt").notNull().defaultNow(),
});

export const order_item = pgTable("order_item", {
  id:       uuid("id").defaultRandom().primaryKey(),
  order:    uuid("order").notNull().references(() => orders.id, { onDelete: "cascade" }),
  product:  uuid("product").notNull().references(() => products.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  price:    integer("price").notNull(),
});

export const cart_item = pgTable("cart_item", {
  id:       uuid("id").defaultRandom().primaryKey(),
  // На диаграмме тип text — оставляю как session/user-cart-id без внешнего ключа.
  cart:     text("cart").notNull(),
  product:  uuid("product").notNull().references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
}, (t) => ({
  // один и тот же товар в одной "корзине" — единственный
  uxCartProduct: uniqueIndex("ux_cart_product").on(t.cart, t.product),
}));

/* ========================= Relations (for drizzle-orm/relations) ========================= */

export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  orders:    many(orders),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const imagesRelations = relations(images, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.category], references: [categories.id] }),
  image:    one(images,     { fields: [products.image],    references: [images.id] }),
  orderItems: many(order_item),
  cartItems:  many(cart_item),
}));

export const addressesRelations = relations(addresses, ({ one, many }) => ({
  user:   one(users,   { fields: [addresses.user], references: [users.id] }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user:       one(users,     { fields: [orders.user],      references: [users.id] }),
  address:    one(addresses, { fields: [orders.addresses], references: [addresses.id] }),
  items:      many(order_item),
}));

export const orderItemRelations = relations(order_item, ({ one }) => ({
  order:   one(orders,   { fields: [order_item.order],   references: [orders.id] }),
  product: one(products, { fields: [order_item.product], references: [products.id] }),
}));

export const cartItemRelations = relations(cart_item, ({ one }) => ({
  product: one(products, { fields: [cart_item.product], references: [products.id] }),
}));

/* ========================= Inferred Types ========================= */

export type User        = InferSelectModel<typeof users>;
export type NewUser     = InferInsertModel<typeof users>;
export type Product     = InferSelectModel<typeof products>;
export type NewProduct  = InferInsertModel<typeof products>;
export type Category    = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;
export type Address     = InferSelectModel<typeof addresses>;
export type NewAddress  = InferInsertModel<typeof addresses>;
export type Order       = InferSelectModel<typeof orders>;
export type NewOrder    = InferInsertModel<typeof orders>;
export type OrderItem   = InferSelectModel<typeof order_item>;
export type NewOrderItem= InferInsertModel<typeof order_item>;
export type CartItem    = InferSelectModel<typeof cart_item>;
export type NewCartItem = InferInsertModel<typeof cart_item>;
export type ImageRow    = InferSelectModel<typeof images>;
export type NewImageRow = InferInsertModel<typeof images>;
