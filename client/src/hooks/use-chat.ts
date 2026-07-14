import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

const SETTINGS_KEY = "soi_settings";

function getApiKeys(): Record<string, string> | undefined {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const settings = JSON.parse(saved);
      const keys: Record<string, string> = {};
      if (settings.deepseekApiKey) keys.deepseek = settings.deepseekApiKey;
      return Object.keys(keys).length > 0 ? keys : undefined;
    }
  } catch {}
  return undefined;
}

export function getDefaultModel(): string {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const settings = JSON.parse(saved);
      if (settings.defaultModel) return settings.defaultModel;
    }
  } catch {}
  return "gpt-5.2";
}

export function useProcessChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ message, model, history }: { message: string; model?: string; history?: { role: string; content: string }[] }) => {
      const apiKeys = getApiKeys();
      const res = await fetch(api.chat.process.path, {
        method: api.chat.process.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, model, history, apiKeys }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to process chat");
      const text = await res.text();
      try {
        return api.chat.process.responses[200].parse(JSON.parse(text));
      } catch {
        throw new Error("Server returned invalid response (non-JSON). Try refreshing the page.");
      }
    },
    onSuccess: (data) => {
      if (data.action) {
        if (data.action.includes("TASK") || data.action.includes("CATEGORY")) {
          queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["categories"] });
        }
      }
    }
  });
}
