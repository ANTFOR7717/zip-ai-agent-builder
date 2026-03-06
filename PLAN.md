# Plan: NPM Package Conversion for `basic-tui` (Iteration 5)

## Overview
Transform the `basic-tui` directory into a standalone, enterprise-ready npm package (`@zip/agent-builder-tui`). This 5th iteration focuses on **Strict Encapsulation**, **Dependency-Injected Logging**, and **Testable API Surfaces**. We are abandoning global `console.log` statements in the core library and ensuring runtime configurations are `readonly` immutables.

---

## Phase 1: Package Distribution Infrastructure

### 1. Initialize `package.json`
**Clean Refactor Goal**: Ensure strict node resolutions, proper typing entry points, and deterministic binary mappings.

**Justification**: A robust `package.json` prevents consumer installation failures. We enforce ES Modules natively (`"type": "module"`). The `exports` map strictly defines what consumers are allowed to import, locking down internal APIs to prevent unintended coupling.

```json
{
  "name": "@zip/agent-builder-tui",
  "version": "1.0.0",
  "description": "Enterprise TUI for building Zip Agents via Mastracode",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "require": "./dist/index.js",
      "import": "./dist/index.mjs",
      "types": "./dist/index.d.ts"
    }
  },
  "bin": {
    "zip-builder": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mastra/core": "1.5.0-alpha.1",
    "mastracode": "0.1.0-alpha.3",
    "zod": "^4.3.6",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "tsup": "^8.3.6",
    "typescript": "^5.5.0",
    "@types/node": "^20.0.0"
  }
}
```

> **Simplification**: The `"main"`, `"module"`, and `"exports".require` fields (lines 21–29) exist to support CJS consumers. Since `"type": "module"` is declared and our consumers are on modern Node, these can be reduced to a single ESM entry. This eliminates the dual-format complexity:
> ```json
> "main": "./dist/index.js",
> "types": "./dist/index.d.ts",
> "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } }
> ```

### 2. Configure `tsconfig.json` & `tsup.config.ts`
**Clean Refactor Goal**: Prevent `any` types escaping into the runtime, enforce ES Module compliance, and output transparent, debuggable bundles.

**Justification (`tsconfig.json`)**: Using `"moduleResolution": "NodeNext"` strictly enforces explicit `.js` extensions in local imports, which is mandatory for Node ES Modules. Setting `noImplicitAny` and `strictNullChecks` guarantees developers explicitly route data exceptions.

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

**Justification (`tsup.config.ts`)**: `tsup` handles outputting both CJS and ESM formats automatically for maximum package compatibility. `sourcemap: true` and `minify: false` ensure consumers see proper mapped stack traces mapping back to our TS files.

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
});
```

> **Simplification**: `format: ['cjs', 'esm']` (line 84) produces two bundles. If we drop CJS from `package.json` (above), this becomes `format: ['esm']` — one bundle, half the `dist/` output, no format ambiguity.

### 3. Create `.gitignore`

**Justification**: `.env` contains a live API key. `output-agents/` is runtime output. Standard project hygiene.

```gitignore
node_modules/
dist/
.env
output-agents/
*.tsbuildinfo
```

---

## Phase 2: Core Architecture Refactoring (`src/`)

We decompose the logic into decoupled modules:
1. **Schema & Config Validation** (`src/config.ts`)
2. **Asynchronous FS Tools** (`src/tools.ts`)
3. **Core Orchestration** (`src/index.ts`)
4. **CLI Process Boundary** (`src/cli.ts`)



### 1. Configuration Validation (`src/config.ts`)
**Clean Refactor Goal**: Guarantee runtime safety across the library by parsing incoming options into an immutable structure, allowing consumers to pass custom loggers.

> **Prose note**: The "Clean Refactor Goal" + "Justification" pattern throughout Phase 2 averages 3–4 sentences per section. These are useful during planning but add ~40 lines of prose that won't survive into code comments. Consider trimming each to a single-line purpose statement during implementation.

**Justification**: Options passed programmatically or parsed from `process.env` in CLI mode should be strictly guarded. Failing early on bad config strings saves debugging time. The returned configuration is explicitly typed as `Readonly` to prevent accidental mutation during runtime.

```typescript
import { z } from "zod";

// We define a simple Logger interface so consumers can inject their own (e.g., Winston, Pino)
export interface Logger {
  info: (msg: string) => void;
  error: (msg: string, err?: unknown) => void;
  warn: (msg: string) => void;
}

// Default no-op logger to prevent accidental console spam in library mode if not requested
const defaultLogger: Logger = {
  info: () => {},
  error: () => {},
  warn: () => {}
};

export const BuilderConfigSchema = z.object({
  outputDir: z.string().default("output-agents"),
  defaultModelId: z.string().default("kilo/minimax/minimax-m2.5:free"),
  verbose: z.boolean().default(true),
  validAgentsDir: z.string().default("examples/Valid-Agents"),
});

export type ZipBuilderOptions = z.infer<typeof BuilderConfigSchema> & { logger?: Logger };
export type ReadonlyZipBuilderConfig = Readonly<z.infer<typeof BuilderConfigSchema> & { logger: Logger }>;

export function parseConfig(options: Partial<ZipBuilderOptions> = {}): ReadonlyZipBuilderConfig {
  try {
    const parsed = BuilderConfigSchema.parse(options);
    return Object.freeze({
      ...parsed,
      logger: options.logger ?? defaultLogger
    });
  } catch (error) {
    throw new Error(`Invalid Configuration for ZipAgentBuilder: ${(error as Error).message}`);
  }
}
```

> **Simplification 1 — Logger DI**: The `Logger` interface, `defaultLogger`, and logger injection (lines 124–153 above) add ~30 lines to solve a problem that doesn't exist yet. The existing system uses `console.log` and works. The `verbose` flag already controls output. For v1, `config.verbose ? console.log : () => {}` is sufficient. Custom logging can be added later without breaking the API.
>
> **Simplification 2 — `Object.freeze` + `Readonly<>`**: `BuilderConfigSchema.parse()` (line 161) already validates and returns a clean object. Wrapping it in `Object.freeze` (line 162) AND typing it as `Readonly<>` (line 157) is triple-layer protection on a 4-field config. Zod's parse is sufficient — the freeze/Readonly guard against the developer mutating their own config, which is a code discipline issue, not a runtime safety issue.

### 2. File System Tools Factory (`src/tools.ts`)
**Clean Refactor Goal**: Isolate I/O side effects, use `fs/promises` to prevent Node Event Loop blocking, and introduce graceful fallback errors so the LLM Agent doesn't crash on bad inputs. Use the injected logger.

**Justification**: migrating to `fs/promises` guarantees high performance. Furthermore, catching parsing errors ensures the LLM gets a graceful string. Injecting the logger allows us to trace tool execution without polluting `stdout` unexpectedly.

<!--
```typescript
// ─── ORIGINAL (Iteration 5) — preserved for reference, DO NOT implement ───
import { promises as fs, existsSync } from "fs";
import { z } from "zod";
import path from "path";
import { ReadonlyZipBuilderConfig } from "./config.js";

/**
 * Returns strongly typed asynchronous filesystem tool bindings for Mastra
 */
export function createZipTools(config: ReadonlyZipBuilderConfig) {

  const ensureDir = async (dirPath: string) => {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (e: any) {
      if (e.code !== 'EEXIST') {
        config.logger.error(`Failed to create directory: ${dirPath}`, e);
        throw e;
      }
    }
  };

  return {
    listAgents: {
      name: "listAgents",
      description: "List JSON files in Valid-Agents folder",
      parameters: z.object({}).shape,
      execute: async () => {
        try {
          if (!existsSync(config.validAgentsDir)) return "No Valid-Agents folder found";
          const files = await fs.readdir(config.validAgentsDir);
          return files.filter(f => f.endsWith(".json")).join("\n") || "No files found.";
        } catch (error) {
           config.logger.warn(`listAgents tool failed: ${(error as Error).message}`);
           return `Error listing agents: ${(error as Error).message}`;
        }
      },
    },
    
    readAgent: {
      name: "readAgent",
      description: "Read agent JSON from valid agents or output directory",
      parameters: z.object({
        filename: z.string().describe("Agent filename"),
        folder: z.enum(["valid", "output"]).default("valid").describe("Folder to read from"),
      }).shape,
      execute: async ({ filename, folder }: { filename: string; folder: "valid" | "output" }) => {
        try {
          const targetDir = folder === "valid" ? config.validAgentsDir : config.outputDir;
          const filepath = path.join(targetDir, filename);
          
          if (!existsSync(filepath)) return `File missing: ${filepath}`;
          // Asynchronous non-blocking file read
          return await fs.readFile(filepath, "utf-8");
        } catch (error) {
          config.logger.warn(`readAgent tool failed on ${filename}: ${(error as Error).message}`);
          return `Critical error reading file: ${(error as Error).message}`;
        }
      },
    },

    saveAgent: {
      name: "saveAgent",
      description: "Save generated agent JSON to output folder",
      parameters: z.object({
         filename: z.string().describe("Filename ending in .json"),
         agent: z.record(z.any()).describe("Complete agent JSON object to save"),
      }).shape,
      execute: async ({ filename, agent }: { filename: string; agent: Record<string, any> }) => {
        // Enforce basic schema safety directly inline to prevent bad file writes
        if (agent.type !== "task_template") return { success: false, error: "Missing/invalid type" };
        if (!Array.isArray(agent.steps_data)) return { success: false, error: "Missing/invalid steps_data" };
        if (!agent.workflow) return { success: false, error: "Missing workflow" };
        
        try {
          await ensureDir(config.outputDir);
          const finalName = filename.endsWith(".json") ? filename : `${filename}.json`;
          const filepath = path.join(config.outputDir, finalName);
          
          // Asynchronous un-blocking write
          await fs.writeFile(filepath, JSON.stringify(agent, null, 2));
          config.logger.info(`Successfully saved agent to ${filepath}`);
          return { success: true, filepath };
        } catch (error) {
           config.logger.error(`saveAgent tool failed to write ${filename}`, error);
           return { success: false, error: `Failed to write file: ${(error as Error).message}` };
        }
      },
    }
  };
}
```
-->

> **Simplification 1 — Dead `ensureDir`**: `fs.mkdir(path, { recursive: true })` already no-ops when the directory exists — it never throws `EEXIST`. The entire `ensureDir` wrapper (lines 183–191) is a 10-line function around a 1-liner. Replace `await ensureDir(config.outputDir)` with `await fs.mkdir(config.outputDir, { recursive: true })` directly in `saveAgent`.
>
> **Simplification 2 — `existsSync` contradicts async goal**: The plan states the goal is `fs/promises` to prevent event loop blocking, but `existsSync` (lines 200, 212) is synchronous. Either use `fs.access()` or — simpler — just attempt the read/readdir and catch `ENOENT`. This is the standard Node pattern (ask forgiveness, not permission) and eliminates the race condition where a file could be deleted between the exists check and the read.
>
> **Simplification 3 — `config.logger.*` calls**: If Logger DI is dropped (see config.ts simplification above), all 5 `config.logger` calls in this file become dead code. The tools already return descriptive error strings to the LLM on failure — that's the actual error handling that matters here.

**Refactored `src/tools.ts`** — applying all three simplifications above. **USE THIS version for implementation:**

```typescript
import { promises as fs } from "fs";
import { z } from "zod";
import path from "path";
import { ZipBuilderConfig } from "./config.js";

export function createZipTools(config: ZipBuilderConfig) {
  return {
    listAgents: {
      name: "listAgents",
      description: "List JSON files in Valid-Agents folder",
      parameters: z.object({}).shape,
      execute: async () => {
        try {
          const files = await fs.readdir(config.validAgentsDir);
          return files.filter(f => f.endsWith(".json")).join("\n") || "No files found.";
        } catch {
          return "No Valid-Agents folder found";
        }
      },
    },

    readAgent: {
      name: "readAgent",
      description: "Read agent JSON from valid agents or output directory",
      parameters: z.object({
        filename: z.string().describe("Agent filename"),
        folder: z.enum(["valid", "output"]).default("valid").describe("Folder to read from"),
      }).shape,
      execute: async ({ filename, folder }: { filename: string; folder: "valid" | "output" }) => {
        try {
          const targetDir = folder === "valid" ? config.validAgentsDir : config.outputDir;
          return await fs.readFile(path.join(targetDir, filename), "utf-8");
        } catch {
          return `File not found: ${filename}`;
        }
      },
    },

    saveAgent: {
      name: "saveAgent",
      description: "Save generated agent JSON to output folder",
      parameters: z.object({
        filename: z.string().describe("Filename ending in .json"),
        agent: z.record(z.any()).describe("Complete agent JSON object to save"),
      }).shape,
      execute: async ({ filename, agent }: { filename: string; agent: Record<string, any> }) => {
        if (agent.type !== "task_template") return { success: false, error: "Missing/invalid type" };
        if (!Array.isArray(agent.steps_data)) return { success: false, error: "Missing/invalid steps_data" };
        if (!agent.workflow) return { success: false, error: "Missing workflow" };

        try {
          await fs.mkdir(config.outputDir, { recursive: true });
          const finalName = filename.endsWith(".json") ? filename : `${filename}.json`;
          const filepath = path.join(config.outputDir, finalName);
          await fs.writeFile(filepath, JSON.stringify(agent, null, 2));
          return { success: true, filepath };
        } catch (error) {
          return { success: false, error: `Failed to write: ${(error as Error).message}` };
        }
      },
    }
  };
}
```

### 3. Core API Orchestrator (`src/index.ts`)
**Clean Refactor Goal**: Expose a clean, programmatic factory that ties together the tools, Subagents, and the Mastra instance seamlessly, respecting the injected logger and immutable config.

**Justification**: This file is the gateway for programmatic consumption. Consumers get maximum flexibility without CLI collisions or unexpected console output.

```typescript
import { createMastraCode } from "mastracode";
import { MastraTUI } from "mastracode/tui";
import { parseConfig, ZipBuilderOptions, ReadonlyZipBuilderConfig } from "./config.js";
import { createZipTools } from "./tools.js";

import { ORCHESTRATOR_PROMPT } from "./prompts/orchestrator.js";
import { VALIDATOR_PROMPT } from "./prompts/validator.js";
import { GENERATOR_PROMPT } from "./prompts/generator.js";
import { STEPBUILDER_PROMPT } from "./prompts/stepBuilder.js";
import { COMPOSER_PROMPT } from "./prompts/composer.js";
import { MODIFIER_PROMPT } from "./prompts/modifier.js";
import { AUDITOR_PROMPT } from "./prompts/auditor.js";
import { IDMANAGER_PROMPT } from "./prompts/idManager.js";

export type { ZipBuilderOptions, ReadonlyZipBuilderConfig };

/**
 * Validates config, mounts dependencies, and bootstraps the Mastra harness and TUI.
 */
export function createZipAgentBuilder(rawOptions: Partial<ZipBuilderOptions> = {}) {
  const config = parseConfig(rawOptions);
  
  // Inject config dependencies (including logger) to tools
  const tools = createZipTools(config);

  config.logger.info(`Initializing Mastra Code Harness with model: ${config.defaultModelId}`);

  const { harness } = createMastraCode({
    subagents: [
      { id: "orchestrator", name: "Orchestrator", description: "Coordinates subagents to build Zip agents", instructions: ORCHESTRATOR_PROMPT, defaultModelId: config.defaultModelId },
      { id: "validator", name: "Validator", description: "Validates agent JSON against schema", instructions: VALIDATOR_PROMPT, defaultModelId: config.defaultModelId },
      { id: "generator", name: "Generator", description: "Creates new Zip agent JSON", instructions: GENERATOR_PROMPT, defaultModelId: config.defaultModelId },
      { id: "stepBuilder", name: "Step Builder", description: "Builds individual step definitions", instructions: STEPBUILDER_PROMPT, defaultModelId: config.defaultModelId },
      { id: "composer", name: "Composer", description: "Assembles steps into workflows", instructions: COMPOSER_PROMPT, defaultModelId: config.defaultModelId },
      { id: "modifier", name: "Modifier", description: "Modifies existing agents", instructions: MODIFIER_PROMPT, defaultModelId: config.defaultModelId },
      { id: "auditor", name: "Auditor", description: "Strict validation of generated agents", instructions: AUDITOR_PROMPT, defaultModelId: config.defaultModelId },
      { id: "idManager", name: "ID Manager", description: "Manages step ID patterns", instructions: IDMANAGER_PROMPT, defaultModelId: config.defaultModelId },
    ],
    extraTools: tools,
    initialState: { currentModelId: config.defaultModelId },
  });

  // Explicitly grant tools to the global session scope
  harness.grantSessionTool("subagent");
  harness.grantSessionTool("listAgents");
  harness.grantSessionTool("readAgent");
  harness.grantSessionTool("saveAgent");

  // Create (but do not automatically run) the TUI
  const tui = new MastraTUI({
    harness,
    appName: "Zip Agent Builder",
    verbose: config.verbose,
  });

  return { harness, tui, config }; // Export the immutable config back to the consumer
}
```


### 4. The Isolated CLI Runner (`src/cli.ts`)
**Clean Refactor Goal**: Handle process signals, environment overrides, and terminal rendering safely. Act as the composed integration layer for console interactions.

**Justification**: `process.exit(1)`, `console.error`, and `process.env` lookups should only ever exist at the boundary layer of an app. The underlying factory is completely decoupled from these global systems. We inject a `console` logger here because we *are* the CLI execution boundary.

```typescript
#!/usr/bin/env node
import 'dotenv/config'; // Auto-load API keys safely
import { createZipAgentBuilder } from "./index.js";

async function main() {
  // Define a basic logger for CLI feedback
  const cliLogger = {
    info: (msg: string) => console.log(`[INFO] ${msg}`),
    warn: (msg: string) => console.warn(`[WARN] ${msg}`),
    error: (msg: string, err?: unknown) => {
        console.error(`[ERROR] ${msg}`);
        if (err) console.error(err);
    }
  };

  // Gracefully translate string environments into programmatic defaults
  const rawConfig = {
    outputDir: process.env.ZIP_OUTPUT_DIR,
    defaultModelId: process.env.ZIP_DEFAULT_MODEL,
    verbose: process.env.ZIP_VERBOSE !== "false",
    validAgentsDir: process.env.ZIP_VALID_AGENTS_DIR,
    logger: cliLogger
  };

  try {
    const { tui, config } = createZipAgentBuilder(rawConfig);

    console.log(`🚀 Booting Zip Agent Builder (Model: ${config.defaultModelId}) [Output: ${config.outputDir}]`);
    
    // Mount terminal UI loop. If process is terminated, this loop unrolls safely.
    await tui.run();

  } catch (err) {
    console.error("\n❌ Fatal Error parsing config or launching terminal interface:");
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  }
}

// Global crash safety bounds
process.on('uncaughtException', (err) => {
    console.error('Unhandled Exception:', err);
    process.exit(1);
});

main();
```


---

## Phase 3: Developer & User Documentation

### 1. `README.md` Format
**Justification**: Clear documentation of typing exports, overrides, and dependency injection drives API adoption. 

```markdown
# @zip/agent-builder-tui

A Type-Safe, programmable terminal user interface for rapidly building proprietary JSON-based Zip Agents powered by Mastracode AI.

## Global Installation (CLI)
\`\`\`bash
npm install -g @zip/agent-builder-tui
\`\`\`

Ensure your API keys (e.g., `KILO_API_KEY`) exist in your `.env` file at the root where you run the command.

\`\`\`bash
# Start directly
zip-builder

# Configure overrides via Env
ZIP_OUTPUT_DIR="./custom-agents" ZIP_DEFAULT_MODEL="openai/gpt-4o" zip-builder
\`\`\`

## Programmatic Library Usage
When imported programmatically, the tool initialization is decoupled from execution, allowing advanced configurations natively:

\`\`\`typescript
import { createZipAgentBuilder, ZipBuilderOptions } from '@zip/agent-builder-tui';

// Provide your own logger or leave undefined for silence
const customLogger = {
    info: console.log,
    warn: console.warn,
    error: console.error
}

const config: ZipBuilderOptions = {
  outputDir: './my-agents', // Outputs all json here
  defaultModelId: 'openai/gpt-4o',
  verbose: true,
  validAgentsDir: './project-assets/agents', // Customize read paths safely!
  logger: customLogger 
};

// Start safely
const { tui, harness } = createZipAgentBuilder(config);
await tui.run();
\`\`\`
```

---

## Phase 4: Build & Execution Verification

1. **Re-Structure Filesystem**: Ensure all active TS files are recursively nested within `/src` (`src/index.ts`, `src/config.ts`, `src/tools.ts`, `src/cli.ts`, `src/prompts/`).
2. **Type Validation**: Execute `pnpm run typecheck` to mathematically prove the strict abstractions.
3. **Compile Ecosystem**: Run `pnpm run build` and assert `/dist` contains CJS (`index.js`), ESM (`index.mjs`), their respective map files, and declaration boundaries (`*.d.ts`).
4. **Symlink execution**: Run `npm link && zip-builder` to start the CLI natively via OS binary pathing safely outside regular root paths.

