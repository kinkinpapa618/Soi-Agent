import { pgTable, serial, text, integer, jsonb, timestamp, boolean, time } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// --- Auth ---

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  timezone: text("timezone").default("Asia/Ho_Chi_Minh"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// --- Session (for connect-pg-simple) ---

export const sessionTable = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// --- Categories ---

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").default("#3b82f6").notNull(),
  icon: text("icon").default("📋"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// --- Tasks ---

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("pending").notNull(), // pending | in_progress | completed | cancelled
  priority: text("priority").default("medium").notNull(), // low | medium | high | urgent
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  reminderAt: timestamp("reminder_at", { withTimezone: true }),
  parentId: integer("parent_id"),
  estimatedMinutes: integer("estimated_minutes"),
  actualMinutes: integer("actual_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// --- Recurring Rules ---

export const recurringRules = pgTable("recurring_rules", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // daily | weekly | monthly
  interval: integer("interval").default(1),
  daysOfWeek: jsonb("days_of_week"), // [1,3,5] = Mon,Wed,Fri
  daysOfMonth: jsonb("days_of_month"), // [1,15]
  nextOccurrence: timestamp("next_occurrence", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// --- Task Activities ---

export const taskActivities = pgTable("task_activities", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // created | updated | completed | reopened | reminded
  changes: jsonb("changes"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// --- User Preferences ---

export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").unique().notNull().references(() => users.id, { onDelete: "cascade" }),
  defaultReminderTime: time("default_reminder_time").default("08:00"),
  workingStartTime: time("working_start_time").default("08:00"),
  workingEndTime: time("working_end_time").default("18:00"),
  language: text("language").default("vi"),
  emailNotifications: boolean("email_notifications").default(true),
  webNotifications: boolean("web_notifications").default(true),
});

// --- Insert schemas ---

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, userId: true, createdAt: true, updatedAt: true, completedAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, userId: true, createdAt: true });
export const insertRecurringRuleSchema = createInsertSchema(recurringRules).omit({ id: true, createdAt: true });
export const insertTaskActivitySchema = createInsertSchema(taskActivities).omit({ id: true, createdAt: true });
export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({ id: true, userId: true });

// --- Types ---

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type RecurringRule = typeof recurringRules.$inferSelect;
export type InsertRecurringRule = z.infer<typeof insertRecurringRuleSchema>;
export type TaskActivity = typeof taskActivities.$inferSelect;
export type InsertTaskActivity = z.infer<typeof insertTaskActivitySchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
