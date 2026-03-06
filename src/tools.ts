import { promises as fs } from "fs";
import { z } from "zod";
import path from "path";
import { ZipBuilderConfig } from "./config.js";

export function createZipTools(config: ZipBuilderConfig) {
    return {
        listAgents: {
            name: "listAgents",
            description: "List JSON files in Valid-Agents folder",
            parameters: z.object({}).shape,
            execute: async () => {
                try {
                    const files = await fs.readdir(config.validAgentsDir);
                    return files.filter(f => f.endsWith(".json")).join("\n") || "No files found.";
                } catch {
                    return "No Valid-Agents folder found";
                }
            },
        },

        readAgent: {
            name: "readAgent",
            description: "Read agent JSON from valid agents or output directory",
            parameters: z.object({
                filename: z.string().describe("Agent filename"),
                folder: z.enum(["valid", "output"]).default("valid").describe("Folder to read from"),
            }).shape,
            execute: async ({ filename, folder }: { filename: string; folder: "valid" | "output" }) => {
                try {
                    const targetDir = folder === "valid" ? config.validAgentsDir : config.outputDir;
                    return await fs.readFile(path.join(targetDir, filename), "utf-8");
                } catch {
                    return `File not found: ${filename}`;
                }
            },
        },

        saveAgent: {
            name: "saveAgent",
            description: "Save generated agent JSON to output folder",
            parameters: z.object({
                filename: z.string().describe("Filename ending in .json"),
                agent: z.record(z.string(), z.any()).describe("Complete agent JSON object to save"),
            }).shape,
            execute: async ({ filename, agent }: { filename: string; agent: Record<string, any> }) => {
                if (agent.type !== "task_template") return { success: false, error: "Missing/invalid type" };
                if (!Array.isArray(agent.steps_data)) return { success: false, error: "Missing/invalid steps_data" };
                if (!agent.workflow) return { success: false, error: "Missing workflow" };

                // Auto-generate valid exported_at timestamp
                agent.exported_at = new Date().toISOString();

                try {
                    await fs.mkdir(config.outputDir, { recursive: true });
                    const finalName = filename.endsWith(".json") ? filename : `${filename}.json`;
                    const filepath = path.join(config.outputDir, finalName);
                    await fs.writeFile(filepath, JSON.stringify(agent, null, 2));
                    return { success: true, filepath };
                } catch (error) {
                    return { success: false, error: `Failed to write: ${(error as Error).message}` };
                }
            },
        }
    };
}
