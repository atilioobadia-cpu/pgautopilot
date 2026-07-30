<p align="center">
  <img src="assets/banner.svg" alt="PGAutoPilot" width="600">
</p>

<p align="center">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/MIT_License-111111?style=for-the-badge&logo=opensourceinitiative&logoColor=33FF99" alt="MIT License">
  </a>
  <a href="package.json">
    <img src="https://img.shields.io/badge/Node_18+-111111?style=for-the-badge&logo=nodedotjs&logoColor=33FF99" alt="Node.js 18+">
  </a>
  <a href="tsconfig.json">
    <img src="https://img.shields.io/badge/TypeScript-111111?style=for-the-badge&logo=typescript&logoColor=33FF99" alt="TypeScript">
  </a>
  <a href="https://modelcontextprotocol.io">
    <img src="https://img.shields.io/badge/MCP-111111?style=for-the-badge" alt="MCP">
  </a>
  <a href="https://www.postgresql.org">
    <img src="https://img.shields.io/badge/PostgreSQL-111111?style=for-the-badge&logo=postgresql&logoColor=33FF99" alt="PostgreSQL">
  </a>
</p>

<p align="center">
  <strong>The PostgreSQL MCP server.</strong> Talk to any database through any AI assistant.
</p>

<p align="center">
  <code>npx pgautopilot</code> &nbsp;·&nbsp; <code>npm install -g pgautopilot</code>
</p>

---

PGAutoPilot is a production-ready PostgreSQL MCP server that lets any AI assistant safely interact with PostgreSQL using natural language. It combines schema-aware query generation, enterprise safety controls, and a minimal-configuration setup into a single executable.

```
  Model-agnostic   PostgreSQL-optimized   Safe writes   Read-only mode
  Minimal config   Single executable      Docker        Cloud databases
  Connection pool  Production-ready       SSL           Schema inspection
```

---

## Contents

- [Requirements](#requirements)
- [Supported MCP Clients](#supported-mcp-clients)
- [Who is this for?](#who-is-this-for)
- [Design Principles](#design-principles)
- [Demo](#demo)
- [Quick Start](#quick-start)
- [Install without npm](#install-without-npm)
- [Why PGAutoPilot](#why-pgautopilot)
- [Features](#features)
- [Architecture](#architecture)
- [Safety](#safety)
- [Security](#security)
- [Tools](#tools)
- [Examples](#examples)
- [Cloud Databases](#cloud-databases)
- [Docker](#docker)
- [Configuration](#configuration)
- [Performance](#performance)
- [Compatibility](#compatibility)
- [Software Signing](#software-signing)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Requirements

| Requirement | Details                                |
| ----------- | -------------------------------------- |
| Node.js     | 18+                                    |
| PostgreSQL  | 12+ (local, remote, Docker, or cloud)  |
| MCP client  | Any MCP-compatible assistant or editor |
| Optional    | Docker, `pg_dump`, Git                 |

---

## Supported MCP Clients

| Client            | Status |
| ----------------- | ------ |
| Claude Desktop    | ✅     |
| Cursor            | ✅     |
| VS Code + Copilot | ✅     |
| Gemini CLI        | ✅     |
| Windsurf          | ✅     |
| Zed               | ✅     |
| JetBrains         | ✅     |
| Continue          | ✅     |
| Cline             | ✅     |
| Roo Code          | ✅     |
| Neovim            | ✅     |

---

## Who is this for?

| Audience    | PGAutoPilot answers                                             |
| ----------- | --------------------------------------------------------------- |
| Developers  | Instantly query databases in plain English from your editor     |
| Staff Eng   | Verifiable architecture, safety by default, deterministic paths |
| DBAs        | Read-only mode, blocked tables, redacted secrets, audit-ready   |
| Security    | Encrypted data, no SQL injection, no credential exposure        |
| Maintainers | Minimal codebase, strict TypeScript, modular safety layer       |

---

## Design Principles

```
Safety before convenience.
Natural language before SQL.
No vendor lock-in.
Minimal dependencies.
Deterministic behavior.
Schema-aware generation.
Fail closed, not open.
Minimal configuration.
Protocol-first architecture.
```

---

## Demo

```
You: "Show me customers that spent more than $500."
  -> db_aggregate(table="orders", by="customer_id", _sum="total",
       orderBy={"_sum/total": "desc"}, take=5)
  <- 23 customers found

Assistant: "23 customers have spent more than $500. The top spender is..."
```

---

## Quick Start

### 1. Install

```bash
npm install -g pgautopilot
```

No npm? Use the [one-line installer](#install-without-npm).

### 2. Point it at your database

Create a `.env` file anywhere on your machine:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/yourdb
```

PGAutoPilot finds `.env` automatically from the current directory.

**Connection string examples:**

| Where                | URL                                                                 |
| -------------------- | ------------------------------------------------------------------- |
| Localhost            | `postgresql://postgres:mypass@localhost:5432/mydb`                  |
| Remote server        | `postgresql://admin:secret@db.mycompany.com:5432/production`        |
| Docker (port-mapped) | `postgresql://user:pass@localhost:5433/mydb`                        |
| Neon                 | `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb`      |
| Supabase             | `postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres`       |
| AWS RDS              | `postgresql://admin:pass@xxx.us-east-1.rds.amazonaws.com:5432/mydb` |
| Render               | `postgresql://user:pass@host.render.com:5432/mydb`                  |

### 3. Connect your AI assistant

```json
{ "mcpServers": { "postgres": { "command": "pgautopilot" } } }
```

Identical config for VS Code, Cursor, Windsurf, Claude Desktop, Zed, JetBrains, Neovim.

### 4. Start asking questions

> _"Show me all tables."_
> _"How many users signed up this month?"_
> _"Find orders over $500 grouped by customer."_
> _"Add a new product called 'Widget Pro' at $29.99."_

---

## Install without npm

You need only **Node.js 18+** and a browser or Git.

**One-line installer:**

| Platform  | Command                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------- |
| Linux/mac | `curl -fsSL https://raw.githubusercontent.com/cyberreinxy/pgautopilot/main/install.sh \| bash` |
| Windows   | `irm https://raw.githubusercontent.com/cyberreinxy/pgautopilot/main/install.ps1 \| iex`        |

Clones into `~/.pgautopilot` (Linux/macOS) or `%LOCALAPPDATA%\pgautopilot` (Windows) and adds `pgautopilot` to your PATH. Run the same command again to update.

**Download & run:**

```bash
node pgautopilot.bundle.cjs
```

**Clone & run:**

```bash
git clone https://github.com/cyberreinxy/pgautopilot.git
cd pgautopilot
node dist/pgautopilot.bundle.cjs
```

**Uninstall:**

| Platform  | Command                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------ |
| Linux/mac | `curl -fsSL https://raw.githubusercontent.com/cyberreinxy/pgautopilot/main/uninstall.sh \| bash` |
| Windows   | `irm https://raw.githubusercontent.com/cyberreinxy/pgautopilot/main/uninstall.ps1 \| iex`        |

Removes the launcher, deletes the installation directory, and cleans up PATH entries. Idempotent — safe to run even when PGAutoPilot isn't installed.

---

## Why PGAutoPilot

Existing database MCP servers usually expose raw SQL directly, offer little protection against destructive operations, or require extensive manual configuration. PGAutoPilot takes a different approach:

- **Schema-aware** — introspects your live database and validates every identifier before it touches SQL
- **Production-first** — every write path is guarded by multiple configurable safety layers
- **AI-friendly** — tools are designed for natural-language workflows, not SQL terminals
- **Model-agnostic** — works identically with Claude, GPT-4o, Gemini, DeepSeek, Copilot, and open-source models
- **Safety by default** — sensitive columns are redacted, bulk operations warn, and deletes require confirmation

---

## Features

| Category       | Features                                                |
| -------------- | ------------------------------------------------------- |
| Querying       | Search, filter, aggregate, paginate, raw SELECT         |
| Writing        | Insert, update, delete, upsert                          |
| Safety         | Read-only mode, secret redaction, schema validation     |
| Infrastructure | Docker, SSL, connection pooling, backups                |
| AI             | MCP protocol, natural language, schema-aware generation |
| Compatibility  | Every major editor, all PostgreSQL 12+, all Node 18+    |

---

## Architecture

```
AI Assistant
     (Claude / Cursor / GPT / Gemini)
        |
        v
   MCP Protocol
        |
        v
+----------------------------------+
|          PGAutoPilot              |
|                                    |
|  Schema Discovery                 |
|  Identifier Validation            |
|  Safety Policy Engine     <----+  |
|  SQL Builder                   |  |
|  Connection Pool               |  |
|  Tool Handlers (14 tools)      |  |
+---------------------------------+ |
        |                          |
        v                          |
   PostgreSQL          Everything passes through safety
```

### How a request flows

```
Natural language
  -> MCP tool request
  -> Parameter validation (Zod)
  -> Live schema lookup
  -> Identifier validation
  -> Safety policy evaluation
  -> Parameterized SQL generation
  -> Query execution (time-limited)
  -> Response formatting
  -> AI assistant presents result
```

Every step is deterministic. No hidden state. No side effects.

---

## Safety

### Threat model

PGAutoPilot runs on your machine and connects to your database over the PostgreSQL wire protocol. The AI assistant communicates only through the MCP protocol, and every request passes through the safety layer before reaching PostgreSQL. The `DATABASE_URL` credential is the sole authentication boundary.

### Safety features

| Threat                 | Protection                                         |
| ---------------------- | -------------------------------------------------- |
| SQL injection          | Parameterized queries (never string interpolation) |
| Accidental delete-all  | `confirmAll: true` required                        |
| Full table update      | Warning on >10 rows affected                       |
| Secret exposure        | Automatic redaction on read + strip on write       |
| Unknown table/column   | Live schema validation before query build          |
| Slow queries           | Configurable statement timeout (default 10s)       |
| Connection exhaustion  | Configurable pool limit (default 5)                |
| Arbitrary SQL          | `db_raw_query` is SELECT-only, single-statement    |
| Dangerous Postgres fns | Blocked: `pg_read_file`, `COPY`, `pg_sleep`, etc.  |
| Bulk data loss         | Dry-run support on every write tool                |

### Operational guarantees

- Never logs `DATABASE_URL` (only the hostname appears in the startup banner)
- Never exposes redacted fields (passwords, tokens, keys return `***REDACTED***`)
- Never executes multiple SQL statements in one call
- Never allows `UPDATE` without identifier validation (table + column checked against live schema)
- Never allows `DELETE ALL` without explicit `confirmAll: true`
- Never runs raw `INSERT`, `UPDATE`, or `DELETE` SQL (use the structured tools)
- Never bypasses schema validation
- Never opens more connections than `PGPOOL_MAX`

### Production recommendations

- Enable `--readonly` for read replicas and analytics environments
- Block sensitive tables with `BLOCKED_TABLES`
- Configure `PGSSLMODE=require` for cloud databases
- Use a dedicated database user with minimal required permissions
- Add custom sensitive columns via `SENSITIVE_COLUMNS`
- Set `PG_STATEMENT_TIMEOUT_MS` to match your SLA
- Run in `--mode=production` to suppress per-request logging

### Read-only mode

```bash
pgautopilot --readonly
```

Blocks every write operation. Ideal for read replicas, analytics databases, and any read-only environment.

### Blocked tables

```bash
BLOCKED_TABLES=users,refresh_tokens pgautopilot
```

Refuses all writes to specific tables, independent of `--readonly`.

### Sensitive columns

Columns matching `password`, `token`, `secret`, `api_key`, `private_key`, `ssn`, `credit_card`, `cvv` (and variants) are automatically redacted on read and stripped on write. Extend with `SENSITIVE_COLUMNS`.

---

## Security

- **Responsible disclosure** — if you discover a security vulnerability, report it privately via [GitHub Security Advisories](https://github.com/cyberreinxy/pgautopilot/security/advisories). Please avoid opening a public issue until the vulnerability has been addressed.
- **Threat model** — see [Threat model](#threat-model) above; the database URL is your credential boundary.
- **Cryptographic verification** — every release is SHA-256 checksummed and GPG-signed.
- **Dependency policy** — zero runtime dependencies in the bundled build.
- **Logging policy** — connection strings are never logged; per-request logging is disabled in production mode (`--mode=production`).
- **Authentication** — handled entirely by the `DATABASE_URL` credential. PGAutoPilot does not manage users or tokens.
- **Production recommendation** — use a dedicated read-only database user with minimal permissions.

---

## Tools

### Read tools

| Tool            | Use when...                                      | Returns                                               |
| --------------- | ------------------------------------------------ | ----------------------------------------------------- |
| `db_overview`   | "What's in this database?"                       | All tables, row counts, relationships                 |
| `db_schema`     | "What columns does each table have?"             | Full column/type/constraint map                       |
| `db_health`     | "Is the connection working?"                     | Pool usage, uptime, latency                           |
| `db_table_info` | "Tell me about the orders table"                 | Columns, indexes, row estimates, size                 |
| `db_find_many`  | "Show recent orders", "Find inactive users"      | Filtered, sorted, paginated rows                      |
| `db_find_first` | "Get user with ID 42"                            | Single matching row                                   |
| `db_count`      | "How many users signed up this week?"            | Row count (all or filtered)                           |
| `db_aggregate`  | "Total sales by category", "Average order value" | Grouped aggregates (count, sum, avg, min, max)        |
| `db_raw_query`  | "I need a custom SELECT"                         | Raw query results (SELECT-only, limited to 5000 rows) |

### Write tools

| Tool             | Use when...                     | Safety                                          |
| ---------------- | ------------------------------- | ----------------------------------------------- |
| `db_create`      | "Add a new user"                | Dry-run supported, schema-validated             |
| `db_upsert`      | "Create or update this product" | Dry-run supported, conflict-safe                |
| `db_update_many` | "Update all shipped orders"     | Warns on >10 rows, dry-run supported            |
| `db_delete_many` | "Delete old logs"               | Warns on >10 rows, `confirmAll` for full clears |

### Maintenance tools

| Tool        | Use when...            | Output                      |
| ----------- | ---------------------- | --------------------------- |
| `db_backup` | "Back up the database" | Full SQL dump via `pg_dump` |

---

## Examples

**Find recent orders for a customer:**

```
Prompt: "Show me the last 10 orders for customer 42"

Tool:   db_find_many(table="orders", where={"customer_id": 42},
         select=["id","total","status","created_at"],
         orderBy={"created_at":"desc"}, take=10)

SQL:    SELECT id, total, status, created_at FROM orders
        WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 10

Result: 10 rows returned
```

**Count products by category:**

```
Prompt: "How many products in each category?"

Tool:   db_aggregate(table="products", by="category", _count="*",
         take=5, orderBy={"_count": "desc"})

SQL:    SELECT category, COUNT(*) FROM products
        GROUP BY category ORDER BY COUNT(*) DESC LIMIT 5

Result: Electronics: 142, Clothing: 89, Books: 54, ...
```

**Add a new user (dry run first):**

```
Prompt: "Add Jane Doe with email jane@example.com"

Tool:   db_create(table="users", data={"email":"jane@example.com","name":"Jane Doe"},
         dryRun=true)  -- verifies first, no write

SQL:    INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *

Result: Dry run: valid. Proceed? [yes] -> Row inserted with id 105
```

**Update order status:**

```
Prompt: "Mark order 1503 as shipped"

Tool:   db_update_many(table="orders", where={"id":1503},
         data={"status":"shipped"})

SQL:    UPDATE orders SET status = $1 WHERE id = $2 RETURNING *

Result: 1 row updated
```

**Delete old records:**

```
Prompt: "Delete logs from before 2025"

Tool:   db_delete_many(table="logs",
         where={"created_at":{"lt":"2025-01-01"}}, dryRun=true)

SQL:    DELETE FROM logs WHERE created_at < $1 RETURNING *

Result: 1,204 rows would be deleted. Confirm? [yes/no]
```

---

## Cloud Databases

Add `PGSSLMODE` for cloud providers (Neon, Supabase, RDS, Render):

```env
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb
PGSSLMODE=require
```

Options: `disable`, `prefer`, `require`, `verify-full`. Auto-detected for most providers.

---

## Docker

Run PGAutoPilot alongside a fresh PostgreSQL instance, or point it at a database you already have:

```bash
docker compose up --build          # PostgreSQL 16 + MCP server together
docker run -e DATABASE_URL=... pgautopilot   # Connect to an existing DB
```

---

## Configuration

| Variable                  | Default       | What it does                                            |
| ------------------------- | ------------- | ------------------------------------------------------- |
| `DATABASE_URL`            | _(required)_  | PostgreSQL connection string                            |
| `PGSSLMODE`               | auto          | SSL mode: `disable`, `prefer`, `require`, `verify-full` |
| `PGPOOL_MAX`              | `5`           | Maximum simultaneous database connections               |
| `PG_CONNECT_TIMEOUT_MS`   | `10000`       | How long to wait when connecting (ms)                   |
| `PG_IDLE_TIMEOUT_MS`      | `30000`       | How long idle connections stay open (ms)                |
| `PG_STATEMENT_TIMEOUT_MS` | `10000`       | Max time for a single query (ms)                        |
| `BACKUPS_DIR`             | `./backups`   | Where `db_backup` saves files                           |
| `DOCKER_CONTAINER`        | -             | Docker container name for `pg_dump` fallback            |
| `BLOCKED_TABLES`          | -             | Tables to block writes on (comma-separated)             |
| `SENSITIVE_COLUMNS`       | -             | Extra columns to redact (comma-separated)               |
| `NODE_ENV`                | `development` | Set to `production` to disable per-request logging      |

### CLI flags

```bash
pgautopilot --readonly
pgautopilot --mode=production
pgautopilot --readonly --mode=production
```

---

## Performance

PGAutoPilot adds minimal overhead over a direct PostgreSQL connection — query latency depends primarily on your database and network. The bundled single-file executable has zero runtime dependencies, and connection pool size and statement timeouts are both configurable. Full performance benchmarks will be published once the project reaches a stable release.

---

## Compatibility

| Platform | Support      |
| -------- | ------------ |
| Windows  | Yes (native) |
| macOS    | Yes (native) |
| Linux    | Yes (native) |
| Docker   | Yes          |
| WSL      | Yes          |
| ARM64    | Yes          |
| x64      | Yes          |
| Node 18  | Yes          |
| Node 20  | Yes          |
| Node 22  | Yes          |

---

## Software Signing

| Method         | How to verify                                                         |
| -------------- | --------------------------------------------------------------------- |
| SHA-256 hashes | `npm run verify` or `node scripts/verify.mjs`                         |
| GPG signature  | `npm run verify:gpg` (public key: [`PUBLIC_KEY.asc`](PUBLIC_KEY.asc)) |

Install scripts verify `checksums.txt` automatically after cloning. On mismatch, installation aborts. Bypass with `--skip-verify` (not recommended).

---

## FAQ

**Do I need to restart after changing my database schema?**
No. PGAutoPilot validates identifiers against the live schema on every request. Schema changes are reflected immediately without a restart.

**Can PGAutoPilot modify my database automatically?**
Only through explicit tool calls. Every write requires a deliberate AI action, and dry-run before write is the default workflow.

**Does it work with Supabase?**
Yes. Use the Supabase connection string and set `PGSSLMODE=require`.

**Does it require npm?**
No. Install via npm, the one-line installer, or the single-file bundle.

**Does it support SSL?**
Yes — auto-detected or configured via `PGSSLMODE`.

**Can I disable writes entirely?**
Yes. `pgautopilot --readonly` blocks every write operation.

**Can I expose it publicly?**
No. PGAutoPilot is designed for local/private network use. There is no authentication layer or HTTP server.

**Is it safe for production?**
Yes — every write path is guarded. See the [Safety](#safety) and [Security](#security) sections for details.

---

## Troubleshooting

| Error                         | Likely cause                        | How to verify           | Fix                                                   |
| ----------------------------- | ----------------------------------- | ----------------------- | ----------------------------------------------------- |
| `DATABASE_URL is not set`     | `.env` not found or missing         | `echo $DATABASE_URL`    | Create `.env` in the working directory                |
| `Connection refused`          | PostgreSQL not running or wrong URL | `pg_isready`            | Check host/port, Docker port mapping                  |
| `SSL connection error`        | Cloud DB requires SSL               | Check provider docs     | Set `PGSSLMODE=require`                               |
| `Unknown table` / column      | Typo or wrong schema                | Run `db_overview` first | Use exact names from schema                           |
| `Only SELECT queries allowed` | Using `db_raw_query` for writes     | N/A                     | Use `db_create`, `db_update_many`, etc.               |
| `pg_dump failed`              | `pg_dump` not installed             | `which pg_dump`         | Install `postgresql-client` or set `DOCKER_CONTAINER` |

---

## Development

### Repository layout

```
src/
  index.ts           Entry point, MCP server initialization
  config.ts          Environment variable loading and validation
  db.ts              PostgreSQL connection pool management
  schema.ts          Live schema introspection via information_schema
  sqlBuilder.ts      Parameterized, safe SQL query builder
  safety.ts          Redaction engine, write access control, warnings
  toolDefinitions.ts Zod schemas for all 14 tools
  toolHandlers.ts    Tool implementations, one handler per tool
```

### Commands

| Command             | What it does                                           |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | Start with hot-reload (development)                    |
| `npm run build`     | Compile TypeScript and bundle into a single executable |
| `npm start`         | Run the compiled version                               |
| `npm run typecheck` | Full TypeScript type checking                          |
| `npm run lint`      | TypeScript type-check + ESLint                         |
| `npm run format`    | Auto-format source files with Prettier                 |

---

## Roadmap

- Authentication plugins (API key, JWT)
- Streaming query results
- Schema migration tools
- Prometheus metrics / OpenTelemetry
- Multi-database support (read replicas, shards)
- Query explain and optimization suggestions

---

## Contributing

1. Strict TypeScript — no `any` types
2. Every write path must pass through the safety layer
3. Add tests for new features
4. Keep dependencies minimal

Fork, branch, commit, open a PR.

---

## License

[MIT](LICENSE) &copy; 2026 [Cyber Reinxy](https://github.com/cyberreinxy)
