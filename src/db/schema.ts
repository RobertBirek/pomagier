import {
  pgTable,
  text,
  integer,
  timestamp,
  uuid,
  varchar,
  boolean,
  uniqueIndex,
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
  code: varchar("code", { length: 20 }).notNull().unique(),
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
