# Zip Agent Node Schema

> **Exact transfer source:** `src/schemas/example.task_template.json`
>
> This file is a faithful markdown transfer of the authoritative example task template. It preserves the exact top-level fields, exact node instances, exact controls, exact references, exact placeholder `null` values, and exact workflow routing present in the JSON.

---

## Source Snapshot

- `type`: `task_template`
- `trigger_kind`: `APPROVAL_ASSIST`
- `version`: `1`
- `exported_at`: `2026-03-08T11:11:05.638Z`
- `name`: `MSA SOW Reader Agent imported at 3/7/2026, 5:58:33 PM`
- total `steps_data` nodes: `8`

## Exact Top-Level Fields

| Field | Exact Value / Shape |
|---|---|
| `config_pages` | `[]` |
| `config_vars` | `{}` |
| `exported_at` | `2026-03-08T11:11:05.638Z` |
| `flow_config_pages` | `[]` |
| `flow_config_vars` | `{}` |
| `is_concurrent_job_limit_enabled` | `true` |
| `is_long_running` | `false` |
| `name` | `MSA SOW Reader Agent imported at 3/7/2026, 5:58:33 PM` |
| `steps_data` | array of 8 step objects |
| `trigger_kind` | `APPROVAL_ASSIST` |
| `type` | `task_template` |
| `version` | `1` |
| `workflow` | trigger object + ordered step routing |

## Exact `steps_data` Storage Order

1. `ai_1`
2. `ai_2`
3. `ai_3`
4. `cond_1`
5. `return_1`
6. `trigger`
7. `zip_1`
8. `zip_2`

## Exact Connector / Action Inventory

| Connector | Action | Nodes |
|---|---|---|
| `ai` | `generic_ai` | `ai_1`, `ai_2`, `ai_3` |
| `ai` | `approval_assist` | `trigger` |
| `zip` | `get_request` | `zip_1` |
| `zip` | `get_vendor` | `zip_2` |
| `condition` | `if_condition` | `cond_1` |
| `return` | `return_value` | `return_1` |

## Exact Controls Present In The Example

Only these controls appear anywhere in the authoritative JSON:

- `object`
- `array`
- `text`
- `ref`
- `picklist`
- `multipicklist`
- `boolean`

Literal `null` values also appear directly as values, especially inside `structured_schema` placeholder entries and in `input_config` for the trigger node.

---

## Exact Action Schemas Transferred From The Example

### `ai / generic_ai`

Exact `input_config.value` fields observed:

| Field | Control | Exact observed value shape |
|---|---|---|
| `user_prompt` | `text` | long instruction string |
| `tools` | `multipicklist` | `["document", "zip_data"]` or `["document"]` |
| `output_format` | `picklist` | `structured` |
| `structured_schema` | `array` | array of `{"control":"object","value":...}` entries |

Exact populated `structured_schema` entry seen in `ai_1`:

```json
{
  "control": "object",
  "value": {
    "key": {
      "control": "text",
      "value": "msa_found"
    },
    "description": {
      "control": "text",
      "value": "Whether an MSA document was found"
    },
    "type": {
      "control": "picklist",
      "value": "boolean"
    }
  }
}
```

Exact placeholder shapes also present in `structured_schema`:

```json
{
  "control": "object",
  "value": null
}
```

Exact observed `structured_schema` array lengths by node:

| Node | Array length | Populated entries | Null placeholder entries |
|---|---:|---:|---:|
| `ai_1` | 5 | 1 | 4 |
| `ai_2` | 8 | 0 | 8 |
| `ai_3` | 8 | 0 | 8 |

### `ai / approval_assist`

Exact shape observed:

- `key`: `trigger`
- `display_name`: `Approval assist`
- `input_config`: `null`
- `branches`: `null`
- `error_handling_policy`: `1`
- `connection_var_key`: `null`

### `zip / get_request`

Exact `input_config.value` field:

| Field | Control | Exact value |
|---|---|---|
| `request_id` | `ref` | `trigger.request_id` |

### `zip / get_vendor`

Exact `input_config.value` field:

| Field | Control | Exact value |
|---|---|---|
| `vendor_id` | `ref` | `steps.zip_1.body.vendor_id` |

### `condition / if_condition`

Exact `input_config.value` field:

| Field | Control | Exact value shape |
|---|---|---|
| `conditions` | `array` | array containing one condition object |

Exact condition object shape:

```json
{
  "control": "object",
  "value": {
    "left_value": {
      "control": "ref",
      "value": "steps.ai_1.output.msa_found"
    },
    "operator": {
      "control": "picklist",
      "value": "equals"
    },
    "right_value": {
      "control": "boolean",
      "value": true
    }
  }
}
```

### `return / return_value`

Exact `input_config.value` field:

| Field | Control | Exact value |
|---|---|---|
| `value` | `ref` | `steps.ai_3.output` |

---

## Exact Node Transfer (`steps_data` Objects)

### `ai_1` — `ai / generic_ai`

```json
{
  "key": "ai_1",
  "display_name": "Identify Documents",
  "connector_key": "ai",
  "action_key": "generic_ai",
  "input_config": {
    "control": "object",
    "value": {
      "user_prompt": {
        "control": "text",
        "value": "Analyze the documents attached to this request. Identify:\n1. MSA (Master Service Agreement) - look for terms like \"Master Service Agreement\", \"MSA\", \"Service Agreement\"\n2. SOW (Statement of Work) - look for \"Statement of Work\", \"SOW\", \"Scope of Work\", \"Project Summary\"\n\nReturn a structured response with:\n- msa_found: boolean - whether an MSA document was found\n- sow_found: boolean - whether an SOW document was found  \n- msa_document_id: string | null - the document ID of the MSA if found\n- sow_document_id: string | null - the document ID of the SOW if found\n- summary: string - brief description of what was found"
      },
      "tools": {
        "control": "multipicklist",
        "value": ["document", "zip_data"]
      },
      "output_format": {
        "control": "picklist",
        "value": "structured"
      },
      "structured_schema": {
        "control": "array",
        "value": [
          {
            "control": "object",
            "value": {
              "key": { "control": "text", "value": "msa_found" },
              "description": { "control": "text", "value": "Whether an MSA document was found" },
              "type": { "control": "picklist", "value": "boolean" }
            }
          },
          { "control": "object", "value": null },
          { "control": "object", "value": null },
          { "control": "object", "value": null },
          { "control": "object", "value": null }
        ]
      }
    }
  },
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### `ai_2` — `ai / generic_ai`

```json
{
  "key": "ai_2",
  "display_name": "Extract MSA Terms",
  "connector_key": "ai",
  "action_key": "generic_ai",
  "input_config": {
    "control": "object",
    "value": {
      "user_prompt": {
        "control": "text",
        "value": "Extract the key terms from the Master Service Agreement (MSA) document.\n\nAnalyze the MSA and extract:\n- parties: The parties involved in the agreement\n- effective_date: When the agreement starts\n- term_length: Duration of the agreement\n- termination_clause: How the agreement can be terminated\n- payment_terms: Payment terms and conditions\n- liability_cap: Maximum liability amounts\n- governing_law: Which state's laws govern\n- any_other_key_terms: Any other significant terms\n\nReturn a structured response with all extracted terms."
      },
      "tools": {
        "control": "multipicklist",
        "value": ["document"]
      },
      "output_format": {
        "control": "picklist",
        "value": "structured"
      },
      "structured_schema": {
        "control": "array",
        "value": [
          { "control": "object", "value": null },
          { "control": "object", "value": null },
          { "control": "object", "value": null },
          { "control": "object", "value": null },
          { "control": "object", "value": null },
          { "control": "object", "value": null },
          { "control": "object", "value": null },
          { "control": "object", "value": null }
        ]
      }
    }
  },
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### `ai_3` — `ai / generic_ai`

```json
{
  "key": "ai_3",
  "display_name": "Extract SOW Details",
  "connector_key": "ai",
  "action_key": "generic_ai",
  "input_config": {
    "control": "object",
    "value": {
      "user_prompt": {
        "control": "text",
        "value": "Extract the details from the Statement of Work (SOW) document.\n\nAnalyze the SOW and extract:\n- project_name: Name of the project\n- project_description: Description of the work to be done\n- deliverables: What will be delivered\n- timeline: Project timeline and milestones\n- budget: Budget or cost information\n- resources: Resources required\n- success_criteria: How success will be measured\n- any_special_terms: Any special terms or conditions\n\nReturn a structured response with all extracted details."
      },
      "tools": {
        "control": "multipicklist",
        "value": ["document"]
      },
      "output_format": {
        "control": "picklist",
        "value": "structured"
      },
      "structured_schema": {
        "control": "array",
        "value": [
          { "control": "object", "value": null },
          { "control": "object", "value": null },
          { "control": "object", "value": null },
          { "control": "object", "value": null },
          { "control": "object", "value": null },
          { "control": "object", "value": null },
          { "control": "object", "value": null },
          { "control": "object", "value": null }
        ]
      }
    }
  },
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### `cond_1` — `condition / if_condition`

```json
{
  "key": "cond_1",
  "display_name": "Check MSA Exists",
  "connector_key": "condition",
  "action_key": "if_condition",
  "input_config": {
    "control": "object",
    "value": {
      "conditions": {
        "control": "array",
        "value": [
          {
            "control": "object",
            "value": {
              "left_value": { "control": "ref", "value": "steps.ai_1.output.msa_found" },
              "operator": { "control": "picklist", "value": "equals" },
              "right_value": { "control": "boolean", "value": true }
            }
          }
        ]
      }
    }
  },
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### `return_1` — `return / return_value`

```json
{
  "key": "return_1",
  "display_name": "Return Report",
  "connector_key": "return",
  "action_key": "return_value",
  "input_config": {
    "control": "object",
    "value": {
      "value": {
        "control": "ref",
        "value": "steps.ai_3.output"
      }
    }
  },
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### `trigger` — `ai / approval_assist`

```json
{
  "key": "trigger",
  "display_name": "Approval assist",
  "connector_key": "ai",
  "action_key": "approval_assist",
  "input_config": null,
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### `zip_1` — `zip / get_request`

```json
{
  "key": "zip_1",
  "display_name": "Get Request",
  "connector_key": "zip",
  "action_key": "get_request",
  "input_config": {
    "control": "object",
    "value": {
      "request_id": {
        "control": "ref",
        "value": "trigger.request_id"
      }
    }
  },
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### `zip_2` — `zip / get_vendor`

```json
{
  "key": "zip_2",
  "display_name": "Get Vendor",
  "connector_key": "zip",
  "action_key": "get_vendor",
  "input_config": {
    "control": "object",
    "value": {
      "vendor_id": {
        "control": "ref",
        "value": "steps.zip_1.body.vendor_id"
      }
    }
  },
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

---

## Exact Workflow Transfer

Execution order is defined by `workflow`, not by `steps_data` order.

```json
{
  "trigger": {
    "key": "trigger",
    "branches": null
  },
  "steps": [
    {
      "key": "zip_1",
      "branches": null
    },
    {
      "key": "zip_2",
      "branches": null
    },
    {
      "key": "ai_1",
      "branches": null
    },
    {
      "key": "cond_1",
      "branches": [
        {
          "key": "true",
          "label": "True",
          "steps": [
            {
              "key": "ai_2",
              "branches": null
            }
          ]
        },
        {
          "key": "default",
          "label": "False",
          "steps": [
            {
              "key": "ai_3",
              "branches": null
            }
          ]
        }
      ]
    },
    {
      "key": "return_1",
      "branches": null
    }
  ]
}
```

## Exact Routing Notes Transferred From The Example

- trigger node key: `trigger`
- workflow starts with `zip_1`
- `zip_1` feeds `zip_2`
- `zip_2` feeds `ai_1`
- `ai_1` feeds `cond_1`
- `cond_1` has two exact branches:
  - branch key `true`, label `True`, steps `[ai_2]`
  - branch key `default`, label `False`, steps `[ai_3]`
- after the condition branch, workflow continues to `return_1`

## Exact Reference Strings Present In The Example

- `trigger.request_id`
- `steps.zip_1.body.vendor_id`
- `steps.ai_1.output.msa_found`
- `steps.ai_3.output`

## Exact Accuracy Boundary

This markdown intentionally transfers only what exists in `src/schemas/example.task_template.json`. If a connector, action, field, control, picklist value, schema entry, or branch pattern is not present in that file, it is not claimed here.