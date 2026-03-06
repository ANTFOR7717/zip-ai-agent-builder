import { createMastraCode } from "mastracode";
import { MastraTUI } from "mastracode/tui";
import { parseConfig, ZipBuilderOptions, ZipBuilderConfig } from "./config.js";
import { createZipTools } from "./tools.js";
import { createTheme } from "./theme.js";

import { ORCHESTRATOR_PROMPT } from "./prompts/orchestrator.js";
import { VALIDATOR_PROMPT } from "./prompts/validator.js";
import { GENERATOR_PROMPT } from "./prompts/generator.js";
import { STEPBUILDER_PROMPT } from "./prompts/stepBuilder.js";
import { COMPOSER_PROMPT } from "./prompts/composer.js";
import { MODIFIER_PROMPT } from "./prompts/modifier.js";
import { AUDITOR_PROMPT } from "./prompts/auditor.js";
import { IDMANAGER_PROMPT } from "./prompts/idManager.js";

export type { ZipBuilderOptions, ZipBuilderConfig };
export { createTheme } from "./theme.js";

/**
 * Validates config, mounts dependencies, and bootstraps the Mastra harness and TUI.
 */
export function createZipAgentBuilder(rawOptions: Partial<ZipBuilderOptions> = {}) {
    const config = parseConfig(rawOptions);

    // Apply the custom Zip Builder theme
    createTheme();

    const tools = createZipTools(config);

    if (config.verbose) {
        console.log(`[INFO] Initializing Mastra Code Harness with model: ${config.defaultModelId}`);
    }

    const { harness } = createMastraCode({
        subagents: [
            {
                id: "orchestrator",
                name: "Orchestrator",
                description: "Coordinates subagents to build Zip agents",
                instructions: ORCHESTRATOR_PROMPT,
                defaultModelId: config.defaultModelId,
                allowedHarnessTools: ["subagent"]  // Can call subagents, CANNOT save
            },
            {
                id: "validator",
                name: "Validator",
                description: "Validates agent JSON against schema",
                instructions: VALIDATOR_PROMPT,
                defaultModelId: config.defaultModelId,
                allowedHarnessTools: ["readAgent"]  // Can compare against schema
            },
            {
                id: "generator",
                name: "Generator",
                description: "Creates new Zip agent JSON",
                instructions: GENERATOR_PROMPT,
                defaultModelId: config.defaultModelId,
                allowedHarnessTools: ["listAgents", "readAgent"]  // Can read valid agents
            },
            {
                id: "stepBuilder",
                name: "Step Builder",
                description: "Builds individual step definitions",
                instructions: STEPBUILDER_PROMPT,
                defaultModelId: config.defaultModelId
            },
            {
                id: "composer",
                name: "Composer",
                description: "Assembles steps into workflows",
                instructions: COMPOSER_PROMPT,
                defaultModelId: config.defaultModelId
            },
            {
                id: "modifier",
                name: "Modifier",
                description: "Modifies existing agents",
                instructions: MODIFIER_PROMPT,
                defaultModelId: config.defaultModelId
            },
            {
                id: "auditor",
                name: "Auditor",
                description: "Strict validation of generated agents",
                instructions: AUDITOR_PROMPT,
                defaultModelId: config.defaultModelId,
                allowedHarnessTools: ["saveAgent"]  // ONLY agent that can save
            },
            {
                id: "idManager",
                name: "ID Manager",
                description: "Manages step ID patterns",
                instructions: IDMANAGER_PROMPT,
                defaultModelId: config.defaultModelId
            },
        ],
        extraTools: tools,
        initialState: { currentModelId: config.defaultModelId },
    });

    // Subagent tool is always needed - tools access controlled via allowedHarnessTools
    harness.grantSessionTool("subagent");

    // Create (but do not automatically run) the TUI
    const tui = new MastraTUI({
        harness,
        appName: "Zip Agent Builder",
        verbose: config.verbose,
    });

    return { harness, tui, config }; // Export the config back to the consumer
}
