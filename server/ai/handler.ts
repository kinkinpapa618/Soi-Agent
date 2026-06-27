import type { Models, ChatRequest, ChatResponse, AgentContext } from "./types";
import type { IStorage } from "../storage";
import type { IChatStorage } from "../replit_integrations/chat/storage";
import type { IBrain } from "./brain";

function summarizeArray<T>(arr: T[], limit = 10) {
  try {
    return arr.slice(0, limit);
  } catch (e) {
    return [] as T[];
  }
}

function buildSystemPrompt(ctx: AgentContext): string {
  const memoryContext = ctx.memories.length > 0
    ? "\n\nPrevious conversation summaries (for context continuity):\n" +
      ctx.memories.map((m, i) => `[Past ${i + 1}]: ${m.summary}`).join("\n")
    : "";

  const brainContext = ctx.customInstructions.length > 0
    ? "\n\nCustom instructions from user (follow these when triggered):\n" +
      ctx.customInstructions.map((inst) =>
        `- When user says "${inst.trigger}": ${inst.instruction}${inst.example ? ` (example: "${inst.example}")` : ""}`
      ).join("\n") +
      "\n\nIMPORTANT: If the user asks you to 'nhớ' or 'học' or 'dạy' a new rule/instruction, you MUST extract the trigger phrase and the instruction, and return action LEARN with data { trigger, instruction, example? }"
    : "";

  const productsSummary = summarizeArray(ctx.products as unknown[], 10);
  const pendingSummary = summarizeArray(ctx.pendingOrders as unknown[], 10);

  return `You are an AI assistant managing an order system via voice/text.
You extract user intentions and format them as JSON.${memoryContext}${brainContext}
Current Context:
Products in DB (showing up to 10): ${JSON.stringify(productsSummary)}
Pending Orders (showing up to 10): ${JSON.stringify(pendingSummary)}
Today's Stats: Total Orders: ${ctx.todayStats.totalOrders}, Completed: ${ctx.todayStats.completedOrders}, Revenue: ${ctx.todayStats.revenue}k

Based on the user's message, determine the action to take.
Always reply in Vietnamese.
Your name is 'Trợ Lý AI' or 'SÓI int'.
Available actions:
1. CREATE_PRODUCT: If user wants to create a product. Return data: { name, price }. Ask for missing info (like price) if needed.
2. CREATE_ORDER: If user wants to create an order. Return data: { customerName, address, phone, items: [{name, quantity, price}], totalAmount }. Ask for missing info if needed. (Calculate total amount when possible.)
3. QUERY_ORDERS: If user asks about orders (e.g. how many pending). Return action QUERY_ORDERS, no data needed.
4. COMPLETE_ORDER: If user wants to complete/chốt an order. Try to match the customer name or address. Return data: { ids: [order_id1, order_id2] }.
5. UPDATE_ORDER: If user wants to update an order. Try to match the customer name or address. Return data: { id, updates: { items, totalAmount, address... } }.
6. REPORT: If user asks for a sales report.
7. LEARN: If user wants to teach you a new rule, instruction, or custom action. Return data: { trigger, instruction, example? }.
8. NONE: If no specific action, just converse naturally.

Return a JSON object with this structure:
{
  "reply": "The response to speak/show to the user",
  "action": "One of the action strings above or NONE",
  "data": { ... }
}

Ensure the 'reply' perfectly matches the user's scenarios.
All prices are typically referred to as 'k' (e.g., 45k = 45000). Convert internally to numbers if necessary.

IMPORTANT: Execute actions immediately without asking for confirmation. Do NOT ask 'bạn có chắc không' or 'xác nhận'. Just do it and reply with the result.`;
}

export class AgentHandler {
  constructor(
    private models: Models,
    private storage: IStorage,
    private chatStorage: IChatStorage,
    private brain: IBrain,
  ) {}

  async process(req: ChatRequest): Promise<ChatResponse> {
    const [products, pendingOrders, allOrders, memories, customInstructions] = await Promise.all([
      this.storage.getProducts(),
      this.storage.getPendingOrders(),
      this.storage.getOrders(),
      this.chatStorage.getRecentMemories(10),
      this.brain.getEnabledInstructions(),
    ]);

    const completedOrders = allOrders.filter(o => o.status === 'Complete');

    const ctx: AgentContext = {
      products,
      pendingOrders,
      allOrders,
      memories,
      customInstructions,
      todayStats: {
        totalOrders: allOrders.length,
        completedOrders: completedOrders.length,
        revenue: completedOrders.reduce((acc, o) => acc + o.totalAmount, 0),
      },
    };

    const systemPrompt = buildSystemPrompt(ctx);
    const modelKey = req.model || "glm-4.7-flash";
    const selected = this.models[modelKey] || this.models["glm-4.7-flash"];

    const conversationMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (req.history && req.history.length > 0) {
      for (const msg of req.history.slice(-20)) {
        conversationMessages.push({ role: msg.role, content: msg.content });
      }
    }

    conversationMessages.push({ role: "user", content: req.message });

    // call model
    const response = await selected.client.chat.completions.create({
      model: selected.model,
      messages: conversationMessages,
      response_format: { type: "json_object" },
    });

    const content = response.choices?.[0]?.message?.content ?? "";
    if (!content) {
      return { reply: "AI không trả về nội dung hợp lệ", action: "NONE", data: null } as ChatResponse;
    }

    let parsed: ChatResponse;
    try {
      parsed = JSON.parse(content) as ChatResponse;
    } catch (err) {
      console.error("AI response parse error:", err, "raw:", content);
      return { reply: "AI trả về định dạng không đúng. Vui lòng thử lại.", action: "NONE", data: null } as ChatResponse;
    }

    // basic validation
    if (typeof parsed.reply !== "string" || typeof parsed.action !== "string") {
      console.error("AI returned invalid structure:", parsed);
      return { reply: "AI trả về dữ liệu không hợp lệ", action: "NONE", data: null } as ChatResponse;
    }

    await this.executeAction(parsed);

    return parsed;
  }

  private async executeAction(parsed: ChatResponse) {
    const data = parsed.data as Record<string, unknown> | undefined;
    if (!data) return;

    switch (parsed.action) {
      case "CREATE_PRODUCT": {
        const name = data.name ? String(data.name) : null;
        const price = data.price ? Number(data.price) : NaN;
        if (!name || Number.isNaN(price)) {
          console.warn("CREATE_PRODUCT missing or invalid fields", data);
          return;
        }
        await this.storage.createProduct({ name, price });
        break;
      }
      case "CREATE_ORDER": {
        const customerName = data.customerName ? String(data.customerName) : null;
        if (!customerName) {
          console.warn("CREATE_ORDER missing customerName", data);
          return;
        }
        await this.storage.createOrder({
          customerName,
          address: String(data.address || "Unknown"),
          phone: String(data.phone || "Unknown"),
          totalAmount: Number(data.totalAmount || 0),
          items: (data.items || []) as [],
          status: "Pending",
        });
        break;
      }
      case "COMPLETE_ORDER": {
        const ids = Array.isArray((data as any).ids) ? (data as any).ids.map(Number) : [];
        if (ids.length === 0) {
          console.warn("COMPLETE_ORDER missing ids", data);
          return;
        }
        await this.storage.completeOrders(ids);
        break;
      }
      case "UPDATE_ORDER": {
        const id = data.id ? Number(data.id) : NaN;
        const updates = data.updates as Record<string, unknown> | undefined;
        if (Number.isNaN(id) || !updates) {
          console.warn("UPDATE_ORDER invalid payload", data);
          return;
        }
        await this.storage.updateOrder(id, {
          ...(updates as Record<string, unknown>),
          status: "Updated - Pending",
        });
        break;
      }
      case "LEARN": {
        if (data.trigger && data.instruction) {
          await this.brain.createInstruction({
            trigger: String(data.trigger),
            instruction: String(data.instruction),
            example: data.example ? String(data.example) : null,
          });
          // mutate reply to confirm
          parsed.reply = `Đã ghi nhớ: "${String(data.trigger)}" - ${String(data.instruction)}`;
        }
        break;
      }
      default: {
        // no-op for other actions (QUERY_ORDERS, REPORT, NONE, etc.)
        break;
      }
    }
  }
}
