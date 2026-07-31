import express from "express";
import type { Pool } from "pg";
import type { SafetyState } from "./safety.js";
import type { AppConfig } from "./config.js";
import { createHandlers } from "./toolHandlers.js";
import { toolDefinitions } from "./toolDefinitions.js";
import { log } from "./logger.js";
import { existsSync } from "fs";
import { resolve } from "path";

export function startHttpServer(
  pool: Pool,
  safety: SafetyState,
  config: AppConfig,
  port: number,
): void {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const handlers = createHandlers(pool, safety, config);
  const handlerMap = handlers as Record<string, (args: unknown) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>>;

  // POST /api/tools/:name — call any tool
  app.post("/api/tools/:name", async (req, res) => {
    const { name } = req.params;
    const handler = handlerMap[name];
    const def = toolDefinitions[name as keyof typeof toolDefinitions];

    if (!handler || !def) {
      return res.status(404).json({ error: `Unknown tool: "${name}"` });
    }

    try {
      const result = await handler(req.body ?? {});
      if (result.isError) {
        return res.status(400).json({ error: result.content?.[0]?.text ?? "Unknown error" });
      }
      const content = result.content?.[0];
      if (content && content.type === "text") {
        try {
          return res.json(JSON.parse(content.text));
        } catch {
          return res.json({ text: content.text });
        }
      }
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/tools — list all tool definitions
  app.get("/api/tools", (_req, res) => {
    const summary = Object.entries(toolDefinitions).map(([name, def]) => ({
      name,
      title: def.title,
      description: def.description,
    }));
    res.json(summary);
  });

  // GET /api/health — connection status
  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "connected" });
    } catch {
      res.status(503).json({ status: "disconnected" });
    }
  });

  // Serve the dashboard HTML from public/
  const publicDir = resolve(process.cwd(), "public");
  if (existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  app.get("/", (_req, res) => {
    const indexPath = resolve(publicDir, "index.html");
    if (existsSync(indexPath)) return res.sendFile(indexPath);
    res.status(200).type("html").send(dashboardHtml);
  });
  app.get("/{*path}", (_req, res) => {
    const indexPath = resolve(publicDir, "index.html");
    if (existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(200).type("html").send(dashboardHtml);
    }
  });

  app.listen(port, () => {
    log.info(`Dashboard: http://localhost:${port}`);
  });
}

const dashboardHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>PGAutoPilot</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0d1117;color:#c9d1d9;margin:40px auto;max-width:600px;text-align:center}h1{color:#58a6ff}p{color:#8b949e;line-height:1.6}code{background:#161b22;padding:2px 6px;border-radius:4px;font-size:14px}</style></head>
<body><h1>PGAutoPilot</h1><p>HTTP server is running.<br>Use <code>POST /api/tools/:name</code> to call tools.<br>Use <code>GET /api/tools</code> to list tools.<br>Use <code>GET /api/health</code> to check status.</p><p>Install the full dashboard by placing <code>index.html</code> in the <code>public/</code> directory.</p></body></html>`;
