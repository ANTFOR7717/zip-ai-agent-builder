# BUGS.md — Zip Agent Builder

Confirmed bugs found by auditing `examples/Valid-Agents/` and `output-agents/` against production JSON evidence. Each entry includes root cause, evidence, and a fix plan.

---

## Bug 1 — `if_condition` `left_value` hardcoded to `"ref"` but production also uses `"text"`

| | |
|---|---|
| **Bug Addressed** | 2026-03-06 13:45 EST (noted in BUGS.md after contract_analysis_agent.json audit) |
| **Bug Fixed** | 2026-03-06 13:47 EST (`src/builders/StepBuilder.ts` + `src/tools.ts`) |

### Symptom
When the Copilot calls `addConditionStep` with a left operand expressed in `${steps.x.y}` interpolation syntax, the generated JSON always emits `"control": "ref"` regardless — producing an invalid condition reference that tries to resolve `"${steps.ai_1.response.msaFound}"` as a literal path instead of interpolating it at runtime.

### Root Cause
`src/builders/StepBuilder.ts` L147 hardcodes `"ref"` unconditionally:
```typescript
left_value: { control: "ref", value: left_op },
```
Every other ref-type field in `StepBuilder` (`getRequest`, `getVendor`, `returnValue`, `memoryAppendToList`) applies an `isInterpolated` check. `condition.left_value` is the sole missing case.

### Cross-Agent Evidence — All 7 Valid-Agents Audited

| Agent | Line | `left_value` control | Value |
|---|---|---|---|
| `Duplicate supplier check agent` | L384 | `"ref"` | `"steps.ai_6.response.nameMatch"` |
| `Intake Validation Agent V2` | L380 | `"ref"` | `"steps.ai_4.response.value"` |
| `Adverse media research agent` | L344 | `"ref"` | `"steps.ai_6.response.matchFound"` |
| `[Kraken] Legal Risk Review` | L112 | `"ref"` | `"steps.ai_1.response.has_legal_docs"` |
| `PoC Zip Contract Review Agent` | L287 | `"ref"` | `"steps.ai_1.response.document_found"` |
| `PoC Zip Contract Review Agent` | L314 | `"ref"` | `"steps.ai_3.response.high_risk_found"` |
| **`contract_analysis_agent`** | **L188** | **`"text"`** | **`"${steps.ai_1.response.msaFound}"`** |
| **`contract_analysis_agent`** | **L492** | **`"text"`** | **`"${steps.ai_1.response.previousOrderFound}"`** |

**Conclusion:** Both controls are valid. 5 of 7 agents use bare path + `"ref"`. 1 of 7 agents uses `${}` interpolation + `"text"`. The `isInterpolated` check is the correct discriminator — identical to how all other ref-type fields work.

### Previous (Wrong) Assumption
The Pass 3/4 audit stated: *"left_value always uses `"ref"` control."* This was based on an incomplete set — `contract_analysis_agent.json` was not included in those passes.

### Fix Plan

**Only one line changes in `src/builders/StepBuilder.ts`.**

Remove the hardcoded `"ref"` on line 147 and apply the same `isInterpolated` check used everywhere else:

```diff
// src/builders/StepBuilder.ts — inside condition()

  static condition(key, name, left_op, operator, right_op) {
+   const leftControl = left_op.includes("${") ? "text" : "ref";
    const rightControl = ...;
    return {
      ...
      input_config: {
        control: "object",
        value: {
          conditions: {
            control: "array",
            value: [{
              control: "object",
              value: {
-               left_value: { control: "ref", value: left_op },
+               left_value: { control: leftControl, value: left_op },
                operator:   { control: "picklist", value: operator },
                right_value: { control: rightControl, value: right_op },
              }
            }]
          }
        }
      },
      branches: null,
    };
  }
```

**No other files need changes.** The tool parameter description for `addConditionStep` in `src/tools.ts` already correctly says `"left must always be a bare step ref (no ${})."` — that instruction should be updated to clarify both syntaxes are allowed:

```diff
// src/tools.ts — addConditionStep parameters.left describe()
- .describe("Left operand — always a bare step ref: 'steps.ai_1.response.found'")
+ .describe("Left operand — bare path 'steps.ai_1.response.found' → ref control. ${} syntax '${steps.ai_1.response.found}' → text control.")
```

### Verification After Fix
Build should still pass (`tsc --noEmit` + `npm run build`). The fix is a one-liner with no new imports or interface changes.

---

## Bug 2 — `structuredSchema` items passed as flat objects instead of fully-wrapped control objects

| | |
|---|---|
| **Bug Addressed** | 2026-03-06 13:45 EST (noted in BUGS.md after contract_analysis_agent.json audit) |
| **Bug Fixed** | 2026-03-06 13:47 EST (`src/tools.ts` — `makeSchemaArray` helper added) |

### Symptom
When the Copilot calls `addAiStep` with a `structuredSchema` array, it passes objects like:
```json
{ "key": "msaFound", "type": "boolean", "description": "MSA found flag" }
```
`StepBuilder.genericAi()` passes these directly into the `structured_schema` array value with no wrapping. The resulting JSON looks like:
```json
"structured_schema": {
  "control": "array",
  "value": [
    { "key": "msaFound", "type": "boolean", "description": "MSA found flag" }
  ]
}
```
This is **wrong**. Production requires each item in the `structured_schema` array to be a fully-wrapped control object.

### Root Cause
`StepBuilder.genericAi()` emits:
```typescript
structured_schema: { control: "array", value: opts.structuredSchema }
```
`opts.structuredSchema` is typed `any[]` and the Zod schema in `tools.ts` accepts `{ key, type, description }` plain objects. There is no materialization step that wraps each item in the production control shape.

The `addJinjaStep` and `addPythonStep` tools correctly use a `makeVarsArray()` helper to materialize control wrappers. `addAiStep` has no equivalent.

### Production Evidence
`contract_analysis_agent.json` L77-165 — every `structured_schema` item is:
```json
{
  "control": "object",
  "value": {
    "key":         { "control": "text",     "value": "msaFound" },
    "description": { "control": "text",     "value": "Boolean indicating if MSA was found" },
    "type":        { "control": "picklist", "value": "boolean" }
  }
}
```
This exact shape appears on every single schema field across all `structured_schema` arrays in all 7 Valid-Agents. The `type` field uses `"picklist"` (not `"text"`). The flat object shape the Copilot emits does not appear anywhere in production.

### Fix Plan

**Step 1 — Add a `makeSchemaArray()` helper to `tools.ts`** (parallel to `makeVarsArray`):
```typescript
const makeSchemaArray = (fields: Array<{ key: string; type: string; description: string }>) =>
  fields.map((f) => ({
    control: "object",
    value: {
      key:         { control: "text",     value: f.key },
      description: { control: "text",     value: f.description },
      type:        { control: "picklist", value: f.type },
    },
  }));
```

**Step 2 — Apply `makeSchemaArray()` in `addAiStep.execute`** before passing to StepBuilder:
```typescript
execute: async (p: any) =>
  run(() =>
    activeBuilder!.addStep(
      StepBuilder.genericAi(p.key, p.name, p.prompt, {
        ...
        structuredSchema: p.structuredSchema ? makeSchemaArray(p.structuredSchema) : undefined,
        outputSchema:     p.outputSchema     ? makeSchemaArray(p.outputSchema)     : undefined,
      })
    )
  ),
```

**Step 3 — `StepBuilder.genericAi()` stays unchanged** — it already wraps in `{ control: "array", value: ... }`. The fix lives entirely in the tool layer.

**Files to modify:** `src/tools.ts`

---

## Bug 3 — Copilot laziness: "Same as `ai_6`" placeholder generation

| | |
|---|---|
| **Bug Addressed** | 2026-03-06 13:45 EST (noted in BUGS.md, identified as behavioral) |
| **Bug Fixed** | 2026-03-06 13:47 EST (`src/prompts/copilot.ts` — stale left_value rule corrected, anti-placeholder section added) |

### Symptom
The Copilot sometimes produces abbreviated or placeholder user_prompt values like `"Same as ai_6."` instead of writing the actual prompt content. This is a Copilot behavior problem, not a StepBuilder bug — the builder would faithfully emit whatever string is passed to it.

This happens because the Copilot's context window for long agents gets loaded with many prior tool calls, and the model shortcuts repetitive work.

### Root Cause
The Copilot prompt (`src/prompts/copilot.ts`) does not explicitly prohibit shorthand or placeholder values. The model is not instructed to always write complete, literal `user_prompt` values for every step — even when steps seem structurally similar to previous ones.

### Fix Plan
Add an explicit rule to the Copilot prompt forbidding placeholder or abbreviated values:

```typescript
// In COPILOT_PROMPT, under the ## addAiStep opts Guidelines section:
"CRITICAL: Never use placeholder values or descriptions like 'Same as ai_6' in user_prompt. " +
"Every prompt must be written in full. Each step's prompt is unique and must be complete. " +
"Copying or referencing prior steps is not acceptable."
```

**Files to modify:** `src/prompts/copilot.ts`

---

---

## Bug 4 — Copilot uses descriptive step key names instead of the required `type_N` naming convention

| | |
|---|---|
| **Bug Addressed** | 2026-03-06 14:14 EST (discovered in `output-agents/full-node-demo-agent.json` audit) |
| **Bug Fixed** | 2026-03-06 14:28 EST (`src/builders/AgentBuilder.ts` — `KEY_PREFIX_MAP` + `validateKey()` + `AgentBuilderOptions.strictKeyNames`; `src/tools.ts` — `initializeAgent` threaded) |

### Symptom
Output agents use freeform descriptive key names like `"get_request"`, `"analyze_data"`, `"main_loop"`, `"fetch_vendor_data"` instead of the production naming convention (`zip_1`, `ai_1`, `loop_1`, etc.). This makes step cross-references inconsistent with the schema every Valid-Agent follows and diverges from the documented naming conventions in the Copilot prompt.

### Evidence — `output-agents/full-node-demo-agent.json` Full Key Audit

| Step Key in Output | Correct Key | connector_key | action_key |
|---|---|---|---|
| `"get_request"` | `"zip_1"` | `zip` | `get_request` |
| `"get_vendor"` | `"zip_2"` | `zip` | `get_vendor` |
| `"fetch_vendor_data"` | `"http_1"` | `http` | `$http_client` |
| `"init_status"` | `"mem_1"` | `memory_storage` | `set_value` |
| `"init_items"` | `"mem_2"` | `memory_storage` | `set_value` |
| `"main_loop"` | `"loop_1"` | `loop` | `loop_n_times` |
| `"get_current_status"` | `"mem_3"` | `memory_storage` | `get_value` |
| `"check_status"` | `"cond_1"` | `condition` | `if_condition` |
| `"append_item"` | `"mem_4"` | `memory_storage` | `append_to_list` |
| `"break_loop"` | `"break_1"` | `loop` | `break_loop` |
| `"get_items"` | `"mem_5"` | `memory_storage` | `get_value` |
| `"analyze_data"` | `"ai_1"` | `ai` | `generic_ai` |
| `"process_data"` | `"python_1"` | `python` | `execute_script` |
| `"generate_report"` | `"jinja_1"` | `jinja` | `render_json_template` |
| `"return_result"` | `"return_1"` | `return` | `return_value` |

**All 15 non-trigger steps use wrong key names.** None follow the `type_N` convention.

### Root Cause
The Copilot prompt's Naming Conventions section lists the correct prefixes but the instruction is too weak — it says "Use these prefixes" without making compliance mandatory or providing an example of what a violation looks like. The model falls back to descriptive names because they feel more readable.

### Fix Plan
Update the **Naming Conventions** section in `src/prompts/copilot.ts` to make the rule unambiguous and add a violation example:

```diff
 ## Naming Conventions

-Use these prefixes for step IDs, matching production agent patterns:
+Step IDs MUST follow the type_N format below. Descriptive names like
+"fetch_vendor_data", "analyze_data", "main_loop" are WRONG and FORBIDDEN.
+Use ONLY these prefixes, incrementing N from 1:
 - ai_1, ai_2 → generic_ai steps
 ...
```

**Files to modify:** `src/prompts/copilot.ts`

---

### Secondary Bugs Also Discovered in `full-node-demo-agent.json`

These are additional bugs co-discovered during the key naming audit. They are related but distinct enough to note separately.

#### 4a — Python/Jinja `variables` items not control-wrapped

`output-agents/full-node-demo-agent.json` L281-285 (`process_data` execute_script):
```json
"variables": {
  "control": "array",
  "value": [
    { "key": "analysis", "value": "steps.analyze_data.output" }
  ]
}
```
Each item is a raw `{ key, value }` flat object. Production requires the full control-wrapped shape (same wrapping that `makeVarsArray()` produces):
```json
{ "control": "object", "value": { "key": { "control": "text", "value": "analysis" }, "value": { "control": "ref", "value": "steps.ai_1.output" } } }
```
This means the Copilot is **bypassing `makeVarsArray()`** — likely by inlining the array directly rather than using the tool's `vars` parameter.

**Same issue appears at L308-315 in the Jinja step.**

**Fix:** The Copilot prompt must explicitly instruct the model to always use the tool's `vars: [{key, valueRef}]` parameter and never construct raw variable arrays inline.

#### 4b — Wrong trigger reference path

`output-agents/full-node-demo-agent.json` L27: `"${trigger.request_id}"`

Production path is `"${steps.trigger.request.id}"`. The `trigger.` prefix without `steps.` is not valid.

**CITED:** `contract_analysis_agent.json` L31: `"${steps.trigger.request.id}"`, `PoC` L49: `"${steps.trigger.request.id}"`

**Fix:** Update the `addGetRequestStep` description in `src/tools.ts` to give the canonical reference path explicitly, and add an example to the Copilot prompt.

#### 4c — Missing `trigger` step in `steps_data`

`output-agents/full-node-demo-agent.json` has no `approval_assist` entry in `steps_data` — the Copilot may have omitted `addApprovalTrigger`, or it was called but not registered because the guard in `AgentBuilder.addStep()` correctly blocks the trigger from `workflowRoot` but still requires it to be called. Without calling `addApprovalTrigger`, the trigger step is absent from `steps_data` entirely.

**Fix:** The Copilot prompt already says "call immediately after initializeAgent" — but this should be strengthened to a hard constraint with a note that skipping it produces invalid JSON.

---

## Bug 5 — Zip-Pilot hallucinates step output schema paths

| | |
|---|---|
| **Bug Addressed** | 2026-03-06 14:55 EST (observed in `output-agents/all-nodes-demo-agent.json`) |
| **Bug Fixed** | 2026-03-06 14:55 EST (`src/prompts/zip-pilot.ts` — no-hallucination rule added to Reference Syntax Rules) |

### Symptom
Zip-Pilot invents sub-field paths on step outputs it has no knowledge of. For example:
```
\${steps.zip_1.body.id}
```
The Zip-Pilot does not know the response schema of `zip_1` (or any other step). `.body.id` is fabricated. At runtime these paths resolve to `undefined` or throw, producing silently broken agents.

### Root Cause
The prompt's Reference Syntax Rules section teaches *how* to write refs (`${steps.x.y}` vs bare path) but says nothing about *what* Zip-Pilot is allowed to put in the path. With no constraint, the model fills in plausible-sounding field names from its training data rather than deferring to the user.

### Fix Plan
Add an explicit rule to the **Reference Syntax Rules** section in `src/prompts/zip-pilot.ts`:
```
NEVER invent sub-field paths on step outputs. You do not know the response
schema of any step. Use only paths explicitly provided by the user.
If a path is unknown, write the ref as steps.step_key (stopping at the step key)
and add a comment in your response asking the user to supply the exact field path.
```

**Files to modify:** `src/prompts/zip-pilot.ts`

---

## Summary

| # | Bug | Location | Severity | Status |
|---|---|---|---|---|
| 1 | `left_value` hardcoded to `"ref"`, ignores `${}` syntax | `src/builders/StepBuilder.ts` L147 | 🔴 **Blocking** | ✅ Fixed 2026-03-06 13:47 EST |
| 2 | `structuredSchema` items not wrapped in production control shape | `src/tools.ts` addAiStep execute | 🔴 **Blocking** | ✅ Fixed 2026-03-06 13:47 EST |
| 3 | Zip-Pilot emits placeholder `user_prompt` values | `src/prompts/zip-pilot.ts` | 🟡 **Behavioral** | ✅ Fixed 2026-03-06 13:47 EST |
| 4 | Zip-Pilot uses descriptive key names instead of `type_N` convention | `src/builders/AgentBuilder.ts` + `src/tools.ts` | 🔴 **Blocking** | ✅ Fixed 2026-03-06 14:28 EST |
| 4a | Python/Jinja `variables` not control-wrapped (bypasses `makeVarsArray`) | `src/prompts/zip-pilot.ts` | 🔴 **Blocking** | 🔲 Open |
| 4b | Wrong trigger reference path (`trigger.request_id` vs `steps.trigger.request.id`) | `src/prompts/zip-pilot.ts` | 🔴 **Blocking** | ✅ Fixed 2026-03-06 14:36 EST |
| 4c | Missing `approval_assist` in `steps_data` | `src/prompts/zip-pilot.ts` | 🔴 **Blocking** | ✅ Fixed 2026-03-06 14:36 EST |
| 5 | Zip-Pilot hallucinates step output sub-field paths | `src/prompts/zip-pilot.ts` | 🔴 **Blocking** | ✅ Fixed 2026-03-06 14:55 EST |
