import type { Pool } from "pg";
import { execFileSync } from "child_process";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { z } from "zod";
import {
  FindManyArgs,
  FindFirstArgs,
  CountArgs,
  CreateArgs,
  UpdateArgs,
  DeleteArgs,
  RawQueryArgs,
  BackupArgs,
  UpsertArgs,
  AggregateArgs,
  TableInfoArgs,
} from "./toolDefinitions.js";
import {
  getSchema,
  resolveTableName,
  schemaToText,
  relationsToText,
  getTableStats,
} from "./schema.js";
import type { TableSchema } from "./schema.js";
import {
  redactRow,
  redactRows,
  sanitizeWriteData,
  checkWriteAccess,
  bulkWarning,
  type SafetyState,
} from "./safety.js";
import {
  buildWhere,
  buildOrderBy,
  buildSelectColumns,
  buildInsert,
  buildUpdate,
  buildDelete,
  buildUpsert,
  buildCount,
  quoteIdent,
} from "./sqlBuilder.js";
import { poolStats } from "./db.js";
import type { AppConfig } from "./config.js";
import { log } from "./logger.js";

const MAX_TAKE = 500;
const MAX_RAW_TAKE = 5000;

function stripSqlStrings(sql: string): string {
  let result = sql.replace(/\$(\w*)\$.*?\$\1\$/gs, "''");
  result = result.replace(/\$\$.*?\$\$/gs, "''");
  result = result.replace(/'[^']*'/g, "''");
  return result;
}

function parseJsonObject(
  input: string | undefined,
  label: string,
): Record<string, unknown> | undefined {
  if (!input || input === "{}") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    throw new Error(`Invalid JSON for ${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function parseJsonArray(input: string | undefined, label: string): string[] | undefined {
  if (!input) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    throw new Error(`Invalid JSON for ${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === "string")) {
    throw new Error(`${label} must be a JSON array of strings`);
  }
  return parsed;
}

function columnSet(table: TableSchema): Set<string> {
  return new Set(table.columns.map((c) => c.name));
}

function decodePgError(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const e = err as {
    code?: string;
    detail?: string;
    message?: string;
    constraint?: string;
  };
  switch (e.code) {
    case "23505":
      return `Unique constraint violation${e.constraint ? ` on "${e.constraint}"` : ""}. ${e.detail ?? "A matching row already exists."}`;
    case "23503":
      return `Foreign key constraint failed${e.constraint ? ` on "${e.constraint}"` : ""}. ${e.detail ?? "Referenced row does not exist."}`;
    case "23502":
      return `Null constraint violation. ${e.detail ?? "A required column was left empty."}`;
    case "22001":
      return `Value too long for column. ${e.detail ?? ""}`.trim();
    case "42703":
      return `Undefined column. ${e.message ?? ""}`.trim();
    case "42P01":
      return `Undefined table. ${e.message ?? ""}`.trim();
    default:
      return e.message ?? String(err);
  }
}

function textResponse(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createHandlers(pool: Pool, safety: SafetyState, config: AppConfig) {
  const startTime = Date.now();
  let requestCount = 0;

  function logRequest(tool: string, durationMs: number) {
    requestCount++;
    if (safety.mode === "development") {
      log.info(`#${requestCount} ${tool}  ${durationMs}ms`);
    }
  }

  return {
    db_overview: async () => {
      const t0 = Date.now();
      const tables = await getSchema(pool);
      const names = tables.map((t) => t.name);

      const estimateResult = names.length
        ? await pool.query<{ relname: string; estimate: number }>(
            `SELECT relname, GREATEST(reltuples::bigint, 0) AS estimate FROM pg_class WHERE relname = ANY($1)`,
            [names],
          )
        : { rows: [] as { relname: string; estimate: number }[] };
      const estimates = new Map(estimateResult.rows.map((r) => [r.relname, Number(r.estimate)]));

      const totalRows = [...estimates.values()].reduce((sum, n) => sum + n, 0);

      const lines = [
        "PostgreSQL Database Overview",
        "",
        `Mode: ${safety.mode} | ${safety.readonly ? "READ-ONLY" : "Read-Write"}`,
        "",
        `TABLES (${tables.length}, ~${totalRows.toLocaleString()} rows total, estimates)`,
        ...tables.map(
          (t) => `  ${t.name.padEnd(28)} ~${String(estimates.get(t.name) ?? 0).padStart(8)} rows`,
        ),
        "",
        relationsToText(tables),
        "SAFETY",
        `  Sensitive columns redacted: ${[...safety.sensitiveColumns].join(", ")}`,
        `  Blocked tables: ${safety.blockedTables.size ? [...safety.blockedTables].join(", ") : "none"}`,
        "",
        "Use db_schema for full column detail, db_table_info for exact counts and indexes on one table.",
      ];

      logRequest("db_overview", Date.now() - t0);
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },

    db_schema: async () => {
      const t0 = Date.now();
      const tables = await getSchema(pool);
      const text = schemaToText(tables) + "\n" + relationsToText(tables);
      logRequest("db_schema", Date.now() - t0);
      return { content: [{ type: "text" as const, text }] };
    },

    db_health: async () => {
      const t0 = Date.now();
      try {
        await pool.query("SELECT 1");
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        logRequest("db_health", Date.now() - t0);
        return textResponse({
          status: "connected",
          uptimeSeconds: uptime,
          totalRequests: requestCount,
          pool: poolStats(pool),
          mode: safety.mode,
          readonly: safety.readonly,
        });
      } catch (err) {
        logRequest("db_health", Date.now() - t0);
        return textResponse({
          status: "disconnected",
          error: decodePgError(err),
          uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
          totalRequests: requestCount,
        });
      }
    },

    db_table_info: async (args: z.infer<typeof TableInfoArgs>) => {
      const t0 = Date.now();
      const table = await resolveTableName(pool, args.table);
      const stats = await getTableStats(pool, table);
      logRequest("db_table_info", Date.now() - t0);
      return textResponse(stats);
    },

    db_find_many: async (args: z.infer<typeof FindManyArgs>) => {
      const t0 = Date.now();
      const table = await resolveTableName(pool, args.table);
      const validColumns = columnSet(table);

      const where = parseJsonObject(args.where, "where");
      const select = parseJsonArray(args.select, "select");
      const orderBy = parseJsonObject(args.orderBy, "orderBy") as
        Record<string, string> | undefined;
      const take = Math.min(args.take ?? 50, MAX_TAKE);
      const skip = args.skip ?? 0;

      const columns = buildSelectColumns(select, validColumns);
      const whereFragment = buildWhere(where, validColumns, 1);
      const orderClause = buildOrderBy(orderBy, validColumns);

      const sql = `SELECT ${columns} FROM ${quoteIdent(table.name)} ${whereFragment.text} ${orderClause} LIMIT ${take} OFFSET ${skip}`;
      const countFragment = buildCount(table.name, where, validColumns);

      const [rowsResult, countResult] = await Promise.all([
        pool.query(sql, whereFragment.values),
        pool.query<{ count: number }>(countFragment.text, countFragment.values),
      ]);

      const total = countResult.rows[0]?.count ?? 0;
      logRequest("db_find_many", Date.now() - t0);

      return textResponse({
        table: table.name,
        count: rowsResult.rows.length,
        total,
        page: skip > 0 ? Math.floor(skip / take) + 1 : 1,
        pageSize: take,
        hasMore: skip + rowsResult.rows.length < total,
        data: redactRows(rowsResult.rows, safety),
      });
    },

    db_find_first: async (args: z.infer<typeof FindFirstArgs>) => {
      const t0 = Date.now();
      const table = await resolveTableName(pool, args.table);
      const validColumns = columnSet(table);

      const where = parseJsonObject(args.where, "where");
      const select = parseJsonArray(args.select, "select");
      const columns = buildSelectColumns(select, validColumns);
      const whereFragment = buildWhere(where, validColumns, 1);

      const sql = `SELECT ${columns} FROM ${quoteIdent(table.name)} ${whereFragment.text} LIMIT 1`;
      const result = await pool.query(sql, whereFragment.values);

      logRequest("db_find_first", Date.now() - t0);
      return textResponse(result.rows[0] ? redactRow(result.rows[0], safety) : null);
    },

    db_count: async (args: z.infer<typeof CountArgs>) => {
      const t0 = Date.now();
      const table = await resolveTableName(pool, args.table);
      const validColumns = columnSet(table);
      const where = parseJsonObject(args.where, "where");

      const fragment = buildCount(table.name, where, validColumns);
      const result = await pool.query<{ count: number }>(fragment.text, fragment.values);

      logRequest("db_count", Date.now() - t0);
      return textResponse({
        table: table.name,
        count: result.rows[0]?.count ?? 0,
      });
    },

    db_aggregate: async (args: z.infer<typeof AggregateArgs>) => {
      const t0 = Date.now();
      const table = await resolveTableName(pool, args.table);
      const validColumns = columnSet(table);

      const groupCols = args.by
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (groupCols.length === 0) throw new Error("At least one 'by' column is required");
      groupCols.forEach((c) => {
        if (!validColumns.has(c)) {
          throw new Error(`Unknown column "${c}". Available: ${[...validColumns].join(", ")}`);
        }
      });

      const selectExprs = groupCols.map((c) => quoteIdent(c));
      selectExprs.push("COUNT(*)::int AS count");

      for (const [label, fn] of [
        ["sum", "SUM"],
        ["avg", "AVG"],
        ["min", "MIN"],
        ["max", "MAX"],
      ] as const) {
        const raw = (args as Record<string, unknown>)[label];
        if (typeof raw !== "string" || raw.length === 0) continue;
        for (const col of raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)) {
          if (!validColumns.has(col)) {
            throw new Error(`Unknown column "${col}". Available: ${[...validColumns].join(", ")}`);
          }
          selectExprs.push(`${fn}(${quoteIdent(col)}) AS ${label}_${col}`);
        }
      }

      const where = parseJsonObject(args.where, "where");
      const whereFragment = buildWhere(where, validColumns, 1);

      const orderBy = parseJsonObject(args.orderBy, "orderBy") as
        Record<string, string> | undefined;
      let orderClause = "";
      if (orderBy && Object.keys(orderBy).length > 0) {
        const parts: string[] = [];
        for (const [key, direction] of Object.entries(orderBy)) {
          const column = key === "_count" ? "count" : key;
          if (column !== "count" && !groupCols.includes(column)) {
            throw new Error(`orderBy column "${key}" must be a group-by column or "_count"`);
          }
          const ident = column === "count" ? "count" : quoteIdent(column);
          parts.push(`${ident} ${direction.toLowerCase() === "desc" ? "DESC" : "ASC"}`);
        }
        orderClause = `ORDER BY ${parts.join(", ")}`;
      }

      const take = Math.min(args.take ?? 50, MAX_TAKE);
      const groupClause = groupCols.map((c) => quoteIdent(c)).join(", ");
      const sql = `SELECT ${selectExprs.join(", ")} FROM ${quoteIdent(table.name)} ${whereFragment.text} GROUP BY ${groupClause} ${orderClause} LIMIT ${take}`;

      const result = await pool.query(sql, whereFragment.values);
      logRequest("db_aggregate", Date.now() - t0);
      return textResponse({
        table: table.name,
        groupBy: groupCols,
        count: result.rows.length,
        data: result.rows,
      });
    },

    db_raw_query: async (args: z.infer<typeof RawQueryArgs>) => {
      const t0 = Date.now();
      const sql = args.sql.trim();

      const strippedSql = stripSqlStrings(sql);
      if (
        strippedSql.includes(";") &&
        (strippedSql.indexOf(";") !== strippedSql.length - 1 || strippedSql.split(";").length > 2)
      ) {
        throw new Error("Multi-statement queries are not allowed. Use a single SELECT statement.");
      }

      const upperSql = sql.toUpperCase().replace(/;\s*$/, "").trim();
      if (!/^SELECT\b/.test(upperSql)) {
        throw new Error("Only SELECT queries are allowed via db_raw_query.");
      }

      const dangerousPatterns = [
        /\bpg_read_file\b/i,
        /\bpg_read_binary_file\b/i,
        /\bpg_ls_dir\b/i,
        /\bpg_write_file\b/i,
        /\blo_import\b/i,
        /\blo_export\b/i,
        /\bcopy\b.*\b(from|to)\b/i,
        /\bpg_sleep\b/i,
      ];
      for (const pattern of dangerousPatterns) {
        if (pattern.test(upperSql)) {
          throw new Error("Dangerous function detected. This query is not permitted.");
        }
      }

      const limitMatch = upperSql.match(/\bLIMIT\s+(\d+)/i);
      if (!limitMatch) {
        throw new Error("All raw queries must include a LIMIT clause.");
      }
      const limitValue = parseInt(limitMatch[1]!, 10);
      if (limitValue > MAX_RAW_TAKE) {
        throw new Error(
          `LIMIT value (${limitValue}) exceeds maximum allowed (${MAX_RAW_TAKE}). Use a smaller limit or paginate.`,
        );
      }

      const execSql = sql.replace(/;\s*$/, "").trim();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL statement_timeout = ${config.statementTimeoutMs}`);
        await client.query("SET LOCAL default_transaction_read_only = on");
        const result = await client.query(execSql);
        await client.query("COMMIT");
        logRequest("db_raw_query", Date.now() - t0);
        return textResponse(redactRows(result.rows, safety));
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw new Error(decodePgError(err));
      } finally {
        client.release();
      }
    },

    db_create: async (args: z.infer<typeof CreateArgs>) => {
      const table = await resolveTableName(pool, args.table);
      const access = checkWriteAccess(table.name, "create", safety);
      if (access.blocked) throw new Error(access.message);

      const data = parseJsonObject(args.data, "data");
      if (!data) throw new Error("data parameter is required");
      const { cleaned, stripped } = sanitizeWriteData(data, safety);

      if (args.dryRun) {
        return textResponse({
          dryRun: true,
          table: table.name,
          wouldCreate: cleaned,
          ...(stripped.length > 0 && { strippedFields: stripped }),
          message: "DRY RUN -- nothing was created.",
        });
      }

      const validColumns = columnSet(table);
      const fragment = buildInsert(table.name, cleaned, validColumns);
      try {
        const result = await pool.query(fragment.text, fragment.values);
        return textResponse({
          created: redactRow(result.rows[0], safety),
          ...(stripped.length > 0 && { strippedFields: stripped }),
        });
      } catch (err) {
        throw new Error(decodePgError(err));
      }
    },

    db_upsert: async (args: z.infer<typeof UpsertArgs>) => {
      const table = await resolveTableName(pool, args.table);
      const access = checkWriteAccess(table.name, "upsert", safety);
      if (access.blocked) throw new Error(access.message);

      const where = parseJsonObject(args.where, "where");
      if (!where) throw new Error("where parameter is required for upsert");
      const createData = parseJsonObject(args.create, "create");
      if (!createData) throw new Error("create data is required for upsert");
      const updateData = parseJsonObject(args.update, "update") ?? createData;

      const whereKeys = Object.keys(where).sort();
      const matched = table.uniqueColumnSets.find((set) => {
        const sorted = [...set].sort();
        return sorted.length === whereKeys.length && sorted.every((c, i) => c === whereKeys[i]);
      });
      if (!matched) {
        const available = table.uniqueColumnSets.map((s) => s.join("+")).join(", ") || "none";
        throw new Error(
          `where columns (${whereKeys.join(", ")}) don't match a unique constraint on "${table.name}". Available: ${available}`,
        );
      }

      const fullInsert = { ...where, ...createData };
      const { cleaned: cleanedInsert, stripped: strippedInsert } = sanitizeWriteData(
        fullInsert,
        safety,
      );
      const { cleaned: cleanedUpdate, stripped: strippedUpdate } = sanitizeWriteData(
        updateData,
        safety,
      );
      const stripped = [...new Set([...strippedInsert, ...strippedUpdate])];

      if (args.dryRun) {
        return textResponse({
          dryRun: true,
          table: table.name,
          wouldInsert: cleanedInsert,
          wouldUpdate: cleanedUpdate,
          ...(stripped.length > 0 && { strippedFields: stripped }),
          message: "DRY RUN -- nothing was upserted.",
        });
      }

      const validColumns = columnSet(table);
      const fragment = buildUpsert(table.name, cleanedInsert, cleanedUpdate, matched, validColumns);
      try {
        const result = await pool.query(fragment.text, fragment.values);
        return textResponse({
          upserted: redactRow(result.rows[0], safety),
          ...(stripped.length > 0 && { strippedFields: stripped }),
        });
      } catch (err) {
        throw new Error(decodePgError(err));
      }
    },

    db_update_many: async (args: z.infer<typeof UpdateArgs>) => {
      const table = await resolveTableName(pool, args.table);
      const access = checkWriteAccess(table.name, "update", safety);
      if (access.blocked) throw new Error(access.message);

      const where = parseJsonObject(args.where, "where");
      const data = parseJsonObject(args.data, "data");
      if (!data) throw new Error("data parameter is required");
      const { cleaned, stripped } = sanitizeWriteData(data, safety);

      const validColumns = columnSet(table);
      const countFragment = buildCount(table.name, where, validColumns);
      const countResult = await pool.query<{ count: number }>(
        countFragment.text,
        countFragment.values,
      );
      const matched = countResult.rows[0]?.count ?? 0;
      const bw = bulkWarning(matched, "update");
      const warnings = [access.warning, bw].filter((w): w is string => Boolean(w));

      if (args.dryRun) {
        return textResponse({
          dryRun: true,
          table: table.name,
          matched,
          wouldSet: cleaned,
          ...(stripped.length > 0 && { strippedFields: stripped }),
          ...(warnings.length > 0 && { warnings }),
          message: `DRY RUN -- ${matched} row(s) would be updated.`,
        });
      }

      const fragment = buildUpdate(table.name, cleaned, where, validColumns);
      try {
        const result = await pool.query(fragment.text, fragment.values);
        return textResponse({
          table: table.name,
          matched: result.rowCount ?? 0,
          ...(stripped.length > 0 && { strippedFields: stripped }),
          ...(warnings.length > 0 && { warnings }),
          message: `${result.rowCount ?? 0} row(s) updated.`,
        });
      } catch (err) {
        throw new Error(decodePgError(err));
      }
    },

    db_delete_many: async (args: z.infer<typeof DeleteArgs>) => {
      const table = await resolveTableName(pool, args.table);
      const access = checkWriteAccess(table.name, "delete", safety);
      if (access.blocked) throw new Error(access.message);

      const where = parseJsonObject(args.where, "where");
      const validColumns = columnSet(table);

      const countFragment = buildCount(table.name, where, validColumns);
      const countResult = await pool.query<{ count: number }>(
        countFragment.text,
        countFragment.values,
      );
      const matched = countResult.rows[0]?.count ?? 0;
      const bw = bulkWarning(matched, "delete");
      const warnings = [access.warning, bw].filter((w): w is string => Boolean(w));

      if (args.dryRun) {
        return textResponse({
          dryRun: true,
          table: table.name,
          wouldDelete: matched,
          ...(warnings.length > 0 && { warnings }),
          message: `DRY RUN -- ${matched} row(s) would be deleted.`,
        });
      }

      if (!where || Object.keys(where).length === 0) {
        if (!args.confirmAll) {
          throw new Error(
            "Refusing to delete ALL rows. Pass confirmAll: true, or use a specific where filter.",
          );
        }
      }

      const fragment = buildDelete(table.name, where, validColumns);
      try {
        const result = await pool.query(fragment.text, fragment.values);
        return textResponse({
          table: table.name,
          deleted: result.rowCount ?? 0,
          ...(warnings.length > 0 && { warnings }),
          message: `${result.rowCount ?? 0} row(s) deleted.`,
        });
      } catch (err) {
        throw new Error(decodePgError(err));
      }
    },

    db_backup: async (args: z.infer<typeof BackupArgs>) => {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) throw new Error("DATABASE_URL is not set -- required to run pg_dump.");

      if (!existsSync(config.backupDir)) {
        mkdirSync(config.backupDir, { recursive: true });
      }

      const now = new Date();
      const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const label = args.label ? `-${args.label.replace(/[^a-zA-Z0-9_-]/g, "_")}` : "";
      const filename = `backup-${ts}${label}.sql`;
      const filepath = resolve(config.backupDir, filename);

      let dump: string;
      try {
        dump = execFileSync("pg_dump", [databaseUrl, "--clean", "--if-exists"], {
          encoding: "utf-8",
          timeout: 30000,
          maxBuffer: 1024 * 1024 * 100,
        });
      } catch (localErr) {
        if (!config.dockerContainer) {
          throw new Error(
            `pg_dump failed: ${localErr instanceof Error ? localErr.message : String(localErr)}. ` +
              `Install postgresql-client, or set DOCKER_CONTAINER to fall back to 'docker exec'.`,
          );
        }
        try {
          const url = new URL(databaseUrl);
          const user = decodeURIComponent(url.username || "postgres");
          const dbName = url.pathname.replace(/^\//, "") || "postgres";
          dump = execFileSync(
            "docker",
            [
              "exec",
              config.dockerContainer,
              "pg_dump",
              "-U",
              user,
              "-d",
              dbName,
              "--clean",
              "--if-exists",
            ],
            { encoding: "utf-8", timeout: 30000, maxBuffer: 1024 * 1024 * 100 },
          );
        } catch (dockerErr) {
          throw new Error(
            `pg_dump failed locally and via 'docker exec ${config.dockerContainer}': ` +
              `${dockerErr instanceof Error ? dockerErr.message : String(dockerErr)}`,
          );
        }
      }

      writeFileSync(filepath, dump, "utf-8");
      const sizeKB = (Buffer.byteLength(dump, "utf-8") / 1024).toFixed(1);

      return textResponse({
        backup: filename,
        path: filepath,
        sizeKB: `${sizeKB} KB`,
        timestamp: now.toISOString(),
        message: `Backup saved: ${filename} (${sizeKB} KB)`,
      });
    },
  };
}
