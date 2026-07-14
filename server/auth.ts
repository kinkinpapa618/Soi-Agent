import crypto from "crypto";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pg from "pg";
import { db } from "./db";
import { users, insertUserSchema, type User } from "@shared/schema";
import { eq } from "drizzle-orm";

const SALT_LEN = 16;
const KEY_LEN = 64;
const SESSION_SECRET = process.env.SESSION_SECRET || "soi-agent-secret-change-in-production";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LEN).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const verify = crypto.scryptSync(password, salt, KEY_LEN).toString("hex");
  return hash === verify;
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
}

export function setupAuth(app: Express) {
  const PgStore = pgSession(session);

  let sessionStore: session.Store | undefined;
  if (process.env.DATABASE_URL) {
    try {
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      sessionStore = new PgStore({ pool, tableName: "session" });
    } catch (err) {
      console.warn("Session store initialization failed, using memory store");
    }
  }

  const sessionConfig: session.SessionOptions = {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      sameSite: "lax",
      secure: false, // Render terminates TLS, internal traffic is HTTP
    },
  };
  if (sessionStore) {
    sessionConfig.store = sessionStore;
  }

  app.use(session(sessionConfig));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
      try {
        if (!db) return done(null, false, { message: "Database not available" });
        const [user] = await db.select().from(users).where(eq(users.email, email));
        if (!user) return done(null, false, { message: "Email hoặc mật khẩu không đúng" });
        if (!verifyPassword(password, user.passwordHash)) {
          return done(null, false, { message: "Email hoặc mật khẩu không đúng" });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      if (!db) return done(null, null);
      const [user] = await db.select().from(users).where(eq(users.id, id));
      done(null, user || null);
    } catch (err) {
      done(err);
    }
  });

  // POST /api/auth/register
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Thiếu email, mật khẩu hoặc tên" });
      }
      if (!db) return res.status(503).json({ error: "Database not available" });

      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
      if (existing) {
        return res.status(409).json({ error: "Email đã được sử dụng" });
      }

      const [user] = await db.insert(users).values({
        email,
        passwordHash: hashPassword(password),
        name,
      }).returning();

      req.login(user, (err) => {
        if (err) return res.status(500).json({ error: "Login after register failed" });
        const { passwordHash, ...safe } = user;
        return res.status(201).json(safe);
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/auth/login
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: User | false, info: any) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(401).json({ error: info?.message || "Đăng nhập thất bại" });
      req.login(user, (loginErr) => {
        if (loginErr) return res.status(500).json({ error: loginErr.message });
        const { passwordHash, ...safe } = user;
        return res.json(safe);
      });
    })(req, res, next);
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      req.session?.destroy(() => {});
      res.json({ success: true });
    });
  });

  // GET /api/auth/me
  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { passwordHash, ...safe } = req.user as User;
    res.json(safe);
  });
}
