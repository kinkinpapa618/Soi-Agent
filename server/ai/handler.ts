import OpenAI from "openai";
import type { Models, ChatRequest, ChatResponse, AgentContext } from "./types";
import type { IStorage } from "../storage";
import type { IChatStorage } from "../replit_integrations/chat/storage";
import type { IBrain } from "./brain";

function buildSystemPrompt(ctx: AgentContext): string {
  const memoryContext = ctx.memories.length > 0
    ? "\n\nTóm tắt hội thoại trước:\n" + ctx.memories.map((m, i) => `[${i + 1}]: ${m.summary}`).join("\n")
    : "";

  const brainContext = ctx.customInstructions.length > 0
    ? "\n\nQuy tắc người dùng dạy:\n" +
      ctx.customInstructions.map((inst) =>
        `- Khi nói "${inst.trigger}": ${inst.instruction}${inst.example ? ` (VD: "${inst.example}")` : ""}`
      ).join("\n") +
      "\n\nNếu người dùng bảo 'nhớ', 'học', hoặc 'dạy', trả về action LEARN với data { trigger, instruction, example? }."
    : "";

  const taskList = ctx.tasks.length > 0
    ? ctx.tasks.map(t =>
        `[${t.id}] ${t.title} - ${t.status} - priority:${t.priority}${t.dueDate ? ` - deadline:${t.dueDate}` : ""}${t.categoryId ? ` - catId:${t.categoryId}` : ""}`
      ).join("\n")
    : "(chưa có công việc nào)";

  return `Bạn là SÓI - Trợ lý quản lý công việc cá nhân. Luôn trả lời bằng tiếng Việt, thân thiện.${memoryContext}${brainContext}

CÔNG VIỆC HIỆN TẠI:
${taskList}

DANH MỤC: ${JSON.stringify(ctx.categories)}

HÔM NAY: Tổng ${ctx.dailyStats.total} việc, đã xong ${ctx.dailyStats.completed}, còn lại ${ctx.dailyStats.pending}

HÀNH ĐỘNG CÓ THỂ:
1. CREATE_TASK: Tạo việc mới. data: { title, description?, dueDate? (ISO string), priority? (low|medium|high|urgent), categoryId? (theo danh mục có sẵn), estimatedMinutes? }
2. UPDATE_TASK: Cập nhật việc. data: { taskId (theo id trong danh sách), updates: { title?, description?, dueDate?, priority?, status?, categoryId? } }
3. COMPLETE_TASK: Đánh dấu xong. data: { taskId }
4. DELETE_TASK: Xóa việc. data: { taskId }
5. LIST_TASKS: Liệt kê theo bộ lọc. data: { status?, priority?, dueToday?, dueThisWeek?, categoryId? }
6. CREATE_CATEGORY: Tạo danh mục mới. data: { name, color?, icon? }
7. REPORT: Báo cáo công việc.
8. LEARN: Người dùng muốn dạy quy tắc mới. data: { trigger, instruction, example? }
9. CHAT: Trò chuyện bình thường, không action.

PHÂN LOẠI TỰ ĐỘNG: Khi tạo task, dựa vào nội dung để gợi ý categoryId phù hợp. VD: "họp", "meeting" → công việc. "mua", "đi chợ" → cá nhân.
ĐỘ ƯU TIÊN: deadline trong 24h → urgent, 3 ngày → high, 7 ngày → medium, xa hơn → low. Không có deadline → medium.

Trả về JSON: { "reply": "...", "action": "CREATE_TASK|...|CHAT", "data": {...} }
Thực hiện hành động NGAY, không hỏi xác nhận.`;
}

export class AgentHandler {
  constructor(
    private models: Models,
    private storage: IStorage,
    private chatStorage: IChatStorage,
    private brain: IBrain,
  ) {}

  async process(req: ChatRequest): Promise<ChatResponse> {
    const [allTasks, categories, memories, customInstructions] = await Promise.all([
      this.storage.getTasks(req.userId),
      this.storage.getCategories(req.userId),
      this.chatStorage.getRecentMemories(10),
      this.brain.getEnabledInstructions(),
    ]);

    const completedTasks = allTasks.filter(t => t.status === "completed");
    const pendingTasks = allTasks.filter(t => t.status !== "completed" && t.status !== "cancelled");
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const dueToday = allTasks.filter(t => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) < todayEnd);

    const ctx: AgentContext = {
      tasks: allTasks.map(t => ({ id: t.id, title: t.title, status: t.status!, priority: t.priority!, dueDate: t.dueDate?.toISOString() ?? null, categoryId: t.categoryId })),
      categories: categories.map(c => ({ id: c.id, name: c.name, color: c.color! })),
      memories,
      customInstructions,
      dailyStats: { total: dueToday.length, completed: dueToday.filter(t => t.status === "completed").length, pending: dueToday.filter(t => t.status !== "completed" && t.status !== "cancelled").length },
    };

    const systemPrompt = buildSystemPrompt(ctx);
    const modelKey = req.model || "gpt-5.2";

    let selected = this.models[modelKey];

    if (modelKey.startsWith("deepseek-") && req.apiKeys?.deepseek) {
      try {
        selected = { client: new OpenAI({ apiKey: req.apiKeys.deepseek, baseURL: "https://api.deepseek.com" }), model: modelKey };
      } catch { return { reply: "Lỗi kết nối DeepSeek", action: "CHAT" }; }
    }

    if (!selected) {
      const fallback = Object.values(this.models)[0];
      if (!fallback) return { reply: "Chưa cấu hình AI. Vào Cài đặt để thêm API key.", action: "CHAT" };
      selected = fallback;
    }

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [{ role: "system", content: systemPrompt }];
    if (req.history) {
      for (const msg of req.history.slice(-20)) messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: "user", content: req.message });

    const isDeepSeek = modelKey.startsWith("deepseek-");
    let response;
    try {
      response = await selected.client.chat.completions.create({
        model: selected.model,
        messages,
        ...(isDeepSeek ? {} : { response_format: { type: "json_object" } }),
      });
    } catch (err: any) {
      return { reply: `Lỗi AI: ${err?.message || "Không thể kết nối"}`, action: "CHAT" };
    }

    const content = response.choices[0]?.message?.content;
    if (!content) return { reply: "Không có phản hồi từ AI", action: "CHAT" };

    let parsed: ChatResponse;
    try { parsed = JSON.parse(content) as ChatResponse; } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]) as ChatResponse; } catch { parsed = { reply: content, action: "CHAT" }; } }
      else { parsed = { reply: content, action: "CHAT" }; }
    }

    await this.executeAction(parsed, req);
    return parsed;
  }

  private async executeAction(parsed: ChatResponse, req: ChatRequest) {
    const data = parsed.data as Record<string, unknown> | undefined;
    if (!data) return;

    switch (parsed.action) {
      case "CREATE_TASK": {
        if (data.title) {
          await this.storage.createTask(req.userId, {
            title: String(data.title),
            description: data.description ? String(data.description) : null,
            priority: (data.priority as any) || "medium",
            categoryId: data.categoryId ? Number(data.categoryId) : null,
            dueDate: data.dueDate ? new Date(String(data.dueDate)) : null,
            estimatedMinutes: data.estimatedMinutes ? Number(data.estimatedMinutes) : null,
          });
        }
        break;
      }
      case "UPDATE_TASK": {
        if (data.taskId && data.updates) {
          const updates: Record<string, unknown> = {};
          const u = data.updates as Record<string, unknown>;
          if (u.title !== undefined) updates.title = String(u.title);
          if (u.description !== undefined) updates.description = u.description ? String(u.description) : null;
          if (u.priority !== undefined) updates.priority = u.priority;
          if (u.status !== undefined) updates.status = u.status;
          if (u.categoryId !== undefined) updates.categoryId = u.categoryId ? Number(u.categoryId) : null;
          if (u.dueDate !== undefined) updates.dueDate = u.dueDate ? new Date(String(u.dueDate)) : null;
          if (u.estimatedMinutes !== undefined) updates.estimatedMinutes = u.estimatedMinutes ? Number(u.estimatedMinutes) : null;
          await this.storage.updateTask(Number(data.taskId), req.userId, updates);
        }
        break;
      }
      case "COMPLETE_TASK": {
        if (data.taskId) {
          await this.storage.completeTask(Number(data.taskId), req.userId);
        }
        break;
      }
      case "DELETE_TASK": {
        if (data.taskId) {
          await this.storage.deleteTask(Number(data.taskId), req.userId);
        }
        break;
      }
      case "CREATE_CATEGORY": {
        if (data.name) {
          await this.storage.createCategory(req.userId, {
            name: String(data.name),
            color: data.color ? String(data.color) : "#3b82f6",
            icon: data.icon ? String(data.icon) : "📋",
          });
        }
        break;
      }
      case "LEARN": {
        if (data.trigger && data.instruction) {
          await this.brain.createInstruction({ trigger: String(data.trigger), instruction: String(data.instruction), example: data.example ? String(data.example) : null });
          parsed.reply = `Đã ghi nhớ: "${data.trigger}" - ${data.instruction}`;
        }
        break;
      }
    }
  }
}
