# @zip/agent-builder-tui

A Type-Safe, programmable terminal user interface for rapidly building proprietary JSON-based Zip Agents powered by Mastracode AI.

## Global Installation (CLI)
```bash
npm install -g @zip/agent-builder-tui
```

Ensure your API keys (e.g., `KILO_API_KEY`) exist in your `.env` file at the root where you run the command.

```bash
# Start directly
zip-builder

# Configure overrides via Env
ZIP_OUTPUT_DIR="./custom-agents" ZIP_DEFAULT_MODEL="openai/gpt-4o" zip-builder
```

## Programmatic Library Usage
When imported programmatically, the tool initialization is decoupled from execution, allowing advanced configurations natively:

```typescript
import { createZipAgentBuilder, ZipBuilderOptions } from '@zip/agent-builder-tui';

const config: ZipBuilderOptions = {
  outputDir: './my-agents', // Outputs all json here
  defaultModelId: 'openai/gpt-4o',
  verbose: true,
  validAgentsDir: './project-assets/agents',
};

// Start safely
const { tui, harness } = createZipAgentBuilder(config);
await tui.run();
```
