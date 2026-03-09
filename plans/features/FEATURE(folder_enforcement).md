# FEATURE: Strict Folder Convention Enforcement

## Objective

Enforce the `plan-agents/` → `build-agents/` → `output-agents/` pipeline contract at runtime by centralizing all write operations through a shared `BuildPipeline` utility, eliminating hardcoded directory strings from build scripts and adding plan-first enforcement to both the LLM tool path and the standalone build-script path.

---

## Current State (Problem Trace)

### Write path A — LLM tool path
```
Zip-Builder agent
  → compileAndSave tool (tools.ts:556)
      → activeBuilder.compile()         ✅ validates refs + orphans
      → fs.mkdir(config.outputDir)      ✅ uses config
      → fs.writeFile(filepath, json)    ✅ uses config.outputDir
      ❌ NO plan-first check
```

### Write path B — standalone build script path
```
npx tsx build-agents/build-msa-sow-agent.ts
  → AgentBuilder + StepBuilder directly
      → agent.compile()                 ✅ validates refs + orphans
      → path.join(process.cwd(), "output-agents", ...)  ❌ HARDCODED STRING
      → fs.writeFile(outputPath, ...)   ❌ bypasses config.outputDir entirely
      ❌ NO plan-first check
      ❌ NO shared contract with the tool path
```

### Write path C — plan path
```
Zip-Planner agent
  → saveAgentPlan tool (tools.ts:586)
      → renderAgentPlanMdx(planDraft)   ✅ always renders REQUIRED_PLAN_SECTIONS
      → normalizePlanFilename(filename) ✅ forces .mdx, strips bad chars
      → fs.writeFile(fullPath, mdx)     ✅ uses config.planDir
```

**Path C is correct. Paths A and B are missing plan-first enforcement. Path B is additionally broken by hardcoded directory.**

---

## Phase 0: Fix Critical Bug in `src/config.ts`

**Justification:** The anti-laziness audit found that `outputDir` defaults to `"build-agents"` — not `"output-agents"`. This means the `compileAndSave` tool has been writing compiled JSON into `build-agents/` by default, directly corrupting the folder separation this feature is meant to enforce. This must be fixed before anything else.

**Target:** [`src/config.ts`](file:///Users/dev/Projects/zip-ai-agent-builder/src/config.ts) — line 4

```diff
- outputDir: z.string().default("build-agents"),
+ outputDir: z.string().default("output-agents"),
```

> **Note:** `cli.ts` reads `outputDir` from `process.env.ZIP_OUTPUT_DIR` — if that env var is unset, the wrong default has been in effect for all LLM tool sessions.

---

## Phase 1: `src/builders/BuildPipeline.ts` — New Shared Utility

**Justification:** Both write paths (tool + build script) need the same guarantees. Centralizing eliminates drift between them. This module is the single source of truth for how compiled agent output gets written.

**Target:** `src/builders/BuildPipeline.ts` — NEW FILE

```typescript
// src/builders/BuildPipeline.ts
// Shared write utility for both the `compileAndSave` tool and standalone build-agents/ scripts.
// Enforces: plan-first check, output path from config, filename normalization.

import { promises as fs } from "fs";
import path from "path";
import type { AgentBuilder } from "./AgentBuilder.js";
import { normalizePlanFilename } from "./PlanBuilder.js";

export interface BuildPipelineOptions {
  /** Path to the plans directory (e.g. config.planDir). */
  planDir: string;
  /** Path to the compiled output directory (e.g. config.outputDir). */
  outputDir: string;
}

/**
 * Compiles an AgentBuilder instance and saves the result to `options.outputDir`.
 *
 * Enforces:
 * 1. A corresponding `<options.planDir>/<filename>.mdx` must exist before any build is allowed.
 * 2. Output is always written to `options.outputDir` — never a hardcoded path.
 * 3. Output filename is normalized: strips path separators, forces .json extension.
 *
 * Throws on plan-first violation or compile errors.
 * Returns the resolved output filepath on success.
 */
export async function buildAndSave(
  builder: AgentBuilder,
  filename: string,
  options: BuildPipelineOptions
): Promise<string> {
  const safeBase = filename.trim().replace(/\.json$/i, "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeBase) {
    throw new Error(`BuildPipeline: filename "${filename}" is invalid. Use kebab-case e.g. "my-agent".`);
  }

  // ── 1. Plan-first guard ──────────────────────────────────────────────────
  const planFilename = normalizePlanFilename(safeBase); // e.g. "my-agent.mdx"
  const planPath = path.resolve(process.cwd(), options.planDir, planFilename);
  try {
    await fs.access(planPath);
  } catch {
    throw new Error(
      `BuildPipeline: No plan found: "${planPath}". ` +
      `Use saveAgentPlan (Plan mode) to create it first.`
    );
  }

  // ── 2. Compile ───────────────────────────────────────────────────────────
  const compiled = builder.compile(); // throws on ref/orphan violations

  // ── 3. Write to options.outputDir ──────────────────────────────────────────
  const outputFilename = `${safeBase}.json`;
  const outputPath = path.resolve(process.cwd(), options.outputDir, outputFilename);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(compiled, null, 2), "utf-8");

  return outputPath;
}
```

---

## Phase 2: Update `compileAndSave` in `src/tools.ts`

**Justification:** The tool currently inlines the write logic. Replace it with a call to `buildAndSave()` so the LLM path shares the same contract as build scripts.

**Target:** [`src/tools.ts`](file:///Users/dev/Projects/zip-ai-agent-builder/src/tools.ts) — `execute` function only (lines 556–569). The `name`, `description`, and `parameters` fields at lines 544–555 are **not touched**.

**Before:**
```typescript
execute: async ({ filename }) => {
    if (!activeBuilder) return { success: false, error: "Call initializeAgent first" };
    try {
        const json = activeBuilder.compile();
        await fs.mkdir(config.outputDir, { recursive: true });
        const finalName = filename.endsWith(".json") ? filename : `${filename}.json`;
        const filepath = path.join(config.outputDir, finalName);
        await fs.writeFile(filepath, JSON.stringify(json, null, 2));
        activeBuilder = null;
        return { success: true, filepath };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
},
```

```typescript
execute: async ({ filename }: { filename: string }): Promise<ToolResult> => {
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
},
```

**Add import at top of `src/tools.ts`:**
```typescript
import { buildAndSave } from "./builders/BuildPipeline.js";
```

**Note on imports in `src/tools.ts`:** The `fs.mkdir` and `fs.writeFile` calls are removed from inside `compileAndSave`. The top-level `import { promises as fs }` and `import path` declarations at the top of `tools.ts` are **NOT** removed — `saveAgentPlan` (line 592) and `readAgentPlan` (line 609) still use them.

---

## Phase 3: Update `build-agents/build-msa-sow-agent.ts`

**Justification:** The build script currently hardcodes `"output-agents"` and does its own `fs.writeFile`. Replace with `buildAndSave()` — making it use the same path resolution and plan-first checks as the tool.

**Target:** [`build-agents/build-msa-sow-agent.ts`](file:///Users/dev/Projects/zip-ai-agent-builder/build-agents/build-msa-sow-agent.ts) — lines 1–6, 151–172

**Add import at top:**
```typescript
import { buildAndSave } from "../src/builders/BuildPipeline.js";
```

**Remove:**
```typescript
import { promises as fs } from "fs";   // ← remove (no longer needed)
import path from "path";                // ← remove (no longer needed)
```

**Replace lines 151–172** (the entire compile-and-save block, including summary prints that used `compiled`):

```typescript
// Before (lines 151-172):
const compiled = agent.compile();
const outputPath = path.join(process.cwd(), "output-agents", "msa-sow-reader-agent.json");
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(compiled, null, 2));
console.log("13. ✓ compileAndSave('msa-sow-reader-agent')");
console.log(`\n✅ Agent saved to: ${outputPath}`);
console.log("\n--- Agent Summary ---");
console.log(`Name: ${compiled.name}`);
console.log(`Steps: ${compiled.steps_data.length}`);
console.log("Workflow:");
console.log("  trigger → zip_1 → zip_2 → ai_1 → condition_1");
console.log("                                          ↘ (true) → ai_2");
console.log("                                          ↘ (default) → ai_3 → return_1");
return compiled;

// After:
const outputPath = await buildAndSave(agent, "msa-sow-reader-agent", {
    planDir: "plan-agents",
    outputDir: "output-agents",
});
console.log("13. ✓ buildAndSave('msa-sow-reader-agent')");
console.log(`\n✅ Agent saved to: ${outputPath}`);
```

> **Why lines 165–166 are removed:** `compiled.name` and `compiled.steps_data.length` reference `compiled` which no longer exists in scope — `buildAndSave` owns the compile step internally. The `outputPath` log remains valid since `buildAndSave` returns it. `return compiled` is dropped since the caller (`buildMsaSowReaderAgent().catch(...)`) never uses the return value.

---

## Phase 4: Fix `tsconfig.json`

**Justification:** `build-agents/*.ts` scripts are not in the TypeScript include list, meaning they currently get zero type-checking. Any type mismatch between them and `src/builders/` is invisible until runtime.

**Target:** [`tsconfig.json`](file:///Users/dev/Projects/zip-ai-agent-builder/tsconfig.json) — line 17

```diff
  "include": [
    "src/**/*",
-   "scripts/**/*"
+   "scripts/**/*",
+   "build-agents/**/*"
  ]
```

---

## Enforcement Summary After Implementation

| Violation | Enforcement mechanism | When |
|---|---|---|
| `outputDir` default pointed at wrong folder | `config.ts` default corrected to `"output-agents"` | App boot |
| Build without a plan | `buildAndSave()` throws — plan-first guard | Tool execute time AND build script run time |
| Output to wrong directory | `buildAndSave()` resolves path from `options.outputDir` | Tool execute time AND build script run time |
| Hardcoded `"output-agents"` string | Build scripts import `buildAndSave` — no raw path | Build script authoring time (TypeScript) |
| Type mismatch in build scripts | `tsconfig.json` includes `build-agents/` | `npm run typecheck` |
| Bad plan filename | `normalizePlanFilename()` already throws | Already enforced, reused in `buildAndSave` |

---

## Files Changed

| File | Change |
|---|---|
| `src/config.ts` | **BUGFIX** — `outputDir` default `"build-agents"` → `"output-agents"` |
| `src/builders/BuildPipeline.ts` | **NEW** — shared `buildAndSave()` utility |
| `src/tools.ts` | MODIFY — `compileAndSave` delegates to `buildAndSave()` |
| `build-agents/build-msa-sow-agent.ts` | MODIFY — uses `buildAndSave()` instead of inline `fs.writeFile` |
| `tsconfig.json` | MODIFY — adds `build-agents/**/*` to include |
