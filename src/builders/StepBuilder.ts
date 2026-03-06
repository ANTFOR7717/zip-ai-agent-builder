// src/builders/StepBuilder.ts
// Deterministic factory methods for all 14 Zip Agent node types.
// Every method is derived from production @Valid-Agents JSON evidence (Pass 4 audit).
// DO NOT add fields not confirmed by production evidence.

// ── Strict Literal Types ──────────────────────────────────────────────────────

export type ConnectorKey =
    | "ai"
    | "zip"
    | "http"
    | "condition"
    | "return"
    | "jinja"
    | "loop"
    | "memory_storage"
    | "python";

export type AiModel = "auto" | "o4-mini" | "gpt-4.1";

// "raw" confirmed by Adverse media research agent.task_template.json L99
export type OutputFormat = "structured" | "markdown" | "raw";

// All 11 control types — "code" confirmed by Intake Validation Agent V2 L939-986
// ("script": { "control": "code", "value": "def execute(input):..." })
export type ControlType =
    | "text"
    | "ref"
    | "object"
    | "array"
    | "picklist"
    | "multipicklist"
    | "boolean"
    | "number"
    | "json"
    | "code"
    | "null";

// ── ZipStep Interface ─────────────────────────────────────────────────────────
// structured_schema is NOT a root field — it lives inside input_config.value
// Confirmed by ALL Pass 4 audited agents.

export interface ZipStep {
    key: string;
    display_name: string;
    connector_key: ConnectorKey;
    action_key: string;
    input_config: any;
    branches: { key: string; label: string; steps: any[] }[] | null;
    error_handling_policy: 1;
    connection_var_key: string | null;
}

// ── StepBuilder ───────────────────────────────────────────────────────────────

export class StepBuilder {

    // ── 1 of 14: $http_client ──────────────────────────────────────────────────
    // CITED: IntakeV2 L510-525 (GET, no method field)
    // CITED: IntakeV2 L473-507 (GET with query_params array)
    // CITED: PoC L328-346 (POST with content_type + request_body)
    // CITED: DuplicateSupplier L481-505 (POST with body)
    // FINDING: method omitted for GET. headers/timeout do NOT exist. body key is "request_body".
    static http(
        key: string,
        name: string,
        url: string,
        method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
        bodyStr?: string,
        queryParams?: Array<{ key: string; value: string }>
    ): ZipStep {
        return {
            key,
            display_name: name,
            connector_key: "http",
            action_key: "$http_client",
            error_handling_policy: 1,
            connection_var_key: "config.http_client_connection",
            branches: null,
            input_config: {
                control: "object",
                value: {
                    url: { control: "text", value: url },
                    ...(method !== "GET" ? { method: { control: "picklist", value: method } } : {}),
                    ...(bodyStr
                        ? {
                            content_type: { control: "picklist", value: "application/json" },
                            request_body: { control: "text", value: bodyStr },
                        }
                        : {}),
                    ...(queryParams?.length
                        ? {
                            query_params: {
                                control: "array",
                                value: queryParams.map((qp) => ({
                                    control: "object",
                                    value: {
                                        key: { control: "text", value: qp.key },
                                        value: { control: "text", value: qp.value },
                                    },
                                })),
                            },
                        }
                        : {}),
                },
            },
        };
    }

    // ── 2 of 14: if_condition ──────────────────────────────────────────────────
    // CITED: Kraken L97-131, IntakeV2 L369-399 (boolean), IntakeV2 L401-435 (null), IntakeV2 L437-465 (number=0)
    // CITED: DuplicateSupplier L370-475 (3 conditions), PoC L273-325
    // CITED: contract_analysis L188 ("text" + "${}"), contract_analysis L492 ("text" + "${}")
    // FINDING: left_value uses "ref" for bare paths, "text" for ${} interpolated strings (same rule as all other ref-type fields).
    // FINDING: branches ALWAYS null on steps_data — routing only in workflow AST.
    static condition(
        key: string,
        name: string,
        left_op: string,
        operator: "equals" | "not_equals",
        right_op: string | boolean | number | null
    ): ZipStep {
        const leftControl = left_op.includes("${") ? "text" : "ref";
        const rightControl =
            right_op === null
                ? "null"
                : typeof right_op === "boolean"
                    ? "boolean"
                    : typeof right_op === "number"
                        ? "number"
                        : "text";

        return {
            key,
            display_name: name,
            connector_key: "condition",
            action_key: "if_condition",
            error_handling_policy: 1,
            connection_var_key: null,
            input_config: {
                control: "object",
                value: {
                    conditions: {
                        control: "array",
                        value: [
                            {
                                control: "object",
                                value: {
                                    left_value: { control: leftControl, value: left_op },
                                    operator: { control: "picklist", value: operator },
                                    right_value: { control: rightControl, value: right_op },
                                },
                            },
                        ],
                    },
                },
            },
            branches: null, // CRITICAL: steps_data branches always null. Routing in workflow AST only.
        };
    }

    // ── 3 of 14: generic_ai ───────────────────────────────────────────────────
    // CITED: AdverseMedia L12-106 (array_schema, output_schema, include_citations, data_sources, output_format:"raw")
    // CITED: DuplicateSupplier ai_2 L75-96 (user_prompt + tools only — NO output_format)
    // CITED: DuplicateSupplier ai_6 L204-303 (structured_schema, NO output_format, NO model)
    // CITED: DuplicateSupplier ai_1 L39-72 (markdown WITH model:"auto" AND include_citations)
    // CITED: PoC ai_4 L237-252 (markdown, NO model, NO tools)
    // FINDING: output_format is OPTIONAL. model is OPTIONAL. user_prompt always "text" control.
    static genericAi(
        key: string,
        name: string,
        userPrompt: string,
        opts?: {
            tools?: string[];           // multipicklist: "document", "zip_data", "web_search_preview"
            structuredSchema?: any[];   // inside input_config.value as "structured_schema"
            outputSchema?: any[];       // alt schema key "output_schema" used by Adverse media agent
            arraySchema?: boolean;      // "array_schema": { control:"boolean", value:true }
            outputFormat?: OutputFormat; // optional — omit if not needed
            model?: string;             // "auto" — optional, omit if not needed
            includeCitations?: boolean; // "include_citations": { control:"boolean", value:... }
            dataSources?: any[];        // "data_sources": { control:"array", value:[] }
        }
    ): ZipStep {
        return {
            key,
            display_name: name,
            connector_key: "ai",
            action_key: "generic_ai",
            error_handling_policy: 1,
            connection_var_key: null,
            branches: null,
            input_config: {
                control: "object",
                value: {
                    ...(opts?.arraySchema !== undefined
                        ? { array_schema: { control: "boolean", value: opts.arraySchema } }
                        : {}),
                    ...(opts?.outputSchema
                        ? { output_schema: { control: "array", value: opts.outputSchema } }
                        : {}),
                    user_prompt: { control: "text", value: userPrompt },
                    ...(opts?.tools !== undefined
                        ? { tools: { control: "multipicklist", value: opts.tools } }
                        : {}),
                    ...(opts?.includeCitations !== undefined
                        ? { include_citations: { control: "boolean", value: opts.includeCitations } }
                        : {}),
                    ...(opts?.dataSources !== undefined
                        ? { data_sources: { control: "array", value: opts.dataSources } }
                        : {}),
                    ...(opts?.outputFormat
                        ? { output_format: { control: "picklist", value: opts.outputFormat } }
                        : {}),
                    ...(opts?.model
                        ? { model: { control: "picklist", value: opts.model } }
                        : {}),
                    ...(opts?.structuredSchema
                        ? { structured_schema: { control: "array", value: opts.structuredSchema } }
                        : {}),
                },
            },
        };
    }

    // ── 4 of 14: approval_assist (Trigger) ────────────────────────────────────
    // CITED: PoC L33-41, Kraken L313-319, IntakeV2 L1028-1036, DuplicateSupplier L609-618
    // FINDING: input_config always null. connector_key "ai". Always first step.
    static approvalAssist(key: string = "trigger", name: string = "Trigger"): ZipStep {
        return {
            key,
            display_name: name,
            connector_key: "ai",
            action_key: "approval_assist",
            error_handling_policy: 1,
            connection_var_key: null,
            branches: null,
            input_config: null,
        };
    }

    // ── 5 of 14: get_request ──────────────────────────────────────────────────
    // CITED: Kraken L11-27 ("ref" control, bare path)
    // CITED: PoC L43-55 ("text" control, ${} interpolation)
    // FINDING: "ref" for bare step paths, "text" for ${} interpolated strings.
    static getRequest(key: string, name: string, requestIdValue: string): ZipStep {
        const isInterpolated = requestIdValue.includes("${");
        return {
            key,
            display_name: name,
            connector_key: "zip",
            action_key: "get_request",
            error_handling_policy: 1,
            connection_var_key: null,
            branches: null,
            input_config: {
                control: "object",
                value: {
                    request_id: { control: isInterpolated ? "text" : "ref", value: requestIdValue },
                },
            },
        };
    }

    // ── 6 of 14: get_vendor ───────────────────────────────────────────────────
    // CITED: contract_analysis_agent L39-55 ("text" + "${}" interpolation)
    // CITED: Adverse media L483-499 ("text" + "${}" interpolation)
    // FINDING: isInterpolated rule applies — same as get_request and return_value.
    static getVendor(key: string, name: string, vendorIdValue: string): ZipStep {
        const isInterpolated = vendorIdValue.includes("${");
        return {
            key,
            display_name: name,
            connector_key: "zip",
            action_key: "get_vendor",
            error_handling_policy: 1,
            connection_var_key: null,
            branches: null,
            input_config: {
                control: "object",
                value: {
                    vendor_id: { control: isInterpolated ? "text" : "ref", value: vendorIdValue },
                },
            },
        };
    }

    // ── 7 of 14: return_value ─────────────────────────────────────────────────
    // CITED: Kraken L273-289 ("ref", bare path)
    // CITED: DuplicateSupplier L538-553 ("text", ${} interpolation)
    // CITED: PoC L369-382 ("text", ${} interpolation)
    static returnValue(key: string, name: string, valueExpr: string): ZipStep {
        const isInterpolated = valueExpr.includes("${");
        return {
            key,
            display_name: name,
            connector_key: "return",
            action_key: "return_value",
            error_handling_policy: 1,
            connection_var_key: null,
            branches: null,
            input_config: {
                control: "object",
                value: {
                    value: { control: isInterpolated ? "text" : "ref", value: valueExpr },
                },
            },
        };
    }

    // ── 8 of 14: render_json_template ─────────────────────────────────────────
    // CITED: IntakeV2 L617-651, L657-692, L693-728
    // FINDING: key is "json_template". variables is an array of {control:"object", value:{key,value}} objects.
    static renderJsonTemplate(
        key: string,
        name: string,
        jsonTemplate: string,
        variablesArr: any[]
    ): ZipStep {
        return {
            key,
            display_name: name,
            connector_key: "jinja",
            action_key: "render_json_template",
            error_handling_policy: 1,
            connection_var_key: null,
            branches: null,
            input_config: {
                control: "object",
                value: {
                    json_template: { control: "text", value: jsonTemplate },
                    variables: { control: "array", value: variablesArr },
                },
            },
        };
    }

    // ── 9 of 14: loop_n_times ─────────────────────────────────────────────────
    // CITED: IntakeV2 L771-787
    // FINDING: branches null on steps_data. iteration_count not count. No delay_seconds.
    static loopNTimes(
        key: string,
        name: string,
        iterationCountRef: string | number
    ): ZipStep {
        return {
            key,
            display_name: name,
            connector_key: "loop",
            action_key: "loop_n_times",
            error_handling_policy: 1,
            connection_var_key: null,
            branches: null, // CONFIRMED: null on steps_data — workflow AST holds loop body
            input_config: {
                control: "object",
                value: {
                    iteration_count: {
                        control: typeof iterationCountRef === "number" ? "number" : "ref",
                        value: iterationCountRef,
                    },
                },
            },
        };
    }

    // ── 10 of 14: break_loop ──────────────────────────────────────────────────
    // CITED: IntakeV2 L761-769
    // FINDING: input_config null. No other fields.
    static breakLoop(key: string, name: string = "Break"): ZipStep {
        return {
            key,
            display_name: name,
            connector_key: "loop",
            action_key: "break_loop",
            error_handling_policy: 1,
            connection_var_key: null,
            branches: null,
            input_config: null,
        };
    }

    // ── 11 of 14: set_value ───────────────────────────────────────────────────
    // CITED: IntakeV2 L789-809 ("json" control, initializing [])
    // CITED: IntakeV2 L855-875 ("ref" control, bare step path)
    // FINDING: value control: "ref" for bare step paths, "json" for JSON literals, "text" for templates.
    static memorySetValue(
        key: string,
        name: string,
        varKey: string,
        valueRef: string
    ): ZipStep {
        const control =
            valueRef.includes("${")
                ? "text"
                : valueRef.startsWith("steps.")
                    ? "ref"
                    : valueRef.startsWith("[") || valueRef.startsWith("{")
                        ? "json"
                        : "text";

        return {
            key,
            display_name: name,
            connector_key: "memory_storage",
            action_key: "set_value",
            error_handling_policy: 1,
            connection_var_key: null,
            branches: null,
            input_config: {
                control: "object",
                value: {
                    key: { control: "text", value: varKey },
                    value: { control, value: valueRef },
                },
            },
        };
    }

    // ── 12 of 14: get_value ───────────────────────────────────────────────────
    // CITED: IntakeV2 L811-831 (WITH default_value: null), IntakeV2 L877-893 (WITHOUT default_value)
    // FINDING: default_value is OPTIONAL. withDefault=false by default.
    static memoryGetValue(
        key: string,
        name: string,
        varKey: string,
        withDefault: boolean = false
    ): ZipStep {
        return {
            key,
            display_name: name,
            connector_key: "memory_storage",
            action_key: "get_value",
            error_handling_policy: 1,
            connection_var_key: null,
            branches: null,
            input_config: {
                control: "object",
                value: {
                    key: { control: "text", value: varKey },
                    ...(withDefault ? { default_value: { control: "null", value: null } } : {}),
                },
            },
        };
    }

    // ── 13 of 14: append_to_list ──────────────────────────────────────────────
    // CITED: IntakeV2 L833-853 ("ref" control), IntakeV2 L917-937 ("ref" control)
    // FINDING: field names are "key" and "value" (not "list_key" and "item").
    // FINDING: isInterpolated rule applies to value control.
    static memoryAppendToList(
        key: string,
        name: string,
        storageKey: string,
        valueRef: string
    ): ZipStep {
        const isInterpolated = valueRef.includes("${");
        return {
            key,
            display_name: name,
            connector_key: "memory_storage",
            action_key: "append_to_list",
            error_handling_policy: 1,
            connection_var_key: null,
            branches: null,
            input_config: {
                control: "object",
                value: {
                    key: { control: "text", value: storageKey },
                    value: { control: isInterpolated ? "text" : "ref", value: valueRef },
                },
            },
        };
    }

    // ── 14 of 14: execute_script ──────────────────────────────────────────────
    // CITED: IntakeV2 L939-986 (only instance in all 7 agents)
    // FINDING: key is "script" with control "code". variables is explicit array of {key, value} objects.
    static executeScript(
        key: string,
        name: string,
        scriptCode: string,
        variablesArr: any[]
    ): ZipStep {
        return {
            key,
            display_name: name,
            connector_key: "python",
            action_key: "execute_script",
            error_handling_policy: 1,
            connection_var_key: null,
            branches: null,
            input_config: {
                control: "object",
                value: {
                    script: { control: "code", value: scriptCode },
                    variables: { control: "array", value: variablesArr },
                },
            },
        };
    }
}
