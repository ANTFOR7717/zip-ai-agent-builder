# PROMPT_PLAN.md - Subagent Enforcement Plan

## Problem Statement

Orchestrator bypasses subagents and generates directly, skipping validation guardrails.

**Root Cause:**
- Main agent has access to `listAgents`, `readAgent` tools
- Subagents have NO tools
- No system-level enforcement to use subagents

---

## Analysis

### Current Architecture (BROKEN)

```
Main Agent (orchestrator)
├── has: subagent, listAgents, readAgent, saveAgent
├── CAN access valid agents directly ✗
└── CAN bypass subagents ✗

Subagents (generator, validator, auditor)
├── have: NO tools
├── CANNOT read valid agents
└── CANNOT validate anything
```

### Key Mastra API Discovery

```typescript
HarnessSubagent {
  tools?: ToolsInput;           // Direct tools
  allowedHarnessTools?: string[];  // Subset of harness tools
}
```

This allows per-subagent tool access control.

---

## Solution: Tool Restriction Enforcement

### Target Architecture

```
Orchestrator
├── can: subagent tool, saveAgent
└── CANNOT: read valid agents directly (forced to use subagents)

Generator subagent
├── has: listAgents, readAgent
└── CAN read valid agents (to learn patterns)

Validator subagent
├── has: readAgent
└── CAN compare against schema

Auditor subagent
└── has: saveAgent (after passing validation)
```

---

## Code Changes

### File: src/index.ts

#### Tool Assignment Matrix (CORRECTED)

| Agent/Tool | subagent | listAgents | readAgent | saveAgent |
|------------|----------|------------|-----------|-----------|
| Orchestrator | ✓ | ✗ | ✗ | ✗ | (coordinates only, CANNOT save) |
| Generator | - | ✓ | ✓ | ✗ | (reads valid agents) |
| Validator | - | ✗ | ✓ | ✗ | (compares schema) |
| Auditor | - | ✗ | ✗ | ✓ | **ONLY agent that can save** |
| StepBuilder | - | ✗ | ✗ | ✗ |
| Composer | - | ✗ | ✗ | ✗ |
| Modifier | - | ✗ | ✗ | ✗ |
| IDManager | - | ✗ | ✗ | ✗ |

#### Change: Add allowedHarnessTools to subagents

**Before:**
```typescript
subagents: [
  { id: "orchestrator", instructions: ORCHESTRATOR_PROMPT, ... },
  { id: "generator", instructions: GENERATOR_PROMPT, ... },
  { id: "validator", instructions: VALIDATOR_PROMPT, ... },
  { id: "auditor", instructions: AUDITOR_PROMPT, ... },
  // others...
],
```

**After:**
```typescript
subagents: [
  { 
    id: "orchestrator", 
    instructions: ORCHESTRATOR_PROMPT, 
    allowedHarnessTools: ["subagent"]  // Can call subagents, CANNOT save
  },
  { 
    id: "generator", 
    instructions: GENERATOR_PROMPT, 
    allowedHarnessTools: ["listAgents", "readAgent"]  // Can read valid agents
  },
  { 
    id: "validator", 
    instructions: VALIDATOR_PROMPT, 
    allowedHarnessTools: ["readAgent"]  // Can compare
  },
  { 
    id: "auditor", 
    instructions: AUDITOR_PROMPT, 
    allowedHarnessTools: ["saveAgent"]  // ONLY agent that can save
  },
  // others with no tools...
],
```

#### Change 2: Keep extraTools but orchestrator restricted via allowedHarnessTools

```typescript
extraTools: tools,  // All tools available, but subagent allowedHarnessTools filters access
```

### File: src/prompts/orchestrator.ts

#### Change: Add strict enforcement language

**Before:**
```
## Workflow
1. User asks → delegate to generator
2. generator → validator
3. validator passes → auditor
4. auditor passes → MUST call saveAgent tool
```

**After:**
```
## MANDATORY WORKFLOW (NEVER DEVIATE)
1. User request → MUST call subagent "generator"
2. generator output → MUST call subagent "validator"
3. validator passes → MUST call subagent "auditor"
4. auditor passes → MUST call saveAgent tool

## FORBIDDEN
- Generate JSON directly - always use subagents
- Skip validator or auditor
- Call saveAgent without auditor passing
- Access valid agents directly - use generator subagent instead
```

---

## Tool Assignment Matrix

| Agent/Tool | subagent | listAgents | readAgent | saveAgent |
|------------|----------|------------|-----------|-----------|
| Orchestrator | ✓ | ✗ | ✗ | ✓ |
| Generator | - | ✓ | ✓ | ✗ |
| Validator | - | ✗ | ✓ | ✗ |
| Auditor | - | ✗ | ✗ | ✓ |
| StepBuilder | - | ✗ | ✗ | ✗ |
| Composer | - | ✗ | ✗ | ✗ |
| Modifier | - | ✗ | ✗ | ✗ |
| IDManager | - | ✗ | ✗ | ✗ |

---

## Expected Behavior

1. **User asks to create agent**
2. **Orchestrator MUST call "generator" subagent** (only way to read valid agents)
3. **Generator creates agent → returns to orchestrator**
4. **Orchestrator MUST call "validator" subagent** (can't validate itself)
5. **Validator checks → returns pass/fail**
6. **If pass → Orchestrator MUST call "auditor" subagent**
7. **Auditor validates strictly → if pass, Auditor calls saveAgent**
8. **File saved**

**Any deviation is now impossible:**
- Orchestrator can't save - only auditor can
- Orchestrator can't read valid agents - must use generator
- Orchestrator can't skip validation - must use validator + auditor

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/index.ts` | Add `allowedHarnessTools` to each subagent |
| `src/prompts/orchestrator.ts` | Add strict MANDATORY/FORBIDDEN language |

---

## Justification

| Change | Why |
|--------|-----|
| Remove listAgents/readAgent from main | Forces use of generator subagent |
| Add allowedHarnessTools per-subagent | Mastra-native way to restrict tools |
| Strict prompt language | Reinforces system-level enforcement |
| saveAgent only in orchestrator/auditor | Only save after full validation |
