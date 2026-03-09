# 🎨 FEATURE(logicDesign agent)

## 1. Objective

Introduce a dedicated `logicDesign` agent that runs **first** in the "Plan" mode pipeline. It receives the user's request, determines all required workflow nodes, and generates highly detailed `promptOrLogic` content for each. Only after this design is complete does it delegate to `plannerAgent`, which exclusively handles assembling and saving the MDX plan artifact.

**Execution order:**
```
User → Logic Agent (primary, designs nodes + prompts)
            └→ Planner Agent (subordinate, assembles + saves MDX)
```

---

## 2. Phased Sections

### Phase 1: Define the `logicDesign` Agent and Prompt

**Target File:** `src/prompts/logic.ts` [NEW]

**Justification:** A prompt that lists responsibilities, rules, and enumerates node types gives the model surface area to guess, assume, and drift. The Logic Agent's SR is one sentence: design nodes and call `invokePlanner`. The prompt is written as a contract boundary — `INPUT → ACTION → OUTPUT`. No rule list, no node type enumeration (the tool schema enforces valid types). Extra prose is scope creep bait.

```typescript
export const ZIP_LOGIC_PROMPT = `
You are the Zip-Logic-Designer.

INPUT: A user's description of an agent they want built.
ACTION: Determine the required workflow nodes. For every node, produce a thoroughly
detailed promptOrLogic — enough for an engineer to implement without asking questions.
OUTPUT: Call invokePlanner once with the complete, fully-designed nodeDesign payload.

You do not write prose. You do not save files. You do not explain your reasoning.
You design, then you call invokePlanner. That is your entire scope.
`;
```

---

### Phase 2: Add the `invokePlanner` Tool

**Target File:** `src/tools.ts` [MODIFY]

**Justification:** The Logic Agent needs a single, well-typed tool to hand off its designed node array to the Planner Agent. The tool calls `plannerAgent.generate()` programmatically, passing the full designed node structure as context. The Planner only receives what the Logic Agent has designed.

```typescript
// Inside createZipTools, requires plannerAgent injected via a callback (same pattern as logicAgentDelegate)

invokePlanner: {
    name: "invokePlanner",
    description:
        "Hand the complete node design to the Planner Agent to assemble and save the MDX plan. " +
        "Call this ONLY after designing ALL nodes. Pass the full nodeDesign array.",
    parameters: z.object({
        agentName: z.string().describe("Human-readable agent name"),
        purpose: z.string().describe("One sentence describing the agent's goal"),
        outputFilename: z.string().describe("Output plan filename without extension"),
        nodeDesign: z.array(z.object({
            nodeType: z.string(),
            nodeName: z.string(),
            nodeId: z.string(),
            purpose: z.string(),
            keysTypesValues: z.string(),
            types: z.string().optional(),
            promptOrLogic: z.string(),
        })).describe("Complete array of all designed nodes"),
        flowEdges: z.array(z.object({
            from: z.string(),
            to: z.string(),
            label: z.string().optional(),
        })).describe("All flow edges between nodes"),
        justifications: z.array(z.string()).default([]),
        futureEnhancements: z.array(z.string()).default([]),
    }).shape,
    execute: async (payload) => {
        try {
            // Delegate to the plannerAgent via injected callback
            const result = await config.plannerDelegate!(JSON.stringify(payload));
            return { success: true, result };
        } catch (e) {
            return { success: false, error: (e as Error).message };
        }
    }
},
```

*Note: `config.plannerDelegate` is a `(payload: string) => Promise<string>` injected at construction time in `src/index.ts`.*

---

### Phase 3: Programmatic Enforcement via `@mastra/core` Processor + TripWire

**New Target File:** `src/processors/LogicGuardProcessor.ts` [NEW]

**Justification:** Mastra 1.5.0-alpha.1 exposes a first-class `Processor` interface with `processOutputStep` and `abort({ retry: true })` (`TripWire`). This is the idiomatic enforcement layer. The `LogicGuardProcessor` is attached to the **Logic Agent** as an `outputProcessor`. It fires after every LLM step and intercepts `invokePlanner` calls — verifying that the `nodeDesign` array contains fully detailed `promptOrLogic` fields before the Planner is invoked. If any node has a lazy summary, it fires `abort({ retry: true })` with specific feedback.

```typescript
import type { Processor, ProcessOutputStepArgs } from '@mastra/core/processors';

const GUARDED_NODE_TYPES = ['generic_ai', 'if_condition', 'execute_script', 'python'];
const MIN_PROMPT_OR_LOGIC_LENGTH = 100; // reject if suspiciously short

export class LogicGuardProcessor implements Processor<'logic-guard'> {
    readonly id = 'logic-guard';
    readonly name = 'Logic Guard';

    processOutputStep({ toolCalls, abort }: ProcessOutputStepArgs): void {
        for (const call of toolCalls ?? []) {
            if (call.toolName !== 'invokePlanner') continue;

            const nodes: any[] = (call.args as any)?.nodeDesign ?? [];
            const lazy = nodes.filter(n =>
                GUARDED_NODE_TYPES.includes(n.nodeType) &&
                (!n.promptOrLogic || n.promptOrLogic.trim().length < MIN_PROMPT_OR_LOGIC_LENGTH)
            );

            if (lazy.length > 0) {
                abort(
                    `Blocked: invokePlanner was called with lazy promptOrLogic on nodes: ` +
                    `[${lazy.map((n: any) => n.nodeId).join(', ')}]. ` +
                    `Every generic_ai, if_condition, execute_script, and python node MUST have ` +
                    `a comprehensive promptOrLogic (minimum ${MIN_PROMPT_OR_LOGIC_LENGTH} characters). ` +
                    `Redesign the flagged nodes before calling invokePlanner.`,
                    { retry: true }
                );
            }
        }
    }
}
```

---

### Phase 4: Define Planner Agent SR using `PlanBuilder.ts`

**Target File:** `src/prompts/planner.ts` [MODIFY]

**Single Responsibility:** Receive the fully-designed node array from the Logic Agent, validate it against `AgentPlanDraftSchema`, render it via `renderAgentPlanMdx`, and persist it via `saveAgentPlan`. Nothing else.

**PlanBuilder.ts helpers used by this SR:**
- `AgentPlanDraftSchema` — validates the full plan structure (node IDs, edge refs, duplicate check)
- `renderAgentPlanMdx` — renders the plan to MDX sections (overview, node flow table, mermaid diagram, justifications)
- `normalizePlanFilename` — normalizes the output filename

These are all invoked inside the `saveAgentPlan` tool. The Planner Agent's SR maps directly onto that single tool call.

**Planner prompt — pure SR contract:**
```typescript
export const ZIP_PLANNER_PROMPT = `
You are the Zip-Planner.

INPUT: A structured node design payload from the Logic-Designer.
ACTION: Call saveAgentPlan once with the payload exactly as received.
OUTPUT: A persisted MDX plan artifact on disk.

You do not design nodes. You do not rewrite promptOrLogic. You do not talk to the user.
You receive structured data and you persist it. That is your entire scope.
`;
```

**Planner tool set — minimal, SR-scoped:**
```typescript
const plannerAgent = new Agent({
    id: "zip-planner",
    name: "Zip-Planner",
    instructions: ZIP_PLANNER_PROMPT,
    model: config.defaultModelId,
    tools: {
        saveAgentPlan: tools.saveAgentPlan,   // SR: validate + render + persist
        readAgentPlan: tools.readAgentPlan,   // revision path only
    }
});
```

---

### Phase 5: Wire Everything in `src/index.ts`

**Target File:** `src/index.ts` [MODIFY]

**Justification:** The `Plan` mode's primary agent becomes `logicDesignAgent`. `plannerAgent` is wired as a subordinate via a delegate callback injected into tools. The `PlannerGuardProcessor` is dropped in favor of `LogicGuardProcessor` which lives on the Logic Agent.

```typescript
import { ZIP_LOGIC_PROMPT } from "./prompts/logic.js";
import { LogicGuardProcessor } from "./processors/LogicGuardProcessor.js";

// Planner is wired first (no circular dep — no tools yet)
const plannerAgent = new Agent({
    id: "zip-planner",
    name: "Zip-Planner",
    instructions: ZIP_PLANNER_PROMPT,
    model: config.defaultModelId,
    tools: {
        saveAgentPlan: tools.saveAgentPlan,
        readAgentPlan: tools.readAgentPlan,
    }
});

// Logic agent tools include invokePlanner as a delegate callback
const logicTools = createZipTools({
    ...config,
    plannerDelegate: async (payload: string) => {
        const result = await plannerAgent.generate(
            `Assemble and save this plan: ${payload}`
        );
        return result.text;
    }
});

const logicDesignAgent = new Agent({
    id: "zip-logic-designer",
    name: "Logic-Designer",
    instructions: ZIP_LOGIC_PROMPT,
    model: config.defaultModelId,
    outputProcessors: [new LogicGuardProcessor()],
    maxProcessorRetries: 3,
    tools: {
        invokePlanner: logicTools.invokePlanner,
    }
});

// Plan mode is now owned by logicDesignAgent
const { harness } = createMastraCode({
    modes: [
        { id: "build", name: "Build", default: true, defaultModelId: config.defaultModelId, agent: builderAgent },
        { id: "plan", name: "Plan", defaultModelId: config.defaultModelId, agent: logicDesignAgent }
    ],
    initialState: { currentModelId: config.defaultModelId },
});
```

---

## 3. Summary of New Agents

| Agent | Role | Primary? | Tools |
|---|---|---|---|
| `Zip-Builder` | Builds agent JSON programmatically | Yes (Build mode) | All 17 builder tools |
| `Logic-Designer` | Designs nodes + prompt logic | **Yes (Plan mode)** | `invokePlanner` |
| `Zip-Planner` | Assembles + saves MDX plan | **No (subordinate)** | `saveAgentPlan`, `readAgentPlan` |
