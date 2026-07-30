import type { PoolConfig } from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";
import { log } from "./logger.js";

function loadDotEnv(): void {
  try {
    const raw = readFileSync(resolve(".env"), "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!key || value === undefined) continue;
      const unquoted =
        value.startsWith('"') && value.endsWith('"')
          ? value.slice(1, -1)
          : value.startsWith("'") && value.endsWith("'")
            ? value.slice(1, -1)
            : value;
      if (!(key in process.env)) {
        process.env[key] = unquoted;
      }
    }
  } catch (err) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code !== "ENOENT") {
      log.warn(`Failed to read .env: ${err.message}`);
    }
  }
}

export interface AppConfig {
  poolConfig: PoolConfig;
  readonly: boolean;
  mode: "development" | "production";
  backupDir: string;
  dockerContainer: string | null;
  blockedTables: Set<string>;
  extraSensitiveColumns: Set<string>;
  statementTimeoutMs: number;
}

function isLocalHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "host.docker.internal" ||
    host.endsWith(".internal")
  );
}

function resolveSsl(url: URL): PoolConfig["ssl"] {
  const mode = (process.env.PGSSLMODE ?? url.searchParams.get("sslmode") ?? "").toLowerCase();
  if (mode === "disable" || mode === "off") return false;
  if (mode === "require" || mode === "verify-full")
    return { rejectUnauthorized: mode === "verify-full" };
  if (mode === "no-verify" || mode === "prefer") return { rejectUnauthorized: false };
  if (isLocalHost(url.hostname)) return false;
  return { rejectUnauthorized: false };
}

function buildPoolConfig(): PoolConfig {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      "DATABASE_URL is not set.\n\n" +
        "  Create a .env file in the current directory with:\n\n" +
        "    DATABASE_URL=postgresql://user:password@localhost:5432/yourdb\n\n" +
        "  Or set it as an environment variable before running.",
    );
  }

  const url = new URL(raw);
  const poolMax = Number(process.env.PGPOOL_MAX ?? "5");
  const connectionTimeoutMs = Number(process.env.PG_CONNECT_TIMEOUT_MS ?? "10000");
  const idleTimeoutMs = Number(process.env.PG_IDLE_TIMEOUT_MS ?? "30000");

  return {
    connectionString: raw,
    ssl: resolveSsl(url),
    max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 5,
    connectionTimeoutMillis: Number.isFinite(connectionTimeoutMs) ? connectionTimeoutMs : 10000,
    idleTimeoutMillis: Number.isFinite(idleTimeoutMs) ? idleTimeoutMs : 30000,
  };
}

function parseList(value: string | undefined): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  );
}

export function loadConfig(argv: string[]): AppConfig {
  loadDotEnv();

  const readonly = argv.includes("--readonly");
  const modeArg = argv.find((a) => a.startsWith("--mode="));
  const mode =
    (modeArg?.split("=")[1] as "development" | "production" | undefined) ??
    (process.env.NODE_ENV === "production" ? "production" : "development");

  const statementTimeoutMs = Number(process.env.PG_STATEMENT_TIMEOUT_MS ?? "10000");

  return {
    poolConfig: buildPoolConfig(),
    readonly,
    mode,
    backupDir: process.env.BACKUPS_DIR ?? "./backups",
    dockerContainer: process.env.DOCKER_CONTAINER ?? null,
    blockedTables: parseList(process.env.BLOCKED_TABLES),
    extraSensitiveColumns: parseList(process.env.SENSITIVE_COLUMNS),
    statementTimeoutMs: Number.isFinite(statementTimeoutMs) ? statementTimeoutMs : 10000,
  };
}

export function connectionSummary(poolConfig: PoolConfig): string {
  const raw = poolConfig.connectionString;
  if (typeof raw !== "string") return "unknown";
  try {
    const url = new URL(raw);
    const sslLabel = poolConfig.ssl === false ? "no SSL" : "SSL";
    return `${url.hostname}:${url.port || "5432"}/${url.pathname.replace(/^\//, "")} (${sslLabel})`;
  } catch {
    return "unknown";
  }
}
