import express, { type Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { chatStorage } from "./replit_integrations/chat/storage";
import { brain } from "./brain";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerAIRoutes } from "./ai";
import { fptSpeechToText } from "./replit_integrations/audio/fpt";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", db: !!process.env.DATABASE_URL });
  });

  // Products
  app.get(api.products.list.path, async (req, res) => {
    const prods = await storage.getProducts();
    res.json(prods);
  });

  app.post(api.products.create.path, async (req, res) => {
    try {
      const input = api.products.create.input.parse(req.body);
      const prod = await storage.createProduct(input);
      res.status(201).json(prod);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { name, price } = req.body;
      const updated = await storage.updateProduct(id, { name, price });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteProduct(id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Orders
  app.get(api.orders.list.path, async (req, res) => {
    const ords = await storage.getOrders();
    res.json(ords);
  });

  app.get(api.orders.get.path, async (req, res) => {
    const ord = await storage.getOrder(Number(req.params.id));
    if (!ord) return res.status(404).json({ message: "Not found" });
    res.json(ord);
  });

  app.post(api.orders.create.path, async (req, res) => {
    try {
      const input = api.orders.create.input.parse(req.body);
      const ord = await storage.createOrder(input);
      res.status(201).json(ord);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put(api.orders.update.path, async (req, res) => {
    try {
      const input = api.orders.update.input.parse(req.body);
      const ord = await storage.updateOrder(Number(req.params.id), input);
      res.json(ord);
    } catch (err) {
      res.status(400).json({ message: "Error updating" });
    }
  });

  app.post(api.orders.complete.path, async (req, res) => {
    try {
      const { ids } = api.orders.complete.input.parse(req.body);
      await storage.completeOrders(ids);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: "Error completing" });
    }
  });

  app.post("/api/orders/uncomplete/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.uncompleteOrder(id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: "Error uncompleting" });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteOrder(id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete order" });
    }
  });

  // AI module - chat + brain instructions
  registerAIRoutes(app, storage, chatStorage, brain);

  // FPT AI Speech-to-Text
  const sttBodyParser = express.json({ limit: "50mb" });
  app.post("/api/stt", sttBodyParser, async (req, res) => {
    try {
      const { audio } = req.body;
      if (!audio) {
        return res.status(400).json({ error: "Audio data (base64) is required" });
      }

      const audioBuffer = Buffer.from(audio, "base64");
      const result = await fptSpeechToText(audioBuffer);

      res.json({
        text: result.text,
        confidence: result.confidence,
      });
    } catch (error: any) {
      console.error("FPT STT error:", error);
      res.status(500).json({ error: error.message || "Speech-to-text failed" });
    }
  });

  // Download AI module
  app.get("/api/ai/module", async (_req, res) => {
    res.download("/home/runner/workspace/soi-agent-module.tar.gz", "soi-agent-module.tar.gz");
  });

  return httpServer;
}