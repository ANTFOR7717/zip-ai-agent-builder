# 🎨 Optimized `structured_schema` Enforcement

## Objective
Provide a 100% computational guarantee that the Zip AST `structured_schema` is correctly formed. To do this, we must completely eliminate the Builder LLM's responsibility to format Schema JSON arrays. Instead, the `addAiStep` tool will accept raw comma-separated parameters directly from the MDX tables, and `StepBuilder.ts` will programmatically split and zip the arrays together into the exact required AST format.

## Phase 1: Engine Parsing (StepBuilder.ts)
### Justification
If the LLM is expected to construct the `structured_schema` array manually, it can hallucinate incorrect properties, invalid Zod shapes, or omit the array entirely. By moving the array construction into the deterministic TypeScript environment of `StepBuilder`, we algorithmically enforce that every property gets the exact primitive format required by the Zip backend.

### Target Block 1: `src/builders/StepBuilder.ts` (opts definition)
**Action & Code:**
Modify the `genericAi` signature to accept raw strings.
```typescript
            arraySchema?: boolean;
            structuredSchemaKeys?: string;  // e.g. "msa_found, sow_found"
            structuredSchemaTypes?: string; // e.g. "boolean, boolean"
            structuredSchema?: any[]; // Legacy override
```

### Target Block 2: `src/builders/StepBuilder.ts` (array computation)
**Action & Code:**
Inside `genericAi`, right before returning the `ZipStep`, write a strictly typed parser to zip the keys and types together.

```typescript
    static genericAi(key: string, name: string, userPrompt: string, opts?: { /*...*/ }): ZipStep {
        // Enforce 100% Guaranteed Schema parsing
        if (opts?.structuredSchemaKeys && opts?.structuredSchemaTypes && !opts.structuredSchema) {
            const keys = opts.structuredSchemaKeys.split(",").map(k => k.trim()).filter(Boolean);
            const types = opts.structuredSchemaTypes.split(",").map(t => t.trim().toLowerCase());
            
            opts.structuredSchema = keys.map((k, index) => {
                const parsedType = types[index] || "string";
                const safeType = ["string", "number", "boolean", "object", "array", "null"].includes(parsedType) 
                    ? parsedType 
                    : "string"; // 100% guarantee no invalid Zip UI strings crash the app

                return {
                    key: k,
                    type: safeType,
                    description: \`Output field for \${k}\` 
                };
            });
            
            opts.outputFormat = "structured"; // Force format to prevent mismatch
        }
        
        // ... return statement
```

## Phase 2: Tool Simplification (tools.ts)
### Justification
The Zod schema for the `addAiStep` tool currently demands an array of objects. We must remove this and replace it with direct string parameters so the LLM is forced to treat them as basic text passthroughs from the MDX plan.

### Target Block 1: `src/tools.ts`
Modify the Zod object in `addAiStep` to ingest raw columns.

**Action & Code:**
```diff
-                structuredSchema: z
-                    .array(
-                        z.object({
-                            key: z.string(),
-                            type: z.string(),
-                            description: z.string(),
-                        })
-                    )
-                    .optional()
-                    .describe("Schema fields for structured output."),
+                structuredSchemaKeys: z
+                    .string()
+                    .optional()
+                    .describe("EXACT copy-paste of the text in the MDX 'Keys / Values' column."),
+                structuredSchemaTypes: z
+                    .string()
+                    .optional()
+                    .describe("EXACT copy-paste of the text in the MDX 'Types' column."),
```

Update the execution wrapper to proxy the strings:
```diff
                             model: p.model,
-                            structuredSchema: p.structuredSchema,
+                            structuredSchemaKeys: p.structuredSchemaKeys,
+                            structuredSchemaTypes: p.structuredSchemaTypes,
                             outputSchema: p.outputSchema,
```

## Phase 3: Prompt Update (builder.ts)
### Justification
The Builder LLM needs to be told about the new tool parameters so it knows where to plug the strings.

### Target Block 1: `src/prompts/builder.ts`
**Action & Code:**
```diff
-3. Use the Node Flow Table as the primary build contract, especially the Keys / Values, Types, and Prompt / Logic columns.
+3. Use the Node Flow Table as the primary build contract. When building AI nodes, map the "Keys / Values" and "Types" columns explicitly into the \`structuredSchemaKeys\` and \`structuredSchemaTypes\` parameters.
```

## Anti-Laziness Audit
- **LLM Error Boundary Check:** What if the LLM passes "a, b" for keys but only "string" for types? The index matcher (`types[index] || "string"`) prevents a crash and defaults the second key to string.
- **Is `description` strictly required?** Yes, Zip backend AST requires `description`. By injecting `\`Output field for \${k}\``, we bypass the need for hallucinated LLM text, ensuring the form renders correctly.
- **Does it enforce `outputFormat: "structured"`?** Yes, the parser automatically guarantees `outputFormat = "structured"` if keys are extracted, meaning the LLM cannot accidentally leave it as "raw" or undefined.
