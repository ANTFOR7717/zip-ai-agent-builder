# 🎨 FEATURE(update_approval_node)

## 1. Objective

Add `update_approval_node` as a new `zip_n` step type across `StepBuilder.ts`, `tools.ts`, `index.ts`, and `NODE_SCHEMA.md`. Source of truth: `Test Update Agent.task_template.json`.

---

## 2. Phased Sections

### Phase 1: Add `StepBuilder.updateApprovalNode`

**Target File:** [`StepBuilder.ts`](file:///Users/dev/Projects/zip-ai-agent-builder/src/builders/StepBuilder.ts)
**Target Block:** After `executeScript` closing `}` at line 553, before the class closing `}` at line 554.
**Justification:** New node types are always appended at the end of the class, following the sequential numbering. Inserting mid-class between `getVendor` and `returnValue` breaks ordering and does not match the existing pattern.

```typescript
    // ── 15 of 15: update_approval_node ───────────────────────────────────────
    // CITED: Test Update Agent.task_template.json L31-38
    // SOURCE JSON fields: key, action_key, connection_var_key, connector_key, display_name, input_config
    // INTERFACE-REQUIRED (not in source JSON): error_handling_policy, branches — required by ZipStep
    // FINDING: input_config null. connection_var_key null. connector_key "zip".
    static updateApprovalNode(key: string, name: string = "Update approval node"): ZipStep {
        return {
            key,
            display_name: name,
            connector_key: "zip",
            action_key: "update_approval_node",
            error_handling_policy: 1,
            connection_var_key: null,
            branches: null,
            input_config: null,
        };
    }
```

---

### Phase 2: Add `addUpdateApprovalStep` Tool

**Target File:** [`tools.ts`](file:///Users/dev/Projects/zip-ai-agent-builder/src/tools.ts)
**Target Block:** After `addPythonStep` closing `},` at line 508, before `// ── Cursor Navigation` at line 510.
**Justification:** All 14 node tools use `// ── Node N:` comments matching StepBuilder numbering. The file does NOT order nodes sequentially — nodes 1-14 appear in mixed order. The new tool goes after the last node (Node 14: `addPythonStep`) before the non-node utilities section.

```typescript
        // ── Node 15: update_approval_node ────────────────────────────────────────

        addUpdateApprovalStep: {
            name: "addUpdateApprovalStep",
            description: "Adds an update_approval_node zip step. Zero-input — no input_config.",
            parameters: z.object({
                key: z.string().describe("Unique step ID e.g. 'zip_1'"),
                name: z.string().default("Update approval node").describe("Display label"),
            }).shape,
            execute: async (p: { key: string; name: string }) =>
                run(() => activeBuilder!.addStep(StepBuilder.updateApprovalNode(p.key, p.name))),
        },
```

---

### Phase 3: Register Tool in `builderAgent`

**Target File:** [`index.ts`](file:///Users/dev/Projects/zip-ai-agent-builder/src/index.ts)
**Target Block:** After `addPythonStep` at line 91, before `setCursor` at line 92.
**Justification:** Every tool in `tools.ts` must be explicitly registered in the `builderAgent` tools map. Omitting this would make the tool unreachable by the agent.

```typescript
            addGetVendorStep: tools.addGetVendorStep,
            addHttpStep: tools.addHttpStep,           // existing — do not move
            // ... (all existing tools unchanged) ...
            addPythonStep: tools.addPythonStep,
            addUpdateApprovalStep: tools.addUpdateApprovalStep,  // ← APPEND after addPythonStep at line 91
            setCursor: tools.setCursor,
```

---

### Phase 4: Add Node Schema Entry

**Target File:** [`NODE_SCHEMA.md`](file:///Users/dev/Projects/zip-ai-agent-builder/src/schemas/NODE_SCHEMA.md)
**Target Block:** After the `zip_2 / get_vendor` section ending at line 860, before `## Exact Reference Strings` at line 862.
**Justification:** `NODE_SCHEMA.md` is the authoritative reference for all accepted node shapes. `update_approval_node` is a zip node with no input fields. The exact JSON from the production source file is used verbatim — no invented fields.

````markdown
### Node `zip_N` — `zip / update_approval_node`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `zip_N` | Yes |
| `display_name` | `string` | `Update approval node` | Yes |
| `connector_key` | `string` | `zip` | Yes |
| `action_key` | `string` | `update_approval_node` | Yes |
| `input_config` | `null` | `null` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

```json
{
  "key": "zip_1",
  "display_name": "Update approval node",
  "connector_key": "zip",
  "action_key": "update_approval_node",
  "input_config": null,
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```
````

---

## 3. Anti-Laziness Audit Results

| Audit Check | Verdict |
|---|---|
| All `addGetVendorStep` registration sites grepped | ✅ Found in `tools.ts:115`, `index.ts:80` only |
| Builder prompt (`builder.ts`) references zip tool names? | ✅ No — no update needed |
| `NODE_SCHEMA.md` has `update_approval_node` entry? | ❌ Missing — Phase 4 adds it |
| `StepBuilder.ts` line 2 comment says "14 of 14"? | ⚠️ Must update to "15 of 15" — Phase 1 Addendum |
| `tools.ts` line 1 comment says "17 builder tools"? | ⚠️ Already stale (actual count is 19). Must update to "20" after this feature — Phase 5 |
| `AgentBuilder.ts` `KEY_PREFIX_MAP` has `update_approval_node`? | ❌ Missing — Phase 6 adds it |
| Source JSON `error_handling_policy` + `branches` present? | ⚠️ Not in source JSON — required by `ZipStep` interface |

> **⚠️ Edge case found in audit:** `StepBuilder.ts` line 2 says `// Deterministic factory methods for all 14 Zip Agent node types.` — this count must be updated to `15`.

### Phase 1 Addendum: Update Count Comment

**Target File:** [`StepBuilder.ts`](file:///Users/dev/Projects/zip-ai-agent-builder/src/builders/StepBuilder.ts)
**Target Line:** Line 2.

```typescript
// Deterministic factory methods for all 15 Zip Agent node types.
```

---

### Phase 5: Update `tools.ts` Header Count

**Target File:** [`tools.ts`](file:///Users/dev/Projects/zip-ai-agent-builder/src/tools.ts)
**Target Line:** Line 1.
**Justification:** `tools.ts` line 1 reads `// src/tools.ts — Full rewrite implementing all 17 builder tools`. Actual tool count confirmed by source grep is **19** (14 node tools + initializeAgent + setCursor + compileAndSave + saveAgentPlan + readAgentPlan). The line 1 comment is already stale before this feature. Adding `addUpdateApprovalStep` makes the total **20**.

```typescript
// src/tools.ts — Full rewrite implementing all 20 builder tools
```

---

### Phase 6: Add `update_approval_node` to `KEY_PREFIX_MAP`

**Target File:** [`AgentBuilder.ts`](file:///Users/dev/Projects/zip-ai-agent-builder/src/builders/AgentBuilder.ts)
**Target Block:** After `get_vendor` at line 40, before the `// HTTP connector` comment at line 42.
**Justification:** Without this entry, `AgentBuilder.ts` L264 silently skips validation for `update_approval_node` (comment: "unknown action_key — skip, don't block unknown future node types"). This means any key name would be accepted. Adding the entry enforces the `zip_N` convention — the same prefix used by `get_request` and `get_vendor`.

```typescript
    // Zip connector
    "get_request": { prefix: "zip", example: "zip_1" },
    "get_vendor": { prefix: "zip", example: "zip_2" },
    "update_approval_node": { prefix: "zip", example: "zip_1" },  // ← ADD
```

---


## 4. Verification Plan

Build the equivalent of `Test Update Agent.task_template.json` using the CLI:

```
initializeAgent("Test Update Agent", "APPROVAL_ASSIST")
addApprovalTrigger("trigger", "AI Approval subtask")
addUpdateApprovalStep("zip_1", "Update approval node")
addReturnStep("return_1", "Return AI approval output", "steps.zip_1.response")
compileAndSave("test-update-agent")
```

> **Note on `return_1`:** The source JSON has `input_config: null` on `return_1`. `addReturnStep` always produces a non-null `input_config` via `StepBuilder.returnValue`. Exact reproduction of `return_1` from the source is not possible with the current toolset. The verification only compares `zip_1`.

Compare `output-agents/test-update-agent.json` step `zip_1` against the source JSON:

| Field | Expected | Must match |
|---|---|---|
| `connector_key` | `"zip"` | ✅ |
| `action_key` | `"update_approval_node"` | ✅ |
| `input_config` | `null` | ✅ |
| `connection_var_key` | `null` | ✅ |
| `error_handling_policy` | `1` | ✅ |
