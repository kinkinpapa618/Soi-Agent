import type OpenAI from "openai";

export interface AIModelConfig {
  client: OpenAI;
  model: string;
}

export type Models = Record<string, AIModelConfig>;

export interface ChatRequest {
  message: string;
  model?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  apiKeys?: Record<string, string>;
  userId: number;
}

export interface ChatResponse {
  reply: string;
  action?: string;
  data?: unknown;
}

export interface AgentContext {
  tasks: { id: number; title: string; status: string; priority: string; dueDate: string | null; categoryId: number | null }[];
  categories: { id: number; name: string; color: string }[];
  memories: { summary: string }[];
  customInstructions: { trigger: string; instruction: string; example: string | null }[];
  dailyStats: { total: number; completed: number; pending: number };
}
