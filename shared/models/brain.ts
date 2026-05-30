import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const instructions = pgTable("instructions", {
  id: serial("id").primaryKey(),
  trigger: text("trigger").notNull(),
  instruction: text("instruction").notNull(),
  example: text("example"),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertInstructionSchema = createInsertSchema(instructions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Instruction = typeof instructions.$inferSelect;
export type InsertInstruction = z.infer<typeof insertInstructionSchema>;