import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import * as chatSchema from "@shared/models/chat";
import * as brainSchema from "@shared/models/brain";

const { Pool } = pg;

let db: ReturnType<typeof drizzle> | null = null;

try {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set - DB features will be unavailable");
  } else {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema: { ...schema, ...chatSchema, ...brainSchema } });
  }
} catch (err) {
  console.warn("Database initialization failed:", err);
}

export { db };
