# Known System Bugs & Limitations

## 1. Type Coercion Bug in `addMemoryAppendStep` [FIXED SYSTEMICALLY]
**Symptom:** AI output objects or arrays were being flattened into raw stringified JSON when appended to memory lists, preventing the Builder/Jinja node from iterating over or reading inner properties sequentially.

**Cause:** 
By design, earlier versions of `StepBuilder.memoryAppendToList(...)` checked if `valueRef` contained the syntax `${...}`. If it did, the AST implicitly compiled `control: "text"`.
When users wrote:
\`\`\`typescript
agent.addStep(StepBuilder.memoryAppendToList("mem_2", "Store", "my_list", "${steps.ai_2.output}"));
\`\`\`
The interpolation engine evaluated the variable as a string, coercing the nested structural output into a single text blob.

**Resolution / System Fix:**
This has been permanently fixed at the Engine layer inside `src/builders/StepBuilder.ts`.
Both `memoryAppendToList` and `memorySetValue` now include a dedicated regex trap `^\$\{([^}]+)\}$`. When the builder detects a variable explicitly encapsulated in a template literal without any surrounding text, it smartly unwraps it and statically bounds it to `control: "ref"`.
Users and Planner Agents can now safely use explicit string references `steps.ai_2.output` OR template boundaries `"${steps.ai_2.output}"` interchangeably without destroying memory array structures.

**Resolution Status:** Resolved.
**Timestamp:** 2026-03-06T21:19:00-05:00

## 2. Invalid Structured Schema Nesting [CRITICAL BUG INVESTIGATING]
**Symptom:** The AI generator produced raw JSON output for schema items inside `output_schema` and `structured_schema` using flat objects (e.g. `{ "key": "...", "type": "...", "description": "..." }`) instead of properly nesting them into `{ "control": "object", "value": { "key": ... } }`. When run in the Zip compiler, it maps to `null`.
**Cause:** 
The `makeSchemaArray` logic inside `src/tools.ts` tries to transform the array, but it fails to map properties correctly if the input fields differ or if the AI provides mismatched properties (missing type, etc).
**Resolution Status:** Resolved.
**Timestamp:** 2026-03-08T07:17:10-04:00
