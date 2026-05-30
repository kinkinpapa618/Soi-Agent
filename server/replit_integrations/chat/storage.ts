import { db } from "../../db";
import { conversations, messages, memory } from "@shared/models/chat";
import { eq, desc, asc } from "drizzle-orm";

export interface IChatStorage {
  getConversation(id: number): Promise<typeof conversations.$inferSelect | undefined>;
  getAllConversations(): Promise<(typeof conversations.$inferSelect)[]>;
  createConversation(title: string): Promise<typeof conversations.$inferSelect>;
  deleteConversation(id: number): Promise<void>;
  getMessagesByConversation(conversationId: number): Promise<(typeof messages.$inferSelect)[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<typeof messages.$inferSelect>;
  getMemory(conversationId: number): Promise<typeof memory.$inferSelect | undefined>;
  setMemory(conversationId: number, summary: string, keyInfo?: string): Promise<typeof memory.$inferSelect>;
  getRecentMemories(limit: number): Promise<(typeof memory.$inferSelect)[]>;
  getAllMemories(): Promise<(typeof memory.$inferSelect)[]>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: number) {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  },

  async getAllConversations() {
    return db.select().from(conversations).orderBy(desc(conversations.createdAt));
  },

  async createConversation(title: string) {
    const [conversation] = await db.insert(conversations).values({ title }).returning();
    return conversation;
  },

  async deleteConversation(id: number) {
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  },

  async getMessagesByConversation(conversationId: number) {
    return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  },

  async createMessage(conversationId: number, role: string, content: string) {
    const [message] = await db.insert(messages).values({ conversationId, role, content }).returning();
    return message;
  },

  async getMemory(conversationId: number) {
    const [mem] = await db.select().from(memory).where(eq(memory.conversationId, conversationId));
    return mem;
  },

  async setMemory(conversationId: number, summary: string, keyInfo?: string) {
    const existing = await this.getMemory(conversationId);
    if (existing) {
      const [updated] = await db.update(memory).set({ summary, keyInfo, createdAt: new Date() })
        .where(eq(memory.conversationId, conversationId)).returning();
      return updated;
    }
    const [mem] = await db.insert(memory).values({ conversationId, summary, keyInfo }).returning();
    return mem;
  },

  async getRecentMemories(limit: number) {
    return db.select().from(memory).orderBy(desc(memory.createdAt)).limit(limit);
  },

  async getAllMemories() {
    return db.select().from(memory).orderBy(desc(memory.createdAt));
  },
};

