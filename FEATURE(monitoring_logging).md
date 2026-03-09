# FEATURE: Monitoring & Logging System

## Objective

Introduce a structured, opt-in logging layer across the entire `zip-ai-agent-builder` runtime that captures every tool invocation, result, error, file write, and session lifecycle event — surfaced as a persistent log file and queryable from the TUI.

---

## Current State (Audit)

| Location | What exists | Gap |
|---|---|---|
| `src/config.ts` | `verbose: z.boolean().default(true)` | Only one flag, used for a single boot `console.log` |
| `src/cli.ts` | `console.log` on boot, `console.error` on fatal crash | No structured log, no session ID, no timestamps |
| `src/tools.ts` | Every tool wraps in `try/catch → { success, error }` | Errors are swallowed back to the LLM — never persisted |
| `src/builders/BuildPipeline.ts` | `fs.writeFile` for JSON output | No audit trail of WHAT was written WHERE and WHEN |
| `src/index.ts` | `write_file` guard logs nothing | Silent reroutes are invisible |
| Anywhere | — | No tool call latency tracking |
| Anywhere | — | No session ID to correlate events |

---

## Phase 0: `src/logger.ts` — Structured Logger

**Justification:** A single, shared logger module avoids scattered `console.log` calls. It writes to both stdout (if verbose) and a persistent JSONL log file (`logs/zip-builder.log`) so sessions can be replayed and debugged.

**Target:** `src/logger.ts` — **NEW FILE**

```typescript
// src/logger.ts
// Structured logger for the Zip Agent Builder runtime.
// Writes JSONL entries to logs/zip-builder.log + stdout (if verbose).

import { promises as fs } from "fs";
import path from "path";

export type LogLevel = "info" | "warn" | "error" | "tool" | "file";

export interface LogEntry {
    ts: string;           // ISO timestamp
    level: LogLevel;
    sessionId: string;
    event: string;        // e.g. "tool:compileAndSave", "file:write", "boot"
    data?: Record<string, unknown>;
}

let _sessionId: string = "unset";
let _logPath: string = path.join(process.cwd(), "logs", "zip-builder.log");
let _verbose: boolean = true;

export function initLogger(opts: { sessionId: string; logDir?: string; verbose?: boolean }) {
    _sessionId = opts.sessionId;
    if (opts.logDir) _logPath = path.join(opts.logDir, "zip-builder.log");
    if (opts.verbose !== undefined) _verbose = opts.verbose;
}

export async function log(level: LogLevel, event: string, data?: Record<string, unknown>) {
    const entry: LogEntry = {
        ts: new Date().toISOString(),
        level,
        sessionId: _sessionId,
        event,
        ...(data ? { data } : {}),
    };

    // Stdout (verbose only for info/tool; always for warn/error)
    if (_verbose || level === "warn" || level === "error") {
        const prefix = { info: "ℹ️ ", warn: "⚠️ ", error: "❌", tool: "🔧", file: "📄" }[level];
        console.log(`${prefix} [${entry.ts}] ${event}`, data ?? "");
    }

    // Persistent JSONL file (always)
    try {
        await fs.mkdir(path.dirname(_logPath), { recursive: true });
        await fs.appendFile(_logPath, JSON.stringify(entry) + "\n", "utf-8");
    } catch {
        // Logging must never crash the application
    }
}
```

---

## Phase 1: Wire Logger in `src/cli.ts`

**Justification:** Boot is the first event. The session ID is established here with a short timestamp-based ID so all subsequent log entries in this TUI session are correlated.

**Target:** [`src/cli.ts`](file:///Users/dev/Projects/zip-ai-agent-builder/src/cli.ts) — lines 1–36

```typescript
#!/usr/bin/env node
import 'dotenv/config';
import { createZipAgentBuilder } from "./index.js";
import { initLogger, log } from "./logger.js";

async function main() {
    const sessionId = `s-${Date.now()}`;

    const rawConfig = {
        outputDir: process.env.ZIP_OUTPUT_DIR,
        planDir: process.env.ZIP_PLAN_DIR,
        defaultModelId: process.env.ZIP_DEFAULT_MODEL,
        verbose: process.env.ZIP_VERBOSE !== "false",
    };

    initLogger({ sessionId, verbose: rawConfig.verbose });

    try {
        const { tui, config } = createZipAgentBuilder(rawConfig);
        await log("info", "boot", { model: config.defaultModelId, outputDir: config.outputDir });
        console.log(`🚀 Booting Zip Agent Builder (Model: ${config.defaultModelId}) [Output: ${config.outputDir}]`);
        await tui.run();
        await log("info", "shutdown");
    } catch (err) {
        await log("error", "fatal", { message: err instanceof Error ? err.message : String(err) });
        console.error("\n❌ Fatal Error:", err instanceof Error ? err.stack : err);
        process.exit(1);
    }
}

process.on('uncaughtException', async (err) => {
    await log("error", "uncaughtException", { message: err.message });
    console.error('Unhandled Exception:', err);
    process.exit(1);
});

main();
```

---

## Phase 2: Tool-level Logging in `src/tools.ts`

**Justification:** Every tool call is a meaningful event. Wrapping the existing `try/catch` with `log()` before and after gives full observability: what was called, with what params, succeeded or failed, and how long it took.

**Target:** [`src/tools.ts`](file:///Users/dev/Projects/zip-ai-agent-builder/src/tools.ts) — lines 1–11 (imports) + the shared `wrapTool` pattern at the top of `createZipTools`

**Add import at top:**
```typescript
import { log } from "./logger.js";
```

**Add `wrapTool` helper inside `createZipTools` (before the tool definitions):**
```typescript
// Wraps any tool execute fn with structured logging and latency tracking
async function wrapTool<T>(
    toolName: string,
    input: Record<string, unknown>,
    fn: () => Promise<T>
): Promise<T> {
    const start = Date.now();
    try {
        const result = await fn();
        const ms = Date.now() - start;
        const r = result as any;
        if (r?.success === false) {
            await log("warn", `tool:${toolName}`, { input, error: r.error, ms });
        } else {
            await log("tool", `tool:${toolName}`, { input, ms });
        }
        return result;
    } catch (e) {
        await log("error", `tool:${toolName}`, { input, error: (e as Error).message, ms: Date.now() - start });
        throw e;
    }
}
```

**Usage pattern in execute blocks** (each tool's `execute` delegates to `wrapTool`):
```typescript
// Example: compileAndSave
execute: async ({ filename }: { filename: string }): Promise<ToolResult> => {
    return wrapTool("compileAndSave", { filename }, async () => {
        if (!activeBuilder) return { success: false, error: "Call initializeAgent first" };
        try {
            const filepath = await buildAndSave(activeBuilder, filename, {
                planDir: config.planDir,
                outputDir: config.outputDir,
            });
            activeBuilder = null;
            return { success: true, filepath };
        } catch (e) {
            return { success: false, error: (e as Error).message };
        }
    });
},
```

> **Note:** Apply `wrapTool` to ALL tool `execute` functions: `initializeAgent`, `compileAndSave`, `saveAgentPlan`, `readAgentPlan`, and all `addXxxStep` tools (17 total).

---

## Phase 3: File-write Audit in `src/builders/BuildPipeline.ts`

**Justification:** Every write to `output-agents/` is a pipeline completion event. Logging it with filename, size, and timestamp gives a full audit trail of what was produced.

**Target:** [`src/builders/BuildPipeline.ts`](file:///Users/dev/Projects/zip-ai-agent-builder/src/builders/BuildPipeline.ts) — lines 49–57

```diff
+ import { log } from "../logger.js";
  ...
  await fs.writeFile(outputPath, JSON.stringify(compiled, null, 2), "utf-8");
+ const bytes = Buffer.byteLength(JSON.stringify(compiled, null, 2), "utf-8");
+ await log("file", "file:write:output", { path: outputPath, bytes });
  return outputPath;
```

---

## Phase 4: `write_file` guard audit in `src/index.ts`

**Justification:** The `write_file` guard silently reroutes `.ts` files to `build-agents/`. This reroute is invisible — logging it makes it explicit when the LLM tried to write a file to the wrong place.

**Target:** [`src/index.ts`](file:///Users/dev/Projects/zip-ai-agent-builder/src/index.ts) — inside `write_file` execute

```diff
+ import { log } from "./logger.js";
  ...
  const enforced =
      normalized.endsWith(".ts") && !normalized.startsWith("build-agents/")
-         ? `build-agents/${path.basename(normalized)}`
+         ? (() => {
+             const corrected = `build-agents/${path.basename(normalized)}`;
+             log("warn", "write_file:rerouted", { original: filePath, corrected });
+             return corrected;
+           })()
          : normalized;
```

---

## Phase 5: `src/config.ts` — Add `logDir` option

**Justification:** The log file location should be configurable like `outputDir` and `planDir`, not hardcoded in the logger.

**Target:** [`src/config.ts`](file:///Users/dev/Projects/zip-ai-agent-builder/src/config.ts) — `BuilderConfigSchema`

```diff
  export const BuilderConfigSchema = z.object({
      outputDir: z.string().default("output-agents"),
      planDir: z.string().default("plan-agents"),
+     logDir: z.string().default("logs"),
      defaultModelId: z.string().default("kilo/minimax/minimax-m2.5:free"),
      verbose: z.boolean().default(true),
  });
```

**Update `cli.ts` accordingly:**
```diff
- initLogger({ sessionId, verbose: rawConfig.verbose });
+ initLogger({ sessionId, logDir: config.logDir, verbose: config.verbose });
```

---

## Files Changed

| File | Change |
|---|---|
| `src/logger.ts` | **NEW** — shared structured JSONL logger |
| `src/cli.ts` | Wire `initLogger`, log boot/shutdown/crash |
| `src/tools.ts` | Add `wrapTool` + wrap all 17 tool execute functions |
| `src/builders/BuildPipeline.ts` | Log file write events with size |
| `src/index.ts` | Log `write_file` reroutes (warn level) |
| `src/config.ts` | Add `logDir` config option |

## Log Output Format (JSONL — one entry per line)

```json
{"ts":"2026-03-08T18:15:00Z","level":"info","sessionId":"s-1741464900000","event":"boot","data":{"model":"kilo/minimax/...","outputDir":"output-agents"}}
{"ts":"2026-03-08T18:15:03Z","level":"tool","sessionId":"s-1741464900000","event":"tool:readAgentPlan","data":{"input":{"filename":"msa-sow-reader-agent"},"ms":12}}
{"ts":"2026-03-08T18:15:30Z","level":"tool","sessionId":"s-1741464900000","event":"tool:compileAndSave","data":{"input":{"filename":"msa-sow-reader-agent"},"ms":240}}
{"ts":"2026-03-08T18:15:30Z","level":"file","sessionId":"s-1741464900000","event":"file:write:output","data":{"path":"/project/output-agents/msa-sow-reader-agent.json","bytes":48932}}
{"ts":"2026-03-08T18:15:31Z","level":"warn","sessionId":"s-1741464900000","event":"write_file:rerouted","data":{"original":"build-msa-sow.ts","corrected":"build-agents/build-msa-sow.ts"}}
```
