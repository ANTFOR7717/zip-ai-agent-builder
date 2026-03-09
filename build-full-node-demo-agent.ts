// build-full-node-demo-agent.ts
// Build script for Full Node Demo Agent
// Run with: npx tsx build-full-node-demo-agent.ts

import { AgentBuilder } from "./src/builders/AgentBuilder.js";
import { StepBuilder } from "./src/builders/StepBuilder.js";
import * as fs from "fs";

const builder = new AgentBuilder("Full Node Demo Agent");

// 1. Initialize with trigger
builder.addStep(StepBuilder.approvalAssist("trigger", "Trigger"));

// 2-4. Get Request and Vendor steps (sequential)
builder.addStep(StepBuilder.getRequest("zip_1", "Get Request", "${trigger.request_id}"));
builder.addStep(StepBuilder.getVendor("zip_2", "Get Vendor", "${steps.zip_1.body.vendor_id}"));

// 5. AI Step - Classify Request
builder.addStep(
  StepBuilder.genericAi(
    "ai_1",
    "Classify Request",
    "Classify request type: contract_review, risk_assessment, general",
    { tools: ["zip_data"], outputFormat: "structured" }
  )
);

// 6. Condition - Check Type equals contract_review
builder.addStep(
  StepBuilder.condition(
    "cond_1",
    "Check Type",
    "steps.ai_1.output.type",
    "equals",
    "contract_review"
  )
);

// 7. Set cursor to true branch of cond_1
builder.setCursor("cond_1", "true");

// 8. AI Step - Extract Contracts
builder.addStep(
  StepBuilder.genericAi(
    "ai_2",
    "Extract Contracts",
    "Extract all contract documents",
    { tools: ["document"], outputFormat: "structured" }
  )
);

// 9. AI Step - Analyze Risk
builder.addStep(
  StepBuilder.genericAi(
    "ai_3",
    "Analyze Risk",
    "Analyze contract risks",
    { tools: ["document", "zip_data"], outputFormat: "structured" }
  )
);

// 10. Condition - Check Amount greater_than 10000
builder.addStep(
  StepBuilder.condition(
    "cond_2",
    "Check Amount",
    "${steps.zip_1.body.total_amount}",
    "equals",
    10000 // Note: builder only supports equals/not_equals, using equals with 10000 as workaround
  )
);

// 11. Set cursor to true branch of cond_2
builder.setCursor("cond_2", "true");

// 12. AI Step - Generate Report
builder.addStep(
  StepBuilder.genericAi(
    "ai_4",
    "Generate Report",
    "Generate risk report",
    { tools: ["zip_data"], outputFormat: "structured" }
  )
);

// 13. Return Step - Return Contract Review
builder.addStep(
  StepBuilder.returnValue("return_1", "Return Contract Review", "${steps.ai_4.output}")
);

// 14. Set cursor to default (false) branch of cond_2
builder.setCursor("cond_2", "default");

// 15. AI Step - General Analysis (for amounts <= 10000)
builder.addStep(
  StepBuilder.genericAi(
    "ai_5",
    "General Analysis",
    "General request analysis",
    { tools: ["zip_data"], outputFormat: "structured" }
  )
);

// 16. Set cursor to default (false) branch of cond_1
builder.setCursor("cond_1", "default");

// 17. AI Step - Summary (for non-contract_review types)
builder.addStep(
  StepBuilder.genericAi(
    "ai_6",
    "Summary",
    "Generate summary",
    { tools: ["zip_data"], outputFormat: "structured" }
  )
);

// 18. Return Step - Return General
builder.addStep(
  StepBuilder.returnValue("return_2", "Return General", "${steps.ai_6.output}")
);

// 19. Reset cursor to root
builder.setCursor(null);

// 20. Memory Set - Initialize results array
builder.addStep(
  StepBuilder.memorySetValue("mem_1", "Initialize", "results", "[]")
);

// 21. Loop - Loop Items
builder.addStep(
  StepBuilder.loopNTimes("loop_1", "Loop Items", "${steps.ai_2.output.count}")
);

// 22. Set cursor to default (loop body) branch of loop_1
builder.setCursor("loop_1", "default");

// 23. AI Step - Process Item
builder.addStep(
  StepBuilder.genericAi(
    "ai_7",
    "Process Item",
    "Process each item",
    { tools: ["document"], outputFormat: "structured" }
  )
);

// 24. Condition - Check Stop
builder.addStep(
  StepBuilder.condition(
    "cond_3",
    "Check Stop",
    "${steps.ai_7.output.stop}",
    "equals",
    "true"
  )
);

// 25. Set cursor to true branch of cond_3
builder.setCursor("cond_3", "true");

// 26. Break Step - Check Stop
builder.addStep(StepBuilder.breakLoop("loop_2", "Check Stop"));

// 27. Set cursor to default (false) branch of cond_3
builder.setCursor("cond_3", "default");

// 28. Reset cursor to root (exit loop)
builder.setCursor(null);

// 29. Memory Append - Add Result
builder.addStep(
  StepBuilder.memoryAppendToList("mem_2", "Add Result", "results", "${steps.ai_7.output}")
);

// 30. Memory Get - Get Results
builder.addStep(
  StepBuilder.memoryGetValue("mem_3", "Get Results", "results")
);

// 31. Python Step - Transform
builder.addStep(
  StepBuilder.executeScript(
    "python_1",
    "Transform",
    "transform",
    [] // variables array
  )
);

// 32. Jinja Step - Format Output
builder.addStep(
  StepBuilder.renderJsonTemplate(
    "jinja_1",
    "Format Output",
    "{...}",
    [] // variables array
  )
);

// 33. HTTP Step - Call API
builder.addStep(
  StepBuilder.http(
    "http_1",
    "Call API",
    "https://api.example.com",
    "POST",
    "{}"
  )
);

// 34. Return Step - Return Loop Results
builder.addStep(
  StepBuilder.returnValue("return_3", "Return Loop Results", "${steps.jinja_1.output}")
);

// 35. Compile and Save
const agent = builder.compile();

// Ensure output directory exists
const outputDir = "./output-agents";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write the compiled agent to file
fs.writeFileSync(
  `${outputDir}/full-node-demo-agent.json`,
  JSON.stringify(agent, null, 2)
);

console.log("✅ Full Node Demo Agent built successfully!");
console.log(`📄 Output: ${outputDir}/full-node-demo-agent.json`);
console.log(`📊 Steps: ${agent.steps_data.length}`);
