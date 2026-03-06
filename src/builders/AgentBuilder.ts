// src/builders/AgentBuilder.ts
// Manages the Zip Agent AST and compiles to the final task_template JSON.
// All design decisions are documented with citations from @Valid-Agents production evidence.

import { ZipStep } from "./StepBuilder.js";

// ── Types ─────────────────────────────────────────────────────────────────────

// WorkflowNode uses AST branches — separate from steps_data branches.
// steps_data branches = always null for condition/loop (confirmed Pass 4 audit)
// AST branches = pre-initialized with branch slots for condition and loop only
interface WorkflowNode {
    key: string;
    branches: { key: string; label: string; steps: WorkflowNode[] }[] | null;
}

// Proper config_var shape matching production schema
// CITED: Duplicate supplier check agent.json L19-29, contract_analysis_agent.json L1-30
export interface ConfigVarDef {
    title: string;
    kind: "text" | "connection";
    required?: boolean;
    connector?: { key: string }; // only for kind:"connection"
}

// ── Key Naming Enforcement ────────────────────────────────────────────────────
// Maps every production action_key to its required step key prefix.
// Convention: type_N (e.g. ai_1, zip_2, cond_1). Trigger is always exactly "trigger".
// CITED: All 7 Valid-Agents follow this convention without exception.
//
// Toggle off via new AgentBuilder(name, { strictKeyNames: false }) for custom key names.

const KEY_PREFIX_MAP: Record<string, { prefix: string; example: string }> = {
    // AI connector
    "generic_ai": { prefix: "ai", example: "ai_1" },
    "approval_assist": { prefix: "trigger", example: "trigger" }, // exact key, no number

    // Zip connector
    "get_request": { prefix: "zip", example: "zip_1" },
    "get_vendor": { prefix: "zip", example: "zip_2" },

    // HTTP connector
    "$http_client": { prefix: "http", example: "http_1" },

    // Condition connector
    "if_condition": { prefix: "cond", example: "cond_1" },

    // Return connector
    "return_value": { prefix: "return", example: "return_1" },

    // Jinja connector
    "render_json_template": { prefix: "jinja", example: "jinja_1" },

    // Loop connector — loop_n_times AND break_loop are both loop nodes, both use loop_N
    "loop_n_times": { prefix: "loop", example: "loop_1" },
    "break_loop": { prefix: "loop", example: "loop_2" },

    // Memory storage connector
    "set_value": { prefix: "mem", example: "mem_1" },
    "get_value": { prefix: "mem", example: "mem_2" },
    "append_to_list": { prefix: "mem", example: "mem_3" },

    // Python connector
    "execute_script": { prefix: "python", example: "python_1" },
};

export interface AgentBuilderOptions {
    /**
     * When true (default), enforces the production type_N step key naming convention.
     * e.g. ai_1, zip_1, cond_1, mem_1, loop_1, return_1 …
     *
     * Set to false to allow arbitrary step key names (useful for migration or custom workflows).
     */
    strictKeyNames?: boolean;
}

// ── AgentBuilder ──────────────────────────────────────────────────────────────

export class AgentBuilder {
    public name: string;
    private readonly strictKeyNames: boolean;

    // Flat list of steps for steps_data output
    private stepsList: Map<string, ZipStep> = new Map();

    // Hierarchical AST for workflow.steps output
    private workflowRoot: WorkflowNode[] = [];

    // Config vars with full production-shape metadata
    private configVars: Map<string, ConfigVarDef> = new Map();

    // Linear cursor state — the AI's only interface to branch routing
    private cursorParentId: string | null = null;
    private cursorBranch: "true" | "default" | null = null;

    constructor(name: string, opts: AgentBuilderOptions = {}) {
        this.name = name;
        this.strictKeyNames = opts.strictKeyNames ?? true;
    }

    // ── Public API ──────────────────────────────────────────────────────────────

    /**
     * Register a config variable. Must be called before compile() if any
     * step references config.{key}.
     */
    public addConfigVar(key: string, def: ConfigVarDef): void {
        this.configVars.set(key, def);
    }

    /**
     * Move the insertion cursor into a branch of an existing condition or loop.
     * Pass parentId=null to return to root scope.
     */
    public setCursor(parentId: string | null, branch?: "true" | "default"): void {
        this.cursorParentId = parentId;
        this.cursorBranch = branch ?? null;
    }

    /**
     * Add a step to the agent. Handles:
     * - Key name validation (strictKeyNames=true by default)
     * - Registering in stepsList (always)
     * - Excluding approval_assist from workflowRoot (it lives in workflow.trigger)
     * - Pre-initializing AST branches for if_condition (true+default) and loop_n_times (default)
     * - Injecting at the current cursor position
     */
    public addStep(step: ZipStep): void {
        // Key naming validation fires first — before duplicate check or AST work
        if (this.strictKeyNames) {
            this.validateKey(step.key, step.action_key);
        }

        if (this.stepsList.has(step.key)) {
            throw new Error(`Step ID '${step.key}' already exists. Step IDs must be unique.`);
        }
        this.stepsList.set(step.key, step);

        // CITED: ALL 7 Valid-Agents: workflow.trigger contains the trigger, NEVER workflow.steps
        // approval_assist is registered in stepsList (for steps_data) but not in workflowRoot.
        if (step.action_key === "approval_assist") return;

        // steps_data branches = null for condition and loop (confirmed Pass 4 audit)
        // But workflow AST needs pre-initialized branch slots for setCursor() to work.
        let workflowBranches: WorkflowNode["branches"] = null;

        if (step.action_key === "if_condition") {
            // CITED: All if_condition instances in all 7 agents have true + default in workflow AST
            workflowBranches = [
                { key: "true", label: "True", steps: [] },
                { key: "default", label: "False", steps: [] },
            ];
        } else if (step.action_key === "loop_n_times") {
            // CITED: IntakeV2 L771-787 (steps_data branches:null), workflow AST (default branch wraps body)
            workflowBranches = [{ key: "default", label: "Loop Body", steps: [] }];
        }

        const node: WorkflowNode = { key: step.key, branches: workflowBranches };

        if (!this.cursorParentId) {
            this.workflowRoot.push(node);
        } else {
            if (
                !this.injectIntoBranch(
                    this.workflowRoot,
                    this.cursorParentId,
                    this.cursorBranch,
                    node
                )
            ) {
                throw new Error(
                    `AST Error: Parent '${this.cursorParentId}' branch '${this.cursorBranch ?? "null"}' not found. ` +
                    `Did you call setCursor() with the correct parentId and branch?`
                );
            }
        }
    }

    /**
     * Compile the agent to a Zip task_template JSON object.
     * Runs two safety checks:
     *   1. Dependency Check — all step refs and config refs must point to real IDs
     *   2. Orphan Check — every step in stepsList must appear in the workflow AST
     */
    public compile(): Record<string, any> {
        const dataStr = JSON.stringify(Array.from(this.stepsList.values()));

        // ── 1. Dependency Regex Check ─────────────────────────────────────────────
        // Matches "value": "steps.X..." (ref control) AND "value": "${steps.X...}" (text control)
        const references = [
            ...dataStr.matchAll(/"value":\s*"(?:[^"]*\$\{)?(steps|config)\.([^."}\s]+)/g),
        ];
        for (const match of references) {
            const [, type, refKey] = match;
            if (type === "steps" && !this.stepsList.has(refKey) && refKey !== "trigger") {
                throw new Error(
                    `Compiler Error: Step ref 'steps.${refKey}' is invalid. No step '${refKey}' exists.`
                );
            }
            if (type === "config" && !this.configVars.has(refKey)) {
                throw new Error(
                    `Compiler Error: Config ref 'config.${refKey}' must be declared via addConfigVar().`
                );
            }
        }

        // ── 2. Orphan AST Check ───────────────────────────────────────────────────
        // trigger is legitimately absent from workflowRoot (it's in workflow.trigger)
        const astKeys = new Set(["trigger", ...this.extractAstKeys(this.workflowRoot)]);
        for (const [key] of this.stepsList) {
            if (!astKeys.has(key)) {
                throw new Error(
                    `Orphan Node: Step '${key}' is in steps_data but missing from workflow AST. ` +
                    `Did you forget to set the cursor before adding this step?`
                );
            }
        }

        // ── Build config_vars with correct production shape ───────────────────────
        // CITED: Duplicate supplier check agent.json L19-29
        const config_vars: Record<string, any> = {};
        for (const [k, def] of this.configVars) {
            config_vars[k] = {
                key: k,
                title: def.title,
                description: null,
                required: def.required ?? true,
                kind: def.kind,
                ...(def.connector ? { connector: def.connector } : {}),
            };
        }

        // ── Assemble final task_template ──────────────────────────────────────────
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
                steps: this.workflowRoot,
            },
        };
    }

    // ── Private Helpers ─────────────────────────────────────────────────────────

    /**
     * Validates a step key against the KEY_PREFIX_MAP convention.
     * - approval_assist must use exactly "trigger"
     * - all other steps must match the pattern: prefix_N (e.g. ai_1, zip_2, mem_3)
     * Throws a descriptive error naming the violation and giving a concrete example.
     */
    private validateKey(key: string, actionKey: string): void {
        const entry = KEY_PREFIX_MAP[actionKey];
        if (!entry) return; // unknown action_key — skip, don't block unknown future node types

        if (entry.prefix === "trigger") {
            // approval_assist must always use exactly "trigger"
            if (key !== "trigger") {
                throw new Error(
                    `Key Naming Error: approval_assist step must use key "trigger", got "${key}". ` +
                    `Disable this check via new AgentBuilder(name, { strictKeyNames: false }).`
                );
            }
            return;
        }

        // For all other steps: key must match prefix_N (prefix, underscore, one or more digits)
        const valid = new RegExp(`^${entry.prefix}_\\d+$`);
        if (!valid.test(key)) {
            throw new Error(
                `Key Naming Error: step key "${key}" is invalid for action "${actionKey}". ` +
                `Expected format: ${entry.prefix}_N (e.g. "${entry.example}"). ` +
                `Disable this check via new AgentBuilder(name, { strictKeyNames: false }).`
            );
        }
    }

    /**
     * Recursive depth-first insertion into the workflow AST.
     * Finds the node matching parentId, then the branch matching branchKey,
     * and appends newNode to that branch's steps array.
     */
    private injectIntoBranch(
        nodes: WorkflowNode[],
        parentId: string,
        branchKey: string | null,
        newNode: WorkflowNode
    ): boolean {
        for (const node of nodes) {
            if (node.key === parentId && node.branches) {
                const branch = node.branches.find((b) => b.key === branchKey);
                if (branch) {
                    branch.steps.push(newNode);
                    return true;
                }
            }
            if (node.branches) {
                for (const branch of node.branches) {
                    if (this.injectIntoBranch(branch.steps, parentId, branchKey, newNode)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Recursively collect all step keys present in the workflow AST.
     * Used for the orphan check during compile().
     */
    private extractAstKeys(nodes: WorkflowNode[]): string[] {
        const keys: string[] = [];
        for (const node of nodes) {
            keys.push(node.key);
            if (node.branches) {
                for (const branch of node.branches) {
                    keys.push(...this.extractAstKeys(branch.steps));
                }
            }
        }
        return keys;
    }
}
