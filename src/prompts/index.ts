// src/prompts/index.ts — re-exports only the Zip-Pilot prompt
// Old prompts (orchestrator, validator, generator, stepBuilder, composer, modifier, auditor, idManager)
// are no longer used. This file exports only ZIP_PILOT_PROMPT.

export { ZIP_PILOT_PROMPT } from "./zip-pilot.js";
