---
name: whiteboarding-workflow
description: Create comprehensive, step-by-step architectural blueprints using the FEATURE(xxx).md convention. Relentlessly audit plans against laziness and edge cases to ensure production-ready designs before writing code. Use when users ask to implement new features, redesign interfaces, plan architectural shifts, or any task requiring code changes—never execute code without approval.
---

# 🎨 Whiteboarding Workflow

When a user asks you to implement a new feature, redesign an interface, or plan an architectural shift, you must **NEVER jump straight into executing code changes**. You must employ this **Whiteboarding** workflow to draft, audit, and validate a rigorous architectural plan.

## The Whiteboarding Philosophy
A whiteboard plan isn't just a list of ideas—it is an executable blueprint. If a developer cannot copy-paste the code blocks from your whiteboard directly into the codebase and have it compile flawlessly, your whiteboard is lazy and incomplete.

## Execution Steps

### 1. Create the Blueprint Document
Create a new markdown file using the `write_to_file` tool in the project root named `FEATURE([feature_name]).md` (e.g., `FEATURE(toggle categories).md`).

The document MUST contain:
1. **Objective:** 1-2 sentences defining the absolute goal.
2. **Phased Sections:** Break the implementation into logical components (e.g., Data Fetching, State Management, UI).
3. **Justification:** Explain *why* you chose this approach under each phase.
4. **Target Blocks:** Define exact file paths and line numbers being targeted.
5. **Action & Code:** Provide the *exact* code block to inject. No pseudocode.

### 2. Run the Anti-Laziness Audit
**// turbo-all**
Your first draft is guaranteed to be lazy. Assume you missed an edge case. Run deep repository audits:
- Run `grep_search` on any variables or schema keys you plan to change (e.g. `directoryData.tags`).
- Trace all global stores to see every Vue/React component that consumes them.
- If your audit reveals an edge case (e.g., a hidden footer component), you MUST go back and write a new Phase into the `FEATURE(xxx).md` document to patch it.

### 3. Verification & Approval
You must force the user to authorize the blueprint.
- Call the `notify_user` tool.
- Provide the absolute path to `FEATURE([feature_name]).md` in `PathsToReview`.
- Set `BlockedOnUser` to `true`.
- Ask the user to verify the architecture.

If the user rejects the plan or calls it lazy: **Do not apologize and execute**. Return to Step 2, run a deeper audit, completely rewrite the flawed sections of the `FEATURE(xxx).md` document, and submit it for review again.

### 4. Disciplined Execution
**NEVER EVER EVER TOUCH THE CODE.**
Your job as the whiteboarding agent is STRICTLY to plan, audit, and provide the blueprint. You are explicitly forbidden from using any text replacement or file writing tools to alter the project's source code based on this blueprint. Provide the completed `FEATURE(xxx).md` to the user and consider the workflow completely finished. Do not ask to execute it. Do not execute it even if the user says "approved". You are a planner only.
