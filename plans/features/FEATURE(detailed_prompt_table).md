# 🎨 FEATURE(detailed_prompt_table)

## 1. Objective
Ensure that the `Prompt / Logic` column in the planner's generated MDX "Node Flow Table" requires **DETAILED** prompt information rather than brief summaries, allowing for clear and understandable reviews during the planning process.

## 2. Phased Sections

### Phase 1: Enforce Detail in the Zod Schema (`PlanBuilder.ts`)
The `AgentPlanDraftSchema` currently defines `promptOrLogic: z.string()`. We must update this definition to explicitly instruct the LLM (via Zod's `.describe()`) that this field requires deep, comprehensive documentation of the prompt or execution logic. It must also be explicitly told that multi-line formatting (like newlines and bullet points) is perfectly safe and encouraged.

**Justification:** The LLM's structured output is heavily influenced by the Zod schema's `.describe()` metadata. Expanding the description directly at the schema level is the most effective way to organically steer the LLM's generation behavior. Telling the LLM that newlines are safe prevents it from lazily writing unreadable run-on sentences to "protect" the markdown table.

**Target File:** `src/builders/PlanBuilder.ts`
**Target Lines:** ~29
**Action & Code:**
```typescript
    promptOrLogic: z.string().describe(
        "DETAILED prompt information or execution logic. This MUST be comprehensive enough " +
        "for a human to fully understand the node's behavior during review. " +
        "Do NOT use brief 1-2 word summaries. Include required inputs, validation rules, " +
        "or exact prompt instructions. You MAY use newlines and bullet points for readability."
    ),
```

### Phase 2: Strengthen the Planner Prompt (`prompts/planner.ts`)
We need to add a strict rule to the `ZIP_PLANNER_PROMPT` emphasizing the requirement for detailed prompts in the Node Flow Table, reinforcing the schema change. 

**Justification:** While the Zod schema guides the output format, the system prompt sets the overriding behavioral directives. A dedicated rule ensures the planner understands *why* this column exists and prioritizes its detail during the drafting phase.

**Target File:** `src/prompts/planner.ts`
**Target Lines:** ~21
**Action & Code:**
```typescript
11. The "Prompt / Logic" column MUST be highly detailed. It is used for human review. Never use a 1-5 word summary. You must write out the comprehensive instructions or execution logic the node will follow. Do not compress this into a single line; use formatting if it helps readability.
12. You MUST generate the planDraft JSON exactly matching this schema:
```

***

## 3. Anti-Laziness & Anti-Overengineering Audit
- **Overengineering Check:** Are we introducing new parser complexity? No. This approach leverages the existing `z.describe` metadata and `ZIP_PLANNER_PROMPT` system instructions. Modifying these natively steers LLM generation without writing cumbersome post-processing regex or adding new file types. This perfectly mirrors existing patterns.
- **Laziness Check (The Edge Case):** If we tell the LLM to write massive, detailed prompts, and it uses newlines (`\n`), won't that completely destroy the layout of the MDX markdown table?
  - **Audit Finding:** I recursively audited `src/builders/PlanBuilder.ts` line 72: `const escapeTableCell = (value: string) => value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");`.
  - **Conclusion:** The MDX compiler *already* natively protects the table by translating `\n` into `<br>` HTML tags. Therefore, it is 100% safe for the LLM to generate massive, multi-line paragraph instructions for the prompt column. I explicitly updated Phase 1 & 2 to tell the LLM that formatting/newlines are allowed so it doesn't stubbornly produce unreadable single-line blobs!

## 4. Verification Plan
1. Edit `src/builders/PlanBuilder.ts` to update the `promptOrLogic` Zod description.
2. Edit `src/prompts/planner.ts` to add the new rule.
3. Run `npx tsc --noEmit` to verify type safety.
4. Execute the planner using the mock CLI or via a test script against an existing plan to observe the generation of a much longer, more detailed `Prompt / Logic` string natively.
