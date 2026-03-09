# FEATURE: Split "Keys / Types / Values" Column — Give Types Its Own Column

## Objective

The current "Keys / Types / Values" column packs keys, types, AND values into a single freeform string (`keysTypesValues`). Split it: **"Types"** gets its own dedicated column. The existing column becomes **"Keys / Values"** only.

---

## Audit Findings

**Current `PlanNodeSchema`** (L18–26):
- `keysTypesValues: z.string()` — single freeform string for all three concerns

**Current `renderNodeFlowTable`** (L200–208):
- Header: `"| ... | Keys / Types / Values | Prompt / Logic |"`
- Row: `${escapeTableCell(node.keysTypesValues)}`

**What changes:**
- Column header `"Keys / Types / Values"` → `"Keys / Values"`
- New column `"Types"` added to the right of `"Keys / Values"`
- New `types: z.string().optional()` field added to `PlanNodeSchema` (optional to prevent hallucination for void nodes)
- Row renderer emits both fields, with fallback `?? "—"` for missing types

---

## Proposed Changes

### `src/builders/PlanBuilder.ts`

#### Edit 1 — Update `PlanNodeSchema` (lines 18–26)

Add `types` field:

```typescript
// REPLACE lines 18-26:
const PlanNodeSchema = z.object({
    nodeType: z.string().describe("Business-level category (e.g., trigger, ai, condition)"),
    nodeName: z.string(),
    nodeId: PlanNodeIdSchema,
    purpose: z.string(),
    keysTypesValues: z.string(),
    types: z.enum([
        "string",
        "number",
        "boolean",
        "object",
        "array",
        "null"
    ]).optional().describe(
        "The strict JSON type of the output payload. " +
        "Required for compiling the final JSON template. " +
        "Leave undefined for void nodes."
    ),
    promptOrLogic: z.string(),
});
```


#### Edit 2 — Update `renderNodeFlowTable` (lines 200–208)

```typescript
// REPLACE lines 200-208:
function renderNodeFlowTable(plan: AgentPlanDraft): string {
    return renderSection(SECTION_TITLES.nodeFlow, [
        "| Node Type | Node Name | Node ID | Purpose | Keys / Values | Types | Prompt / Logic |",
        "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
        ...plan.nodeFlow.map((node) =>
            `| ${escapeTableCell(node.nodeType)} | ${escapeTableCell(node.nodeName)} | \`${escapeTableCell(node.nodeId)}\` | ${escapeTableCell(node.purpose)} | ${escapeTableCell(node.keysTypesValues)} | ${escapeTableCell(node.types ?? "—")} | ${escapeTableCell(node.promptOrLogic)} |`
        ),
    ]);
}
```

---

### `src/prompts/planner.ts`

```typescript
// REPLACE line 13:
// OLD: "...filling in the Keys / Types / Values and Prompt / Logic columns."
// NEW:
"3. Make the Node Flow Table detailed enough for the Builder by filling in the Keys / Values, Types, and Prompt / Logic columns."

// REPLACE line 25:
// OLD: "    - nodeFlow (array of { ..., keysTypesValues, promptOrLogic })"
// NEW:
"    - nodeFlow (array of { nodeType, nodeName, nodeId, purpose, keysTypesValues, types?, promptOrLogic })"
```

---

### `src/prompts/builder.ts`

```typescript
// REPLACE line 6:
// OLD: "...especially the Keys / Types / Values and Prompt / Logic columns."
// NEW:
"3. Use the Node Flow Table as the primary build contract, especially the Keys / Values, Types, and Prompt / Logic columns."
```

---

## Verification

Generated MDX table should render as:

| Node Type | Node Name | Node ID | Purpose | Keys / Values | Types | Prompt / Logic |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| trigger | Approval assist | trigger | Receive request | request.id | string | N/A |
| ui | Display Form | ui_1 | Show screen | | — | Render component |
| ai | Risk analysis | ai_1 | Score vendor | response.score | object | Analyze the vendor... |
