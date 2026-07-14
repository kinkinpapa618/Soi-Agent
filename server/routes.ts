import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { chatStorage } from "./replit_integrations/chat/storage";
import { brain } from "./brain";
import { registerAIRoutes } from "./ai";
import { setupAuth, isAuthenticated } from "./auth";
import { z } from "zod";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Health check
  app.get("/health", (_req, res) => { res.json({ status: "ok", db: !!process.env.DATABASE_URL }); });

  // Auth
  setupAuth(app);

  // --- Protected routes below ---
  const auth = isAuthenticated;

  // Tasks
  app.get("/api/tasks", auth, async (req, res) => {
    try {
      const user = (req as any).user;
      const tasks = await storage.getTasks(user.id, {
        status: req.query.status as string | undefined,
        priority: req.query.priority as string | undefined,
        categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
        dueToday: req.query.dueToday === "true",
        dueThisWeek: req.query.dueThisWeek === "true",
      });
      res.json(tasks);
    } catch (err) { res.status(500).json({ error: "Failed to fetch tasks" }); }
  });

  app.get("/api/tasks/stats", auth, async (req, res) => {
    try {
      const user = (req as any).user;
      const stats = await storage.getDailyStats(user.id);
      res.json(stats);
    } catch (err) { res.status(500).json({ error: "Failed to fetch stats" }); }
  });

  app.get("/api/tasks/:id", auth, async (req, res) => {
    try {
      const user = (req as any).user;
      const task = await storage.getTask(Number(req.params.id), user.id);
      if (!task) return res.status(404).json({ error: "Not found" });
      const activities = await storage.getActivities(Number(req.params.id));
      res.json({ ...task, activities });
    } catch (err) { res.status(500).json({ error: "Failed to fetch task" }); }
  });

  app.post("/api/tasks", auth, async (req, res) => {
    try {
      const user = (req as any).user;
      const input = z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        dueDate: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        categoryId: z.number().optional(),
        estimatedMinutes: z.number().optional(),
        reminderAt: z.string().optional(),
      }).parse(req.body);

      const task = await storage.createTask(user.id, {
        title: input.title,
        description: input.description || null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        priority: input.priority || "medium",
        categoryId: input.categoryId || null,
        estimatedMinutes: input.estimatedMinutes || null,
        reminderAt: input.reminderAt ? new Date(input.reminderAt) : null,
      });

      await storage.logActivity({ taskId: task.id, userId: user.id, action: "created" });
      res.status(201).json(task);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/tasks/:id", auth, async (req, res) => {
    try {
      const user = (req as any).user;
      const input = z.object({
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        dueDate: z.string().nullable().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
        categoryId: z.number().nullable().optional(),
        estimatedMinutes: z.number().nullable().optional(),
        reminderAt: z.string().nullable().optional(),
      }).parse(req.body);

      const updates: Record<string, unknown> = {};
      if (input.title !== undefined) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      if (input.dueDate !== undefined) updates.dueDate = input.dueDate ? new Date(input.dueDate) : null;
      if (input.priority !== undefined) updates.priority = input.priority;
      if (input.status !== undefined) updates.status = input.status;
      if (input.categoryId !== undefined) updates.categoryId = input.categoryId;
      if (input.estimatedMinutes !== undefined) updates.estimatedMinutes = input.estimatedMinutes;
      if (input.reminderAt !== undefined) updates.reminderAt = input.reminderAt ? new Date(input.reminderAt) : null;

      const task = await storage.updateTask(Number(req.params.id), user.id, updates);
      await storage.logActivity({ taskId: task.id, userId: user.id, action: "updated", changes: updates });
      res.json(task);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/tasks/:id/complete", auth, async (req, res) => {
    try {
      const user = (req as any).user;
      const task = await storage.completeTask(Number(req.params.id), user.id);
      await storage.logActivity({ taskId: task.id, userId: user.id, action: "completed" });
      res.json(task);
    } catch (err) { res.status(500).json({ error: "Failed to complete task" }); }
  });

  app.delete("/api/tasks/:id", auth, async (req, res) => {
    try {
      const user = (req as any).user;
      await storage.deleteTask(Number(req.params.id), user.id);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to delete task" }); }
  });

  // Categories
  app.get("/api/categories", auth, async (req, res) => {
    try {
      const user = (req as any).user;
      const cats = await storage.getCategories(user.id);
      res.json(cats);
    } catch (err) { res.status(500).json({ error: "Failed to fetch categories" }); }
  });

  app.post("/api/categories", auth, async (req, res) => {
    try {
      const user = (req as any).user;
      const input = z.object({ name: z.string().min(1), color: z.string().optional(), icon: z.string().optional() }).parse(req.body);
      const cat = await storage.createCategory(user.id, input);
      res.status(201).json(cat);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/categories/:id", auth, async (req, res) => {
    try {
      const user = (req as any).user;
      const input = z.object({ name: z.string().optional(), color: z.string().optional(), icon: z.string().optional() }).parse(req.body);
      const cat = await storage.updateCategory(Number(req.params.id), user.id, input);
      res.json(cat);
    } catch (err) { res.status(500).json({ error: "Failed to update category" }); }
  });

  app.delete("/api/categories/:id", auth, async (req, res) => {
    try {
      const user = (req as any).user;
      await storage.deleteCategory(Number(req.params.id), user.id);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to delete category" }); }
  });

  // Preferences
  app.get("/api/preferences", auth, async (req, res) => {
    try {
      const user = (req as any).user;
      const prefs = await storage.getPreferences(user.id);
      res.json(prefs || {});
    } catch (err) { res.status(500).json({ error: "Failed to fetch preferences" }); }
  });

  app.put("/api/preferences", auth, async (req, res) => {
    try {
      const user = (req as any).user;
      const input = z.object({
        defaultReminderTime: z.string().optional(),
        workingStartTime: z.string().optional(),
        workingEndTime: z.string().optional(),
        language: z.string().optional(),
        emailNotifications: z.boolean().optional(),
        webNotifications: z.boolean().optional(),
      }).parse(req.body);
      const prefs = await storage.upsertPreferences(user.id, input);
      res.json(prefs);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
      res.status(500).json({ error: err.message });
    }
  });

  // AI module - chat + brain instructions
  registerAIRoutes(app, storage, chatStorage, brain);

  return httpServer;
}
