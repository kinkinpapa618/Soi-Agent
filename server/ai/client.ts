import OpenAI from "openai";
import type { Models } from "./types";

function createSafeClient(apiKey?: string, baseURL?: string): OpenAI | null {
  try {
    if (!apiKey) return null;
    return new OpenAI({ apiKey, baseURL });
  } catch {
    return null;
  }
}

export function createAIClients(apiKeys?: Record<string, string>): Models {
  const openai = createSafeClient(
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  );

  const nvidiaClient = createSafeClient(
    process.env.NVIDIA_API_KEY,
    "https://integrate.api.nvidia.com/v1",
  );

  const deepseekApiKey = apiKeys?.deepseek || process.env.DEEPSEEK_API_KEY;
  const deepseekClient = createSafeClient(deepseekApiKey, "https://api.deepseek.com");

  const models: Models = {};

  if (openai) {
    models["gpt-5.2"] = { client: openai, model: "gpt-5.2" };
    models["gpt-5.1"] = { client: openai, model: "gpt-5.1" };
    models["gpt-4o"] = { client: openai, model: "gpt-4o" };
    models["gpt-4o-mini"] = { client: openai, model: "gpt-4o-mini" };
    models["o3"] = { client: openai, model: "o3" };
  }

  if (nvidiaClient) {
    models["gemma-2-2b-it"] = { client: nvidiaClient, model: "google/gemma-2-2b-it" };
  }

  if (deepseekClient) {
    models["deepseek-chat"] = { client: deepseekClient, model: "deepseek-chat" };
    models["deepseek-reasoner"] = { client: deepseekClient, model: "deepseek-reasoner" };
  }

  return models;
}

export const AVAILABLE_MODELS = [
  { id: "gpt-5.2", name: "GPT-5.2", provider: "openai" },
  { id: "gpt-5.1", name: "GPT-5.1", provider: "openai" },
  { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
  { id: "gpt-4o-mini", name: "GPT-4o-mini", provider: "openai" },
  { id: "o3", name: "O3", provider: "openai" },
  { id: "gemma-2-2b-it", name: "Gemma 2 2B IT", provider: "nvidia" },
  { id: "deepseek-chat", name: "DeepSeek Chat", provider: "deepseek" },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner", provider: "deepseek" },
];