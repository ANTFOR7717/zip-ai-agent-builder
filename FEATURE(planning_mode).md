# 🎯 FEATURE(planning_mode)

## Objective
Implement two deeply decoupled, distinct `/mode` environments natively within the Mastra TUI by registering standalone `Agent` instances. The **Planner Mode** uses `saveAgentPlan` to create sequential recipes. The **Builder Mode** executes those recipes into pure JSON using strict AST tools.

---

## Phase 1: Native Mode Switching

### Action 1.1: Update Prompt Exports
#### Target File: `src/prompts/index.ts`
#### Target Block: Lines 4-6
**Action & Code:** Re-export the new prompts.
```typescript
export { ZIP_BUILDER_PROMPT } from "./builder.js";
export { ZIP_PLANNER_PROMPT } from "./planner.js";
```

### Action 1.2: Instantiate Agents and Configure Modes
#### Target File: `src/index.ts`
#### Target Block: Lines 33-67
**Action & Code:** Replace `subagents` and monolithic wiring with strictly defined `modes`.
```typescript
    const builderAgent = new Agent({
        name: "Zip-Builder",
        instructions: ZIP_BUILDER_PROMPT,
        model: config.defaultModelId,
        tools: {
            initializeAgent: tools.initializeAgent,
            addApprovalTrigger: tools.addApprovalTrigger,
            addGetRequestStep: tools.addGetRequestStep,
            addGetVendorStep: tools.addGetVendorStep,
            addHttpStep: tools.addHttpStep,
            addAiStep: tools.addAiStep,
            addConditionStep: tools.addConditionStep,
            addReturnStep: tools.addReturnStep,
            addJinjaStep: tools.addJinjaStep,
            addLoopStep: tools.addLoopStep,
            addBreakStep: tools.addBreakStep,
            addMemorySetStep: tools.addMemorySetStep,
            addMemoryGetStep: tools.addMemoryGetStep,
            addMemoryAppendStep: tools.addMemoryAppendStep,
            addPythonStep: tools.addPythonStep,
            setCursor: tools.setCursor,
            compileAndSave: tools.compileAndSave
        }
    });

    const plannerAgent = new Agent({
        name: "Zip-Planner",
        instructions: ZIP_PLANNER_PROMPT,
        model: config.defaultModelId,
        tools: { saveAgentPlan: tools.saveAgentPlan }
    });

    const { harness } = createMastraCode({
        modes: [
            { id: "build", name: "Build", default: true, defaultModelId: config.defaultModelId, agent: builderAgent },
            { id: "plan", name: "Plan", defaultModelId: config.defaultModelId, agent: plannerAgent }
        ],
        initialState: { currentModelId: config.defaultModelId },
    });
```

---

## Phase 2: `saveAgentPlan` Tool

### Action 2.1: Inject Tool Definition
#### Target File: `src/tools.ts`
#### Target Block: Lines 580-580
**Action & Code:** Add the safe file save operation, constrained purely to writing the file to disk.
```typescript
        saveAgentPlan: {
            name: "saveAgentPlan",
            description: "Saves a generated plan to the configured plan directory.",
            parameters: z.object({
                filename: z.string().describe("Name of the file (without extension)"),
                content: z.string().describe("The full text content of the plan"),
            }).shape,
            execute: async ({ filename, content }: { filename: string; content: string }) => {
                try {
                    const planDir = path.resolve(process.cwd(), config.planDir);
                    await fs.mkdir(planDir, { recursive: true });
                    const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, "");
                    const fullPath = path.join(planDir, `${safeName}.md`);
                    await fs.writeFile(fullPath, content, "utf-8");
                    return { success: true, message: `Plan saved to ${fullPath}` };
                } catch (e) {
                    return { success: false, error: (e as Error).message };
                }
            },
        },
```

---

## Phase 3: Planner & Builder Prompts

### Action 3.1: Create Planner Prompt
#### Target File: `src/prompts/planner.ts`
**Action & Code:** Keep the plan structure strictly minimal, mapping output directly to the tools the builder will call.
```typescript
export const ZIP_PLANNER_PROMPT = \`
You are the Zip-Planner. Outline the logical sequence of AST node tools needed for the user's agent.

1. Do NOT generate JSON.
2. Outline a linear checklist of programmatic node operation tool calls (e.g., "- addHttpStep(url: '...', ...)").
3. Use your \`saveAgentPlan\` tool to save this checklist securely to disk.
4. Keep the plan strictly minimal. Only output the variables and tool call sequence required for the Builder to execute.
\`;
```

### Action 3.2: Create Builder Prompt
#### Target File: `src/prompts/builder.ts`
**Action & Code:** Limit instructions purely to executing tools based on user text input.
```typescript
export const ZIP_BUILDER_PROMPT = \`
You are the Zip-Builder. Your exclusive task is to execute the node operations from the provided plan text.

1. Call \`initializeAgent(name)\` first.
2. Call \`addApprovalTrigger()\` as step 1.
3. Methodically transcribe each step from the plan into the exact corresponding \`addXStep\` tool call.
4. When finished, call \`compileAndSave()\` to generate the pure JSON AST.
\`;
```

### Action 3.3: Delete Old Prompt
#### Target File: `src/prompts/zip-pilot.ts`
**Action:** Delete the file.

---

## Phase 4: Configuration Refactoring

### Action 4.1: Extend Config Schema
#### Target File: `src/config.ts`
#### Target Block: Lines 3-8
**Action & Code:**
```typescript
export const BuilderConfigSchema = z.object({
    outputDir: z.string().default("build-agents"),
    planDir: z.string().default("plan-agents"),
    defaultModelId: z.string().default("kilo/minimax/minimax-m2.5:free"),
    verbose: z.boolean().default(true),
    validAgentsDir: z.string().default("examples/Valid-Agents"),
});
```

### Action 4.2: Expose Environment Variable
#### Target File: `src/cli.ts`
#### Target Block: Lines 7-12
**Action & Code:**
```typescript
    const rawConfig: Partial<ZipBuilderOptions> = {
        outputDir: process.env.ZIP_OUTPUT_DIR,
        planDir: process.env.ZIP_PLAN_DIR,
        defaultModelId: process.env.ZIP_DEFAULT_MODEL,
        verbose: process.env.ZIP_VERBOSE !== "false",
        validAgentsDir: process.env.ZIP_VALID_AGENTS_DIR,
    };
```
