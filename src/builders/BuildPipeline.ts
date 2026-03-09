// src/builders/BuildPipeline.ts
// Shared write utility for both the `compileAndSave` tool and standalone build-agents/ scripts.
// Enforces: plan-first check, output path from config, filename normalization.

import { promises as fs } from "fs";
import path from "path";
import type { AgentBuilder } from "./AgentBuilder.js";
import { normalizePlanFilename } from "./PlanBuilder.js";

export interface BuildPipelineOptions {
    /** Path to the plans directory (e.g. config.planDir). */
    planDir: string;
    /** Path to the compiled output directory (e.g. config.outputDir). */
    outputDir: string;
}

/**
 * Compiles an AgentBuilder instance and saves the result to `options.outputDir`.
 *
 * Enforces:
 * 1. A corresponding `<options.planDir>/<filename>.mdx` must exist before any build is allowed.
 * 2. Output is always written to `options.outputDir` — never a hardcoded path.
 * 3. Output filename is normalized: strips path separators, forces .json extension.
 *
 * Throws on plan-first violation or compile errors.
 * Returns the resolved output filepath on success.
 */
export async function buildAndSave(
    builder: AgentBuilder,
    filename: string,
    options: BuildPipelineOptions
): Promise<string> {
    const safeBase = filename.trim().replace(/\.json$/i, "").replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safeBase) {
        throw new Error(`BuildPipeline: filename "${filename}" is invalid. Use kebab-case e.g. "my-agent".`);
    }

    // ── 1. Plan-first guard ──────────────────────────────────────────────────
    const planFilename = normalizePlanFilename(safeBase); // e.g. "my-agent.mdx"
    const planPath = path.resolve(process.cwd(), options.planDir, planFilename);
    try {
        await fs.access(planPath);
    } catch {
        throw new Error(
            `BuildPipeline: No plan found: "${planPath}". ` +
            `Use saveAgentPlan (Plan mode) to create it first.`
        );
    }

    // ── 2. Compile ───────────────────────────────────────────────────────────
    const compiled = builder.compile(); // throws on ref/orphan violations

    // ── 3. Write to options.outputDir ─────────────────────────────────────────
    const outputFilename = `${safeBase}.json`;
    const outputPath = path.resolve(process.cwd(), options.outputDir, outputFilename);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(compiled, null, 2), "utf-8");

    return outputPath;
}
