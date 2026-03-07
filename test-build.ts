import { createZipAgentBuilder } from "./src/index.js";
const { harness } = createZipAgentBuilder();
async function run() {
  const tools = harness.getTools();
  console.log(Object.keys(tools));
}
run();
