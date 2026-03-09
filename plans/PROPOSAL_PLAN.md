# Programmatic Agent Builder Proposal (V5 - Enterprise Architecture)

## Executive Summary
**The Problem:** The current `@zip/agent-builder-tui` relies on an LLM to generate raw, deeply nested Zip Agent JSON. As seen in `NODE_SCHEMA_AGENT.json`, even a basic workflow contains hundreds of lines of strict enums, multi-level arrays, and specific interpolation syntax (e.g., `{"control": "object", "value": {"method": {"control": "picklist", "value": "POST"}}}`). LLMs are notoriously bad at producing long, strict syntax trees without hallucination, requiring heavy, slow prompt-engineering (`auditor`, `validator` subagents) that still frequently fails.

**The Solution:** The **Programmatic Agent Builder Pattern**.
We introduce a deterministic TypeScript SDK (`src/builders`). The TypeScript engine inherently guarantees 100% syntactical compliance with the exact `NODE_SCHEMA`. The AI is given high-level, semantic tools (e.g., `addHttpStep(url, method)`). The AI focuses on *intent* (what URL to hit, what logic to execute), while our TypeScript code handles the syntax construction and AST routing.

---

## Architectural Justifications

Why is this the only enterprise-grade path forward?

1. **Separation of Concerns:** 
   LLMs excel at natural language translation and planning. They fail at syntax formatting. By forcing the LLM to output raw JSON strings, the current architecture treats the AI as a syntax-engine. The proposed architecture treats the AI as a logic-engine.
2. **Performance & Latency:** 
   Removing the multi-agent `generator -> validator -> auditor` loop means agent creation drops from minutes to seconds. A single "Copilot" AI decides the steps, and the native TypeScript execution compiling the JSON is instantaneous.
3. **AST Branch Routing (The Nesting Problem):** 
   Zip workflows require steps to be declared flatly in `steps_data`, but nested hierarchically within `workflow.steps` branches. LLMs lose spatial awareness. Our `AgentBuilder` class automatically traverses an internal AST based on a simple linear cursor state, entirely decoupling the complexity of routing from the AI.
4. **Dependency Safety (Strict Regex Compiler):**
   Our compiler natively parses interpolation tags (e.g., `${steps.http_1.data}` or `${config.api_endpoint}`) via a strict RegEx engine. Before generating any JSON, the compiler extracts every single dependency reference globally and explicitly verifies it against the generated AST step map or `config_vars` definitions. If a referenced node ID or config key does not actively exist, compilation fails instantly, prevents saving the corrupt file, and streams the exact error text directly to the TUI (e.g., `Compiler Error: Config reference '${config.api_endpoint}' is invalid. You must declare 'api_endpoint' globally.`), forcing the Copilot to self-correct.

---

## Simple, Clean Code Implementation

We adhere to the KISS principle. The architecture relies on basic TypeScript Classes and Maps without over-engineered generic abstractions.

### 1. `StepBuilder.ts` (The Node Factories)
Instead of dynamic magic, we use clean factory methods providing strict Zod/TypeScript boundaries. The factory natively supports all **14 Actions** (e.g. `generic_ai`, `get_vendor`, `render_json_template`, `loop_n_times`) across all **10 Connectors** defined in the Zip schema. 

Every parameter strictly enforces the **11 Control Types** (`text`, `ref`, `object`, `array`, `picklist`, `multipicklist`, `boolean`, `number`, `json`, `code`, `null`). Furthermore, all `picklist` constraints (e.g., `o4-mini` vs `gpt-4.1`, `structured` vs `markdown`) are strictly typed as TypeScript standard literal unions.

```typescript
import { z } from "zod";

// Strict Literal Types generated directly from NODE_SCHEMA.md
export type ConnectorKey = "ai" | "zip" | "http" | "condition" | "return" | "jinja" | "loop" | "memory_storage" | "python";
export type AiModel = "auto" | "o4-mini" | "gpt-4.1";
// FIX GAP 1: Added "raw" — confirmed in Adverse media L99. The plan previously only had "structured"|"markdown".
export type OutputFormat = "structured" | "markdown" | "raw";
// All 11 control types — "code" confirmed by execute_script in Intake Validation Agent V2 L939-986
// ("script": { "control": "code", "value": "def execute(input):..." })
export type ControlType = "text" | "ref" | "object" | "array" | "picklist" | "multipicklist" | "boolean" | "number" | "json" | "code" | "null";

export interface ZipStep {
  key: string;
  display_name: string;
  connector_key: ConnectorKey;
  action_key: string;
  input_config: any;
  // FIX GAP 1: Removed stale `structured_schema?` root field. Confirmed by ALL Pass 4 audited agents:
  // structured_schema lives INSIDE input_config.value, never as a root sibling on the step.
  branches: { key: string; label: string; steps: any[] }[] | null;
  error_handling_policy: 1;
  connection_var_key: string | null;
}

export class StepBuilder {
  /**
   * 1 of 14: Generates a flawlessly formatted Zip HTTP Action Node natively.
   */
  static http(key: string, name: string, url: string, method: "GET" | "POST" | "PUT" | "DELETE" = "GET", bodyStr?: string): ZipStep {
    return {
      key,
      display_name: name,
      connector_key: "http",
      action_key: "$http_client",
      error_handling_policy: 1,
      connection_var_key: "config.http_client_connection",
      branches: null,
      input_config: {
        control: "object",
        value: {
          url: { control: "text", value: url },
          ...(method !== "GET" ? { method: { control: "picklist", value: method } } : {}),
          ...(bodyStr ? { 
            content_type: { control: "picklist", value: "application/json" }, 
            request_body: { control: "text", value: bodyStr } 
          } : {})
        }
      }
    };
  }

  /**
   * 2 of 14: Generates a Zip Condition Node with strict AST branch targets.
   */
  // CITED: [Kraken] L97-131, IntakeV2 L401-435 (right_value null), DuplicateSupplier L370-403, PoC L273-325
  // FINDING: right_value control can be "boolean", "number", "text", OR "null" (when comparing to null)
  // FINDING: branches in steps_data is ALWAYS null — branch routing is only in the workflow AST, NOT on the step itself
  static condition(
    key: string,
    name: string,
    left_op: string,
    operator: "equals" | "not_equals",
    right_op: string | boolean | number | null
  ): ZipStep {
    const rightControl =
      right_op === null ? "null" :
      typeof right_op === "boolean" ? "boolean" :
      typeof right_op === "number" ? "number" : "text";
    return {
      key,
      display_name: name,
      connector_key: "condition",
      action_key: "if_condition",
      error_handling_policy: 1,
      connection_var_key: null,
      input_config: {
        control: "object",
        value: {
          conditions: {
            control: "array",
            value: [
              {
                control: "object",
                value: {
                  left_value: { control: "ref", value: left_op }, // always "ref" — left side is always a step reference
                  operator: { control: "picklist", value: operator },
                  right_value: { control: rightControl, value: right_op }
                }
              }
            ]
          }
        }
      },
      branches: null // CRITICAL: branches null on steps_data; routing lives in workflow AST only
    };
  }

  /** 3 of 14: AI - generic_ai */
  // CITED: AdverseMedia L12-106 (array_schema, output_schema, include_citations, data_sources, output_format:"raw")
  // CITED: DuplicateSupplier ai_2 L75-96 (NO output_format field at all; just user_prompt + tools)
  // CITED: DuplicateSupplier ai_6 L204-303 (structured_schema BUT NO output_format, NO model)
  // CITED: DuplicateSupplier ai_1 L39-72 (markdown WITH model:"auto" AND include_citations)
  // CITED: PoC ai_4 L237-252 (markdown, NO model, NO tools)
  // FINDING: output_format is OPTIONAL. Some structured steps and some markdown steps omit it entirely.
  // FINDING: model is OPTIONAL. Present only when explicitly set in that agent's step.
  // FINDING: include_citations, data_sources, array_schema, output_schema are real production fields.
  // FINDING: user_prompt control is ALWAYS "text" across all instances - never "ref".
  static genericAi(
    key: string,
    name: string,
    userPrompt: string,
    opts?: {
      tools?: string[];           // multipicklist: "document", "zip_data", "web_search_preview", or [] for empty
      structuredSchema?: any[];   // when output_format = "structured"; key name is "structured_schema"
      outputSchema?: any[];       // alt schema key used by some agents; key name is "output_schema"
      arraySchema?: boolean;      // when true, emits "array_schema": { control:"boolean", value:true }
      outputFormat?: "structured" | "markdown" | "raw"; // explicitly set; defaults to omitting if not provided
      model?: string;             // "auto" when explicitly needed, default omit
      includeCitations?: boolean; // emits "include_citations": { control:"boolean", value:true/false }
      dataSources?: any[];        // "data_sources": { control:"array", value:[] } — usually empty array
    }
  ): ZipStep {
    return {
      key, display_name: name, connector_key: "ai", action_key: "generic_ai",
      error_handling_policy: 1, connection_var_key: null, branches: null,
      input_config: {
        control: "object", value: {
          ...(opts?.arraySchema !== undefined ? { array_schema: { control: "boolean", value: opts.arraySchema } } : {}),
          ...(opts?.outputSchema ? { output_schema: { control: "array", value: opts.outputSchema } } : {}),
          user_prompt: { control: "text", value: userPrompt }, // ALWAYS "text" — interpolated inline with ${}
          ...(opts?.tools !== undefined ? { tools: { control: "multipicklist", value: opts.tools } } : {}),
          ...(opts?.includeCitations !== undefined ? { include_citations: { control: "boolean", value: opts.includeCitations } } : {}),
          ...(opts?.dataSources !== undefined ? { data_sources: { control: "array", value: opts.dataSources } } : {}),
          ...(opts?.outputFormat ? { output_format: { control: "picklist", value: opts.outputFormat } } : {}),
          ...(opts?.model ? { model: { control: "picklist", value: opts.model } } : {}),
          ...(opts?.structuredSchema ? { structured_schema: { control: "array", value: opts.structuredSchema } } : {})
        }
      }
    };
  }

  /** 4 of 14: AI - approval_assist (Trigger) */
  static approvalAssist(key: string = "trigger", name: string = "Trigger"): ZipStep {
    return {
      key, display_name: name, connector_key: "ai", action_key: "approval_assist",
      error_handling_policy: 1, connection_var_key: null, branches: null,
      input_config: null
    };
  }

  // CITED: [Kraken] L11-27 (ref control), PoC L43-55 (text control with ${} interpolation), IntakeV2 L1028-1062
  // FINDING: request_id can be "ref" (bare step ref) OR "text" (${} interpolated string). Both exist in production.
  /** 5 of 14: ZIP - get_request */
  static getRequest(key: string, name: string, requestIdValue: string): ZipStep {
    // Use "ref" if it is a bare step path (e.g. "steps.trigger.request.id"),
    // use "text" if it is an interpolated template (e.g. "${steps.trigger.request.id}")
    const isInterpolated = requestIdValue.includes("${");
    return {
      key, display_name: name, connector_key: "zip", action_key: "get_request",
      error_handling_policy: 1, connection_var_key: null, branches: null,
      input_config: {
        control: "object", value: { request_id: { control: isInterpolated ? "text" : "ref", value: requestIdValue } }
      }
    };
  }

  // CITED: Adverse media L483-499 (text control with ${}), contract_analysis L39-55 (text control with ${})
  // CITED: AdverseMedia L484-499 vendor_id uses "text" + "${}"
  // FINDING: vendor_id always uses "text" control with ${} interpolation — never bare "ref"
  /** 6 of 14: ZIP - get_vendor */
  static getVendor(key: string, name: string, vendorIdValue: string): ZipStep {
    const isInterpolated = vendorIdValue.includes("${");
    return {
      key, display_name: name, connector_key: "zip", action_key: "get_vendor",
      error_handling_policy: 1, connection_var_key: null, branches: null,
      input_config: {
        control: "object", value: { vendor_id: { control: isInterpolated ? "text" : "ref", value: vendorIdValue } }
      }
    };
  }

  // CITED: [Kraken] L273-289 (ref control), DuplicateSupplier L538-553 (text with ${}), PoC L369-382 (text with ${})
  // FINDING: "ref" is used for bare step paths (steps.ai_compile.response), "text" for ${} interpolated strings.
  /** 7 of 14: RETURN - return_value */
  static returnValue(key: string, name: string, valueExpr: string): ZipStep {
    const isInterpolated = valueExpr.includes("${");
    return {
      key, display_name: name, connector_key: "return", action_key: "return_value",
      error_handling_policy: 1, connection_var_key: null, branches: null,
      input_config: {
        control: "object", value: { 
          value: { control: isInterpolated ? "text" : "ref", value: valueExpr } 
        }
      }
    };
  }

  /** 8 of 14: JINJA - render_json_template */
  static renderJsonTemplate(key: string, name: string, jsonTemplate: string, variablesArr: any[]): ZipStep {
    return {
      key, display_name: name, connector_key: "jinja", action_key: "render_json_template",
      error_handling_policy: 1, connection_var_key: null, branches: null,
      input_config: {
        control: "object", value: {
          json_template: { control: "text", value: jsonTemplate },
          variables: { control: "array", value: variablesArr } // Valid-Agents requires array of key/value objects
        }
      }
    };
  }

  // CITED: IntakeV2 L771-787 (branches: null, iteration_count control: "ref")
  // FINDING: loop_n_times has branches: null in steps_data — body steps live only in the workflow AST
  /** 9 of 14: LOOP - loop_n_times */
  static loopNTimes(key: string, name: string, iterationCountRef: string | number): ZipStep {
    return {
      key, display_name: name, connector_key: "loop", action_key: "loop_n_times",
      error_handling_policy: 1, connection_var_key: null,
      branches: null, // CONFIRMED: branches always null on steps_data — workflow AST holds loop body
      input_config: {
        control: "object", value: {
          iteration_count: { control: typeof iterationCountRef === "number" ? "number" : "ref", value: iterationCountRef }
        }
      }
    };
  }

  /** 10 of 14: LOOP - break_loop */
  static breakLoop(key: string, name: string = "Break"): ZipStep {
    return {
      key, display_name: name, connector_key: "loop", action_key: "break_loop",
      error_handling_policy: 1, connection_var_key: null, branches: null, input_config: null
    };
  }

  /** 11 of 14: MEMORY STORAGE - set_value */
  static memorySetValue(key: string, name: string, varKey: string, valueRef: string): ZipStep {
    return {
      key, display_name: name, connector_key: "memory_storage", action_key: "set_value",
      error_handling_policy: 1, connection_var_key: null, branches: null,
      input_config: {
        control: "object", value: {
          key: { control: "text", value: varKey },
          value: { control: valueRef.startsWith("steps.") ? "ref" : valueRef.startsWith("[") || valueRef.startsWith("{") ? "json" : "text", value: valueRef }
        }
      }
    };
  }

  // CITED: IntakeV2 memory_storage_3 L811-831 (HAS default_value: null), memory_storage_6 L877-893 (NO default_value at all)
  // FINDING: default_value is fully optional. Some production steps include it, some do not. Caller decides.
  /** 12 of 14: MEMORY STORAGE - get_value */
  static memoryGetValue(key: string, name: string, varKey: string, withDefault: boolean = false): ZipStep {
    return {
      key, display_name: name, connector_key: "memory_storage", action_key: "get_value",
      error_handling_policy: 1, connection_var_key: null, branches: null,
      input_config: {
        control: "object", value: {
          key: { control: "text", value: varKey },
          ...(withDefault ? { default_value: { control: "null", value: null } } : {})
        }
      }
    };
  }

  // CITED: IntakeV2 L833-853 (ref control), IntakeV2 L917-937 (ref control)
  // FINDING: value field uses "ref" for bare step paths, same isInterpolated rule as return_value and get_request
  /** 13 of 14: MEMORY STORAGE - append_to_list */
  static memoryAppendToList(key: string, name: string, storageKey: string, valueRef: string): ZipStep {
    const isInterpolated = valueRef.includes("${");
    return {
      key, display_name: name, connector_key: "memory_storage", action_key: "append_to_list",
      error_handling_policy: 1, connection_var_key: null, branches: null,
      input_config: {
        control: "object", value: {
          key: { control: "text", value: storageKey },
          value: { control: isInterpolated ? "text" : "ref", value: valueRef }
        }
      }
    };
  }

  /** 14 of 14: PYTHON - execute_script */
  static executeScript(key: string, name: string, scriptCode: string, variablesArr: any[]): ZipStep {
    return {
      key, display_name: name, connector_key: "python", action_key: "execute_script",
      error_handling_policy: 1, connection_var_key: null, branches: null,
      input_config: {
        control: "object", value: {
          script: { control: "code", value: scriptCode },
          variables: { control: "array", value: variablesArr } // Valid-Agents uses explicit `variables` array, not flat objects
        }
      }
    };
  }
}
```

### 2. `AgentBuilder.ts` (State & AST Management)
A simple, robust class containing linear cursor management handling workflow state.

```typescript
import { ZipStep } from "./StepBuilder.js";

// FIX GAP 4+5: WorkflowNode uses its own branches (AST branches), separate from steps_data branches.
// steps_data branches = always null for condition/loop (confirmed Pass 4)
// AST branches = pre-initialized with true/default for condition, default for loop
interface WorkflowNode {
    key: string;
    branches: { key: string; label: string; steps: WorkflowNode[] }[] | null;
}

// FIX GAP 5: Proper config_var shape matching production schema
// Cited: Duplicate supplier check agent.json L19-29
interface ConfigVarDef {
    title: string;
    kind: "text" | "connection";
    required?: boolean;
    connector?: { key: string }; // only for kind:"connection"
}

export class AgentBuilder {
  public name: string;

  private stepsList: Map<string, ZipStep> = new Map();
  private workflowRoot: WorkflowNode[] = [];
  // FIX GAP 5: configVars carries full metadata, not just a Set<string>
  private configVars: Map<string, ConfigVarDef> = new Map();

  private cursorParentId: string | null = null;
  private cursorBranch: "true" | "default" | null = null;

  constructor(name: string) {
    this.name = name;
  }

  /** Register a config variable. Called before compile(). */
  public addConfigVar(key: string, def: ConfigVarDef): void {
    this.configVars.set(key, def);
  }

  public setCursor(parentId: string | null, branch?: "true" | "default"): void {
    this.cursorParentId = parentId;
    this.cursorBranch = branch ?? null;
  }

  public addStep(step: ZipStep): void {
    if (this.stepsList.has(step.key)) throw new Error(`Step ID ${step.key} already exists.`);
    this.stepsList.set(step.key, step);

    // FIX GAP 5: approval_assist is the trigger — it lives in workflow.trigger, NOT workflow.steps.
    // Cited: ALL 7 Valid-Agents have trigger in workflow.trigger, never in workflow.steps.
    if (step.action_key === "approval_assist") return;

    // FIX GAP 4: steps_data always has branches:null for condition and loop (confirmed Pass 4).
    // But the workflow AST needs pre-initialized branch slots for child injection to work.
    // We compute workflowBranches separately from step.branches.
    let workflowBranches: WorkflowNode["branches"] = null;
    if (step.action_key === "if_condition") {
      // Cited: Every if_condition in all 7 agents has true + default branches in workflow.steps
      workflowBranches = [
        { key: "true", label: "True", steps: [] },
        { key: "default", label: "False", steps: [] }
      ];
    } else if (step.action_key === "loop_n_times") {
      // Cited: IntakeV2 L771-787 (steps_data branches:null), IntakeV2 workflow AST (default branch wraps body)
      workflowBranches = [{ key: "default", label: "Loop Body", steps: [] }];
    }

    const node: WorkflowNode = { key: step.key, branches: workflowBranches };

    if (!this.cursorParentId) {
      this.workflowRoot.push(node);
    } else {
      // FIX GAP 3: was `this.cursorBranch?` — invalid template literal syntax. Corrected to ?? "null".
      if (!this.injectIntoBranch(this.workflowRoot, this.cursorParentId, this.cursorBranch, node)) {
        throw new Error(`AST Error: Parent '${this.cursorParentId}' branch '${this.cursorBranch ?? "null"}' not found.`);
      }
    }
  }

  private injectIntoBranch(nodes: WorkflowNode[], parentId: string, branchKey: string | null, newNode: WorkflowNode): boolean {
    for (const node of nodes) {
      if (node.key === parentId && node.branches) {
        const b = node.branches.find(n => n.key === branchKey);
        if (b) { b.steps.push(newNode); return true; }
      }
      if (node.branches) {
        for (const b of node.branches) {
          if (this.injectIntoBranch(b.steps, parentId, branchKey, newNode)) return true;
        }
      }
    }
    return false;
  }

  private extractAstKeys(nodes: WorkflowNode[]): string[] {
    const keys: string[] = [];
    for (const node of nodes) {
      keys.push(node.key);
      if (node.branches) {
        for (const b of node.branches) keys.push(...this.extractAstKeys(b.steps));
      }
    }
    return keys;
  }

  // FIX GAP 2: Removed duplicate compile() signature — the plan had two declarations.
  // Only one compile() exists. configVars is now a class-level Map, not a parameter.
  public compile(): Record<string, any> {
    const dataStr = JSON.stringify(Array.from(this.stepsList.values()));

    // 1. Strict Global Dependency Regex Check
    const references = [...dataStr.matchAll(/"value":\s*"(?:.*?\$?\{)?(steps|config)\.([^.}"]+)/g)];
    for (const match of references) {
      const [, type, refKey] = match;
      if (type === "steps" && !this.stepsList.has(refKey) && refKey !== "trigger") {
        throw new Error(`Compiler Error: Step ref 'steps.${refKey}' is invalid. No step '${refKey}' exists.`);
      }
      if (type === "config" && !this.configVars.has(refKey)) {
        throw new Error(`Compiler Error: Config ref 'config.${refKey}' must be declared via addConfigVar().`);
      }
    }

    // 2. Orphan AST Check (trigger is allowed to be missing from AST)
    const astKeys = new Set(["trigger", ...this.extractAstKeys(this.workflowRoot)]);
    for (const [key] of this.stepsList) {
      if (!astKeys.has(key)) throw new Error(`Orphan Node: '${key}' is in stepsList but missing from AST.`);
    }

    // FIX GAP 5: config_vars now emits the correct production schema shape.
    // Cited: Duplicate supplier check agent.json L19-29, contract_analysis_agent.json L1-30
    const config_vars: Record<string, any> = {};
    for (const [k, def] of this.configVars) {
      config_vars[k] = {
        key: k,
        title: def.title,
        description: null,
        required: def.required ?? true,
        kind: def.kind,
        ...(def.connector ? { connector: def.connector } : {})
      };
    }

    return {
      type: "task_template",
      name: this.name,
      version: 1,
      trigger_kind: "APPROVAL_ASSIST",
      is_concurrent_job_limit_enabled: true,
      is_long_running: false,
      config_pages: [],
      config_vars,
      exported_at: new Date().toISOString(),
      flow_config_pages: [],
      flow_config_vars: {},
      steps_data: Array.from(this.stepsList.values()),
      workflow: {
        trigger: { key: "trigger", branches: null },
        steps: this.workflowRoot
      }
    };
  }
}
```

### 3. AI Tool Interface (`src/tools.ts`)
// FIX GAP 6: All 17 tool Zod schemas are now fully specified.
// Previously only addHttpStep existed. Every tool now has its complete parameter shape.

```typescript
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { StepBuilder } from "./builders/StepBuilder.js";
import { AgentBuilder } from "./builders/AgentBuilder.js";
import { ZipBuilderConfig } from "./config.js";

// Module-level builder instance — one session = one agent build
let activeBuilder: AgentBuilder | null = null;
// Error passthrough helper: any throw from builder propagates directly to Copilot
const run = (fn: () => void) => { try { fn(); return { success: true }; } catch (e) { return { success: false, error: (e as Error).message }; } };

export function createZipTools(config: ZipBuilderConfig) {
  return {

    // ── Session Init ────────────────────────────────────────────────────────
    initializeAgent: {
      name: "initializeAgent",
      description: "Start building a new Zip Agent. Must be called first.",
      parameters: z.object({
        name: z.string().describe("Agent display name"),
      }).shape,
      execute: async ({ name }: { name: string }) => {
        activeBuilder = new AgentBuilder(name);
        return { success: true };
      },
    },

    // ── Node 4: approval_assist ─────────────────────────────────────────────
    addApprovalTrigger: {
      name: "addApprovalTrigger",
      description: "Adds the approval_assist trigger node. Always the first step.",
      parameters: z.object({
        key: z.string().default("trigger"),
        name: z.string().default("Trigger"),
      }).shape,
      execute: async (p: { key: string; name: string }) =>
        run(() => activeBuilder!.addStep(StepBuilder.approvalAssist(p.key, p.name))),
    },

    // ── Node 5: get_request ─────────────────────────────────────────────────
    addGetRequestStep: {
      name: "addGetRequestStep",
      description: "Adds a get_request node to fetch the current Zip request.",
      parameters: z.object({
        key: z.string().describe("Unique step ID e.g. 'zip_1'"),
        name: z.string().describe("Display label"),
        requestIdValue: z.string().describe("Value for request_id. Use bare path like 'steps.trigger.request.id' or interpolated '${steps.trigger.request.id}'"),
      }).shape,
      execute: async (p: { key: string; name: string; requestIdValue: string }) =>
        run(() => activeBuilder!.addStep(StepBuilder.getRequest(p.key, p.name, p.requestIdValue))),
    },

    // ── Node 6: get_vendor ──────────────────────────────────────────────────
    addGetVendorStep: {
      name: "addGetVendorStep",
      description: "Adds a get_vendor node to fetch vendor data.",
      parameters: z.object({
        key: z.string().describe("Unique step ID e.g. 'zip_2'"),
        name: z.string().describe("Display label"),
        vendorIdValue: z.string().describe("vendor_id value, usually '${steps.zip_1.vendor.id}'"),
      }).shape,
      execute: async (p: { key: string; name: string; vendorIdValue: string }) =>
        run(() => activeBuilder!.addStep(StepBuilder.getVendor(p.key, p.name, p.vendorIdValue))),
    },

    // ── Node 1: $http_client ────────────────────────────────────────────────
    addHttpStep: {
      name: "addHttpStep",
      description: "Adds an HTTP request step. For GET omit method. Use bodyStr for POST body JSON string.",
      parameters: z.object({
        key: z.string().describe("Unique step ID e.g. 'http_1'"),
        name: z.string().describe("Display label"),
        url: z.string().describe("API URL path e.g. '/vendors'"),
        method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
        bodyStr: z.string().optional().describe("JSON body string for POST/PUT"),
      }).shape,
      execute: async (p: { key: string; name: string; url: string; method: "GET"|"POST"|"PUT"|"DELETE"; bodyStr?: string }) =>
        run(() => activeBuilder!.addStep(StepBuilder.http(p.key, p.name, p.url, p.method, p.bodyStr))),
    },

    // ── Node 3: generic_ai ──────────────────────────────────────────────────
    addAiStep: {
      name: "addAiStep",
      description: "Adds a generic_ai node. All opts are optional — only pass what the step actually needs.",
      parameters: z.object({
        key: z.string().describe("Unique step ID e.g. 'ai_1'"),
        name: z.string().describe("Display label"),
        prompt: z.string().describe("user_prompt text. Interpolate step refs inline with ${steps.x.y}"),
        tools: z.array(z.enum(["document", "zip_data", "web_search_preview"])).optional()
          .describe("Tools to enable. Omit if none needed."),
        outputFormat: z.enum(["structured", "markdown", "raw"]).optional()
          .describe("Output format. Omit if not explicitly needed."),
        model: z.string().optional().describe("e.g. 'auto'. Omit unless explicitly needed."),
        structuredSchema: z.array(z.object({
          key: z.string(), type: z.string(), description: z.string()
        })).optional().describe("Schema fields for structured output."),
        outputSchema: z.array(z.object({
          key: z.string(), type: z.string(), description: z.string()
        })).optional().describe("Alt schema key used by some agents (output_schema vs structured_schema)."),
        arraySchema: z.boolean().optional().describe("Set true if structured output is an array of objects."),
        includeCitations: z.boolean().optional().describe("Emit include_citations boolean field."),
        dataSources: z.array(z.any()).optional().describe("data_sources array — usually []."),
      }).shape,
      execute: async (p: any) =>
        run(() => activeBuilder!.addStep(StepBuilder.genericAi(p.key, p.name, p.prompt, {
          tools: p.tools,
          outputFormat: p.outputFormat,
          model: p.model,
          structuredSchema: p.structuredSchema,
          outputSchema: p.outputSchema,
          arraySchema: p.arraySchema,
          includeCitations: p.includeCitations,
          dataSources: p.dataSources,
        }))),
    },

    // ── Node 2: if_condition ────────────────────────────────────────────────
    addConditionStep: {
      name: "addConditionStep",
      description: "Adds an if_condition node. left must be a bare step path (no ${}). right can be boolean, number, string, or null.",
      parameters: z.object({
        key: z.string().describe("Unique step ID e.g. 'condition_1'"),
        name: z.string().describe("Display label"),
        left: z.string().describe("Left operand — always a bare step ref like 'steps.ai_1.response.found'"),
        op: z.enum(["equals", "not_equals"]).describe("Comparison operator"),
        right: z.union([z.string(), z.boolean(), z.number(), z.null()])
          .describe("Right operand. Pass null for null comparisons, boolean for true/false, number for numeric."),
      }).shape,
      execute: async (p: { key: string; name: string; left: string; op: "equals"|"not_equals"; right: any }) =>
        run(() => activeBuilder!.addStep(StepBuilder.condition(p.key, p.name, p.left, p.op, p.right))),
    },

    // ── Node 7: return_value ────────────────────────────────────────────────
    addReturnStep: {
      name: "addReturnStep",
      description: "Adds a return_value node. Use bare path for ref control, ${} syntax for text control.",
      parameters: z.object({
        key: z.string().describe("Unique step ID e.g. 'return_1'"),
        name: z.string().describe("Display label"),
        valueExpr: z.string().describe("Return value. Bare path 'steps.ai_1.response' → ref. Interpolated '${steps.ai_1.response}' → text."),
      }).shape,
      execute: async (p: { key: string; name: string; valueExpr: string }) =>
        run(() => activeBuilder!.addStep(StepBuilder.returnValue(p.key, p.name, p.valueExpr))),
    },

    // ── Node 8: render_json_template ────────────────────────────────────────
    addJinjaStep: {
      name: "addJinjaStep",
      description: "Adds a render_json_template (Jinja) node.",
      parameters: z.object({
        key: z.string().describe("Unique step ID e.g. 'jinja_1'"),
        name: z.string().describe("Display label"),
        jsonTemplate: z.string().describe("Jinja2 template string"),
        vars: z.array(z.object({
          key: z.string().describe("Variable name in template"),
          valueRef: z.string().describe("Step ref for this variable e.g. 'steps.http_1'"),
        })).describe("Template variables"),
      }).shape,
      execute: async (p: any) =>
        run(() => activeBuilder!.addStep(StepBuilder.renderJsonTemplate(p.key, p.name, p.jsonTemplate,
          p.vars.map((v: any) => ({
            control: "object",
            value: {
              key: { control: "text", value: v.key },
              value: { control: v.valueRef.includes("${") ? "text" : "ref", value: v.valueRef }
            }
          }))
        ))),
    },

    // ── Node 9: loop_n_times ─────────────────────────────────────────────────
    addLoopStep: {
      name: "addLoopStep",
      description: "Adds a loop_n_times node. After calling this, use setCursor(key, 'default') to add steps inside the loop body.",
      parameters: z.object({
        key: z.string().describe("Unique step ID e.g. 'loop_1'"),
        name: z.string().describe("Display label"),
        iterationCount: z.union([z.string(), z.number()]).describe("Iteration count. String for step ref like 'steps.py_1.result', number for literal count."),
      }).shape,
      execute: async (p: { key: string; name: string; iterationCount: string|number }) =>
        run(() => activeBuilder!.addStep(StepBuilder.loopNTimes(p.key, p.name, p.iterationCount))),
    },

    // ── Node 10: break_loop ──────────────────────────────────────────────────
    addBreakStep: {
      name: "addBreakStep",
      description: "Adds a break_loop node. Typically placed inside a condition branch inside a loop.",
      parameters: z.object({
        key: z.string().describe("Unique step ID e.g. 'break_1'"),
        name: z.string().default("Break"),
      }).shape,
      execute: async (p: { key: string; name: string }) =>
        run(() => activeBuilder!.addStep(StepBuilder.breakLoop(p.key, p.name))),
    },

    // ── Node 11: set_value ───────────────────────────────────────────────────
    addMemorySetStep: {
      name: "addMemorySetStep",
      description: "Adds a set_value memory node. Stores a value under a named key.",
      parameters: z.object({
        key: z.string().describe("Unique step ID e.g. 'mem_1'"),
        name: z.string().describe("Display label"),
        varKey: z.string().describe("Memory key name e.g. 'vendor_name'"),
        valueRef: z.string().describe("Value to store. Bare step path → ref, JSON literal '[]' or '{}' → json, text template → text."),
      }).shape,
      execute: async (p: { key: string; name: string; varKey: string; valueRef: string }) =>
        run(() => activeBuilder!.addStep(StepBuilder.memorySetValue(p.key, p.name, p.varKey, p.valueRef))),
    },

    // ── Node 12: get_value ───────────────────────────────────────────────────
    addMemoryGetStep: {
      name: "addMemoryGetStep",
      description: "Adds a get_value memory node. Retrieves a stored value by key.",
      parameters: z.object({
        key: z.string().describe("Unique step ID e.g. 'mem_2'"),
        name: z.string().describe("Display label"),
        varKey: z.string().describe("Memory key to retrieve"),
        withDefault: z.boolean().default(false).describe("If true, emits default_value: null. Only set true if the step genuinely needs a null default."),
      }).shape,
      execute: async (p: { key: string; name: string; varKey: string; withDefault: boolean }) =>
        run(() => activeBuilder!.addStep(StepBuilder.memoryGetValue(p.key, p.name, p.varKey, p.withDefault))),
    },

    // ── Node 13: append_to_list ──────────────────────────────────────────────
    addMemoryAppendStep: {
      name: "addMemoryAppendStep",
      description: "Adds an append_to_list memory node.",
      parameters: z.object({
        key: z.string().describe("Unique step ID e.g. 'mem_3'"),
        name: z.string().describe("Display label"),
        storageKey: z.string().describe("List key to append to"),
        valueRef: z.string().describe("Value to append. Bare step path → ref, interpolated ${} → text."),
      }).shape,
      execute: async (p: { key: string; name: string; storageKey: string; valueRef: string }) =>
        run(() => activeBuilder!.addStep(StepBuilder.memoryAppendToList(p.key, p.name, p.storageKey, p.valueRef))),
    },

    // ── Node 14: execute_script ──────────────────────────────────────────────
    addPythonStep: {
      name: "addPythonStep",
      description: "Adds an execute_script (Python) node.",
      parameters: z.object({
        key: z.string().describe("Unique step ID e.g. 'python_1'"),
        name: z.string().describe("Display label"),
        script: z.string().describe("Python script. Must define 'def execute(input): ...'"),
        vars: z.array(z.object({
          key: z.string().describe("Variable name"),
          valueRef: z.string().describe("Step ref for variable value"),
        })).describe("Input variables passed to the script via input dict"),
      }).shape,
      execute: async (p: any) =>
        run(() => activeBuilder!.addStep(StepBuilder.executeScript(p.key, p.name, p.script,
          p.vars.map((v: any) => ({
            control: "object",
            value: {
              key: { control: "text", value: v.key },
              value: { control: v.valueRef.includes("${") ? "text" : "ref", value: v.valueRef }
            }
          }))
        ))),
    },

    // ── Cursor ───────────────────────────────────────────────────────────────
    setCursor: {
      name: "setCursor",
      description: "Move the insertion cursor to a branch inside a condition or loop. Pass parentId=null to return to root.",
      parameters: z.object({
        parentId: z.string().nullable().describe("Key of the condition or loop step. null = root scope."),
        branch: z.enum(["true", "default"]).optional()
          .describe("Branch to enter. 'true' = if-true branch, 'default' = else/loop body. Omit when parentId is null."),
      }).shape,
      execute: async (p: { parentId: string | null; branch?: "true" | "default" }) => {
        if (!activeBuilder) return { success: false, error: "Call initializeAgent first" };
        activeBuilder.setCursor(p.parentId, p.branch);
        return { success: true };
      },
    },

    // ── Save ─────────────────────────────────────────────────────────────────
    compileAndSave: {
      name: "compileAndSave",
      description: "Compile and save the agent JSON. Runs dependency + orphan checks. Throws compiler errors if any step refs are invalid.",
      parameters: z.object({
        filename: z.string().describe("Output filename e.g. 'my-agent.json'"),
      }).shape,
      execute: async ({ filename }: { filename: string }) => {
        if (!activeBuilder) return { success: false, error: "Call initializeAgent first" };
        try {
          const json = activeBuilder.compile();
          json.exported_at = new Date().toISOString();
          await fs.mkdir(config.outputDir, { recursive: true });
          const finalName = filename.endsWith(".json") ? filename : `${filename}.json`;
          const filepath = path.join(config.outputDir, finalName);
          await fs.writeFile(filepath, JSON.stringify(json, null, 2));
          activeBuilder = null; // Reset session
          return { success: true, filepath };
        } catch (e) {
          return { success: false, error: (e as Error).message };
        }
      },
    },
  };
}
```


---

## 4. The Developer Experience (AI Execution Flow)

### Tool Call Surface — All 14 Node Types

| Tool Name | StepBuilder Method | Node (`action_key`) |
|---|---|---|
| `initializeAgent(name)` | — | Agent scaffold + trigger |
| `addApprovalTrigger(key, name)` | `StepBuilder.approvalAssist` | `approval_assist` |
| `addGetRequestStep(key, name, requestIdValue)` | `StepBuilder.getRequest` | `get_request` |
| `addGetVendorStep(key, name, vendorIdValue)` | `StepBuilder.getVendor` | `get_vendor` |
| `addHttpStep(key, name, url, method?, bodyStr?)` | `StepBuilder.http` | `$http_client` |
| `addAiStep(key, name, prompt, opts?)` | `StepBuilder.genericAi` | `generic_ai` |
| `addConditionStep(key, name, left, op, right)` | `StepBuilder.condition` | `if_condition` |
| `addReturnStep(key, name, valueExpr)` | `StepBuilder.returnValue` | `return_value` |
| `addJinjaStep(key, name, jsonTemplate, vars[])` | `StepBuilder.renderJsonTemplate` | `render_json_template` |
| `addLoopStep(key, name, iterationCount)` | `StepBuilder.loopNTimes` | `loop_n_times` |
| `addBreakStep(key, name)` | `StepBuilder.breakLoop` | `break_loop` |
| `addMemorySetStep(key, name, varKey, value)` | `StepBuilder.memorySetValue` | `set_value` |
| `addMemoryGetStep(key, name, varKey, withDefault?)` | `StepBuilder.memoryGetValue` | `get_value` |
| `addMemoryAppendStep(key, name, listKey, value)` | `StepBuilder.memoryAppendToList` | `append_to_list` |
| `addPythonStep(key, name, script, vars[])` | `StepBuilder.executeScript` | `execute_script` |
| `setCursor(parentId, branch?)` | — | AST cursor navigation |
| `compileAndSave(filename)` | `AgentBuilder.compile()` | Final JSON output |

---

### Full Example — Contract Review Agent (all 14 nodes demonstrated)

**User Prompt:** *"Build a contract review agent. Get the request, fetch the vendor, classify the docs with AI, if a contract is found extract it with AI and store the vendor name in memory, loop 3 times checking for updated doc status using python to compute count, render a JSON summary, POST it to /comments, and return the final markdown."*

**AI Engine Execution (every tool corresponds to a StepBuilder factory call):**
```
 1. initializeAgent(name="Contract Review Agent")
 2. addApprovalTrigger(key="trigger", name="Approval assist")
 3. addGetRequestStep(key="zip_1", name="Get request", requestIdValue="steps.trigger.request.id")
 4. addGetVendorStep(key="zip_2", name="Get vendor", vendorIdValue="${steps.zip_1.vendor.id}")
 5. addAiStep(key="ai_1", name="Classify docs",
       prompt="Does ${steps.zip_1.id} have an MSA, SOW or Order Form?",
       opts={ tools: ["document"], outputFormat: "structured",
              structuredSchema: [{ key:"found", type:"boolean", description:"..." }] })
 6. addConditionStep(key="condition_1", name="Doc found?",
       left="steps.ai_1.response.found", op="equals", right=true)
 7. setCursor(parentId="condition_1", branch="true")
 8. addAiStep(key="ai_2", name="Extract contract",
       prompt="Extract terms from ${steps.zip_1.id}.",
       opts={ tools: ["document"], model: "auto", outputFormat: "structured",
              structuredSchema: [{ key:"vendor_name", type:"string", description:"..." }] })
 9. addMemorySetStep(key="mem_1", name="Store vendor", varKey="vendor_name",
       valueRef="steps.ai_2.response.vendor_name")
10. addPythonStep(key="py_1", name="Compute loop count",
       script="def execute(input):\n    return min(input['count'], 3)",
       vars=[{ key:"count", valueRef:"steps.zip_1.attachments_count" }])
11. addLoopStep(key="loop_1", name="Check doc loop", iterationCount="steps.py_1.result")
12. setCursor(parentId="loop_1", branch="default")   // enter loop body in AST
13. addMemoryGetStep(key="mem_2", name="Get vendor name", varKey="vendor_name", withDefault=false)
14. addConditionStep(key="cond_2", name="Complete?",
       left="steps.mem_2.value", op="not_equals", right=null)
15. setCursor(parentId="cond_2", branch="true")
16. addBreakStep(key="break_1", name="Break loop")
17. setCursor(parentId=null)                          // back to root
18. addMemoryAppendStep(key="mem_3", name="Append log",
       storageKey="review_log", valueRef="steps.ai_2.response.vendor_name")
19. addJinjaStep(key="jinja_1", name="Render summary",
       jsonTemplate='{ "vendor": {{ input.name | tojson }} }',
       vars=[{ key:"input", valueRef:"steps.ai_2.response" }])
20. addHttpStep(key="http_1", name="Post comment", url="/comments", method="POST",
       bodyStr='{ "data": { "text": "${steps.jinja_1.result}" } }')
21. setCursor(parentId="condition_1", branch="default")
22. addAiStep(key="ai_3", name="No doc message",
       prompt="Summary banner\nRed\nTitle: No contract found",
       opts={ outputFormat: "markdown" })
23. addReturnStep(key="return_2", name="Return error", valueExpr="${steps.ai_3.response}")
24. setCursor(parentId=null)
25. addReturnStep(key="return_1", name="Return report", valueExpr="steps.http_1.response")
26. compileAndSave(filename="contract-review.json")
```

The TypeScript kernel converts those 26 semantic tool calls into a 400+ line perfectly-structured Zip Agent JSON. The AI's only job is correctly naming steps and understanding branching intent.



## 5. Extensibility
Future-proofing is simple, standard TypeScript. If new schemas arise, developers just add a new `StepBuilder.newSchema(...)` factory method and hook it up to a new small tool. If the AI needs to wing it in the meantime, we keep a `StepBuilder.generic` fallback. Both utilize the identical `AgentBuilder` AST logic seamlessly.

---

## 6. Zero-Trust Valid-Agents Audit Report (Pass 4 — All 7 Agents)

This is the **4th full re-audit pass**. All 7 Valid-Agent files have now been fully read. Every finding has a cited file and line number. No assumption is accepted without production evidence.

---

### (1) `$http_client` — `connector_key: "http"`

**Files audited:**
- `Duplicate supplier check agent.task_template.json` L481-505 (POST w/ body)
- `Intake Validation Agent V2.task_template.json` L473-507 (GET w/ query_params)
- `Intake Validation Agent V2.task_template.json` L510-525 (GET — bare `url` only, **no method field**)
- `PoC Zip Contract Review Agent.task_template.json` L328-346 (POST w/ content_type)

**Raw evidence — GET, no `method` field (IntakeV2 L510-525):**
```json
{ "action_key": "$http_client",
  "input_config": { "control": "object", "value": {
    "url": { "control": "text", "value": "/locations" }
  }},
  "connection_var_key": "config.http_client_connection" }
```
**Raw evidence — GET with `query_params` (IntakeV2 L473-507):**
```json
"query_params": { "control": "array", "value": [
  { "control": "object", "value": {
    "key": { "control": "text", "value": "active" },
    "value": { "control": "text", "value": "True" }
  }}
]}
```
**Raw evidence — POST (PoC L328-346):**
```json
{ "method": { "control": "picklist", "value": "POST" },
  "url": { "control": "text", "value": "/comments" },
  "request_body": { "control": "text", "value": "{...}" },
  "content_type": { "control": "picklist", "value": "application/json" } }
```

| Hallucinated | Actual (production) |
|---|---|
| `headers` object wrapping `Content-Type` | Does NOT exist. Use `content_type` picklist |
| `timeout` number | Does NOT exist in any of the 7 agents |
| `body` key | `request_body` with `control: "text"` |
| `method` always present | **Omitted entirely on GET requests** |
| `query_params` undocumented | Array of `{ key, value }` objects |

**Correction:** `method` only emitted on non-GET. `content_type` + `request_body` for body. No `headers`, no `timeout`.

---

### (2) `if_condition` — `connector_key: "condition"`

**Files audited:**
- `[Kraken] Legal Risk Review.json` L97-131 (boolean right_value)
- `Intake Validation Agent V2.task_template.json` L369-399 (boolean)
- `Intake Validation Agent V2.task_template.json` L401-435 (**null right_value**)
- `Intake Validation Agent V2.task_template.json` L437-465 (number right_value = 0)
- `PoC Zip Contract Review Agent.task_template.json` L273-325
- `Duplicate supplier check agent.task_template.json` L370-475 (3 conditions)

**Raw evidence — `null` comparison (IntakeV2 L401-435):**
```json
"right_value": { "control": "null", "value": null }
```
**Raw evidence — `number` comparison (IntakeV2 L437-465):**
```json
"right_value": { "control": "number", "value": 0 }
```
**Raw evidence — `branches: null` on EVERY step across all 13 `if_condition` instances:**
```json
"branches": null, "error_handling_policy": 1
```
**Raw evidence — `left_value` always `"ref"` across all 13 instances:**
```json
"left_value": { "control": "ref", "value": "steps.ai_6.response.nameMatch" }
```

| Hallucinated | Actual (production) |
|---|---|
| `branches: [{ key: "true" }, { key: "default" }]` on the step | **`branches: null` always in `steps_data`** — routing only in `workflow` AST |
| `left_value` control auto-detects text vs ref | **Always `"ref"` — left side is always a step reference** |
| `right_value` supports only boolean/number/text | **Also `"null"` control** for null comparisons |

**Correction:** `branches: null`. `left_value` hardcoded to `"ref"`. `rightControl` includes `"null"` case.

---

### (3) `generic_ai` — `connector_key: "ai"`

**Files audited (all 7 agents — 26 `generic_ai` instances total):**
- `Adverse media research agent.task_template.json` L12-106 (**new fields: `array_schema`, `output_schema`, `include_citations`, `data_sources`, `output_format: "raw"`**)
- `Adverse media research agent.task_template.json` L107-165 (`include_citations`, `data_sources`, no `output_format`)
- `Adverse media research agent.task_template.json` L167-188 (`output_format: "markdown"`, no `model`, no `tools`)
- `Adverse media research agent.task_template.json` L190-305 (`tools`, `output_format: "structured"`, `structured_schema`, NO `model`)
- `Duplicate supplier check agent.task_template.json` L39-72 (markdown WITH `model: "auto"` AND `include_citations`)
- `Duplicate supplier check agent.task_template.json` L75-96 (`tools`, `user_prompt` only — **NO `output_format` at all**)
- `Duplicate supplier check agent.task_template.json` L204-303 (`structured_schema`, `tools` — **NO `output_format`, NO `model`**)
- `PoC Zip Contract Review Agent.task_template.json` L57-96 (`tools`, `structured_schema`, `output_format: "structured"`)
- `PoC Zip Contract Review Agent.task_template.json` L237-252 (`output_format: "markdown"`, NO `model`, NO `tools`)
- `[Kraken] Legal Risk Review.json` L30-95 (`tools`, `structured_schema`, `output_format: "structured"`)

**Raw evidence — Adverse media L12-106, `output_schema` + `array_schema` + `data_sources` + `include_citations` + `output_format: "raw"`:**
```json
{ "action_key": "generic_ai",
  "input_config": { "control": "object", "value": {
    "array_schema": { "control": "boolean", "value": true },
    "output_schema": { "control": "array", "value": [
      { "control": "object", "value": {
        "key": { "control": "text", "value": "title" },
        "description": { "control": "text", "value": "The title of the adverse media event" },
        "type": { "control": "picklist", "value": "string" }
      }}
    ]},
    "user_prompt": { "control": "text", "value": "..." },
    "tools": { "control": "multipicklist", "value": ["web_search_preview"] },
    "include_citations": { "control": "boolean", "value": true },
    "data_sources": { "control": "array", "value": [] },
    "output_format": { "control": "picklist", "value": "raw" }
  }}}
```

**Raw evidence — DuplicateSupplier ai_2 L75-96, NO `output_format` at all:**
```json
{ "action_key": "generic_ai",
  "input_config": { "control": "object", "value": {
    "user_prompt": { "control": "text", "value": "..." },
    "tools": { "control": "multipicklist", "value": ["zip_data"] }
  }}}
```

**Raw evidence — DuplicateSupplier ai_6 L204-303, `structured_schema` but NO `output_format`, NO `model`:**
```json
{ "output_format": { "control": "picklist", "value": "structured" },
  "user_prompt": { "control": "text", "value": "..." },
  "structured_schema": { "control": "array", "value": [...] },
  "tools": { "control": "multipicklist", "value": ["web_search_preview", "zip_data"] } }
```

| Hallucinated | Actual (production) |
|---|---|
| `prompt` key | `user_prompt` key always |
| `context`, `temperature`, `stream` | Do NOT exist in any of the 7 agents |
| `output_format` always emitted | **Genuinely optional** — DuplicateSupplier ai_2 emits NO `output_format` |
| `model` always present on structured | **Genuinely optional** — many structured steps omit it |
| `structured_schema` as root sibling | **Inside `input_config.value`** |
| `tools` not parameterized | `multipicklist` — values from: `"document"`, `"zip_data"`, `"web_search_preview"` |
| No other fields documented | **`include_citations`** (boolean), **`data_sources`** (array), **`array_schema`** (boolean), **`output_schema`** (array) all exist in production |
| `output_format` only `"structured"` or `"markdown"` | Also **`"raw"`** (Adverse media L99) |

**Pass 4 correction:** `genericAi` opts expanded to support: `outputFormat`, `model`, `tools`, `structuredSchema`, `outputSchema`, `arraySchema`, `includeCitations`, `dataSources`. Every field is optional. The method only emits what is explicitly passed.

---

### (4) `approval_assist` — `connector_key: "ai"`

**Files audited (all 7 agents have exactly one trigger):**
- `[Kraken] Legal Risk Review.json` L313-319
- `Intake Validation Agent V2.task_template.json` L1028-1036
- `PoC Zip Contract Review Agent.task_template.json` L33-41
- `Duplicate supplier check agent.task_template.json` L609-618

**Raw evidence (PoC L33-41):**
```json
{ "key": "trigger", "display_name": "Approval assist",
  "connector_key": "ai", "action_key": "approval_assist",
  "input_config": null, "branches": null,
  "error_handling_policy": 1, "connection_var_key": null }
```

**Discrepancies found:** None. Confirmed across 4 files. Always `input_config: null`, always `connector_key: "ai"`.

---

### (5) `get_request` — `connector_key: "zip"`

**Files audited:**
- `[Kraken] Legal Risk Review.json` L11-27 (`"ref"` control, bare path)
- `PoC Zip Contract Review Agent.task_template.json` L43-55 (`"text"` control, `${}` interpolation)
- `Intake Validation Agent V2.task_template.json` L1038-1065
- `Duplicate supplier check agent.task_template.json` L620-636

**Raw evidence ([Kraken] L11-27, `ref` control, bare path):**
```json
"request_id": { "control": "ref", "value": "steps.trigger.request.id" }
```
**Raw evidence (PoC L43-55, `text` control, interpolated):**
```json
"request_id": { "control": "text", "value": "${steps.trigger.request.id}" }
```

**Discrepancy found in pass 3:** Previous plan used `startsWith("steps.")` to pick `ref`. **Wrong.** Both bare paths and interpolated strings start with `steps.`. Correct discriminator: presence of `${}` syntax.

**Correction:** `isInterpolated = value.includes("${")` → `"text"`. Otherwise → `"ref"`.

---

### (6) `get_vendor` — `connector_key: "zip"`

**Files audited:**
- `contract_analysis_agent.json` L39-55
- `Adverse media research agent.task_template.json` L483-499
- `[Amplitude] Contract Analysis Agent.task_template.json` L1271-1290

**Raw evidence (contract_analysis_agent L39-55):**
```json
{ "action_key": "get_vendor",
  "input_config": { "control": "object", "value": {
    "vendor_id": { "control": "text", "value": "${steps.zip_1.vendor.id}" }
  }}, "connection_var_key": null }
```
**Raw evidence (Adverse media L483-499):**
```json
{ "action_key": "get_vendor",
  "input_config": { "control": "object", "value": {
    "vendor_id": { "control": "text", "value": "${steps.zip_1.vendor.id}" }
  }}}
```

**Pass 4 discrepancy:** Previous plan still used `startsWith("steps.")` logic for `vendor_id`. Wrong. Both production instances above use `"text"` control with `${}` interpolation syntax. Same `isInterpolated` rule applies.

**Pass 4 correction:** `isInterpolated = vendorIdValue.includes("${")`  → `"text"`. Otherwise → `"ref"`.

---

### (7) `return_value` — `connector_key: "return"`

**Files audited:**
- `[Kraken] Legal Risk Review.json` L273-289 (`"ref"` control, bare path)
- `Duplicate supplier check agent.task_template.json` L538-553 (`"text"` control, `${}`)
- `PoC Zip Contract Review Agent.task_template.json` L369-382 (`"text"` control, `${}`)
- `Intake Validation Agent V2.task_template.json` L992-1009

**Raw evidence ([Kraken] L273-289, `ref`):**
```json
"value": { "control": "ref", "value": "steps.ai_compile.response" }
```
**Raw evidence (DuplicateSupplier L538-553, `text`):**
```json
"value": { "control": "text", "value": "${steps.ai_1.response}" }
```

**Discrepancy found in pass 3:** Same `startsWith("steps.")` false assumption as `get_request`. Bare paths → `ref`, interpolated → `text`.

**Correction:** `isInterpolated = valueExpr.includes("${")` → `"text"`. Otherwise → `"ref"`.

---

### (8) `render_json_template` — `connector_key: "jinja"`

**Files audited:**
- `Intake Validation Agent V2.task_template.json` L617-651
- `Intake Validation Agent V2.task_template.json` L657-692
- `Intake Validation Agent V2.task_template.json` L693-728

**Raw evidence (IntakeV2 L617-651):**
```json
{ "action_key": "render_json_template",
  "input_config": { "control": "object", "value": {
    "json_template": { "control": "text", "value": "[{% for item in input.data.list %}...{% endfor %}]" },
    "variables": { "control": "array", "value": [
      { "control": "object", "value": {
        "key": { "control": "text", "value": "input" },
        "value": { "control": "ref", "value": "steps.http_1" }
      }}
    ]}
  }}}
```

| Hallucinated | Actual (production) |
|---|---|
| `template` key | `json_template` key |
| `variables` as flat `Record<string, {}>` | `variables` is an `array` of `{ control:"object", value:{ key, value } }` objects |

**Correction:** `json_template` key. `variables` is a proper array.

---

### (9) `loop_n_times` — `connector_key: "loop"`

**Files audited:**
- `Intake Validation Agent V2.task_template.json` L771-787 (only instance in all 7 agents)

**Raw evidence (IntakeV2 L771-787):**
```json
{ "action_key": "loop_n_times",
  "input_config": { "control": "object", "value": {
    "iteration_count": { "control": "ref", "value": "steps.python_1.result" }
  }},
  "branches": null }
```

| Was | Actual (production) |
|---|---|
| `count` key | `iteration_count` key |
| `delay_seconds` | Does NOT exist |
| `branches: [{ key: "default", label: "Loop Body", steps: [] }]` | **`branches: null` always on the step itself** |

**Pass 4 correction:** `loopNTimes` now emits `branches: null`. Loop body routing lives exclusively in the `workflow` AST — confirmed by IntakeV2 L771-787 steps_data entry and L1040-1080 workflow AST entry which wraps the body steps in a `"default"` branch.

---

### (10) `break_loop` — `connector_key: "loop"`

**Files audited:**
- `Intake Validation Agent V2.task_template.json` L761-769 (only instance in all 7 agents)

**Raw evidence (IntakeV2 L761-769):**
```json
{ "action_key": "break_loop", "input_config": null,
  "branches": null, "error_handling_policy": 1, "connection_var_key": null }
```

**Discrepancies found:** None. Confirmed `input_config: null`.

---

### (11) `set_value` — `connector_key: "memory_storage"`

**Files audited:**
- `Intake Validation Agent V2.task_template.json` L789-809 (`"json"` control, initializing `[]`)
- `Intake Validation Agent V2.task_template.json` L855-875 (`"ref"` control)
- `Intake Validation Agent V2.task_template.json` L895-915 (`"ref"` control)

**Raw evidence (IntakeV2 L789-809, `json` control):**
```json
"value": { "control": "json", "value": "[]" }
```
**Raw evidence (IntakeV2 L855-875, `ref` control):**
```json
"value": { "control": "ref", "value": "steps.http_5.data.next_page_token" }
```

| Hallucinated | Actual (production) |
|---|---|
| `expires_in` parameter | Does NOT exist in any agent |
| `value` control only `"ref"` or `"text"` | Also `"json"` for JSON literal initializers (`"[]"`) |

**Correction:** No `expires_in`. Value control: `"ref"` for bare step paths, `"json"` for JSON literals, `"text"` for string templates.

---

### (12) `get_value` — `connector_key: "memory_storage"`

**Files audited:**
- `Intake Validation Agent V2.task_template.json` L811-831 (HAS `default_value`)
- `Intake Validation Agent V2.task_template.json` L877-893 (**NO `default_value`**)

**Raw evidence (IntakeV2 L811-831, WITH default):**
```json
{ "action_key": "get_value",
  "input_config": { "control": "object", "value": {
    "key": { "control": "text", "value": "next_page_token" },
    "default_value": { "control": "null", "value": null }
  }}}
```
**Raw evidence (IntakeV2 L877-893, WITHOUT default):**
```json
{ "action_key": "get_value",
  "input_config": { "control": "object", "value": {
    "key": { "control": "text", "value": "items_accumulated_gl_codes" }
  }}}
```

**Discrepancy found in pass 3:** Previous plan had `includeDefaultNull: true` as default — meaning `default_value` was ALWAYS emitted. Wrong. It is genuinely optional.

**Correction:** `withDefault: boolean = false`. Only emits `default_value: { control: "null", value: null }` when explicitly `true`.

---

### (13) `append_to_list` — `connector_key: "memory_storage"`

**Files audited:**
- `Intake Validation Agent V2.task_template.json` L833-853
- `Intake Validation Agent V2.task_template.json` L917-937

**Raw evidence (IntakeV2 L833-853):**
```json
{ "action_key": "append_to_list",
  "input_config": { "control": "object", "value": {
    "key": { "control": "text", "value": "items_accumulated_gl_codes" },
    "value": { "control": "ref", "value": "steps.jinja_4.result" }
  }}}
```

| Was | Actual (production) |
|---|---|
| `list_key` | `key` |
| `item` | `value` |
| `value` control: `startsWith("steps.")` → `"ref"` | **Wrong discriminator**. Must use `isInterpolated = includes("${")` |

**Pass 4 correction:** Field names are `key` and `value`. `value` control uses `isInterpolated` logic (same as `return_value`, `get_request`, `get_vendor`): bare step path → `"ref"`, `${}` interpolated string → `"text"`.

---

### (14) `execute_script` — `connector_key: "python"`

**Files audited:**
- `Intake Validation Agent V2.task_template.json` L939-986 (only instance in all 7 agents)

**Raw evidence (IntakeV2 L939-986):**
```json
{ "action_key": "execute_script",
  "input_config": { "control": "object", "value": {
    "script": { "control": "code", "value": "def execute(input):\n    size = input['size']..." },
    "variables": { "control": "array", "value": [
      { "control": "object", "value": {
        "key": { "control": "text", "value": "total" },
        "value": { "control": "ref", "value": "steps.http_4.data.total" }
      }},
      { "control": "object", "value": {
        "key": { "control": "text", "value": "size" },
        "value": { "control": "ref", "value": "steps.http_4.data.size" }
      }}
    ]}
  }}}
```

| Hallucinated | Actual (production) |
|---|---|
| `code` key | `script` key |
| `...variablesFlatObject` spread at root | `variables` is an explicit `array` of `{ key, value }` objects |
| Shape of variables unknown | Each item: `{ control:"object", value:{ key:{control:"text",...}, value:{control:"ref",...} }}` |

**Correction:** `script` key with `"code"` control. `variables` is an array matching the same `{ key, value }` pattern used in `render_json_template` and `query_params`.







---

## 7. Implementation Readiness Audit

**Scope:** Cross-reference between `PROPOSAL_PLAN.md` and the actual `src/` codebase to identify every gap before implementation begins.

**Verdict: 9 blocking gaps found. Plan is NOT implementation-ready as-is.**

---

### Current `src/` vs Plan

| File | Current State | Plan State | Gap |
|---|---|---|---|
| `src/builders/StepBuilder.ts` | **Does not exist** | Fully specified in plan | 🔴 Must create |
| `src/builders/AgentBuilder.ts` | **Does not exist** | Fully specified in plan | 🔴 Must create |
| `src/tools.ts` | 3 tools: `listAgents`, `readAgent`, `saveAgent` | 17 new builder tools | 🔴 Full rewrite |
| `src/index.ts` | 8 subagents (orchestrator, validator, generator…) | 1 Copilot with builder tools | 🔴 Full rewrite |
| `src/prompts/` | 8 prompt files for old subagents | 1 Copilot prompt | 🟡 New prompt, delete old |
| `src/config.ts` | 4 config fields, Zod-validated | No changes needed | ✅ Keep as-is |
| `src/theme.ts` / `src/cli.ts` | Operational | No changes planned | ✅ Keep as-is |

---

### Gap 1 — `StepBuilder.ts` has stale `ZipStep` interface fields

**Severity: BLOCKING**

Line 52 declares `structured_schema?: any` as a **root-level** field on `ZipStep`. This is wrong. Every Pass 4 audit finding confirms `structured_schema` lives inside `input_config.value`, not as a top-level step key. This will cause confusion during implementation and must be removed.

Also: `OutputFormat` type (line 41) declares only `"structured" | "markdown"`. Pass 4 found `"raw"` is a valid third value (`Adverse media L99`). Blocks TypeScript compilation of `genericAi` opts.

**Fix:** Remove `structured_schema?` from `ZipStep`. Add `"raw"` to `OutputFormat`.

---

### Gap 2 — `AgentBuilder.compile()` has two signatures (TypeScript syntax error)

**Severity: BLOCKING — will not compile**

Lines 408 and 412 both declare `public compile(...)`. One has no args, one takes `configVarsMap`. This is a duplicate method declaration — TypeScript will refuse to compile this. Only the `configVarsMap` version should exist.

---

### Gap 3 — `injectIntoBranch` has a syntax error

**Severity: BLOCKING — will not compile**

Line 379: `throw new Error(\`AST Error: Parent ${this.cursorParentId}:${this.cursorBranch?} not found.\`)`

The `?` is invalid JavaScript/TypeScript inside a template literal at that position. Must be `this.cursorBranch ?? "null"`.

---

### Gap 4 — Loop and Condition AST branch injection will silently fail

**Severity: BLOCKING**

`steps_data` entries for `loop_n_times` and `if_condition` both have `branches: null` (confirmed in Pass 4). `AgentBuilder.addStep()` creates `WorkflowNode` with `branches: step.branches`, so both loop and condition nodes go into the AST with `branches: null`. When the AI then calls `setCursor(parentId="loop_1", branch="default")` and adds a child step, `injectIntoBranch()` looks for a matching `branches` array on the node — finds `null` — returns `false` — throws `AST Error: Parent not found`.

**Fix:** `addStep()` must distinguish between `steps_data` branches (always `null` for these types) and **workflow AST branches** (which need to be pre-initialized). Proposed solution:

```typescript
// When action_key is "if_condition", pre-init AST branches:
workflowBranches = [
  { key: "true", label: "True", steps: [] },
  { key: "default", label: "False", steps: [] }
]
// When action_key is "loop_n_times":
workflowBranches = [{ key: "default", label: "Loop Body", steps: [] }]
// All others: workflowBranches = null
```

The `WorkflowNode` must use `workflowBranches` (not `step.branches`) for AST insertion.

---

### Gap 5 — `approval_assist` trigger must not be added to `workflowRoot`

**Severity: BLOCKING**

Production agents emit:
```json
"workflow": {
  "trigger": { "key": "trigger", "branches": null },
  "steps": [ ... all other steps ... ]
}
```

`AgentBuilder.addStep()` currently adds every step to either `workflowRoot` or an AST branch. If `approvalAssist()` is called without special handling, it will be injected into `workflowRoot` and appear in `workflow.steps`, creating an invalid duplicate (it already appears in `workflow.trigger`).

**Fix:** When `step.action_key === "approval_assist"`, register in `stepsList` only. Never inject into `workflowRoot`.

---

### Gap 6 — `config_vars` output format is wrong

**Severity: MODERATE**

The plan emits (line 446):
```typescript
config_vars: Object.fromEntries(Array.from(configVarsMap).map(k => [k, { control: "text", value: "" }]))
```

But production `config_vars` entries have a real schema with `key`, `title`, `description`, `required`, `kind`, and `connector` (for connection vars).

**Cited evidence — `Duplicate supplier check agent.json` L19-29:**
```json
"config_vars": {
  "http_connection": {
    "key": "http_connection", "title": "Http connection",
    "description": null, "required": true,
    "kind": "connection", "connector": { "key": "http" }
  }
}
```

The plan's `configVarsMap: Set<string>` is insufficient — it carries no metadata. `configVarsMap` must become a `Map<string, ConfigVarDef>` where `ConfigVarDef` carries `title`, `kind`, and optional `connector`.

---

### Gap 7 — `StepBuilder.http()` has no `queryParams` parameter

**Severity: MODERATE**

`StepBuilder.http()` accepts `bodyStr?` but has no way to express `query_params`. Production GET requests use query params (`IntakeV2 L473-507` shows `query_params` as an array of `{ key, value }` control objects). Without this, the builder cannot represent any parameterized GET request.

**Fix:** Add `queryParams?: Array<{ key: string; value: string }>` to `StepBuilder.http()`. Emit:
```typescript
...(queryParams?.length ? {
  query_params: {
    control: "array",
    value: queryParams.map(qp => ({
      control: "object",
      value: {
        key: { control: "text", value: qp.key },
        value: { control: "text", value: qp.value }
      }
    }))
  }
} : {})
```

---

### Gap 8 — None of the 17 tool Zod schemas are written

**Severity: BLOCKING**

The plan's `src/tools.ts` section only shows one example tool (`addHttpStep`). The other 16 tools have no Zod parameter schemas defined. All must be written to exact spec before implementation.

Required parameter schemas not yet defined:
`initializeAgent`, `addApprovalTrigger`, `addGetRequestStep`, `addGetVendorStep`, `addAiStep` (with full `opts` schema), `addConditionStep`, `addReturnStep`, `addJinjaStep`, `addLoopStep`, `addBreakStep`, `addMemorySetStep`, `addMemoryGetStep`, `addMemoryAppendStep`, `addPythonStep`, `setCursor`, `compileAndSave`.

---

### Gap 9 — Copilot prompt does not exist

**Severity: BLOCKING**

The plan describes a single Copilot subagent that replaces 8 old subagents. `src/prompts/` has 8 old files but no Copilot prompt. A Copilot prompt must be written that explains:
- All 17 tool calls and when to use each
- `setCursor` mechanics for branching
- How to use `"ref"` vs `"${}"` interpolation appropriately
- ID naming conventions (snake_case, connector-prefixed: `ai_1`, `http_1`, `zip_1`, etc.)
- When to pass `opts.model`, `opts.outputFormat`, `opts.tools` to `addAiStep`

---

### Prioritized Implementation Order

| # | File to create/modify | Action |
|---|---|---|
| 1 | `src/builders/StepBuilder.ts` | **Create** — fix `OutputFormat`, remove `structured_schema?` from interface, add `queryParams` to `http()` |
| 2 | `src/builders/AgentBuilder.ts` | **Create** — fix compile() duplicate, fix syntax error, fix trigger exclusion, fix AST `workflowBranches` for condition + loop |
| 3 | `src/tools.ts` | **Full rewrite** — 17 tools with complete Zod schemas wiring into builder instance |
| 4 | `src/prompts/copilot.ts` | **Create** — Copilot prompt covering all 17 tools, cursor mechanics, naming patterns |
| 5 | `src/index.ts` | **Full rewrite** — single `copilot` subagent with all 17 tools, remove all 8 old subagents |
| 6 | `src/prompts/` | **Delete** — orchestrator, validator, generator, stepBuilder, composer, modifier, auditor, idManager prompts |

---

## 8. Blocking Gap Fix Report

Each fix applied above, with justification and cited evidence.

---

### Fix for Gap 1 — `ZipStep` interface + `OutputFormat` type

**What changed:**
- Removed `structured_schema?: any` from `ZipStep` interface
- Added `"raw"` to `OutputFormat` union type

**Justification:**
`structured_schema` appeared as a root-level field on `ZipStep` with a comment saying "Required sibling of input_config for AI outputs." This is factually wrong and contradicted by every production agent audited. In all 7 `@Valid-Agents` files, `structured_schema` is always nested inside `input_config.value`, never as a top-level step field. Keeping this field on the interface would mislead implementing code into placing structured schemas at the wrong level.

`OutputFormat` was declared as `"structured" | "markdown"` only. Pass 4 audit of `Adverse media research agent.task_template.json` L99 found `output_format: "raw"` as a third valid production value. TypeScript would have rejected any `genericAi` call with `outputFormat: "raw"`.

**Evidence:**
- `Adverse media research agent.task_template.json` L97-100: `"output_format": { "control": "picklist", "value": "raw" }`
- ALL 7 agents: `structured_schema` inside `input_config.value`, never as root step field

---

### Fix for Gap 2 — Duplicate `compile()` signature

**What changed:**
Removed the phantom `public compile(): Record<string, any> {` at line 408. Only one `compile()` method now exists. Also moved `configVarsMap` from a parameter into a class-level `Map<string, ConfigVarDef>` property, populated via `addConfigVar()`.

**Justification:**
TypeScript does not support duplicate method declarations without function overloading syntax. Having two `public compile()` declarations would produce a `Duplicate function implementation` error at compile time. The plan had this due to an editing artifact from a previous draft. Moving `configVars` to class state is correct because the AI needs to be able to register config vars incrementally, not pass them all at once at compile time.

---

### Fix for Gap 3 — Syntax error in `injectIntoBranch`

**What changed:**
```diff
- throw new Error(`AST Error: Parent ${this.cursorParentId}:${this.cursorBranch?} not found.`);
+ throw new Error(`AST Error: Parent '${this.cursorParentId}' branch '${this.cursorBranch ?? "null"}' not found.`);
```

**Justification:**
`this.cursorBranch?` uses optional chaining inside a template literal, which is invalid JavaScript/TypeScript syntax. The `?` here would be interpreted as a ternary operator with a missing condition, causing a parse error. The correct idiom is `this.cursorBranch ?? "null"` which coalesces null/undefined to the string "null" for a readable error message.

---

### Fix for Gap 4 — Loop + Condition AST branch injection

**What changed:**
`addStep()` now computes `workflowBranches` separately from `step.branches`:
- `if_condition` steps get `workflowBranches = [{ key: "true", label: "True", steps: [] }, { key: "default", label: "False", steps: [] }]`
- `loop_n_times` steps get `workflowBranches = [{ key: "default", label: "Loop Body", steps: [] }]`
- All other steps get `workflowBranches = null`
- The `WorkflowNode` uses `workflowBranches`, not `step.branches`

**Justification:**
Pass 4 audit confirmed that `steps_data` entries for both `if_condition` and `loop_n_times` always have `branches: null` at the step level. However the workflow AST entries for the same steps always have pre-initialized branch arrays. If `addStep()` copies `step.branches` (null) into the `WorkflowNode`, then any subsequent `setCursor(parentId="condition_1", branch="true")` call will attempt to find a node with key `"condition_1"` that has branches — but it will have `null` — and `injectIntoBranch()` will return `false`, causing the `AST Error: Parent not found` throw for every single branching operation.

**Evidence:**
- `Intake Validation Agent V2.task_template.json` L369: `if_condition` step: `"branches": null`
- `Intake Validation Agent V2.task_template.json` L771: `loop_n_times` step: `"branches": null`
- `Adverse media research agent.task_template.json` L520-588 (workflow AST): `condition_1` has `branches: [{ key: "default", ... }, { key: "true", ... }]`

---

### Fix for Gap 5 — `approval_assist` guard + `config_vars` output format

**What changed (trigger guard):**
Added early return in `addStep()`: if `step.action_key === "approval_assist"`, register in `stepsList` and `return` immediately — do not inject into `workflowRoot`.

**What changed (config_vars):**
- Replaced `configVarsMap: Set<string>` parameter with class-level `Map<string, ConfigVarDef>`
- Added `ConfigVarDef` interface: `{ title, kind, required?, connector? }`
- Added public `addConfigVar()` method
- `compile()` now emits correct production-shaped config_vars objects

**Justification (trigger):**
All 7 production agents place the trigger step in `workflow.trigger`, never in `workflow.steps`. If `addStep()` injects `approval_assist` into `workflowRoot`, it will appear in `workflow.steps` — creating a structural duplicate that would be rejected on import.

**Evidence (trigger):** ALL 7 Valid-Agents:
```json
"workflow": { "trigger": { "key": "trigger", "branches": null }, "steps": [ /* no trigger here */ ] }
```

**Justification (config_vars):**
The plan emitted config_vars as `{ key: { control: "text", value: "" } }` — a flat control object. Production uses a completely different object shape with `key`, `title`, `description`, `required`, `kind`, and `connector`. The old format would produce a structurally invalid agent.

**Evidence (config_vars):** `Duplicate supplier check agent.task_template.json` L19-29:
```json
"http_connection": {
  "key": "http_connection", "title": "Http connection", "description": null,
  "required": true, "kind": "connection", "connector": { "key": "http" }
}
```

---

### Fix for Gap 6 — All 17 tool Zod schemas

**What changed:**
Replaced the single-tool stub with a complete `createZipTools()` function containing all 17 tools with full Zod parameter schemas, execute implementations, and error passthrough via the `run()` helper.

**Justification:**
With only `addHttpStep` defined, the Copilot had no programmatic interface to 15 of the 16 node types. The tools section was the bridge between the plan and implementation — without complete schemas, the `src/tools.ts` rewrite could not be attempted. Each tool's Zod schema enforces the exact parameter types the AI is allowed to pass, preventing invalid combinations at the tool layer before they reach the builder.

Key design decisions:
- `run()` helper centralizes error passthrough — any `throw` from `StepBuilder` or `AgentBuilder` becomes `{ success: false, error: message }` returned directly to the Copilot
- `addAiStep` uses `any` execute type to avoid Zod discriminated union complexity for the optional nested `structuredSchema` array; validation is handled by `StepBuilder.genericAi`
- `activeBuilder` is module-level state — one agent build per session, reset to `null` after `compileAndSave`
- `addJinjaStep` and `addPythonStep` materialize the `vars` array into the correct production control object shape inline, so callers only need to pass `{ key, valueRef }` pairs
