import OpenAI from "openai";
import type { Models, ChatRequest, ChatResponse, AgentContext } from "./types";
import type { IStorage } from "../storage";
import type { IChatStorage } from "../replit_integrations/chat/storage";
import type { IBrain } from "./brain";

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
      "\n\nIMPORTANT: If the user asks you to 'nhớ' or 'học' or 'dạy' a new rule/instruction, you MUST extract the trigger phrase and the instruction, and return action LEARN with data { trigger, instruction, example? }."
    : "";

  return `You are an AI assistant managing an order system via voice/text.
You extract user intentions and format them as JSON.${memoryContext}${brainContext}
Current Context:
Products in DB: ${JSON.stringify(ctx.products)}
Pending Orders: ${JSON.stringify(ctx.pendingOrders)}
Today's Stats: Total Orders: ${ctx.todayStats.totalOrders}, Completed: ${ctx.todayStats.completedOrders}, Revenue: ${ctx.todayStats.revenue}k

Based on the user's message, determine the action to take.
Always reply in Vietnamese.
Your name is 'Trợ Lý AI' or 'SÓI int'.
Available actions:
1. CREATE_PRODUCT: If user wants to create a product. Return data: { name, price }. Ask for missing info (like price) if needed.
2. CREATE_ORDER: If user wants to create an order. Return data: { customerName, address, phone, items: [{name, quantity, price}], totalAmount }. Ask for missing info if needed. (Calculate total amount based on product price).
3. QUERY_ORDERS: If user asks about orders (e.g. how many pending). Return action QUERY_ORDERS, no data needed.
4. COMPLETE_ORDER: If user wants to complete/chốt an order. Try to match the customer name or address. Return data: { ids: [order_id1, order_id2] }.
5. UPDATE_ORDER: If user wants to update an order. Try to match the customer name or address. Return data: { id, updates: { items, totalAmount, address... } }. Ask for confirmation before updating if needed.
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
    const modelKey = req.model || "gpt-5.2";

    let selected = this.models[modelKey] || this.models["gpt-5.2"];

    if (modelKey.startsWith("deepseek-") && req.apiKeys?.deepseek) {
      const dynamicClient = new OpenAI({
        apiKey: req.apiKeys.deepseek,
        baseURL: "https://api.deepseek.com",
      });
      selected = { client: dynamicClient, model: modelKey };
    }

    const conversationMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (req.history && req.history.length > 0) {
      for (const msg of req.history.slice(-20)) {
        conversationMessages.push({ role: msg.role, content: msg.content });
      }
    }

    conversationMessages.push({ role: "user", content: req.message });

    const isDeepSeek = modelKey.startsWith("deepseek-");
    const response = await selected.client.chat.completions.create({
      model: selected.model,
      messages: conversationMessages,
      ...(isDeepSeek ? {} : { response_format: { type: "json_object" } }),
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    const parsed = JSON.parse(content) as ChatResponse;

    await this.executeAction(parsed);

    return parsed;
  }

  private async executeAction(parsed: ChatResponse) {
    const data = parsed.data as Record<string, unknown> | undefined;
    if (!data) return;

    switch (parsed.action) {
      case "CREATE_PRODUCT": {
        if (data.name && data.price) {
          await this.storage.createProduct({
            name: String(data.name),
            price: Number(data.price),
          });
        }
        break;
      }
      case "CREATE_ORDER": {
        if (data.customerName) {
          await this.storage.createOrder({
            customerName: String(data.customerName),
            address: String(data.address || "Unknown"),
            phone: String(data.phone || "Unknown"),
            totalAmount: Number(data.totalAmount || 0),
            items: (data.items || []) as [],
            status: "Pending",
          });
        }
        break;
      }
      case "COMPLETE_ORDER": {
        const ids = data.ids as number[] | undefined;
        if (ids && ids.length > 0) {
          await this.storage.completeOrders(ids);
        }
        break;
      }
      case "UPDATE_ORDER": {
        if (data.id && data.updates) {
          await this.storage.updateOrder(Number(data.id), {
            ...(data.updates as Record<string, unknown>),
            status: "Updated - Pending",
          });
        }
        break;
      }
      case "LEARN": {
        if (data.trigger && data.instruction) {
          await this.brain.createInstruction({
            trigger: String(data.trigger),
            instruction: String(data.instruction),
            example: data.example ? String(data.example) : null,
          });
          parsed.reply = `Đã ghi nhớ: "${data.trigger}" - ${data.instruction}`;
        }
        break;
      }
    }
  }
}