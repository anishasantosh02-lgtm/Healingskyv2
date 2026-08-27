import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { config } from "./config.js";

let anthropicClient = null;
let azureClient = null;

// ============================================================
// Anthropic Client
// ============================================================

function getAnthropicClient() {
  if (!anthropicClient) {
    if (!config.anthropic.apiKey) {
      throw new Error(
        "Missing ANTHROPIC_API_KEY. Check your .env file."
      );
    }

    anthropicClient = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
  }

  return anthropicClient;
}

// ============================================================
// Azure OpenAI Client
// ============================================================

function getAzureClient() {
  if (!azureClient) {
    const {
      endpoint,
      apiKey,
      deployment,
      apiVersion,
    } = config.azure;

    if (!endpoint || !apiKey || !deployment) {
      throw new Error(
        "Missing Azure OpenAI configuration. Check AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY and AZURE_OPENAI_DEPLOYMENT_NAME."
      );
    }

    azureClient = new OpenAI({
      apiKey,

      baseURL:
        `${endpoint}/openai/deployments/${deployment}`,

      defaultQuery: {
        "api-version": apiVersion,
      },

      defaultHeaders: {
        "api-key": apiKey,
      },
    });
  }

  return azureClient;
}

// ============================================================
// Tool conversion
// ============================================================

function convertToolsForAnthropic(tools = []) {
  return tools.map((tool) => ({
    name: tool.function.name,

    description:
      tool.function.description || "",

    input_schema:
      tool.function.parameters,
  }));
}

// ============================================================
// Anthropic response normalization
// ============================================================

function normalizeAnthropicResponse(response) {
  const toolCalls = [];

  let textContent = "";

  for (const block of response.content || []) {
    if (block.type === "text") {
      textContent += block.text || "";
    }

    if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,

        type: "function",

        function: {
          name: block.name,

          arguments:
            JSON.stringify(block.input || {}),
        },
      });
    }
  }

  return {
    assistantMessage: {
      role: "assistant",

      content:
        textContent || null,

      tool_calls:
        toolCalls,
    },

    stopReason:
      response.stop_reason,
  };
}

// ============================================================
// Anthropic message conversion
// ============================================================

function convertMessagesForAnthropic(messages = []) {
  const converted = [];

  for (const message of messages) {

    // --------------------------------------------------------
    // User message
    // --------------------------------------------------------

    if (message.role === "user") {
      converted.push({
        role: "user",

        content:
          message.content || "",
      });

      continue;
    }

    // --------------------------------------------------------
    // Assistant message
    // --------------------------------------------------------

    if (message.role === "assistant") {
      const content = [];

      if (message.content) {
        content.push({
          type: "text",
          text: message.content,
        });
      }

      for (const toolCall of message.tool_calls || []) {
        let input = {};

        try {
          input = JSON.parse(
            toolCall.function.arguments || "{}"
          );
        } catch {
          input = {};
        }

        content.push({
          type: "tool_use",

          id: toolCall.id,

          name:
            toolCall.function.name,

          input,
        });
      }

      converted.push({
        role: "assistant",
        content,
      });

      continue;
    }

    // --------------------------------------------------------
    // Tool result
    // --------------------------------------------------------

    if (message.role === "tool") {
      converted.push({
        role: "user",

        content: [
          {
            type: "tool_result",

            tool_use_id:
              message.tool_call_id,

            content:
              message.content || "",
          },
        ],
      });
    }
  }

  return converted;
}

// ============================================================
// Anthropic call
// ============================================================

async function callAnthropic({
  systemPrompt,
  messages,
  tools,
  maxTokens,
}) {
  const client =
    getAnthropicClient();

  const response =
    await client.messages.create({
      model:
        config.anthropic.model,

      max_tokens:
        maxTokens,

      system:
        systemPrompt,

      messages:
        convertMessagesForAnthropic(
          messages
        ),

      tools:
        convertToolsForAnthropic(
          tools
        ),
    });

  return normalizeAnthropicResponse(
    response
  );
}

// ============================================================
// Azure OpenAI call
// ============================================================

async function callAzure({
  systemPrompt,
  messages,
  tools,
  maxTokens,
}) {
  const client =
    getAzureClient();

  const response =
    await client.chat.completions.create({
      model:
        config.azure.deployment,

      max_completion_tokens:
        maxTokens,

      messages: [
        {
          role: "system",

          content:
            systemPrompt,
        },

        ...messages,
      ],

      tools,

      tool_choice:
        "auto",
    });

  const assistantMessage =
    response.choices?.[0]?.message;

  if (!assistantMessage) {
    throw new Error(
      "Azure OpenAI returned no assistant message."
    );
  }

  return {
    assistantMessage,

    stopReason:
      response.choices?.[0]?.finish_reason,
  };
}

// ============================================================
// PUBLIC FUNCTION
// ============================================================
//
// agent.js should import this:
//
// import { callLLM } from "./llmClient.js";
//
// and call:
//
// await callLLM({
//   systemPrompt,
//   messages,
//   tools,
//   maxTokens: 1500,
// });
//
// ============================================================

export async function callLLM({
  systemPrompt,
  messages,
  tools,
  maxTokens = 1500,
}) {
  switch (config.llmProvider) {

    case "anthropic":
      return callAnthropic({
        systemPrompt,
        messages,
        tools,
        maxTokens,
      });

    case "azure":
    case "azure-openai":
      return callAzure({
        systemPrompt,
        messages,
        tools,
        maxTokens,
      });

    default:
      throw new Error(
        `Unsupported LLM_PROVIDER: ${config.llmProvider}. Use "anthropic" or "azure".`
      );
  }
}