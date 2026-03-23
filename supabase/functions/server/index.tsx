import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const prefix = "/make-server-c093f2ae";

// KV Store routes
app.get(`${prefix}/kv/get`, async (c) => {
  const key = c.req.query("key");
  if (!key) return c.json({ error: "Key is required" }, 400);
  try {
    const value = await kv.get(key);
    return c.json({ data: value });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post(`${prefix}/kv/set`, async (c) => {
  try {
    const { key, value } = await c.req.json();
    if (!key) return c.json({ error: "Key is required" }, 400);
    await kv.set(key, value);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.delete(`${prefix}/kv/del`, async (c) => {
  const key = c.req.query("key");
  if (!key) return c.json({ error: "Key is required" }, 400);
  try {
    await kv.del(key);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get(`${prefix}/kv/getByPrefix`, async (c) => {
  const p = c.req.query("prefix");
  if (!p) return c.json({ error: "Prefix is required" }, 400);
  try {
    const values = await kv.getByPrefix(p);
    return c.json({ data: values });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Health check endpoint
app.get(`${prefix}/health`, (c) => {
  return c.json({ status: "ok" });
});

Deno.serve(app.fetch);
