// src/tools.ts — Full rewrite implementing all 17 builder tools
// Replaces the old 3-tool implementation (listAgents, readAgent, saveAgent)
// with the programmatic Zip Agent builder interface.

import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { StepBuilder } from "./builders/StepBuilder.js";
import { AgentBuilder } from "./builders/AgentBuilder.js";
import { ZipBuilderConfig } from "./config.js";
import { AgentPlanDraftSchema, normalizePlanFilename, renderAgentPlanMdx } from "./builders/PlanBuilder.js";
import { buildAndSave } from "./builders/BuildPipeline.js";

// Module-level builder instance — one session = one agent build
let activeBuilder: AgentBuilder | null = null;

export interface ToolResult {
    success: boolean;
    error?: string;
    filepath?: string;
    source?: string;
}

// Error passthrough helper: any throw from StepBuilder or AgentBuilder
// propagates directly to Zip-Pilot as { success: false, error: message }
const run = (fn: () => void): ToolResult => {
    try {
        fn();
        return { success: true };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
};

// Helper to build the variables array used by jinja and python steps.
// Callers pass { key, valueRef } pairs; this materializes the correct control shape.
const makeVarsArray = (vars: Array<{ key: string; valueRef: string }>) =>
    vars.map((v) => ({
        control: "object",
        value: {
            key: { control: "text", value: v.key },
            value: StepBuilder.resolveControl(v.valueRef),
        },
    }));



export function createZipTools(config: ZipBuilderConfig) {
    return {

        // ── Session Init ──────────────────────────────────────────────────────────

        initializeAgent: {
            name: "initializeAgent",
            description:
                "Start building a new Zip Agent. MUST be called before any other tool. " +
                "Resets any previous session. " +
                "By default, step key names are enforced to follow the type_N convention (ai_1, zip_2, condition_1, etc.). " +
                "Pass strictKeyNames=false ONLY if the user explicitly requests custom key names.",
            parameters: z.object({
                name: z.string().describe("Agent display name"),
                strictKeyNames: z
                    .boolean()
                    .default(true)
                    .describe(
                        "Enforce type_N step key naming (default: true). " +
                        "Set false only if user explicitly requests custom key names."
                    ),
            }).shape,
            execute: async ({ name, strictKeyNames }: { name: string; strictKeyNames: boolean }): Promise<ToolResult> => {
                activeBuilder = new AgentBuilder(name, { strictKeyNames });
                return { success: true };
            },
        },

        // ── Node 4: approval_assist ───────────────────────────────────────────────

        addApprovalTrigger: {
            name: "addApprovalTrigger",
            description:
                "Adds the approval_assist trigger node. Always call this immediately after initializeAgent.",
            parameters: z.object({
                key: z.string().default("trigger").describe("Step ID — always 'trigger'"),
                name: z.string().default("Approval assist").describe("Display label"),
            }).shape,
            execute: async (p: { key: string; name: string }) =>
                run(() => activeBuilder!.addStep(StepBuilder.approvalAssist(p.key, p.name))),
        },

        // ── Node 5: get_request ───────────────────────────────────────────────────

        addGetRequestStep: {
            name: "addGetRequestStep",
            description:
                "Adds a get_request node to fetch the current Zip request object. " +
                "Use bare path 'steps.trigger.request.id' for ref control, " +
                "or '${steps.trigger.request.id}' for text control.",
            parameters: z.object({
                key: z.string().describe("Unique step ID e.g. 'zip_1'"),
                name: z.string().describe("Display label"),
                requestIdValue: z
                    .string()
                    .describe(
                        "Value for request_id. Bare path → ref control. ${} syntax → text control."
                    ),
            }).shape,
            execute: async (p: { key: string; name: string; requestIdValue: string }) =>
                run(() =>
                    activeBuilder!.addStep(StepBuilder.getRequest(p.key, p.name, p.requestIdValue))
                ),
        },

        // ── Node 6: get_vendor ────────────────────────────────────────────────────

        addGetVendorStep: {
            name: "addGetVendorStep",
            description: "Adds a get_vendor node to fetch vendor data.",
            parameters: z.object({
                key: z.string().describe("Unique step ID e.g. 'zip_2'"),
                name: z.string().describe("Display label"),
                vendorIdValue: z
                    .string()
                    .describe("vendor_id value, usually '${steps.zip_1.vendor.id}'"),
            }).shape,
            execute: async (p: { key: string; name: string; vendorIdValue: string }) =>
                run(() =>
                    activeBuilder!.addStep(StepBuilder.getVendor(p.key, p.name, p.vendorIdValue))
                ),
        },

        // ── Node 1: $http_client ──────────────────────────────────────────────────

        addHttpStep: {
            name: "addHttpStep",
            description:
                "Adds an HTTP request step. For GET requests omit method. " +
                "Use bodyStr for POST/PUT body as a JSON string. " +
                "Use queryParams for GET query parameters.",
            parameters: z.object({
                key: z.string().describe("Unique step ID e.g. 'http_1'"),
                name: z.string().describe("Display label"),
                url: z.string().describe("API URL path e.g. '/vendors'"),
                method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
                bodyStr: z.string().optional().describe("JSON body string for POST/PUT"),
                queryParams: z
                    .array(
                        z.object({
                            key: z.string(),
                            value: z.string(),
                        })
                    )
                    .optional()
                    .describe("Query parameters for GET requests"),
            }).shape,
            execute: async (p: {
                key: string;
                name: string;
                url: string;
                method: "GET" | "POST" | "PUT" | "DELETE";
                bodyStr?: string;
                queryParams?: Array<{ key: string; value: string }>;
            }) =>
                run(() =>
                    activeBuilder!.addStep(
                        StepBuilder.http(p.key, p.name, p.url, p.method, p.bodyStr, p.queryParams)
                    )
                ),
        },

        // ── Node 3: generic_ai ────────────────────────────────────────────────────

        addAiStep: {
            name: "addAiStep",
            description:
                "Adds a generic_ai node. All opts are OPTIONAL — only pass what the step needs. " +
                "Interpolate step references inline in the prompt using ${steps.x.field} syntax. " +
                "Do NOT use outputFormat unless the step explicitly needs it — some production steps omit it entirely.",
            parameters: z.object({
                key: z.string().describe("Unique step ID e.g. 'ai_1'"),
                name: z.string().describe("Display label"),
                prompt: z
                    .string()
                    .describe(
                        "user_prompt text. Embed step refs inline: '${steps.zip_1.id}'"
                    ),
                tools: z
                    .array(z.enum(["document", "zip_data", "web_search_preview"]))
                    .optional()
                    .describe("Tools to enable. Omit entirely if none needed."),
                outputFormat: z
                    .enum(["structured", "markdown", "raw"])
                    .optional()
                    .describe("Output format. Omit if not explicitly needed."),
                model: z.string().optional().describe("e.g. 'auto'. Omit unless explicitly needed."),
                structuredSchemaKeys: z
                    .string()
                    .optional()
                    .describe("EXACT copy-paste of the text in the MDX 'Keys / Values' column."),
                structuredSchemaTypes: z
                    .string()
                    .optional()
                    .describe("EXACT copy-paste of the text in the MDX 'Types' column."),
                outputSchema: z
                    .array(
                        z.object({
                            key: z.string(),
                            type: z.string(),
                            description: z.string(),
                        })
                    )
                    .optional()
                    .describe("Alt schema key 'output_schema' — used by some agents instead of structuredSchema."),
                arraySchema: z
                    .boolean()
                    .optional()
                    .describe("Set true if structured output is an array of objects."),
                includeCitations: z
                    .boolean()
                    .optional()
                    .describe("Emit include_citations boolean field."),
                dataSources: z
                    .array(z.any())
                    .optional()
                    .describe("data_sources array — usually []."),
            }).shape,
            execute: async (p: any) =>
                run(() =>
                    activeBuilder!.addStep(
                        StepBuilder.genericAi(p.key, p.name, p.prompt, {
                            tools: p.tools,
                            outputFormat: p.outputFormat,
                            model: p.model,
                            structuredSchemaKeys: p.structuredSchemaKeys,
                            structuredSchemaTypes: p.structuredSchemaTypes,
                            outputSchema: p.outputSchema,
                            arraySchema: p.arraySchema,
                            includeCitations: p.includeCitations,
                            dataSources: p.dataSources,
                        })
                    )
                ),
        },

        // ── Node 2: if_condition ──────────────────────────────────────────────────

        addConditionStep: {
            name: "addConditionStep",
            description:
                "Adds an if_condition node. " +
                "After adding, call setCursor(key, 'true') to add steps for the true branch, " +
                "and setCursor(key, 'default') for the false/else branch. " +
                "left: bare path 'steps.x.y' uses ref control; ${} syntax uses text control. Both are valid.",
            parameters: z.object({
                key: z.string().describe("Unique step ID e.g. 'condition_1'"),
                name: z.string().describe("Display label"),
                left: z
                    .string()
                    .describe(
                        // BUG 1 FIX: both ref and text control are valid for left_value
                        // CITED: contract_analysis_agent.json L188, L492 (\"text\" + \"${}\")
                        // CITED: DuplicateSupplier L384, IntakeV2 L380, AdverseMedia L344, Kraken L112, PoC L287/L314 (\"ref\" bare path)
                        "Left operand — bare path 'steps.ai_1.response.found' → ref control. " +
                        "${} syntax '${steps.ai_1.response.found}' → text control."
                    ),
                op: z.enum(["equals", "not_equals"]).describe("Comparison operator"),
                right: z
                    .union([z.string(), z.boolean(), z.number(), z.null()])
                    .describe(
                        "Right operand. Pass JS null for null comparisons, boolean for true/false, " +
                        "number for numeric, string for text."
                    ),
            }).shape,
            execute: async (p: {
                key: string;
                name: string;
                left: string;
                op: "equals" | "not_equals";
                right: any;
            }) =>
                run(() =>
                    activeBuilder!.addStep(
                        StepBuilder.condition(p.key, p.name, p.left, p.op, p.right)
                    )
                ),
        },

        // ── Node 7: return_value ──────────────────────────────────────────────────

        addReturnStep: {
            name: "addReturnStep",
            description:
                "Adds a return_value node. " +
                "Use bare path 'steps.ai_1.response' for ref control. " +
                "Use '${steps.ai_1.response}' for text control.",
            parameters: z.object({
                key: z.string().describe("Unique step ID e.g. 'return_1'"),
                name: z.string().describe("Display label"),
                valueExpr: z
                    .string()
                    .describe(
                        "Return value expression. Bare path → ref. ${} syntax → text."
                    ),
            }).shape,
            execute: async (p: { key: string; name: string; valueExpr: string }) =>
                run(() =>
                    activeBuilder!.addStep(StepBuilder.returnValue(p.key, p.name, p.valueExpr))
                ),
        },

        // ── Node 8: render_json_template ──────────────────────────────────────────

        addJinjaStep: {
            name: "addJinjaStep",
            description: "Adds a render_json_template (Jinja2) node.",
            parameters: z.object({
                key: z.string().describe("Unique step ID e.g. 'jinja_1'"),
                name: z.string().describe("Display label"),
                jsonTemplate: z.string().describe("Jinja2 template string"),
                vars: z
                    .array(
                        z.object({
                            key: z.string().describe("Variable name used in the template"),
                            valueRef: z
                                .string()
                                .describe(
                                    "Step ref for this variable. Bare path → ref control. ${} → text."
                                ),
                        })
                    )
                    .describe("Template input variables"),
            }).shape,
            execute: async (p: {
                key: string;
                name: string;
                jsonTemplate: string;
                vars: Array<{ key: string; valueRef: string }>;
            }) =>
                run(() =>
                    activeBuilder!.addStep(
                        StepBuilder.renderJsonTemplate(
                            p.key,
                            p.name,
                            p.jsonTemplate,
                            makeVarsArray(p.vars)
                        )
                    )
                ),
        },

        // ── Node 9: loop_n_times ──────────────────────────────────────────────────

        addLoopStep: {
            name: "addLoopStep",
            description:
                "Adds a loop_n_times node. " +
                "After adding, call setCursor(key, 'default') to place steps inside the loop body. " +
                "Call setCursor(null) to exit the loop body.",
            parameters: z.object({
                key: z.string().describe("Unique step ID e.g. 'loop_1'"),
                name: z.string().describe("Display label"),
                iterationCount: z
                    .union([z.string(), z.number()])
                    .describe(
                        "Iteration count. String step ref 'steps.py_1.result' → ref control. " +
                        "Number literal → number control."
                    ),
            }).shape,
            execute: async (p: { key: string; name: string; iterationCount: string | number }) =>
                run(() =>
                    activeBuilder!.addStep(
                        StepBuilder.loopNTimes(p.key, p.name, p.iterationCount)
                    )
                ),
        },

        // ── Node 10: break_loop ───────────────────────────────────────────────────

        addBreakStep: {
            name: "addBreakStep",
            description:
                "Adds a break_loop node. Place this inside a condition's true branch that is inside a loop.",
            parameters: z.object({
                key: z.string().describe("Unique step ID e.g. 'break_1'"),
                name: z.string().default("Break").describe("Display label"),
            }).shape,
            execute: async (p: { key: string; name: string }) =>
                run(() => activeBuilder!.addStep(StepBuilder.breakLoop(p.key, p.name))),
        },

        // ── Node 11: set_value ────────────────────────────────────────────────────

        addMemorySetStep: {
            name: "addMemorySetStep",
            description: "Adds a set_value memory storage node. Stores a value under a named key.",
            parameters: z.object({
                key: z.string().describe("Unique step ID e.g. 'mem_1'"),
                name: z.string().describe("Display label"),
                varKey: z.string().describe("Memory key name e.g. 'vendor_name'"),
                valueRef: z
                    .string()
                    .describe(
                        "Value to store. Bare step path → ref. JSON literal '[]'/'{}' → json. " +
                        "Text template with ${} → text."
                    ),
            }).shape,
            execute: async (p: {
                key: string;
                name: string;
                varKey: string;
                valueRef: string;
            }) =>
                run(() =>
                    activeBuilder!.addStep(
                        StepBuilder.memorySetValue(p.key, p.name, p.varKey, p.valueRef)
                    )
                ),
        },

        // ── Node 12: get_value ────────────────────────────────────────────────────

        addMemoryGetStep: {
            name: "addMemoryGetStep",
            description: "Adds a get_value memory storage node. Retrieves a stored value by key.",
            parameters: z.object({
                key: z.string().describe("Unique step ID e.g. 'mem_2'"),
                name: z.string().describe("Display label"),
                varKey: z.string().describe("Memory key to retrieve"),
                withDefault: z
                    .boolean()
                    .default(false)
                    .describe(
                        "If true, emits default_value: null. Only set true when the step " +
                        "genuinely needs a null fallback."
                    ),
            }).shape,
            execute: async (p: {
                key: string;
                name: string;
                varKey: string;
                withDefault: boolean;
            }) =>
                run(() =>
                    activeBuilder!.addStep(
                        StepBuilder.memoryGetValue(p.key, p.name, p.varKey, p.withDefault)
                    )
                ),
        },

        // ── Node 13: append_to_list ───────────────────────────────────────────────

        addMemoryAppendStep: {
            name: "addMemoryAppendStep",
            description: "Adds an append_to_list memory storage node.",
            parameters: z.object({
                key: z.string().describe("Unique step ID e.g. 'mem_3'"),
                name: z.string().describe("Display label"),
                storageKey: z.string().describe("List key to append to"),
                valueRef: z
                    .string()
                    .describe(
                        "Value to append. Bare step path → ref. ${} interpolated → text."
                    ),
            }).shape,
            execute: async (p: {
                key: string;
                name: string;
                storageKey: string;
                valueRef: string;
            }) =>
                run(() =>
                    activeBuilder!.addStep(
                        StepBuilder.memoryAppendToList(p.key, p.name, p.storageKey, p.valueRef)
                    )
                ),
        },

        // ── Node 14: execute_script ───────────────────────────────────────────────

        addPythonStep: {
            name: "addPythonStep",
            description: "Adds an execute_script (Python) node.",
            parameters: z.object({
                key: z.string().describe("Unique step ID e.g. 'python_1'"),
                name: z.string().describe("Display label"),
                script: z
                    .string()
                    .describe("Python script. Must define 'def execute(input): ...'"),
                vars: z
                    .array(
                        z.object({
                            key: z.string().describe("Variable name accessible via input dict"),
                            valueRef: z.string().describe("Step ref for this variable's value"),
                        })
                    )
                    .describe("Input variables passed to the script"),
            }).shape,
            execute: async (p: {
                key: string;
                name: string;
                script: string;
                vars: Array<{ key: string; valueRef: string }>;
            }) =>
                run(() =>
                    activeBuilder!.addStep(
                        StepBuilder.executeScript(p.key, p.name, p.script, makeVarsArray(p.vars))
                    )
                ),
        },

        // ── Cursor Navigation ─────────────────────────────────────────────────────

        setCursor: {
            name: "setCursor",
            description:
                "Move the insertion cursor into a branch of a condition or loop, " +
                "or back to root scope. " +
                "Call setCursor(conditionKey, 'true') to enter the if-true branch. " +
                "Call setCursor(conditionKey, 'default') to enter the else/false branch. " +
                "Call setCursor(loopKey, 'default') to enter the loop body. " +
                "Call setCursor(null) to return to the root (top-level) scope.",
            parameters: z.object({
                parentId: z
                    .string()
                    .nullable()
                    .describe("Key of the condition or loop step. Pass null to return to root."),
                branch: z
                    .enum(["true", "default"])
                    .optional()
                    .describe(
                        "'true' = if-true branch of a condition. " +
                        "'default' = else branch of a condition OR loop body. " +
                        "Omit when parentId is null."
                    ),
            }).shape,
            execute: async (p: { parentId: string | null; branch?: "true" | "default" }): Promise<ToolResult> => {
                if (!activeBuilder) return { success: false, error: "Call initializeAgent first" };
                activeBuilder.setCursor(p.parentId, p.branch);
                return { success: true };
            },
        },

        // ── Compile & Save ────────────────────────────────────────────────────────

        compileAndSave: {
            name: "compileAndSave",
            description:
                "Compile the agent and save it as JSON. " +
                "Runs dependency check (all step refs and config refs must be valid) " +
                "and orphan check (all steps must appear in the workflow AST). " +
                "Throws compiler errors directly back to you if anything is invalid.",
            parameters: z.object({
                filename: z
                    .string()
                    .describe("Output filename e.g. 'my-agent.json' or 'my-agent'"),
            }).shape,
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
        },

        // ── Planning Mode Storage ──────────────────────────────────────────────────

        saveAgentPlan: {
            name: "saveAgentPlan",
            description: "Validates a planning draft, renders it as MDX, and creates or overwrites a plan file in the configured plan directory.",
            parameters: z.object({
                filename: z.string().describe("Plan filename without extension"),
                planDraft: z.preprocess((val) => {
                    if (typeof val === "string") {
                        try { return JSON.parse(val); } catch (e) { return val; }
                    }
                    return val;
                }, AgentPlanDraftSchema).describe("Business-level planning draft used to render the MDX plan"),
            }).shape,
            execute: async ({ filename, planDraft }: { filename: string; planDraft: any }): Promise<ToolResult> => {
                try {
                    const mdx = renderAgentPlanMdx(planDraft);
                    const planDir = path.resolve(process.cwd(), config.planDir);
                    await fs.mkdir(planDir, { recursive: true });
                    const fullPath = path.join(planDir, normalizePlanFilename(filename));
                    await fs.writeFile(fullPath, mdx, "utf-8");
                    return { success: true, filepath: fullPath };
                } catch (e) {
                    return { success: false, error: (e as Error).message };
                }
            },
        },

        readAgentPlan: {
            name: "readAgentPlan",
            description: "Reads a saved MDX plan and returns the rendered source for review, planner-side reconstruction of planDraft, or build translation.",
            parameters: z.object({
                filename: z.string().describe("Plan filename with or without .mdx"),
            }).shape,
            execute: async ({ filename }: { filename: string }): Promise<ToolResult> => {
                try {
                    const planDir = path.resolve(process.cwd(), config.planDir);
                    const fullPath = path.join(planDir, normalizePlanFilename(filename));
                    const source = await fs.readFile(fullPath, "utf-8");
                    return { success: true, filepath: fullPath, source };
                } catch (e) {
                    return { success: false, error: (e as Error).message };
                }
            },
        },
    };
}
