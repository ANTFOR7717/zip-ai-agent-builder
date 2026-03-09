import { z } from "zod";

export const SECTION_TITLES = {
    overview: "Agent Overview",
    nodeFlow: "Node Flow Table",
    flowDiagram: "Flow Diagram",
    justifications: "Justifications",
    futureEnhancements: "Future Enhancement Notes",
} as const;

export const REQUIRED_PLAN_SECTIONS = Object.values(SECTION_TITLES);

const PlanNodeIdSchema = z.string().regex(
    /^[a-zA-Z0-9_-]+$/,
    "nodeId must contain only letters, numbers, underscores, or hyphens for valid Mermaid rendering."
);

const PlanNodeSchema = z.object({
    nodeType: z.string().describe("Business-level category (e.g., trigger, ai, condition)"),
    nodeName: z.string(),
    nodeId: PlanNodeIdSchema,
    purpose: z.string(),
    keysTypesValues: z.string(),
    types: z.string().optional().describe(
        "Comma-separated list of exact JSON primitive types (string, number, boolean, object, array, null). " +
        "Required for compiling the final JSON template. " +
        "Leave undefined for void nodes."
    ),
    promptOrLogic: z.string(),
});

const PlanEdgeSchema = z.object({
    from: PlanNodeIdSchema,
    to: PlanNodeIdSchema,
    label: z.string().trim().optional().transform(v => v === "" ? undefined : v),
});

export const AgentPlanDraftSchema = z.object({
    agentName: z.string(),
    purpose: z.string(),
    outputFilename: z.string(),
    nodeFlow: z.array(PlanNodeSchema).min(1),
    flowEdges: z.array(PlanEdgeSchema),
    justifications: z.array(z.string()).default([]),
    futureEnhancements: z.array(z.string()).default([]),
}).superRefine((plan, ctx) => {
    const nodeIds = plan.nodeFlow.map((node) => node.nodeId);
    const uniqueNodeIds = new Set(nodeIds);

    if (uniqueNodeIds.size !== nodeIds.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "nodeFlow contains duplicate nodeId values." });
    }

    if (plan.nodeFlow.length > 1 && plan.flowEdges.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "flowEdges must not be empty when nodeFlow contains more than one node." });
    }

    for (const edge of plan.flowEdges) {
        if (!uniqueNodeIds.has(edge.from) || !uniqueNodeIds.has(edge.to)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `flowEdges reference unknown nodeId: ${edge.from} -> ${edge.to}`,
            });
        }
    }
});

export type AgentPlanDraft = z.infer<typeof AgentPlanDraftSchema>;
export type PlanNode = AgentPlanDraft["nodeFlow"][number];
export type PlanEdge = AgentPlanDraft["flowEdges"][number];

const escapeTableCell = (value: string) => value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
const escapeMermaidLabel = (value: string) => value.replace(/"/g, "'");

const renderSection = (title: string, lines: string[]) => [
    `## ${title}`,
    "",
    ...lines,
    "",
    "---",
    "",
].join("\n");

export function normalizePlanFilename(filename: string): string {
    const safeBase = filename.trim().replace(/\.mdx?$/i, "").replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safeBase) {
        throw new Error("Plan filename must contain at least one letter, number, underscore, or hyphen.");
    }
    return `${safeBase}.mdx`;
}

export function parseAgentPlanDraft(input: unknown): AgentPlanDraft {
    return AgentPlanDraftSchema.parse(input);
}

export function addNodeRow(
    planInput: AgentPlanDraft,
    nodeInput: PlanNode,
    options: { position?: number; edges?: PlanEdge[] } = {}
): AgentPlanDraft {
    const plan = parseAgentPlanDraft(planInput);
    const node = PlanNodeSchema.parse(nodeInput);

    if (plan.nodeFlow.some((existing) => existing.nodeId === node.nodeId)) {
        throw new Error(`Cannot add node. nodeId already exists: ${node.nodeId}`);
    }

    const position = options.position ?? plan.nodeFlow.length;
    if (position < 0 || position > plan.nodeFlow.length) {
        throw new Error(`Cannot add node. position out of bounds: ${position}`);
    }

    const nodeFlow = [
        ...plan.nodeFlow.slice(0, position),
        node,
        ...plan.nodeFlow.slice(position)
    ];

    // Deduplicate edges to prevent nested rendering loops in mermaid
    const rawEdges = [...plan.flowEdges, ...(options.edges ?? [])];
    const uniqueEdges = Array.from(new Set(rawEdges.map(e => JSON.stringify(e))))
        .map(e => JSON.parse(e) as PlanEdge);

    return parseAgentPlanDraft({
        ...plan,
        nodeFlow,
        flowEdges: uniqueEdges,
    });
}

export function updateNodeRow(
    planInput: AgentPlanDraft,
    nodeId: string,
    patch: Partial<Omit<PlanNode, "nodeId">>,
    options: { edges?: PlanEdge[] } = {}
): AgentPlanDraft {
    const plan = parseAgentPlanDraft(planInput);
    const index = plan.nodeFlow.findIndex((node) => node.nodeId === nodeId);

    if (index === -1) {
        throw new Error(`Cannot update node. Unknown nodeId: ${nodeId}`);
    }

    const updatedNode = PlanNodeSchema.parse({
        ...plan.nodeFlow[index],
        ...patch,
        nodeId,
    });

    const nodeFlow = [
        ...plan.nodeFlow.slice(0, index),
        updatedNode,
        ...plan.nodeFlow.slice(index + 1)
    ];

    const rawEdges = options.edges ?? plan.flowEdges;
    const uniqueEdges = Array.from(new Set(rawEdges.map(e => JSON.stringify(e))))
        .map(e => JSON.parse(e) as PlanEdge);

    return parseAgentPlanDraft({
        ...plan,
        nodeFlow,
        flowEdges: uniqueEdges,
    });
}

export function removeNodeRow(
    planInput: AgentPlanDraft,
    nodeId: string,
    options: { reconnectEdges?: PlanEdge[] } = {}
): AgentPlanDraft {
    const plan = parseAgentPlanDraft(planInput);

    if (!plan.nodeFlow.some((node) => node.nodeId === nodeId)) {
        throw new Error(`Cannot remove node. Unknown nodeId: ${nodeId}`);
    }

    if (plan.nodeFlow.length === 1) {
        throw new Error("Cannot remove node. A plan must contain at least one node.");
    }

    const rawEdges = [
        ...plan.flowEdges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
        ...(options.reconnectEdges ?? []),
    ];
    const uniqueEdges = Array.from(new Set(rawEdges.map(e => JSON.stringify(e))))
        .map(e => JSON.parse(e) as PlanEdge);

    return parseAgentPlanDraft({
        ...plan,
        nodeFlow: plan.nodeFlow.filter((node) => node.nodeId !== nodeId),
        flowEdges: uniqueEdges,
    });
}

function renderOverview(plan: AgentPlanDraft): string {
    return renderSection(SECTION_TITLES.overview, [
        `**Agent Name:** ${plan.agentName}`,
        `**Purpose:** ${plan.purpose}`,
        `**Output Filename:** ${plan.outputFilename}`,
    ]);
}

function renderNodeFlowTable(plan: AgentPlanDraft): string {
    return renderSection(SECTION_TITLES.nodeFlow, [
        "| Node Type | Node Name | Node ID | Purpose | Keys / Values | Types | Prompt / Logic |",
        "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
        ...plan.nodeFlow.map((node) =>
            `| ${escapeTableCell(node.nodeType)} | ${escapeTableCell(node.nodeName)} | \`${escapeTableCell(node.nodeId)}\` | ${escapeTableCell(node.purpose)} | ${escapeTableCell(node.keysTypesValues)} | ${escapeTableCell(node.types ?? "—")} | ${escapeTableCell(node.promptOrLogic)} |`
        ),
    ]);
}

function renderFlowchart(plan: AgentPlanDraft): string {
    const labels = new Map(plan.nodeFlow.map((node) => [node.nodeId, `${node.nodeId}: ${node.nodeName}`]));
    return [
        "```mermaid",
        "flowchart TD",
        ...plan.flowEdges.map((edge) => {
            const fromLabel = escapeMermaidLabel(labels.get(edge.from) ?? edge.from);
            const toLabel = escapeMermaidLabel(labels.get(edge.to) ?? edge.to);
            const branch = edge.label ? ` -->|${escapeMermaidLabel(edge.label)}| ` : " --> ";
            return `    ${edge.from}[${fromLabel}]${branch}${edge.to}[${toLabel}]`;
        }),
        "```",
    ].join("\n");
}

function renderFlowDiagram(plan: AgentPlanDraft): string {
    return renderSection(SECTION_TITLES.flowDiagram, [renderFlowchart(plan)]);
}

function renderNumberedSection(title: string, items: string[], fallback: string): string {
    const lines = items.length ? items.map((item, index) => `${index + 1}. ${item}`) : [`1. ${fallback}`];
    return renderSection(title, lines);
}

export function renderAgentPlanMdx(input: unknown): string {
    const plan = parseAgentPlanDraft(input);

    return [
        `# PLAN.MDX - ${plan.agentName}`,
        "",
        renderOverview(plan),
        renderNodeFlowTable(plan),
        renderFlowDiagram(plan),
        renderNumberedSection(SECTION_TITLES.justifications, plan.justifications, "Keep the plan artifact executable and reviewable before build mode runs."),
        renderNumberedSection(SECTION_TITLES.futureEnhancements, plan.futureEnhancements, "None."),
    ].join("\n");
}
export const PLAN_FILE_IS_AUTHORITATIVE = true;
export const PLAN_TEMPLATE_VERSION = 1;