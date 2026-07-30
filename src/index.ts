import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, connectionSummary } from "./config.js";
import { createPool, waitForConnection } from "./db.js";
import { buildSafetyState } from "./safety.js";
import { toolDefinitions } from "./toolDefinitions.js";
import { createHandlers } from "./toolHandlers.js";
import { log } from "./logger.js";

process.on("unhandledRejection", (reason) => {
  log.error(`Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
  process.exit(1);
});

async function main() {
  const config = loadConfig(process.argv.slice(2));
  const pool = createPool(config.poolConfig);
  const safety = buildSafetyState(
    config.readonly,
    config.mode,
    config.blockedTables,
    config.extraSensitiveColumns,
  );

  try {
    await waitForConnection(pool, 5, 2000);
    log.info(`Connected to ${connectionSummary(config.poolConfig)}`);
  } catch (err) {
    log.error(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
    log.error("Ensure DATABASE_URL points to a reachable PostgreSQL instance.");
    await pool.end();
    process.exit(1);
  }

  const server = new McpServer({
    name: "pgautopilot",
    title: "PGAutoPilot -- PostgreSQL AI Assistant",
    version: "1.0.0",
  });
  const handlers = createHandlers(pool, safety, config);

  type ToolResult = {
    content: { type: "text"; text: string }[];
    isError?: boolean;
  };
  const untypedHandlers = handlers as Record<string, (args: unknown) => Promise<ToolResult>>;

  for (const [name, def] of Object.entries(toolDefinitions)) {
    const handler = untypedHandlers[name];
    if (!handler) {
      log.warn(`No handler registered for tool: ${name}`);
      continue;
    }
    const wrapped = async (args: unknown): Promise<ToolResult> => {
      try {
        return await handler(args);
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { error: err instanceof Error ? err.message : String(err) },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    };
    server.registerTool(
      name,
      def as Parameters<typeof server.registerTool>[1],
      wrapped as Parameters<typeof server.registerTool>[2],
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("PGAutoPilot v1.0.0 ready");
  log.info(`Connection: ${connectionSummary(config.poolConfig)}`);
  log.info(`Mode: ${safety.mode} | Read-only: ${safety.readonly ? "yes" : "no"}`);
  if (safety.blockedTables.size > 0) {
    log.info(`Blocked tables: ${[...safety.blockedTables].join(", ")}`);
  }

  const shutdown = async () => {
    await server.close();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  log.error(`Failed to start: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
