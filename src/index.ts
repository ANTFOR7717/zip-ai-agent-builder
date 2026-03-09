// src/index.ts — Programmatic Agent Builder (V5)
// Replaces the old 8-subagent architecture with a single Zip-Pilot that calls
// programmatic builder tools instead of generating raw JSON.

import { createMastraCode } from "mastracode";
import { MastraTUI } from "mastracode/tui";
import { Agent } from "@mastra/core/agent";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { parseConfig, ZipBuilderOptions, ZipBuilderConfig } from "./config.js";
import { createZipTools } from "./tools.js";
import { createTheme } from "./theme.js";
import { ZIP_BUILDER_PROMPT, ZIP_PLANNER_PROMPT } from "./prompts/index.js";

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

    const builderAgent = new Agent({
        id: "zip-builder",
        name: "Zip-Builder",
        instructions: ZIP_BUILDER_PROMPT,
        model: config.defaultModelId,
        tools: {
            // ── Path-guarding write_file override ──────────────────────────
            // mastracode auto-injects write_file with no directory enforcement.
            // This override forces .ts build scripts into build-agents/ at the
            // agent tool level before the framework can inject its own version.
            write_file: {
                name: "write_file",
                description:
                    "Write a file to disk. TypeScript build scripts MUST use a path " +
                    "starting with 'build-agents/' (e.g. 'build-agents/build-my-agent.ts'). " +
                    "Plan files use saveAgentPlan instead.",
                parameters: z.object({
                    path: z.string().describe("File path relative to project root"),
                    content: z.string().describe("File content to write"),
                }).shape,
                execute: async ({ path: filePath, content }: { path: string; content: string }) => {
                    try {
                        const normalized = filePath.replace(/\\/g, "/");
                        // Hard-enforce: .ts files must live in build-agents/
                        const enforced =
                            normalized.endsWith(".ts") && !normalized.startsWith("build-agents/")
                                ? `build-agents/${path.basename(normalized)}`
                                : normalized;
                        const absolutePath = path.isAbsolute(enforced)
                            ? enforced
                            : path.join(process.cwd(), enforced);
                        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
                        await fs.writeFile(absolutePath, content, "utf-8");
                        return { success: true, filepath: absolutePath };
                    } catch (e) {
                        return { success: false, error: (e as Error).message };
                    }
                },
            },
            // ── Builder tools ───────────────────────────────────────────────
            initializeAgent: tools.initializeAgent,
            addApprovalTrigger: tools.addApprovalTrigger,
            addGetRequestStep: tools.addGetRequestStep,
            addGetVendorStep: tools.addGetVendorStep,
            addHttpStep: tools.addHttpStep,
            addAiStep: tools.addAiStep,
            addConditionStep: tools.addConditionStep,
            addReturnStep: tools.addReturnStep,
            addJinjaStep: tools.addJinjaStep,
            addLoopStep: tools.addLoopStep,
            addBreakStep: tools.addBreakStep,
            addMemorySetStep: tools.addMemorySetStep,
            addMemoryGetStep: tools.addMemoryGetStep,
            addMemoryAppendStep: tools.addMemoryAppendStep,
            addPythonStep: tools.addPythonStep,
            setCursor: tools.setCursor,
            compileAndSave: tools.compileAndSave,
            readAgentPlan: tools.readAgentPlan
        }
    });

    const plannerAgent = new Agent({
        id: "zip-planner",
        name: "Zip-Planner",
        instructions: ZIP_PLANNER_PROMPT,
        model: config.defaultModelId,
        tools: {
            saveAgentPlan: tools.saveAgentPlan,
            readAgentPlan: tools.readAgentPlan
        }
    });

    const { harness } = createMastraCode({
        modes: [
            { id: "build", name: "Build", default: true, defaultModelId: config.defaultModelId, agent: builderAgent },
            { id: "plan", name: "Plan", defaultModelId: config.defaultModelId, agent: plannerAgent }
        ],
        initialState: { currentModelId: config.defaultModelId },
    });

    const tui = new MastraTUI({
        harness,
        appName: "Zip Agent Builder",
        verbose: config.verbose,
    });

    return { harness, tui, config };
}
