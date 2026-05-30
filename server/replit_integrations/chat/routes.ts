import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { chatStorage } from "./storage";
import { memory } from "@shared/models/chat";
import { db } from "../../db";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export function registerChatRoutes(app: Express): void {
  // Get all conversations
  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      const conversations = await chatStorage.getAllConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get single conversation with messages
  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id));
      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  // Create new conversation
  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Delete conversation
  app.delete("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id));
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Get all memories
  app.get("/api/memory", async (req: Request, res: Response) => {
    try {
      const memories = await chatStorage.getAllMemories();
      res.json(memories);
    } catch (error) {
      console.error("Error fetching memories:", error);
      res.status(500).json({ error: "Failed to fetch memories" });
    }
  });

  // Get recent memories (up to 10)
  app.get("/api/memory/recent", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(String(req.query.limit || "10"));
      const memories = await chatStorage.getRecentMemories(Math.min(limit, 10));
      res.json(memories);
    } catch (error) {
      console.error("Error fetching recent memories:", error);
      res.status(500).json({ error: "Failed to fetch recent memories" });
    }
  });

  // Clear all memories
  app.delete("/api/memory", async (req: Request, res: Response) => {
    try {
      const memories = await chatStorage.getAllMemories();
      for (const mem of memories) {
        await db.delete(memory).where(eq(memory.id, mem.id));
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error clearing memories:", error);
      res.status(500).json({ error: "Failed to clear memories" });
    }
  });

  // Send message and get AI response (streaming)
  app.post("/api/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(String(req.params.id));
      const { content } = req.body;

      // Save user message
      await chatStorage.createMessage(conversationId, "user", content);

      // Get conversation history for context
      const messages = await chatStorage.getMessagesByConversation(conversationId);
      const chatMessages = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Get recent memories (last 10 conversations)
      const memories = await chatStorage.getRecentMemories(10);
      let memoryContext = "";
      if (memories.length > 0) {
        memoryContext = "\n\nPrevious conversation summaries:\n" + memories.map((m, i) =>
          `[Conversation ${i + 1}]: ${m.summary}${m.keyInfo ? `\nKey info: ${m.keyInfo}` : ""}`
        ).join("\n");
      }

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Build system message with memory
      const systemMessage = {
        role: "system" as const,
        content: `You are a helpful AI assistant. ${memoryContext}\n\nUse the previous conversation summaries above to maintain context and avoid repeating information from recent conversations.`
      };

      const allMessages = [systemMessage, ...chatMessages];

      // Stream response from OpenAI
      const stream = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: allMessages,
        stream: true,
        max_completion_tokens: 8192,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      // Save assistant message
      await chatStorage.createMessage(conversationId, "assistant", fullResponse);

      // Generate and save memory for this conversation
      const conversation = await chatStorage.getConversation(conversationId);
      if (conversation && messages.length >= 4) {
        const summaryPrompt = `Summarize this conversation in 1-2 sentences:\n${chatMessages.map(m => `${m.role}: ${m.content}`).join("\n")}`;
        const summaryStream = await openai.chat.completions.create({
          model: "gpt-5.1",
          messages: [{ role: "user", content: summaryPrompt }],
          stream: false,
          max_completion_tokens: 256,
        });
        const summary = summaryStream.choices[0]?.message?.content || "Conversation summary";
        await chatStorage.setMemory(conversationId, summary);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      // Check if headers already sent (SSE streaming started)
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });
}

