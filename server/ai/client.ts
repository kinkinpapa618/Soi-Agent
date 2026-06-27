import OpenAI from "openai";
import type { Models } from "./types";

export function createAIClients(): Models {
  const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  const nvidiaClient = new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY || "",
    baseURL: "https://integrate.api.nvidia.com/v1",
  });

  // GLM provider client (use a separate env var for the key and optional base URL)
  const glmClient = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_GLM_API_KEY || process.env.GLM_API_KEY || "",
    baseURL: process.env.AI_INTEGRATIONS_GLM_BASE_URL || undefined,
  });

  return {
    "glm-4.7-flash": { client: glmClient, model: "glm-4.7-flash" },
    "gpt-5.2": { client: openai, model: "gpt-5.2" },
    "gpt-5.1": { client: openai, model: "gpt-5.1" },
    "gpt-4o": { client: openai, model: "gpt-4o" },
    "gpt-4o-mini": { client: openai, model: "gpt-4o-mini" },
    "o3": { client: openai, model: "o3" },
    "gemma-2-2b-it": { client: nvidiaClient, model: "google/gemma-2-2b-it" },
  };
}
