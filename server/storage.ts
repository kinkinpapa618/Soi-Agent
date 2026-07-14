import { db } from "./db";
import {
  tasks,
  categories,
  recurringRules,
  taskActivities,
  userPreferences,
  type InsertTask,
  type InsertCategory,
  type InsertRecurringRule,
  type InsertTaskActivity,
  type InsertUserPreferences,
  type Task,
  type Category,
  type RecurringRule,
  type TaskActivity,
  type UserPreferences,
} from "@shared/schema";
import { eq, and, desc, gte, lt, inArray, sql } from "drizzle-orm";

// --- Categories ---

export interface ICategoryStorage {
  getCategories(userId: number): Promise<Category[]>;
  createCategory(userId: number, input: InsertCategory): Promise<Category>;
  updateCategory(id: number, userId: number, input: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number, userId: number): Promise<void>;
}

// --- Tasks ---

export interface ITaskStorage {
  getTasks(userId: number, filters?: { status?: string; priority?: string; categoryId?: number; dueToday?: boolean; dueThisWeek?: boolean }): Promise<Task[]>;
  getTask(id: number, userId: number): Promise<Task | undefined>;
  createTask(userId: number, input: InsertTask): Promise<Task>;
  updateTask(id: number, userId: number, input: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: number, userId: number): Promise<void>;
  completeTask(id: number, userId: number): Promise<Task>;
  getDailyStats(userId: number): Promise<{ total: number; completed: number; pending: number }>;
}

// --- Recurring Rules ---

export interface IRecurringRuleStorage {
  getRuleForTask(taskId: number): Promise<RecurringRule | undefined>;
  createRule(input: InsertRecurringRule): Promise<RecurringRule>;
  updateRule(id: number, input: Partial<InsertRecurringRule>): Promise<RecurringRule>;
  deleteRule(id: number): Promise<void>;
}

// --- Task Activities ---

export interface ITaskActivityStorage {
  getActivities(taskId: number): Promise<TaskActivity[]>;
  logActivity(activity: InsertTaskActivity): Promise<TaskActivity>;
}

// --- User Preferences ---

export interface IUserPreferencesStorage {
  getPreferences(userId: number): Promise<UserPreferences | undefined>;
  upsertPreferences(userId: number, input: InsertUserPreferences): Promise<UserPreferences>;
}

export interface IStorage extends ICategoryStorage, ITaskStorage, IRecurringRuleStorage, ITaskActivityStorage, IUserPreferencesStorage {}

export class DatabaseStorage implements IStorage {
  // Categories
  async getCategories(userId: number) {
    return db.select().from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(desc(categories.isDefault), desc(categories.createdAt));
  }

  async createCategory(userId: number, input: InsertCategory) {
    const [created] = await db.insert(categories).values({ ...input, userId }).returning();
    return created;
  }

  async updateCategory(id: number, userId: number, input: Partial<InsertCategory>) {
    const [updated] = await db.update(categories)
      .set(input)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning();
    return updated;
  }

  async deleteCategory(id: number, userId: number) {
    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
  }

  // Tasks
  async getTasks(userId: number, filters: any = {}) {
    const conditions = [eq(tasks.userId, userId)];

    if (filters.status) {
      conditions.push(eq(tasks.status, filters.status));
    }
    if (filters.priority) {
      conditions.push(eq(tasks.priority, filters.priority));
    }
    if (filters.categoryId) {
      conditions.push(eq(tasks.categoryId, filters.categoryId));
    }

    const now = new Date();
    if (filters.dueToday) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start.getTime() + 86400000);
      conditions.push(gte(tasks.dueDate, start));
      conditions.push(lt(tasks.dueDate, end));
    }
    if (filters.dueThisWeek) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const end = new Date(start.getTime() + 7 * 86400000);
      conditions.push(gte(tasks.dueDate, start));
      conditions.push(lt(tasks.dueDate, end));
    }

    return db.select().from(tasks)
      .where(and(...conditions))
      .orderBy(
        desc(sql`CASE WHEN priority = 'urgent' THEN 3 WHEN priority = 'high' THEN 2 WHEN priority = 'medium' THEN 1 ELSE 0 END`),
        desc(tasks.dueDate),
        desc(tasks.createdAt)
      );
  }

  async getTask(id: number, userId: number) {
    const [task] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    return task;
  }

  async createTask(userId: number, input: InsertTask) {
    const [created] = await db.insert(tasks).values({ ...input, userId }).returning();
    return created;
  }

  async updateTask(id: number, userId: number, input: Partial<InsertTask>) {
    const [updated] = await db.update(tasks)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      .returning();
    return updated;
  }

  async deleteTask(id: number, userId: number) {
    await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  }

  async completeTask(id: number, userId: number) {
    const [completed] = await db.update(tasks)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      .returning();
    return completed;
  }

  async getDailyStats(userId: number) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 86400000);

    const all = await db.select().from(tasks)
      .where(and(eq(tasks.userId, userId), gte(tasks.dueDate, start), lt(tasks.dueDate, end)));

    return {
      total: all.length,
      completed: all.filter(t => t.status === "completed").length,
      pending: all.filter(t => t.status !== "completed" && t.status !== "cancelled").length,
    };
  }

  // Recurring Rules
  async getRuleForTask(taskId: number) {
    const [rule] = await db.select().from(recurringRules).where(eq(recurringRules.taskId, taskId));
    return rule;
  }

  async createRule(input: InsertRecurringRule) {
    const [created] = await db.insert(recurringRules).values(input).returning();
    return created;
  }

  async updateRule(id: number, input: Partial<InsertRecurringRule>) {
    const [updated] = await db.update(recurringRules).set(input).where(eq(recurringRules.id, id)).returning();
    return updated;
  }

  async deleteRule(id: number) {
    await db.delete(recurringRules).where(eq(recurringRules.id, id));
  }

  // Task Activities
  async getActivities(taskId: number) {
    return db.select().from(taskActivities)
      .where(eq(taskActivities.taskId, taskId))
      .orderBy(desc(taskActivities.createdAt));
  }

  async logActivity(activity: InsertTaskActivity) {
    const [logged] = await db.insert(taskActivities).values(activity).returning();
    return logged;
  }

  // User Preferences
  async getPreferences(userId: number) {
    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    return prefs;
  }

  async upsertPreferences(userId: number, input: InsertUserPreferences) {
    const existing = await this.getPreferences(userId);
    if (existing) {
      const [updated] = await db.update(userPreferences)
        .set(input)
        .where(eq(userPreferences.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(userPreferences).values({ ...input, userId }).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
