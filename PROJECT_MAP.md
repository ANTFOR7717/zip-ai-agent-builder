# Zip AI Agent Builder: Full Directory Structure & Map (Iteration 7)

This document provides a holistic directory tree of the `zip-ai-agent-builder` repository, followed by an exhaustive dictionary detailing the purpose and explicit dependencies of **every single file** present in the file system. 

### 📝 What Was Added in Iteration 7?
*The user requested a massive context expansion to move beyond just file-definitions and into **Code-Level implementations for EVERY SINGLE module** across the ecosystem:*
1. **`src/builders/` Deep Mappings:** Expanded `AgentBuilder`, `StepBuilder`, and `PlanBuilder` to document every single internal Class, Interface, and Function signature natively.
2. **`src/` Deep Mappings:** Expanded `index.ts`, `cli.ts`, `config.ts`, `theme.ts`, and `tools.ts` to document programmatic initialization boundaries, Zod interfaces, and internal functions.
3. **`src/prompts/` and Root Files Deep Mapping:** Expanded the AI prompting definitions natively exposing their exported string contexts. Also mapped test scripts (`test-build.ts`), bundle configs (`tsup.config.ts`), and build agents (`build-msa-sow-agent.ts`) explicitly denoting their internal TS execution logic.

### 📝 What Was Added in Iteration 5?
*The following items were missed or grouped too broadly in Iteration 4 and have now been strictly mapped with dependencies:*
1. **The `dist/` Directory:** Documented internal `tsup` compiled bundles (`chunk-IE5UQPJP.js`, `cli.js`, `index.js`, `.map`, and `.d.ts` files).
2. **The `node_modules/` Directory:** Documented explicitly as the 3rd-party resolver cache.
3. **The `.git/` Directory:** Documented as the internal version control object store.
4. **The `scripts/` Directory:** Now properly mapped as an intentionally empty boundary. 
5. **The `plans/` Sub-files:** Grouped together in Iteration 4. Now explicitly broken out (`BUGS.md`, `PLAN.md`, `PROMPT_PLAN.md`, `PROPOSAL_PLAN.md`) with their specific historical contexts and independent logic bounds.

---

## 🌳 Global Directory Structure

```text
zip-ai-agent-builder/
├── .agents/
│   └── skills/
│       └── whiteboarding/
│           └── SKILL.md
├── .git/
│   └── (Internal version control metadata)
├── build-agents/
│   └── build-msa-sow-agent.ts
├── dist/
│   ├── chunk-IE5UQPJP.js
│   ├── chunk-IE5UQPJP.js.map
│   ├── cli.d.ts
│   ├── cli.js
│   ├── cli.js.map
│   ├── index.d.ts
│   ├── index.js
│   └── index.js.map
├── node_modules/
│   └── (Installed NPM dependency binaries)
├── output-agents/
│   ├── .DS_Store
│   ├── msa-sow-reader-agent.json
│   └── MSA SOW Reader Agent imported at 3_7_2026, 5_58_33 PM.task_template.json
├── plan-agents/
│   └── msa-sow-reader-agent.mdx
├── plans/
│   ├── BUGS.md
│   ├── PLAN.md
│   ├── PROMPT_PLAN.md
│   └── PROPOSAL_PLAN.md
├── scripts/
│   └── (Empty intentionally)
├── src/
│   ├── builders/
│   │   ├── AgentBuilder.ts
│   │   ├── PlanBuilder.ts
│   │   └── StepBuilder.ts
│   ├── prompts/
│   │   ├── auditor.ts
│   │   ├── builder.ts
│   │   ├── composer.ts
│   │   ├── generator.ts
│   │   ├── idManager.ts
│   │   ├── index.ts
│   │   ├── modifier.ts
│   │   ├── planner.ts
│   │   ├── stepBuilder.ts
│   │   └── validator.ts
│   ├── schemas/
│   │   ├── .DS_Store
│   │   └── NODE_SCHEMA.md
│   ├── cli.ts
│   ├── config.ts
│   ├── index.ts
│   ├── theme.ts
│   └── tools.ts
├── .DS_Store
├── .env
├── .gitignore
├── BUGS.md
├── FEATURE(mdx_planning).md
├── FEATURE(planning_mode).md
├── PLAN copy.MD
├── PROJECT_MAP.md
├── README.md
├── RESTRICT_BUILDER_ACCESS.md
├── package.json
├── pnpm-lock.yaml
├── test-build.ts
├── tsconfig.json
└── tsup.config.ts
```

---

## 📁 Repository Root Structure Files

*   **`package.json`**
    *   **Purpose:** Defines project dependencies, metadata, and core NPM run scripts (`typecheck`, `build`, `start`).
    *   **Internal Implementations:** `name: "@zip/agent-builder-tui"`. Exposes CLI bin `zip-builder`. Configures `tsup` for build compilation and enforces `node >=18.0.0`. Specifies `dotenv`, `zod`, `@mastra/core` as dependencies.
    *   **Dependencies:** `npm`, Node.js environment.
*   **`tsconfig.json`**
    *   **Purpose:** Guides the TypeScript compiler. Critically encompasses both `"src/**/*"` and `"build-agents/**/*"` to guarantee type safety simultaneously across internal engine code and dynamically generated LLM scripts.
    *   **Internal Implementations:** Forces `target: ESNext`, `moduleResolution: NodeNext`, outputs to `./dist`, explicitly tracking `src/` and `scripts/` directories for strict type emission constraints.
    *   **Dependencies:** `tsc`, TypeScript compiler environment.
*   **`tsup.config.ts`**
    *   **Purpose:** Configuration for `tsup`, responsible for bundling the application into the `dist/` folder via `npm run build`.
    *   **Internal Implementations:**
        *   `defineConfig({ ... })`: Sets entry arguments (`src/index.ts`, `src/cli.ts`), outputs purely as `esm`, enables `dts` (TypeScript definition generation) and source maps `sourcemap: true`, with `minify: false` deliberately set to preserve debug traces.
    *   **Dependencies:** `tsup`, `package.json`.
*   **`.env`**
    *   **Purpose:** Stores secret environment-level configurations and API keys.
    *   **Internal Implementations:** Stores standard developer keys mapping: `KILO_API_KEY` (JWT payload format) and the fallback `DEFAULT_OM_MODEL_ID=kilo/minimax/minimax-m2.5`.
    *   **Dependencies:** Parsed by `dotenv` within `src/cli.ts`.
*   **`.gitignore`**
    *   **Purpose:** Specifies intentionally untracked files to omit from version control (like `.env`, `node_modules/`, `/dist`).
    *   **Internal Implementations:** Explicitly excludes generated agent artifact directories: `output-agents/`, `build-agents/`, and `plan-agents/` preventing dirty commits of JSON AST payload runs natively.
    *   **Dependencies:** Core `git` application.
*   **`pnpm-lock.yaml`**
    *   **Purpose:** Locks down exactly which dependency trees and versions are physically installed.
    *   **Internal Implementations:** Systematically generated YAML mapping defining physical module resolution checksums tracking node_modules dependencies precisely guaranteeing deterministic TUI builds.
    *   **Dependencies:** Generated by `package.json` and the PNPM package manager.
*   **`README.md`**
    *   **Purpose:** High-level project entry documentation for developers learning to boot the application.
    *   **Internal Implementations:** Illustrates 2 implementation pathways: Terminal command-line usage (`npm install -g`, CLI `ZIP_OUTPUT_DIR`) vs. programmatic integration via `createZipAgentBuilder(config)`.
    *   **Dependencies:** None (Human-readable text).
*   **`BUGS.md`**
    *   **Purpose:** Tracking record of solved systemic bugs, issues currently under investigation, and critical engineering notes on resolution approaches.
    *   **Internal Implementations:** Documents 2 severe bugs: 1) Systemic interpolation type-coercion array-flattening (fixed by regex boundary trapping resolving control refs) and 2) Invalid `structured_schema` node definitions causing Zip compiler mapping crashes natively.
    *   **Dependencies:** None (Human-readable text).
*   **`RESTRICT_BUILDER_ACCESS.md`**
    *   **Purpose:** Foundational rule set guarding against over-engineering core modules. Prevents LLMs from creating hallucinated build environments.
    *   **Internal Implementations:** Dictates restricting the Orchestrator/Copilot from directly invoking specific functions (e.g., `addAiStep`, `compileAndSave`) constraining the parent loop to use strictly `subagent`, `submit_plan`, `ask_user`, and `readAgentPlan`.
    *   **Dependencies:** None (Context for LLMs).
*   **`FEATURE(mdx_planning).md`**
    *   **Purpose:** Architectural proposals and specification document denoting how the Node Schema flow engines generate Mermaid planning.
    *   **Internal Implementations:** A 569-line architecture blueprint implementing `AgentPlanDraft` validations via Zod schemas, defining deterministic 5-section MDX generation logic mapping raw JSON intent safely to human-verified Mermaid `.mdx` table flows.
    *   **Dependencies:** System design theories.
*   **`FEATURE(planning_mode).md`**
    *   **Purpose:** Architectural proposals isolating planner agents vs. executor agents inside the CLI modes.
    *   **Internal Implementations:** A 163-line document outlining the exact separation of Mastra context spaces mapping `createMastraCode(modes)` where Builder has rigid tool scopes executing generated AST instructions and Planner dictates JSON generation linearly.
    *   **Dependencies:** System design theories.
*   **`PLAN copy.MD`**
    *   **Purpose:** Historical clone file from initial iteration drafting.
    *   **Internal Implementations:** Tracks a massive historical 10-node Contract Review Agent execution pipeline detailing explicit prompt behaviors natively targeting document classifications, savings calculators, and structured security reporting natively.
    *   **Dependencies:** None.
*   **`test-build.ts`**
    *   **Purpose:** Scratchpad testing file for evaluating minor TS compilation structures without triggering the full interactive engine.
    *   **Internal Implementations:**
        *   `run()`: Programmatically boots the `createZipAgentBuilder` instance, dynamically extracting explicitly available `tools` from the `harness` via `harness.getTools()` directly logging their keys to validate the CLI tool-binding pipeline manually.
    *   **Dependencies:** `npx tsx` interpreter, dynamically imports `src/index.ts`.
*   **`.DS_Store`**
    *   **Purpose:** macOS system-generated hidden file storing custom attributes of its containing folder.
    *   **Internal Implementations:** Proprietary Apple binary tree format tracking localized icon view positions internally.
    *   **Dependencies:** macOS Finder OS.
*   **`PROJECT_MAP.md`**
    *   **Purpose:** This exact file. Serves as the self-documenting structural map of the repository.
    *   **Internal Implementations:** A sprawling markdown mapping mapping every explicit directory, file boundary, code implementation, and variable dependency natively documenting the entirety of the `@zip/agent-builder-tui` repository flawlessly.
    *   **Dependencies:** None.

---

## 📁 `/.git/` - Version Control

*   **`.git/` (and internal objects)**
    *   **Purpose:** Internal commit history and branch object meta-data manager for the repository.
    *   **Dependencies:** Git CLI.

---

## 📁 `/node_modules/` - Third-Party Binaries

*   **`node_modules/` (All package directories)**
    *   **Purpose:** Source binaries and execution libraries downloaded from NPM (like `@mastra/core`, `zod`, `typescript`).
    *   **Dependencies:** Linked to `package.json` and `pnpm-lock.yaml`.

---

## 📁 `/.agents/` - Automated Sub-System Configs

*   **`skills/whiteboarding/SKILL.md`**
    *   **Purpose:** Teaches autonomous sub-agents how to formulate comprehensive step-by-step architectural blueprints using the `FEATURE(xxx).md` convention.
    *   **Internal Implementations:** Enforces a rigid 4-step execution flow: 1) Create Blueprint Document, 2) Anti-Laziness Audit (deep grep search for edge cases), 3) Verification & Approval (blocked via `notify_user`), and 4) Disciplined Execution (planner strictly prohibited from modifying code directly).
    *   **Dependencies:** Agent Framework Context logic.

---

## 📁 `/plans/` - Deprecated/Historical Concept Plans

*   **`plans/BUGS.md`**
    *   **Purpose:** Track record of solved anomalous systemic bugs and edge cases encountered during the CLI development.
    *   **Internal Implementations:** Catalogs exact trace outputs of 5 primary bugs including `if_condition` left_value syntax mismatches, `structuredSchema` array un-wrapping crashes, Zip-Pilot hallucinated JSON paths, and invalid descriptive step_keys ignoring `type_N` conventions.
    *   **Dependencies:** Markdown documentation strictly utilized by the Copilot context memory.
*   **`plans/PLAN.md`**
    *   **Purpose:** Initial architectural roadmap defining the migration from standalone agent scripts into an isolated, standalone `@zip/agent-builder-tui` Enterprise NPM package.
    *   **Internal Implementations:** Outlines 4 explicit phases: 1) Package Distribution setup (tsup.config/package.json), 2) Core Architecture Refactoring, 3) Documentation formatting, 4) Symlinked build compilation targets.
    *   **Dependencies:** Markdown text informing future agent builder actions.
*   **`plans/PROMPT_PLAN.md`**
    *   **Purpose:** Specifies exact Subagent capability bounds preventing LLM hallucinations across complex multi-agent execution chains.
    *   **Internal Implementations:** Implements the Subagent Tool Assignment Matrix, forcibly restricting the `saveAgent` tool exclusively to the `Auditor` while blocking the `Orchestrator` to only leverage execution instructions.
    *   **Dependencies:** Informs the definitions currently executed in `src/index.ts`.
*   **`plans/PROPOSAL_PLAN.md`**
    *   **Purpose:** The monolithic V5 Enterprise Architecture proposal proving that relying entirely on LLMs for nested JSON execution is architecturally fatal due to syntax recursion.
    *   **Internal Implementations:** Outlines the original core mathematical prototypes backing `StepBuilder` (14 Factory Logic actions) and `AgentBuilder` (Sequential cursor DAG mappings) inherently proving programmatic JSON stability.
    *   **Dependencies:** Origination context strictly utilized originally to authored `src/schemas/NODE_SCHEMA.md` and `src/builders/`.

---

## 📁 `/dist/` - Production Output Distributables

*   **`dist/cli.js` & `dist/cli.js.map`**
    *   **Purpose:** Transpiled, minified CommonJS codebase serving as the immediate execution boundary when a user executes the binary CLI locally. Map file gives source-mapping references for debugging.
    *   **Dependencies:** `tsup` bundler from `src/cli.ts`.
*   **`dist/index.js` & `dist/index.js.map`**
    *   **Purpose:** Transpiled programmatic access entry logic if `zip-ai-agent-builder` were imported as an NPM package in the future.
    *   **Dependencies:** `tsup` bundler from `src/index.ts`.
*   **`dist/chunk-IE5UQPJP.js` & `dist/chunk-IE5UQPJP.js.map`**
    *   **Purpose:** Internal code split chunk resolving shared logic dependencies between the CLI and Index bundles simultaneously.
    *   **Dependencies:** `tsup` AST linker trees.
*   **`dist/cli.d.ts` & `dist/index.d.ts`**
    *   **Purpose:** TypeScript definition output libraries to offer type-awareness interfaces to external consuming packages.
    *   **Dependencies:** `tsc` declaration outputs from `/src`.

---

## 📁 `/scripts/` - Legacy Scripts Interface

*   **`/scripts/`**
    *   **Purpose:** Intentionally empty directory. Previously used to hold test generation agents, deprecated architecturally in favor of `/build-agents/`.
    *   **Dependencies:** None.

---

## 📁 `src/` - Application Core

*   **`index.ts`**
    *   **Purpose:** The main application bootstrap file. It initializes the dual-agent `MastraCode` harnessing framework (`Zip-Planner` and `Zip-Builder`).
    *   **Internal Implementations:**
        *   `createZipAgentBuilder(rawOptions)`: Instantiates `config` and `theme`. Initiates exactly two specific conversational agent primitives (`Zip-Builder` and `Zip-Planner`). Embeds foundational instructions directly pulled from `ZIP_BUILDER_PROMPT`. Attaches explicitly defined 17 `tools.ts` interface boundaries dynamically ensuring tight LLM containment. Spawns the CLI TUI dynamically returning the state context `harness`.
    *   **Dependencies:** `src/prompts/index.ts`, `src/config.ts`, `src/tools.ts`, `src/theme.ts`, `mastracode`, `@mastra/core/agent`.
*   **`cli.ts`**
    *   **Purpose:** The entry point executable ran when a user calls `npm run start` (or `npx tsx src/cli.ts`).
    *   **Internal Implementations:**
        *   `main()`: Extracts `process.env` structures natively via `dotenv`, evaluates arguments like `--dir` mapping them to config primitives cleanly piping natively into `createZipAgentBuilder()`, boots the asynchronous interactive terminal loop via `await tui.run()`. Manages generic global unhandled exceptions natively guarding the system from hard-crashing unconditionally globally via global `console.error` fallback catches.
    *   **Dependencies:** `src/index.ts`, `dotenv`.
*   **`config.ts`**
    *   **Purpose:** The central schema logic managing configurable paths (`outputDir`, `planDir`) and application flags (`verbose`, `defaultModelId`). It uses `zod` schema parsing for rigid defaults.
    *   **Internal Implementations:**
        *   `const BuilderConfigSchema`: Direct Zod Map tracking defaults to `kilo/minimax/minimax-m2.5:free`.
        *   `type ZipBuilderOptions` / `ZipBuilderConfig`: Inferred TypeScript signatures bound directly to the Zod graph.
        *   `parseConfig(options)`: Programmatically validates configuration bounds during the CLI bootstrap phase, explicitly throwing `Invalid Configuration...` halting bad boot operations.
    *   **Dependencies:** `zod` NPM package natively.
*   **`theme.ts`**
    *   **Purpose:** Themed UI logic handling visual prompt decorators and colors in the terminal.
    *   **Internal Implementations:**
        *   `createTheme()`: Injects custom `ThemeColors` object explicitly defining color codes (e.g. `accent: "#5572DA"`, `thinkingText: "#cbd5e1"`) into the native context.
    *   **Dependencies:** Imports `setTheme` natively from `mastracode/tui`.
*   **`tools.ts`**
    *   **Purpose:** Exposes 17 highly-rigid Zod-backed tool definitions representing the exact actions `Zip-Builder` is allowed to take (e.g., `addAiStep`, `compileAndSave`, `readAgentPlan`). It enforces rigid JSON types via the `ToolResult` interface.
    *   **Internal Implementations:**
        *   **Interface `ToolResult`**: Defines the absolute return structure (`success`, `error`, `filepath`, `source`) strictly required inherently universally for LLMs.
        *   `makeVarsArray(vars)`: Native helper function serializing deep python/jinja `{key, valueRef}` AST configurations into standard Zip models natively safely escaping primitive values.
        *   `run(fn)`: Core execution wrapper. Graceful error catcher trapping underlying AST throwing components (like `AgentBuilder.validateKey` faults), flattening them to `{ success: false, error: err.message }` recursively.
        *   `createZipTools(config)`: Massive monolithic factory yielding precisely 17 explicit dynamic tool interfaces natively wrapped by deep Zod execution bounds natively. Interfaces parse arguments (like `{ key, name }`), intercept parameters securely, and push them down into the active heap `activeBuilder!.addStep(StepBuilder.xxx(..))`. 
    *   **Dependencies:** `src/builders/StepBuilder.ts`, `src/builders/AgentBuilder.ts`, `src/builders/PlanBuilder.ts`, `src/config.ts`, `zod`, `fs` (Node Native), `path` (Node Native).

---

## 📁 `src/builders/` - The AST Compilation Engine

*   **`AgentBuilder.ts`**
    *   **Purpose:** Acts as a stateful "shopping cart" while the LLM builds out steps. It manages the queue of nodes, validates uniqueness of step names, dynamically navigates branches (cursor routing), and ultimately compiles the entire structure.
    *   **Internal Implementations:**
        *   **Class `WorkflowNode`**: Internal tree data structure (`key`, `label`, `steps[]`) dictating the execution topography routing natively.
        *   **Class `ConfigVarDef`**: Enforces strict payload shapes (`title`, `kind`, `required`) for global Zip configuration variable allocations natively.
        *   **Class `AgentBuilderOptions`**: Defines interface flags securely (e.g. `strictKeyNames: boolean`).
        *   **Class `AgentBuilder`**:
            *   `constructor(name, opts)`: Maps root `stepsList`, `workflowRoot`, and initializes state natively.
            *   `addStep(step: ZipStep)`: Intelligently intercepts pure steps. Performs strict key validation inherently enforcing boundaries (like `type_N`). Maps `trigger` steps outside standard arrays recursively binding natively into `workflow.trigger`. Initializes null branch shapes identically formatting against condition loops accurately inherently. Injects execution block utilizing active cursor bounds cleanly.
            *   `setCursor(parentId, branch)`: Relocates appending insertion bounds internally enabling nested hierarchy structures flawlessly via direct pointer overwrites dynamically natively.
            *   `addConfigVar(key, def)`: Globally registers configs.
            *   `compile()`: Analyzes complete AST structures natively enforcing safety bound integrity tests iteratively. Executes Orphan Checks isolating unused variables natively. Traces full cyclic Reference Lookups actively eliminating `ReferenceError` collisions dynamically generating finalized perfectly formed `.json`. 
            *   `validateKey()`, `injectIntoBranch()`, `extractAstKeys()`: Internal recursion logic boundaries securely enforcing branch paths natively.
    *   **Dependencies:** Extracts types natively from `StepBuilder.ts`, core JavaScript internal Map engines.
*   **`StepBuilder.ts`**
    *   **Purpose:** The core intelligence layer. Exposes deterministic factory class methods (e.g., `StepBuilder.genericAi`, `StepBuilder.http`, `StepBuilder.condition`) exactly mirroring the 14 available Zip node schemas globally.
    *   **Internal Implementations:**
        *   **Interfaces `ConnectorKey`, `AiModel`, `OutputFormat`, `ControlType`**: Strict TypeScript literal types guarding static string combinations directly intercepting hallucinations iteratively natively.
        *   **Type `ZipStep`**: Exact execution block encapsulating `key, display_name, connector_key, action_key, input_config, ...`.
        *   **Class `StepBuilder`**:
            *   `resolveControl(valueRef)`: Abstract interpreter deducing if dynamic variables map natively into `ref` (pure logic path, e.g `steps.abc`) arrays, or if structural boundaries demand string interpolation natively mapping via `text` controls protecting logic formatting identically against dynamic corruptions natively.
            *   `makeSchemaArray(fields)`: Formats logical unstructured tuples natively translating `{ key, type, definition }` structures securely translating them uniformly into rigid deep arrays dynamically iterating arrays precisely into Zip’s monolithic `{ control: "object", value: ... }` parameters intelligently avoiding validation crashes dynamically natively.
            *   *(14 Factory Execution Nodes)*: `http()`, `condition()`, `genericAi()`, `approvalAssist()`, `getRequest()`, `getVendor()`, `renderJsonTemplate()`, `loop()`, `breakLoop()`, `setMemory()`, `getMemory()`, `appendMemory()`, `python()`, `returnStep()`. Each implements precise literal arrays formatting natively mapped boundaries safely.
    *   **Dependencies:** Standalone self-contained core runtime natively avoiding external libraries structurally.
*   **`PlanBuilder.ts`**
    *   **Purpose:** Analyzes intermediate LLM plans utilizing Zod arrays (like `nodeFlow` and `flowEdges`), verifying mathematical DAG computation before rendering them to stringified MDX diagrams.
    *   **Internal Implementations:**
        *   **Interfaces `AgentPlanDraft`, `PlanNode`, `PlanEdge`**: Defines complex Zod models wrapping arrays natively validating mathematical structures instantly natively.
        *   `parseAgentPlanDraft(input)`: Validates untrusted execution blocks cleanly outputting standard variables.
        *   `addNodeRow()`, `updateNodeRow()`, `removeNodeRow()`: Immutable mapping loops recreating isolated schema chunks incrementally intercepting state corruption safely natively.
        *   `renderAgentPlanMdx()`, `renderFlowchart()`, `renderNodeFlowTable()`: Translates arrays perfectly natively iterating cleanly against markdown boundary strings injecting pure Mermaid Chart definitions automatically accurately natively.
    *   **Dependencies:** `zod` boundaries validating variables cleanly natively.

---

## 📁 `src/prompts/` - The System Brain Context

Contains system instructions explicitly instructing conversational models and defining raw string boundary configurations directly via exported variables creatively ensuring agent logic containment natively.

*   **`index.ts`**
    *   **Purpose:** Central prompt repository barrel.
    *   **Internal Implementations:** `export *` definitions exposing boundary instructions internally natively.
    *   **Dependencies:** Exposes `planner.ts`, `builder.ts`.
*   **`planner.ts`**
    *   **Purpose:** Target limitation string bounding `Zip-Planner`.
    *   **Internal Implementations:** `export const ZIP_PLANNER_PROMPT`: Long string definition detailing strict constraints forcing planner to export schemas natively before execution natively creatively bounding states.
    *   **Dependencies:** Ingested via `mastracode` in `index.ts`.
*   **`builder.ts`**
    *   **Purpose:** Target limitation defining the `Zip-Builder` TUI context natively.
    *   **Internal Implementations:** `export const ZIP_BUILDER_PROMPT`: Ruleset explicitly forcing agent to parse read context (`readAgentPlan`) before iterating node factories gracefully.
    *   **Dependencies:** Ingested via `mastracode` in `index.ts`.
*   **`generator.ts`**
    *   **Purpose:** Generative chain node instructions defining baseline raw generation architectures directly natively.
    *   **Internal Implementations:** `export const GENERATOR_PROMPT`: Outlines exact Zip literal keys forcing models to adhere identically to reference states. 
    *   **Dependencies:** Defines system memory parameters structurally implicitly.
*   **`auditor.ts`**
    *   **Purpose:** Strict unit-tester ruleset against logic exported by the `generator`. Validates that all 13 top-level configuration schemas exist perfectly.
    *   **Internal Implementations:** `export const AUDITOR_PROMPT`: Directs the LLM to verify connector keys, enforce branch endings, and detect circular reference graph paths.
    *   **Dependencies:** Evaluates strings exported exclusively from `generator.ts`.
*   **`validator.ts`**
    *   **Purpose:** Validates Directed Acyclic Graph (DAG) cyclic checks so logic branches don't infinitely recurse prior to serialization.
    *   **Internal Implementations:** `export const VALIDATOR_PROMPT`: Explicitly instructs checking of all 8 core step fields and bounds input structures cleanly.
    *   **Dependencies:** Evaluates strings exported from `composer.ts`.
*   **`composer.ts`**
    *   **Purpose:** Re-assembles fragmented arrays of AST steps into massive overarching single JSON workflows natively.
    *   **Internal Implementations:** `export const COMPOSER_PROMPT`: Gives the LLM exact JSON scaffolding (`{"workflow": {"trigger": ..., "steps": [...]}}`) to compile blocks together safely.
    *   **Dependencies:** Formulates string inputs outputted from `generator.ts`.
*   **`modifier.ts`**
    *   **Purpose:** Guides precise diff-editing when updating existing configurations without destroying un-edited nodes.
    *   **Internal Implementations:** `export const MODIFIER_PROMPT`: Defines the edit pipeline (Read -> Apply -> Update -> Validate) protecting against context loss.
    *   **Dependencies:** Reads existing JSON payloads dynamically mapped by mastracode contexts.
*   **`stepBuilder.ts`**
    *   **Purpose:** Granular contextual boundaries teaching how standard input fields specifically align into the exact 14 supported Zip schemas.
    *   **Internal Implementations:** `export const STEPBUILDER_PROMPT`: Embeds raw JSON examples of `zip_1`, `generic_ai`, `return_value`, and `condition` natively into the LLM context.
    *   **Dependencies:** Serves as abstract ruleset memory natively for step definitions.
*   **`idManager.ts`**
    *   **Purpose:** Prompt rules to maintain universal global unique IDs (Step Keys) safely down complex LLM chains.
    *   **Internal Implementations:** `export const IDMANAGER_PROMPT`: Enforces strict naming patterns (`ai_N`, `http_N`, etc) and explicitly mandates tracking state arrays before pushing new keys.
    *   **Dependencies:** Prevents collision between steps defined iteratively by the planner.

---

## 📁 `src/schemas/` - Blueprint Documentation

*   **`.DS_Store`**
    *   **Purpose:** System-generated Mac attribute file.
    *   **Internal Implementations:** Native Apple OS binary blob specifying localized window UI states invisibly.
    *   **Dependencies:** macOS.
*   **`NODE_SCHEMA.md`**
    *   **Purpose:** The foundational "Ground Truth" documentation dictating exact configuration payloads mathematically matching the Zip execution engine.
    *   **Internal Implementations:** Defines all 13 top-level required fields structurally, delineates the exact required field matrices for all 10 connection nodes (e.g. `connector_key`, `action_key`), maps all 11 execution flow typologies natively, and dictates branch labels boundaries tightly.
    *   **Dependencies:** Underpins `StepBuilder.ts` variable array requirements natively.

---

## 📁 `build-agents/` - Deterministic Generation Environment

*   **`build-msa-sow-agent.ts`**
    *   **Purpose:** An automated executable script mapping programmatic architectures directly building exact Zip targets completely decoupled from AI context natively safely enabling pure CI/CD generation inherently.
    *   **Internal Implementations:**
        *   `buildMsaSowReaderAgent()`: Executes sequential `AgentBuilder` and `StepBuilder` functions directly (e.g., `builder.addStep(StepBuilder.approvalAssist(...))`) iterating cleanly mapping logic edges. Sets explicit deep cursors securely rendering nested conditionals uniformly. Traps configurations mapping inputs mapping bounds directly natively compiling automatically globally inherently exactly mapping outputs structurally securely universally natively. Resolves via internal async calls directly to `fs.promises.writeFile`.
    *   **Dependencies:** Directly relies uniformly on `../src/builders/AgentBuilder.js` and `../src/builders/StepBuilder.js`, Node primitives `fs` and `path`.

---

## 📁 `plan-agents/` - MDX Construction Schematics

*   **`msa-sow-reader-agent.mdx`**
    *   **Purpose:** Visually renders the planned agent execution topology to developers before any JSON compilation natively occurs.
    *   **Internal Implementations:** Generates markdown-rendered tables tracking specific node states alongside a flat DAG graph diagram flow sequence: `trigger → zip_1 → zip_2 → ai_1 → cond_1 → (ai_2 or ai_3) → return_1` securely isolating logic branches mapping explicitly to input/outputs.
    *   **Dependencies:** Rendered via `tools.ts -> PlanBuilder.renderAgentPlanMdx()`. Re-ingested via `tools.ts -> readAgentPlan()`.

---

## 📁 `output-agents/` - Final Artifact Delivery

*   **`.DS_Store`**
    *   **Purpose:** macOS folder meta attributes.
    *   **Internal Implementations:** Apple OS binary desktop services store indexing localized file order.
    *   **Dependencies:** macOS Finder OS.
*   **`msa-sow-reader-agent.json`**
    *   **Purpose:** Current executable output instance mapping exact execution states dynamically against MSA payload models cleanly.
    *   **Internal Implementations:** Native payload generated by the builder dictating 7 active Zip steps. Features isolated generic AI boundaries natively extracting MSA elements locally (`zip_1`, `zip_2`, `ai_1`, sequentially mapped to branch endpoints `cond_1` dictating arrays locally).
    *   **Dependencies:** The definitive serialization payload exported natively from `AgentBuilder.compileAndSave()`.
*   **`MSA SOW Reader Agent imported at 3_7_2026, 5_58_33 PM.task_template.json`**
    *   **Purpose:** Earlier static output backup export directly retaining historical structures for diff-testing compilation consistency mathematically.
    *   **Internal Implementations:** An agent JSON payload mirroring `ai_1`, `ai_2`, `ai_3` topologies structurally mirroring the current instance but explicitly carrying empty/null configurations implicitly across its unstructured `structured_schema`.
    *   **Dependencies:** Exported directly from the active Zip Platform UI natively.
