import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useProcessChat() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ message, model, history }: { message: string; model?: string; history?: { role: string; content: string }[] }) => {
      const res = await fetch(api.chat.process.path, {
        method: api.chat.process.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, model, history }),
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to process chat");
      return api.chat.process.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      if (data.action) {
        if (data.action.includes("PRODUCT")) {
          queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
        }
        if (data.action.includes("ORDER")) {
          queryClient.invalidateQueries({ queryKey: [api.orders.list.path] });
        }
      }
    }
  });
}
