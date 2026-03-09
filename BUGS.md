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

## 3. Build Scripts Written to Project Root Instead of `build-agents/` [CRITICAL — RESOLVED]

**Timestamp:** 2026-03-08T11:29:02-04:00

**Symptom:** TypeScript build scripts generated at runtime by the Zip-Builder LLM appear at the project root (e.g. `/build-msa-sow-agent.ts`) instead of inside `build-agents/`.

**Root Cause:**
The `mastracode` package auto-injects a `write_file` tool into the harness (source: `chunk-FKCM2XJN.js`, `createWriteFileTool`, line 1307). This tool resolves paths relative to `process.cwd()` with no directory restrictions:
```
const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
```
When the LLM writes a build script as `write_file("build-msa-sow-agent.ts", content)`, it lands at `/project/build-msa-sow-agent.ts`. Our `BuildPipeline.ts` enforcement only covers the JSON output path — it never intercepted the `write_file` tool.

**Fix:** Override `write_file` in the `builderAgent` tools in `src/index.ts` with a path-guarding wrapper that forces `.ts` files into `build-agents/`. Also updated `ZIP_BUILDER_PROMPT` to mandate `build-agents/<filename>.ts` explicitly.

**Resolution Status:** Resolved.
