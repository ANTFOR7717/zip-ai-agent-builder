# My Responsibility - SR Principle

## What I Do

1. **Provide plan data** - Create nodeFlow and flowEdges in correct format
2. **Use helper functions** - addNodeRow, updateNodeRow, removeNodeRow
3. **Submit for approval** - submit_plan
4. **Execute via subagent** - Let subagent build the agent

## What I DON'T Do

- ❌ Manually write MDX files
- ❌ Manually construct markdown tables
- ❌ Worry about rendering/formatting
- ❌ Use builder tools directly

## Correct Workflow

1. Create/modify plan using helper functions
2. Submit for approval
3. Execute via subagent

---

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

## Planning Helper Functions

These functions manage the plan object programmatically. They handle node positioning and edge updates automatically.

### Functions (in src/planning/mdx-plan.ts)

```typescript
addNodeRow(planInput, nodeInput, { position?, edges? })
updateNodeRow(planInput, nodeId, patch, { edges? })
removeNodeRow(planInput, nodeId, { reconnectEdges? })
```

### Workflow

1. Read current plan from file
2. Use helper functions to modify (add/update/remove nodes)
3. Write updated plan back to file
4. Submit for approval

### Example Usage

```typescript
// Read plan
const plan = readPlanFile('plan-agents/msa-sow-reader-agent.mdx');

// Add node at position 6
const updated = addNodeRow(plan, {
  nodeId: 'ai_4',
  nodeType: 'generic_ai',
  nodeName: 'Validate',
  purpose: 'Validate SOW vs MSA',
  keysTypesValues: 'tools: [document, zip_data]',
  promptOrLogic: '6-point compliance check'
}, {
  position: 6,
  edges: [
    { from: 'ai_3', to: 'ai_4' },
    { from: 'ai_4', to: 'return_1' }
  ]
});

// Write back
writeFile('plan-agents/msa-sow-reader-agent.mdx', renderMdx(updated));
```

### Why Use These?

- Auto-updates flowEdges when nodes change
- Prevents duplicate nodeIds
- Validates positions
- Returns new plan (immutable)

---

## Alternative: System Prompt Rule

Add to instructions:
> "You must use the `subagent` tool to build agents. Never call builder tools directly."
