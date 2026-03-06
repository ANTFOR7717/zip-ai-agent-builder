# Zip Agent Node Schema

> **Authoritative reference** - All values extracted from 7 valid agents (123 steps total)
> This document defines EVERY valid node type, action, property, and control type for Zip agent JSON.

---

## Table of Contents

1. [Connector Overview](#connector-overview)
2. [Control Types](#control-types)
3. [Top-Level Agent Structure](#top-level-agent-structure)
4. [Step Fields (All 8 Required)](#step-fields-all-8-required)
5. [Node Types](#node-types)
   - [AI Connector](#ai-connector)
   - [ZIP Connector](#zip-connector)
   - [HTTP Connector](#http-connector)
   - [Condition Connector](#condition-connector)
   - [Return Connector](#return-connector)
   - [Jinja Connector](#jinja-connector)
   - [Loop Connector](#loop-connector)
   - [Memory Storage Connector](#memory-storage-connector)
   - [Python Connector](#python-connector)

---

## Connector Overview

| Connector | Action | Count | Description |
|-----------|--------|-------|-------------|
| ai | generic_ai | 60 | AI analysis step |
| ai | approval_assist | 17 | Trigger for approval workflows |
| return | return_value | 17 | Return a value |
| condition | if_condition | 13 | Conditional branching |
| zip | get_request | 7 | Fetch request data |
| zip | get_vendor | 3 | Fetch vendor data |
| http | $http_client | 9 | HTTP API call |
| jinja | render_json_template | 4 | Jinja2 template rendering |
| memory_storage | set_value | 6 | Store a value |
| memory_storage | get_value | 3 | Retrieve a value |
| memory_storage | append_to_list | 2 | Append to list |
| loop | loop_n_times | 1 | Loop N times |
| loop | break_loop | 1 | Exit loop |
| python | execute_script | 1 | Execute Python code |

---

## Control Types

Every input field uses this structure:

```json
{
  "field_name": {
    "control": "CONTROL_TYPE",
    "value": VALUE
  }
}
```

### Valid Control Types

| Control | JSON Type | Description | Example |
|---------|-----------|-------------|---------|
| **text** | string | Plain text or template with `${steps.X.response}` | `"value": "Hello ${steps.ai_1.response}"` |
| **ref** | string | Direct reference (no `${}` wrapper) | `"value": "steps.ai_1.response"` |
| **object** | object | Nested object structure | `{"control": "object", "value": {...}}` |
| **array** | array | Array of items | `[{"control": "object", ...}]` |
| **picklist** | string | Single selection dropdown | `"value": "structured"` |
| **multipicklist** | array | Multi-select list | `["document", "zip_data"]` |
| **boolean** | boolean | True/false | `true` or `false` |
| **number** | number | Numeric value | `42` |
| **json** | string | JSON string | `"[]"` |
| **code** | string | Python code | `"def execute(input): ..."` |
| **null** | null | Null value | `null` |

---

## Top-Level Agent Structure

All 13 fields are **REQUIRED**:

| Field | Type | Value | Example |
|-------|------|-------|---------|
| type | string | task_template | `"task_template"` |
| name | string | Agent name | `"Contract Review Agent"` |
| version | number | 1 | `1` |
| trigger_kind | string | APPROVAL_ASSIST | `"APPROVAL_ASSIST"` |
| is_concurrent_job_limit_enabled | boolean | true | `true` |
| is_long_running | boolean | false | `false` |
| config_pages | array | [] | `[]` |
| config_vars | object | {} | `{}` |
| exported_at | string | ISO timestamp | `"2026-03-06T00:00:00.000Z"` |
| flow_config_pages | array | [] | `[]` |
| flow_config_vars | object | {} | `{}` |
| steps_data | array | [...] | Array of step objects |
| workflow | object | {...} | `{ "trigger": {...}, "steps": [...] }` |

---

## Step Fields (All 8 Required)

Every step in `steps_data` MUST have these 8 fields:

| Field | Type | Description |
|-------|------|-------------|
| key | string | Unique step ID (e.g., ai_1, zip_1, condition_1) |
| display_name | string | Human-readable name |
| connector_key | string | Connector type (ai, zip, http, etc.) |
| action_key | string | Action type (generic_ai, get_request, etc.) |
| input_config | object | Wrapped in `{"control": "object", "value": {...}}` |
| branches | null or array | null for linear, array for conditional |
| error_handling_policy | number | Always `1` |
| connection_var_key | null or string | Usually null, or `"config.http_connection"` |

---

## Node Types

### AI Connector

**connector_key:** `ai`

#### Actions

| Action | Description |
|--------|-------------|
| generic_ai | General AI analysis |
| approval_assist | Approval workflow trigger |

#### Action: generic_ai

**Required Input Fields:**

| Field | Control Type | Valid Values | Required |
|-------|--------------|--------------|----------|
| user_prompt | text | Any string with optional `${steps.X.response}` | YES |
| output_format | picklist | `structured`, `markdown` | Recommended |
| tools | multipicklist | `["document"]`, `["zip_data"]`, `["document", "zip_data"]` | Optional |
| structured_schema | array | Array of field definitions | If output_format=structured |
| model | picklist | `o4-mini`, `gpt-4.1` | Optional |
| include_citations | boolean | `true`, `false` | Optional |
| output_schema | object | Schema definition | Optional |
| array_schema | object | Array schema definition | Optional |
| data_sources | object | Data source config | Optional |

**structured_schema Format:**

```json
{
  "control": "array",
  "value": [
    {
      "control": "object",
      "value": {
        "key": { "control": "text", "value": "fieldName" },
        "type": { "control": "picklist", "value": "string" },
        "description": { "control": "text", "value": "Description" }
      }
    }
  ]
}
```

**Valid structured_schema types (picklist):**
- `string`
- `boolean`
- `number`
- `array`

#### Action: approval_assist

**No input_config required** - this is used as the trigger step.

---

### ZIP Connector

**connector_key:** `zip`

#### Actions

| Action | Description |
|--------|-------------|
| get_request | Fetch request data from Zip |
| get_vendor | Fetch vendor data from Zip |

#### Action: get_request

**Required Input Fields:**

| Field | Control Type | Valid Values | Example |
|-------|--------------|--------------|---------|
| request_id | text or ref | `${steps.trigger.request.id}` or `steps.trigger.request.id` | `"${steps.trigger.request.id}"` |

#### Action: get_vendor

**Required Input Fields:**

| Field | Control Type | Valid Values | Example |
|-------|--------------|--------------|---------|
| vendor_id | text or ref | `${steps.zip_1.vendor.id}` | `"${steps.zip_1.vendor.id}"` |

---

### HTTP Connector

**connector_key:** `http`

#### Actions

| Action | Description |
|--------|-------------|
| $http_client | Make HTTP API call |

#### Action: $http_client

**Required Input Fields:**

| Field | Control Type | Valid Values | Example |
|-------|--------------|--------------|---------|
| method | picklist | `POST` | `"POST"` |
| url | text | Any URL or path | `"/contract_risks"` |
| content_type | picklist | `application/json` | `"application/json"` |
| request_body | text | JSON with `${steps.X.response}` | See example |
| query_params | array | Array of query parameters | Optional |

**request_body Example:**

```json
{
  "control": "object",
  "value": {
    "requester": {
      "control": "ref",
      "value": "steps.zip_1.requester.email"
    },
    "request_id": {
      "control": "text",
      "value": "${steps.trigger.request.id}"
    }
  }
}
```

---

### Condition Connector

**connector_key:** `condition`

#### Actions

| Action | Description |
|--------|-------------|
| if_condition | Conditional branching |

#### Action: if_condition

**Required Input Fields:**

| Field | Control Type | Valid Values | Example |
|-------|--------------|--------------|---------|
| conditions | array | Array of condition objects | Required |

**conditions Format:**

```json
{
  "control": "array",
  "value": [
    {
      "control": "object",
      "value": {
        "left_value": {
          "control": "ref",
          "value": "steps.ai_1.response.has_documents"
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
  ]
}
```

**Valid operators (picklist):**
- `equals`
- `not_equals`

---

### Return Connector

**connector_key:** `return`

#### Actions

| Action | Description |
|--------|-------------|
| return_value | Return a value |

#### Action: return_value

**Required Input Fields:**

| Field | Control Type | Valid Values | Example |
|-------|--------------|--------------|---------|
| value | text or ref | `${steps.ai_1.response}` or `steps.ai_1.response` | `"${steps.ai_1.response}"` |

**Format:**

```json
{
  "control": "object",
  "value": {
    "value": {
      "control": "text",
      "value": "${steps.ai_1.response}"
    }
  }
}
```

---

### Jinja Connector

**connector_key:** `jinja`

#### Actions

| Action | Description |
|--------|-------------|
| render_json_template | Render Jinja2 template |

#### Action: render_json_template

**Required Input Fields:**

| Field | Control Type | Valid Values | Example |
|-------|--------------|--------------|---------|
| json_template | text | Jinja2 template string | Required |
| variables | array | Array of variable definitions | Required |

**json_template Example:**

```json
{
  "control": "text",
  "value": "[\n{% for item in input.data.list %}\n  {\n    \"name\": {{ item.name | tojson }},\n    \"number\": {{ item.account_number | tojson }}\n  }{% if not loop.last %},{% endif %}\n{% endfor %}\n]"
}
```

**variables Format:**

```json
{
  "control": "array",
  "value": [
    {
      "control": "object",
      "value": {
        "key": { "control": "text", "value": "input" },
        "value": {
          "control": "ref",
          "value": "steps.http_1.data"
        }
      }
    }
  ]
}
```

---

### Loop Connector

**connector_key:** `loop`

#### Actions

| Action | Description |
|--------|-------------|
| loop_n_times | Loop N times |
| break_loop | Exit loop |

#### Action: loop_n_times

**Required Input Fields:**

| Field | Control Type | Valid Values | Example |
|-------|--------------|--------------|---------|
| iteration_count | ref or number | `steps.python_1.result` or number | `"steps.python_1.result"` |

#### Action: break_loop

**No input_config required** - used to exit a loop.

---

### Memory Storage Connector

**connector_key:** `memory_storage`

#### Actions

| Action | Description |
|--------|-------------|
| set_value | Store a value |
| get_value | Retrieve a value |
| append_to_list | Append to a list |

#### Action: set_value

**Required Input Fields:**

| Field | Control Type | Valid Values | Example |
|-------|--------------|--------------|---------|
| key | text | Variable name | `"items_accumulated"` |
| value | text, ref, or json | Value to store | `"${steps.jinja_1.result}"` |

#### Action: get_value

**Required Input Fields:**

| Field | Control Type | Valid Values | Example |
|-------|--------------|--------------|---------|
| key | text | Variable name | `"next_page_token"` |
| default_value | null, text, or ref | Default if not found | `null` |

#### Action: append_to_list

**Required Input Fields:**

| Field | Control Type | Valid Values | Example |
|-------|--------------|--------------|---------|
| key | text | List variable name | `"items_accumulated_gl_codes"` |
| value | text or ref | Value to append | `"${steps.jinja_4.result}"` |

---

### Python Connector

**connector_key:** `python`

#### Actions

| Action | Description |
|--------|-------------|
| execute_script | Execute Python code |

#### Action: execute_script

**Required Input Fields:**

| Field | Control Type | Valid Values | Example |
|-------|--------------|--------------|---------|
| script | code | Python function | Required |
| variables | array | Input variables | Required |

**script Format:**

```json
{
  "control": "code",
  "value": "def execute(input):\n    roundedNumber = 0\n    size = input['size']\n    total = input['total']\n    roundedNumber = math.ceil(total/size)\n    return roundedNumber"
}
```

**variables Format:**

```json
{
  "control": "array",
  "value": [
    {
      "control": "object",
      "value": {
        "key": { "control": "text", "value": "total" },
        "value": { "control": "ref", "value": "steps.http_4.data.total" }
      }
    }
  ]
}
```

---

## Workflow Structure

The `workflow` field has this structure:

```json
{
  "trigger": {
    "key": "trigger",
    "branches": null
  },
  "steps": [
    { "key": "zip_1", "branches": null },
    { "key": "ai_1", "branches": null },
    { "key": "condition_1", "branches": [
      { "key": "true", "label": "True", "steps": [...] },
      { "key": "default", "label": "False", "steps": [...] }
    ]},
    { "key": "return_1", "branches": null }
  ]
}
```

**Branch labels (picklist):**
- `"True"` - condition met
- `"False"` - condition not met

**IMPORTANT: Labels are STRICT**
- Only `"True"` and `"False"` are valid
- NO custom labels like "SOW Found", "No MSA", "Yes", "No", etc.
- The branch `key` can be anything (`"true"`, `"default"`, etc.) but `label` must be exactly "True" or "False"

---

## Common Patterns

### Reference Patterns

**Pattern 1: text control with interpolation**
```json
{
  "control": "text",
  "value": "${steps.ai_1.response.field}"
}
```

**Pattern 2: ref control (direct reference)**
```json
{
  "control": "ref",
  "value": "steps.ai_1.response.field"
}
```

**BOTH patterns are valid.** Use:
- `text` + `${}` for string interpolation in prompts, URLs, templates
- `ref` for direct data pass-through

### Input Config Wrapper

**ALWAYS wrap input_config like this:**

```json
{
  "input_config": {
    "control": "object",
    "value": {
      "field_name": {
        "control": "CONTROL_TYPE",
        "value": "VALUE"
      }
    }
  }
}
```

---

## Quick Reference

### Picklist Values by Context

| Context | Valid Values |
|---------|--------------|
| output_format | `structured`, `markdown` |
| operator | `equals`, `not_equals` |
| method | `POST` |
| content_type | `application/json` |
| model | `o4-mini`, `gpt-4.1` |
| tools | `document`, `zip_data` (can combine) |
| structured_schema type | `string`, `boolean`, `number`, `array` |

### Step ID Patterns

| Connector | ID Pattern | Examples |
|-----------|------------|----------|
| ai | ai_N or custom | ai_1, ai_2, ai_compile |
| zip | zip_N | zip_1, zip_2 |
| http | http_N | http_1, http_2 |
| condition | condition_N | condition_1, condition_2 |
| return | return_N or custom | return_1, return_final |
| jinja | jinja_N | jinja_1, jinja_2 |
| loop | loop_N | loop_1, loop_2 |
| memory_storage | memory_storage_N | memory_storage_1 |
| python | python_N | python_1 |
| trigger | trigger | trigger |
