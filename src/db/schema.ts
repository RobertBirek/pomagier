import {
  pgTable,
  text,
  integer,
  timestamp,
  uuid,
  varchar,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  subiektUzId: integer("subiekt_uz_id").notNull().unique(),
  pin: varchar("pin", { length: 64 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("operator"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const loginAttempts = pgTable("login_attempts", {
  subiektUzId: integer("subiekt_uz_id").primaryKey(),
  failures: integer("failures").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const idempotencyKeys = pgTable("idempotency_keys", {
  key: varchar("key", { length: 128 }).primaryKey(),
  response: text("response").notNull(),
  statusCode: integer("status_code").notNull().default(200),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  correlationId: varchar("correlation_id", { length: 36 }).notNull(),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 50 }).notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const config = pgTable("config", {
  key: varchar("key", { length: 50 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const locations = pgTable("locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 30 }).notNull().unique(),
  area: varchar("area", { length: 5 }).notNull(),
  aisle: integer("aisle").notNull(),
  rack: integer("rack").notNull(),
  shelf: integer("shelf").notNull(),
  spot: integer("spot").notNull().default(1),
  label: varchar("label", { length: 100 }).notNull(),
  createdBy: varchar("created_by", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productLocations = pgTable(
  "product_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: integer("product_id").notNull(),
    locationId: uuid("location_id")
      .references(() => locations.id)
      .notNull(),
    quantity: integer("quantity").default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqueProductLocation: uniqueIndex("unique_product_location").on(t.productId, t.locationId),
  }),
);

export const productMovements = pgTable("product_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: integer("product_id").notNull(),
  symbol: varchar("symbol", { length: 50 }),
  name: varchar("name", { length: 100 }),
  fromLocationId: uuid("from_location_id"),
  toLocationId: uuid("to_location_id"),
  fromCode: varchar("from_code", { length: 20 }),
  toCode: varchar("to_code", { length: 20 }),
  quantity: integer("quantity").notNull().default(1),
  operator: varchar("operator", { length: 100 }),
  correlationId: varchar("correlation_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Szybki cache podstawowych danych produktów z Subiekta GT do użycia w koszyku skanów.
 *  Klucz główny = tw_Id (integer). Aktualizowany przy każdym skanie. */
export const productsCache = pgTable(
  "products_cache",
  {
    id: integer("id").primaryKey(),
    symbol: varchar("symbol", { length: 50 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    barcode: varchar("barcode", { length: 50 }),
    unit: varchar("unit", { length: 10 }).default("szt"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    barcodeIdx: index("idx_pc_barcode").on(t.barcode),
    symbolIdx: index("idx_pc_symbol").on(t.symbol),
  }),
);
