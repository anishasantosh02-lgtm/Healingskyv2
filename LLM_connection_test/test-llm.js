import { callLLM, createLLMClient } from "../llmclient.js";
import { config } from "../config.js";

console.log("==========================================");
console.log(`Testing Dynamic LLM Provider: ${config.llmProvider.toUpperCase()}`);
console.log("==========================================");

try {
  const result = await callLLM({
    systemPrompt: "You are a helpful assistant.",
    messages: [
      {
        role: "user",
        content: `Say "Dynamic LLM test successful for ${config.llmProvider}" and nothing else.`,
      },
    ],
    maxTokens: 100,
  });

  console.log("Response Content:");
  console.log(result.assistantMessage.content);
  console.log("\nStop Reason:", result.stopReason);
  console.log("SUCCESS: Dynamic LLM connection test passed!");

  // Also test createLLMClient factory
  const client = createLLMClient();
  const factoryResult = await client.call({
    messages: [{ role: "user", content: "Reply with 'Factory test OK'" }],
    maxTokens: 50,
  });
  console.log("\nFactory Client Response:");
  console.log(factoryResult.assistantMessage.content);

} catch (error) {
  console.error("ERROR running LLM connection test:", error.message);
}
