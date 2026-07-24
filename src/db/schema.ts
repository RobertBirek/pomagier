import { pgTable, text, integer, timestamp, uuid, varchar, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  pin: varchar("pin", { length: 10 }).notNull(),
  firstName: varchar("first_name", { length: 50 }).notNull(),
  lastName: varchar("last_name", { length: 50 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("operator"),
  warehouseId: integer("warehouse_id"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 30 }).notNull().unique(),
  permissions: text("permissions")
    .array()
    .notNull()
    .$default(() => []),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const terminals = pgTable("terminals", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  type: varchar("type", { length: 30 }).notNull().default("android"),
  lastActive: timestamp("last_active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  terminalId: uuid("terminal_id").references(() => terminals.id),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  correlationId: varchar("correlation_id", { length: 36 }).notNull(),
  userId: uuid("user_id").references(() => users.id),
  terminalId: uuid("terminal_id").references(() => terminals.id),
  action: varchar("action", { length: 50 }).notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
