// src/index.ts — Programmatic Agent Builder (V5)
// Replaces the old 8-subagent architecture with a single Zip-Pilot that calls
// programmatic builder tools instead of generating raw JSON.

import { createMastraCode } from "mastracode";
import { MastraTUI } from "mastracode/tui";
import { parseConfig, ZipBuilderOptions, ZipBuilderConfig } from "./config.js";
import { createZipTools } from "./tools.js";
import { createTheme } from "./theme.js";
import { ZIP_PILOT_PROMPT } from "./prompts/index.js";

export type { ZipBuilderOptions, ZipBuilderConfig };
export { createTheme } from "./theme.js";

/**
 * Bootstraps the Zip Agent Builder harness with a single Zip-Pilot subagent.
 * Zip-Pilot receives all 17 builder tools and builds agents programmatically
 * rather than generating raw JSON through multi-agent prompt chains.
 */
export function createZipAgentBuilder(rawOptions: Partial<ZipBuilderOptions> = {}) {
    const config = parseConfig(rawOptions);

    createTheme();

    const tools = createZipTools(config);

    if (config.verbose) {
        console.log(
            `[INFO] Zip Agent Builder initialized. Model: ${config.defaultModelId}`
        );
    }

    const { harness } = createMastraCode({
        subagents: [
            {
                id: "zip-pilot",
                name: "Zip-Pilot",
                description:
                    "Translates user intent into Zip Agent JSON by calling programmatic builder tools. " +
                    "Builds agents accurately and deterministically without generating raw JSON.",
                instructions: ZIP_PILOT_PROMPT,
                defaultModelId: config.defaultModelId,
                // Zip-Pilot has access to all 17 builder tools
                allowedHarnessTools: [
                    "initializeAgent",
                    "addApprovalTrigger",
                    "addGetRequestStep",
                    "addGetVendorStep",
                    "addHttpStep",
                    "addAiStep",
                    "addConditionStep",
                    "addReturnStep",
                    "addJinjaStep",
                    "addLoopStep",
                    "addBreakStep",
                    "addMemorySetStep",
                    "addMemoryGetStep",
                    "addMemoryAppendStep",
                    "addPythonStep",
                    "setCursor",
                    "compileAndSave",
                ],
            },
        ],
        extraTools: tools,
        initialState: { currentModelId: config.defaultModelId },
    });

    const tui = new MastraTUI({
        harness,
        appName: "Zip Agent Builder",
        verbose: config.verbose,
    });

    return { harness, tui, config };
}
