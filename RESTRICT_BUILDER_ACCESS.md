# Restrict Builder Access to Subagents Only

## Problem

The Copilot can bypass subagents and use builder tools directly, leading to errors from guessing parameters.

## Solution

Programmatically restrict access to only delegation tools.

---

## Implementation Options

### Option A: Filter exports in src/index.ts

```typescript
import { createAllZipTools } from './tools.js';

export function createZipTools(config: ZipBuilderConfig) {
  const allTools = createAllZipTools(config);
  
  return {
    subagent: allTools.subagent,
    submit_plan: allTools.submit_plan,
    ask_user: allTools.ask_user,
    readAgentPlan: allTools.readAgentPlan,
  };
}
```

### Option B: Add flag to src/tools.ts

```typescript
export function createZipTools(
  config: ZipBuilderConfig, 
  options: { restrictToSubagents?: boolean } = {}
) {
  const tools = {
    subagent: { ... },
    submit_plan: { ... },
    ask_user: { ... },
    readAgentPlan: { ... },
  };

  if (!options.restrictToSubagents) {
    Object.assign(tools, {
      initializeAgent: { ... },
      addApprovalTrigger: { ... },
      // ... all builder tools
    });
  }

  return tools;
}
```

---

## Tools to Remove (builder tools)

- initializeAgent
- addApprovalTrigger
- addGetRequestStep
- addGetVendorStep
- addAiStep
- addConditionStep
- addMemorySetStep
- addMemoryAppendStep
- addMemoryGetStep
- addReturnStep
- addJinjaStep
- addLoopStep
- addBreakStep
- addHttpStep
- addPythonStep
- setCursor
- compileAndSave

## Tools to Keep (delegation tools)

- subagent
- submit_plan
- ask_user
- readAgentPlan

---

## Alternative: System Prompt Rule

Add to instructions:
> "You must use the `subagent` tool to build agents. Never call builder tools directly."
