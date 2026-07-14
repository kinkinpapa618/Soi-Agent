import { z } from "zod";

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  // Auth
  auth: {
    login:    { method: "POST" as const, path: "/api/auth/login" as const },
    register: { method: "POST" as const, path: "/api/auth/register" as const },
    logout:   { method: "POST" as const, path: "/api/auth/logout" as const },
    me:       { method: "GET"  as const, path: "/api/auth/me" as const },
  },

  // Tasks
  tasks: {
    list: {
      method: "GET" as const,
      path: "/api/tasks" as const,
      query: z.object({ status: z.string().optional(), priority: z.string().optional(), categoryId: z.coerce.number().optional(), dueToday: z.string().optional(), dueThisWeek: z.string().optional() }).optional(),
    },
    get: {
      method: "GET" as const,
      path: "/api/tasks/:id" as const,
    },
    create: {
      method: "POST" as const,
      path: "/api/tasks" as const,
      input: z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        dueDate: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        categoryId: z.number().optional(),
        estimatedMinutes: z.number().optional(),
        reminderAt: z.string().optional(),
      }),
      responses: { 201: z.any() },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/tasks/:id" as const,
      input: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        dueDate: z.string().nullable().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
        categoryId: z.number().nullable().optional(),
        estimatedMinutes: z.number().nullable().optional(),
        reminderAt: z.string().nullable().optional(),
      }),
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/tasks/:id" as const,
    },
    complete: {
      method: "POST" as const,
      path: "/api/tasks/:id/complete" as const,
    },
    stats: {
      method: "GET" as const,
      path: "/api/tasks/stats" as const,
    },
  },

  // Categories
  categories: {
    list:   { method: "GET" as const,    path: "/api/categories" as const },
    create: { method: "POST" as const,   path: "/api/categories" as const, input: z.object({ name: z.string().min(1), color: z.string().optional(), icon: z.string().optional() }) },
    update: { method: "PATCH" as const,  path: "/api/categories/:id" as const },
    delete: { method: "DELETE" as const, path: "/api/categories/:id" as const },
  },

  // Preferences
  preferences: {
    get:    { method: "GET" as const,    path: "/api/preferences" as const },
    upsert: { method: "PUT" as const,    path: "/api/preferences" as const },
  },

  // Chat
  chat: {
    process: {
      method: "POST" as const,
      path: "/api/chat/process" as const,
      input: z.object({
        message: z.string(),
        model: z.string().optional(),
        history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional(),
        apiKeys: z.record(z.string()).optional(),
      }),
      responses: { 200: z.object({ reply: z.string(), action: z.string().optional(), data: z.any().optional() }) },
    },
  },

  // Brain
  brain: {
    list:   { method: "GET" as const,    path: "/api/brain/instructions" as const },
    create: { method: "POST" as const,   path: "/api/brain/instructions" as const },
    update: { method: "PATCH" as const,  path: "/api/brain/instructions/:id" as const },
    delete: { method: "DELETE" as const, path: "/api/brain/instructions/:id" as const },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => { url = url.replace(`:${key}`, String(value)); });
  }
  return url;
}

export type ChatInput = z.infer<typeof api.chat.process.input>;
export type ChatResponse = z.infer<typeof api.chat.process.responses[200]>;
