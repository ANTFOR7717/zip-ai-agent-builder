# Zip Agent Node Schema

> **Exact transfer source:** `src/schemas/example.json`
>
> Each node below has its own dedicated schema table using the exact field format requested, followed by the exact node structure from the authoritative example JSON.

---

## Source Snapshot

- `type`: `task_template`
- `trigger_kind`: `APPROVAL_ASSIST`
- `version`: `1`
- `exported_at`: `2026-03-09T01:34:52.499Z`
- `name`: `New PoC Agent`
- total `steps_data` nodes: `20`

## Exact Top-Level JSON Blocks

### `config_pages`
```json
[
  {
    "title": "Connections",
    "description": "",
    "items": [
      {
        "kind": "config_var",
        "config_var_key": "http_connection"
      }
    ]
  },
  {
    "title": "Setup",
    "description": "",
    "items": []
  }
]
```

### `config_vars`
```json
{
  "http_connection": {
    "key": "http_connection",
    "title": "Http connection",
    "description": null,
    "required": true,
    "kind": "connection",
    "connector": {
      "key": "http"
    }
  }
}
```

### `flow_config_pages`
```json
[]
```

### `flow_config_vars`
```json
{}
```

### `workflow`
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
      "key": "ai_2",
      "branches": null
    },
    {
      "key": "condition_1",
      "branches": [
        {
          "key": "default",
          "label": "False",
          "steps": [
            {
              "key": "invoke_subflow_1",
              "branches": null
            },
            {
              "key": "terminate_1",
              "branches": null
            }
          ]
        },
        {
          "key": "true",
          "label": "True",
          "steps": [
            {
              "key": "loop_1",
              "branches": [
                {
                  "key": "default",
                  "label": null,
                  "steps": [
                    {
                      "key": "loop_2",
                      "branches": [
                        {
                          "key": "default",
                          "label": null,
                          "steps": [
                            {
                              "key": "loop_3",
                              "branches": null
                            }
                          ]
                        }
                      ]
                    },
                    {
                      "key": "loop_4",
                      "branches": [
                        {
                          "key": "default",
                          "label": null,
                          "steps": []
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              "key": "sleep_1",
              "branches": null
            },
            {
              "key": "condition_2",
              "branches": [
                {
                  "key": "default",
                  "label": "False",
                  "steps": [
                    {
                      "key": "datetime_utils_1",
                      "branches": null
                    },
                    {
                      "key": "datetime_utils_2",
                      "branches": null
                    }
                  ]
                },
                {
                  "key": "true",
                  "label": "True",
                  "steps": [
                    {
                      "key": "http_1",
                      "branches": null
                    },
                    {
                      "key": "http_2",
                      "branches": null
                    },
                    {
                      "key": "http_3",
                      "branches": null
                    }
                  ]
                }
              ]
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

## Node Tables

### Node `ai_1` — `ai / generic_ai`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `ai_1` | Yes |
| `display_name` | `string` | `Generic AI` | Yes |
| `connector_key` | `string` | `ai` | Yes |
| `action_key` | `string` | `generic_ai` | Yes |
| `input_config` | `object` | wrapper: control=`object`, value keys=`tools`, `output_format`, `include_citations`, `user_prompt` | Yes |
| `input_config.control` | `string` | `object` | Yes |
| `input_config.value` | `object` | object keys=`tools`, `output_format`, `include_citations`, `user_prompt` | Yes |
| `input_config.value.tools` | `multipicklist` | wrapper: control=`multipicklist`, value=`["web_search_preview","document","zip_data","ai_company_context"]` | Yes |
| `input_config.value.tools.control` | `string` | `multipicklist` | Yes |
| `input_config.value.tools.value` | `array` | `["web_search_preview","document","zip_data","ai_company_context"]` | Yes |
| `input_config.value.tools.value[0]` | `string` | `web_search_preview` | Yes |
| `input_config.value.tools.value[1]` | `string` | `document` | Yes |
| `input_config.value.tools.value[2]` | `string` | `zip_data` | Yes |
| `input_config.value.tools.value[3]` | `string` | `ai_company_context` | Yes |
| `input_config.value.output_format` | `picklist` | wrapper: control=`picklist`, value=`raw` | Yes |
| `input_config.value.output_format.control` | `string` | `picklist` | Yes |
| `input_config.value.output_format.value` | `string` | `raw` | Yes |
| `input_config.value.include_citations` | `boolean` | wrapper: control=`boolean`, value=`false` | Yes |
| `input_config.value.include_citations.control` | `string` | `boolean` | Yes |
| `input_config.value.include_citations.value` | `boolean` | `false` | Yes |
| `input_config.value.user_prompt` | `text` | wrapper: control=`text`, value=`example` | Yes |
| `input_config.value.user_prompt.control` | `string` | `text` | Yes |
| `input_config.value.user_prompt.value` | `string` | `example` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

```json
{
  "key": "ai_1",
  "display_name": "Generic AI",
  "connector_key": "ai",
  "action_key": "generic_ai",
  "input_config": {
    "control": "object",
    "value": {
      "tools": {
        "control": "multipicklist",
        "value": [
          "web_search_preview",
          "document",
          "zip_data",
          "ai_company_context"
        ]
      },
      "output_format": {
        "control": "picklist",
        "value": "raw"
      },
      "include_citations": {
        "control": "boolean",
        "value": false
      },
      "user_prompt": {
        "control": "text",
        "value": "example"
      }
    }
  },
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### Node `ai_2` — `ai / generic_ai`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `ai_2` | Yes |
| `display_name` | `string` | `Generic AI` | Yes |
| `connector_key` | `string` | `ai` | Yes |
| `action_key` | `string` | `generic_ai` | Yes |
| `input_config` | `object` | wrapper: control=`object`, value keys=`tools`, `include_citations`, `user_prompt` | Yes |
| `input_config.control` | `string` | `object` | Yes |
| `input_config.value` | `object` | object keys=`tools`, `include_citations`, `user_prompt` | Yes |
| `input_config.value.tools` | `multipicklist` | wrapper: control=`multipicklist`, value=`["web_search_preview"]` | Yes |
| `input_config.value.tools.control` | `string` | `multipicklist` | Yes |
| `input_config.value.tools.value` | `array` | `["web_search_preview"]` | Yes |
| `input_config.value.tools.value[0]` | `string` | `web_search_preview` | Yes |
| `input_config.value.include_citations` | `boolean` | wrapper: control=`boolean`, value=`true` | Yes |
| `input_config.value.include_citations.control` | `string` | `boolean` | Yes |
| `input_config.value.include_citations.value` | `boolean` | `true` | Yes |
| `input_config.value.user_prompt` | `ref` | wrapper: control=`ref`, value=`steps.ai_1.response` | Yes |
| `input_config.value.user_prompt.control` | `string` | `ref` | Yes |
| `input_config.value.user_prompt.value` | `string` | `steps.ai_1.response` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

```json
{
  "key": "ai_2",
  "display_name": "Generic AI",
  "connector_key": "ai",
  "action_key": "generic_ai",
  "input_config": {
    "control": "object",
    "value": {
      "tools": {
        "control": "multipicklist",
        "value": [
          "web_search_preview"
        ]
      },
      "include_citations": {
        "control": "boolean",
        "value": true
      },
      "user_prompt": {
        "control": "ref",
        "value": "steps.ai_1.response"
      }
    }
  },
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### Node `condition_1` — `condition / if_condition`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `condition_1` | Yes |
| `display_name` | `string` | `If condition` | Yes |
| `connector_key` | `string` | `condition` | Yes |
| `action_key` | `string` | `if_condition` | Yes |
| `input_config` | `null` | `null` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

```json
{
  "key": "condition_1",
  "display_name": "If condition",
  "connector_key": "condition",
  "action_key": "if_condition",
  "input_config": null,
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### Node `condition_2` — `condition / if_condition`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `condition_2` | Yes |
| `display_name` | `string` | `If condition` | Yes |
| `connector_key` | `string` | `condition` | Yes |
| `action_key` | `string` | `if_condition` | Yes |
| `input_config` | `null` | `null` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

```json
{
  "key": "condition_2",
  "display_name": "If condition",
  "connector_key": "condition",
  "action_key": "if_condition",
  "input_config": null,
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### Node `datetime_utils_1` — `datetime_utils / format_date`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `datetime_utils_1` | Yes |
| `display_name` | `string` | `Format date` | Yes |
| `connector_key` | `string` | `datetime_utils` | Yes |
| `action_key` | `string` | `format_date` | Yes |
| `input_config` | `null` | `null` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

```json
{
  "key": "datetime_utils_1",
  "display_name": "Format date",
  "connector_key": "datetime_utils",
  "action_key": "format_date",
  "input_config": null,
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### Node `datetime_utils_2` — `datetime_utils / date_to_unix_timestamp`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `datetime_utils_2` | Yes |
| `display_name` | `string` | `Date to Unix timestamp` | Yes |
| `connector_key` | `string` | `datetime_utils` | Yes |
| `action_key` | `string` | `date_to_unix_timestamp` | Yes |
| `input_config` | `null` | `null` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

```json
{
  "key": "datetime_utils_2",
  "display_name": "Date to Unix timestamp",
  "connector_key": "datetime_utils",
  "action_key": "date_to_unix_timestamp",
  "input_config": null,
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### Node `http_1` — `http / $http_client`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `http_1` | Yes |
| `display_name` | `string` | `Send HTTP request` | Yes |
| `connector_key` | `string` | `http` | Yes |
| `action_key` | `string` | `$http_client` | Yes |
| `input_config` | `null` | `null` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `string` | `config.http_connection` | Yes |

#### Exact node structure

```json
{
  "key": "http_1",
  "display_name": "Send HTTP request",
  "connector_key": "http",
  "action_key": "$http_client",
  "input_config": null,
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": "config.http_connection"
}
```

### Node `http_2` — `http / $http_form`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `http_2` | Yes |
| `display_name` | `string` | `HTTP form data request` | Yes |
| `connector_key` | `string` | `http` | Yes |
| `action_key` | `string` | `$http_form` | Yes |
| `input_config` | `null` | `null` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `string` | `config.http_connection` | Yes |

#### Exact node structure

```json
{
  "key": "http_2",
  "display_name": "HTTP form data request",
  "connector_key": "http",
  "action_key": "$http_form",
  "input_config": null,
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": "config.http_connection"
}
```

### Node `http_3` — `http / $http_upload`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `http_3` | Yes |
| `display_name` | `string` | `Upload file` | Yes |
| `connector_key` | `string` | `http` | Yes |
| `action_key` | `string` | `$http_upload` | Yes |
| `input_config` | `null` | `null` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `string` | `config.http_connection` | Yes |

#### Exact node structure

```json
{
  "key": "http_3",
  "display_name": "Upload file",
  "connector_key": "http",
  "action_key": "$http_upload",
  "input_config": null,
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": "config.http_connection"
}
```

### Node `invoke_subflow_1` — `invoke_subflow / invoke_subflow`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `invoke_subflow_1` | Yes |
| `display_name` | `string` | `Invoke callable task` | Yes |
| `connector_key` | `string` | `invoke_subflow` | Yes |
| `action_key` | `string` | `invoke_subflow` | Yes |
| `input_config` | `null` | `null` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

```json
{
  "key": "invoke_subflow_1",
  "display_name": "Invoke callable task",
  "connector_key": "invoke_subflow",
  "action_key": "invoke_subflow",
  "input_config": null,
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### Node `loop_1` — `loop / for_each`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `loop_1` | Yes |
| `display_name` | `string` | `Loop over items` | Yes |
| `connector_key` | `string` | `loop` | Yes |
| `action_key` | `string` | `for_each` | Yes |
| `input_config` | `null` | `null` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

```json
{
  "key": "loop_1",
  "display_name": "Loop over items",
  "connector_key": "loop",
  "action_key": "for_each",
  "input_config": null,
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### Node `loop_2` — `loop / loop_n_times`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `loop_2` | Yes |
| `display_name` | `string` | `Loop N times` | Yes |
| `connector_key` | `string` | `loop` | Yes |
| `action_key` | `string` | `loop_n_times` | Yes |
| `input_config` | `null` | `null` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

```json
{
  "key": "loop_2",
  "display_name": "Loop N times",
  "connector_key": "loop",
  "action_key": "loop_n_times",
  "input_config": null,
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### Node `loop_3` — `loop / break_loop`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `loop_3` | Yes |
| `display_name` | `string` | `Break loop` | Yes |
| `connector_key` | `string` | `loop` | Yes |
| `action_key` | `string` | `break_loop` | Yes |
| `input_config` | `null` | `null` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

```json
{
  "key": "loop_3",
  "display_name": "Break loop",
  "connector_key": "loop",
  "action_key": "break_loop",
  "input_config": null,
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### Node `loop_4` — `loop / loop_at_interval`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `loop_4` | Yes |
| `display_name` | `string` | `Schedule execution` | Yes |
| `connector_key` | `string` | `loop` | Yes |
| `action_key` | `string` | `loop_at_interval` | Yes |
| `input_config` | `null` | `null` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

```json
{
  "key": "loop_4",
  "display_name": "Schedule execution",
  "connector_key": "loop",
  "action_key": "loop_at_interval",
  "input_config": null,
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### Node `return_1` — `return / return_value`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `return_1` | Yes |
| `display_name` | `string` | `Return value` | Yes |
| `connector_key` | `string` | `return` | Yes |
| `action_key` | `string` | `return_value` | Yes |
| `input_config` | `null` | `null` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

```json
{
  "key": "return_1",
  "display_name": "Return value",
  "connector_key": "return",
  "action_key": "return_value",
  "input_config": null,
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### Node `sleep_1` — `sleep / sleep`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `sleep_1` | Yes |
| `display_name` | `string` | `Sleep` | Yes |
| `connector_key` | `string` | `sleep` | Yes |
| `action_key` | `string` | `sleep` | Yes |
| `input_config` | `null` | `null` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

```json
{
  "key": "sleep_1",
  "display_name": "Sleep",
  "connector_key": "sleep",
  "action_key": "sleep",
  "input_config": null,
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### Node `terminate_1` — `terminate / terminate_with_error`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `terminate_1` | Yes |
| `display_name` | `string` | `Terminate with error` | Yes |
| `connector_key` | `string` | `terminate` | Yes |
| `action_key` | `string` | `terminate_with_error` | Yes |
| `input_config` | `null` | `null` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

```json
{
  "key": "terminate_1",
  "display_name": "Terminate with error",
  "connector_key": "terminate",
  "action_key": "terminate_with_error",
  "input_config": null,
  "branches": null,
  "error_handling_policy": 1,
  "connection_var_key": null
}
```

### Node `trigger` — `ai / approval_assist`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `trigger` | Yes |
| `display_name` | `string` | `Approval assist` | Yes |
| `connector_key` | `string` | `ai` | Yes |
| `action_key` | `string` | `approval_assist` | Yes |
| `input_config` | `null` | `null` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

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

### Node `zip_1` — `zip / get_request`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `zip_1` | Yes |
| `display_name` | `string` | `Get Request` | Yes |
| `connector_key` | `string` | `zip` | Yes |
| `action_key` | `string` | `get_request` | Yes |
| `input_config` | `object` | wrapper: control=`object`, value keys=`request_id` | Yes |
| `input_config.control` | `string` | `object` | Yes |
| `input_config.value` | `object` | object keys=`request_id` | Yes |
| `input_config.value.request_id` | `ref` | wrapper: control=`ref`, value=`trigger.request_id` | Yes |
| `input_config.value.request_id.control` | `string` | `ref` | Yes |
| `input_config.value.request_id.value` | `string` | `trigger.request_id` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

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

### Node `zip_2` — `zip / get_vendor`

| Field | Control Type | Valid Values | Required |
|---|---|---|---|
| `key` | `string` | `zip_2` | Yes |
| `display_name` | `string` | `Get Vendor` | Yes |
| `connector_key` | `string` | `zip` | Yes |
| `action_key` | `string` | `get_vendor` | Yes |
| `input_config` | `object` | wrapper: control=`object`, value keys=`vendor_id` | Yes |
| `input_config.control` | `string` | `object` | Yes |
| `input_config.value` | `object` | object keys=`vendor_id` | Yes |
| `input_config.value.vendor_id` | `ref` | wrapper: control=`ref`, value=`steps.zip_1.body.vendor_id` | Yes |
| `input_config.value.vendor_id.control` | `string` | `ref` | Yes |
| `input_config.value.vendor_id.value` | `string` | `steps.zip_1.body.vendor_id` | Yes |
| `branches` | `null` | `null` | Yes |
| `error_handling_policy` | `number` | `1` | Yes |
| `connection_var_key` | `null` | `null` | Yes |

#### Exact node structure

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

## Exact Reference Strings Present In The Example

- `steps.ai_1.response`
- `trigger.request_id`
- `steps.zip_1.body.vendor_id`

## Exact Accuracy Boundary

This markdown intentionally transfers only what exists in `src/schemas/example.json`.