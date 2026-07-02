import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import * as brainSchema from "@shared/models/brain";

const { Pool } = pg;

function getDb() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set - database features disabled");
    return null;
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return drizzle(pool, { schema: { ...schema, ...brainSchema } });
}

export const db = getDb();
