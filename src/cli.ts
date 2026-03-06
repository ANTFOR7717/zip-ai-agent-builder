#!/usr/bin/env node
import 'dotenv/config'; // Auto-load API keys safely
import { createZipAgentBuilder } from "./index.js";

async function main() {
    // Gracefully translate string environments into programmatic defaults
    const rawConfig = {
        outputDir: process.env.ZIP_OUTPUT_DIR,
        defaultModelId: process.env.ZIP_DEFAULT_MODEL,
        verbose: process.env.ZIP_VERBOSE !== "false",
        validAgentsDir: process.env.ZIP_VALID_AGENTS_DIR,
    };

    try {
        const { tui, config } = createZipAgentBuilder(rawConfig);

        console.log(`🚀 Booting Zip Agent Builder (Model: ${config.defaultModelId}) [Output: ${config.outputDir}]`);

        // Mount terminal UI loop. If process is terminated, this loop unrolls safely.
        await tui.run();

    } catch (err) {
        console.error("\n❌ Fatal Error parsing config or launching terminal interface:");
        console.error(err instanceof Error ? err.stack : err);
        process.exit(1);
    }
}

// Global crash safety bounds
process.on('uncaughtException', (err) => {
    console.error('Unhandled Exception:', err);
    process.exit(1);
});

main();
