import { z } from "zod";

export const BuilderConfigSchema = z.object({
    outputDir: z.string().default("build-agents"),
    defaultModelId: z.string().default("kilo/minimax/minimax-m2.5:free"),
    verbose: z.boolean().default(true),
    validAgentsDir: z.string().default("examples/Valid-Agents"),
});

export type ZipBuilderOptions = z.infer<typeof BuilderConfigSchema>;
export type ZipBuilderConfig = z.infer<typeof BuilderConfigSchema>;

export function parseConfig(options: Partial<ZipBuilderOptions> = {}): ZipBuilderConfig {
    try {
        return BuilderConfigSchema.parse(options);
    } catch (error) {
        throw new Error(`Invalid Configuration for ZipAgentBuilder: ${(error as Error).message}`);
    }
}
