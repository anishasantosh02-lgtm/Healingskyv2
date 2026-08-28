import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { config, validateLLMConfig } from "./config.js";

// Cached client instances
const clientCache = new Map();

/**
 * Get or create an Anthropic client instance.
 */
export function getAnthropicClient(customConfig = {}) {
  const apiKey = customConfig.apiKey || config.anthropic.apiKey;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY. Check your environment configuration.");
  }

  const cacheKey = `anthropic:${apiKey}`;
  if (!clientCache.has(cacheKey)) {
    clientCache.set(cacheKey, new Anthropic({ apiKey }));
  }

  return clientCache.get(cacheKey);
}

/**
 * Get or create an Azure OpenAI client instance.
 */
export function getAzureClient(customConfig = {}) {
  const endpoint = customConfig.endpoint || config.azure.endpoint;
  const apiKey = customConfig.apiKey || config.azure.apiKey;
  const deployment = customConfig.deployment || config.azure.deployment;
  const apiVersion = customConfig.apiVersion || config.azure.apiVersion;

  if (!endpoint || !apiKey || !deployment) {
    throw new Error(
      "Missing Azure OpenAI configuration. Endpoint, API Key, and Deployment Name are required."
    );
  }

  const cacheKey = `azure:${endpoint}:${deployment}:${apiKey}`;
  if (!clientCache.has(cacheKey)) {
    clientCache.set(
      cacheKey,
      new OpenAI({
        apiKey,
        baseURL: `${endpoint}/openai/deployments/${deployment}`,
        defaultQuery: { "api-version": apiVersion },
        defaultHeaders: { "api-key": apiKey },
      })
    );
  }

  return clientCache.get(cacheKey);
}

/**
 * Get or create a Standard OpenAI client instance.
 */
export function getOpenAIClient(customConfig = {}) {
  const apiKey = customConfig.apiKey || config.openai.apiKey;
  const baseURL = customConfig.baseURL || config.openai.baseURL;
  const organization = customConfig.organization || config.openai.organization;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY. Check your environment configuration.");
  }

  const cacheKey = `openai:${apiKey}:${baseURL || "default"}`;
  if (!clientCache.has(cacheKey)) {
    const opts = { apiKey };
    if (baseURL) opts.baseURL = baseURL;
    if (organization) opts.organization = organization;
    clientCache.set(cacheKey, new OpenAI(opts));
  }

  return clientCache.get(cacheKey);
}

/**
 * Get or create a Custom / OpenAI-compatible client instance.
 */
export function getCustomClient(customConfig = {}) {
  const endpoint = customConfig.endpoint || config.custom.endpoint;
  const apiKey = customConfig.apiKey || config.custom.apiKey;

  if (!endpoint) {
    throw new Error("Missing custom LLM base URL endpoint. Check your environment configuration.");
  }

  const cacheKey = `custom:${endpoint}:${apiKey}`;
  if (!clientCache.has(cacheKey)) {
    clientCache.set(
      cacheKey,
      new OpenAI({
        apiKey: apiKey || "dummy-key",
        baseURL: endpoint,
      })
    );
  }

  return clientCache.get(cacheKey);
}

// ============================================================
// Tool Normalization
// ============================================================

export function convertToolsForAnthropic(tools = []) {
  if (!Array.isArray(tools)) return [];
  return tools.map((tool) => ({
    name: tool.function ? tool.function.name : tool.name,
    description: (tool.function ? tool.function.description : tool.description) || "",
    input_schema: tool.function ? tool.function.parameters : tool.input_schema || { type: "object", properties: {} },
  }));
}

export function convertToolChoiceForAnthropic(toolChoice) {
  if (!toolChoice) return undefined;
  if (toolChoice === "auto") return { type: "auto" };
  if (toolChoice === "any" || toolChoice === "required") return { type: "any" };

  if (typeof toolChoice === "string") {
    return { type: "tool", name: toolChoice };
  }

  if (typeof toolChoice === "object") {
    if (toolChoice.type === "function" && toolChoice.function?.name) {
      return { type: "tool", name: toolChoice.function.name };
    }
    if (toolChoice.name) {
      return { type: "tool", name: toolChoice.name };
    }
  }

  return undefined;
}

// ============================================================
// Message Normalization for Anthropic
// ============================================================

export function convertMessagesForAnthropic(messages = [], systemPrompt = "") {
  let extractedSystemPrompt = systemPrompt || "";
  const converted = [];

  for (const message of messages) {
    // Extract system prompt messages
    if (message.role === "system") {
      if (extractedSystemPrompt) {
        extractedSystemPrompt += "\n\n" + (message.content || "");
      } else {
        extractedSystemPrompt = message.content || "";
      }
      continue;
    }

    // User message
    if (message.role === "user") {
      converted.push({
        role: "user",
        content: message.content || "",
      });
      continue;
    }

    // Assistant message
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
        if (typeof toolCall.function.arguments === "string") {
          try {
            input = JSON.parse(toolCall.function.arguments || "{}");
          } catch {
            input = {};
          }
        } else if (typeof toolCall.function.arguments === "object") {
          input = toolCall.function.arguments || {};
        }

        content.push({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.function.name,
          input,
        });
      }

      converted.push({
        role: "assistant",
        content: content.length > 0 ? content : message.content || "",
      });
      continue;
    }

    // Tool result message
    if (message.role === "tool") {
      const toolResultBlock = {
        type: "tool_result",
        tool_use_id: message.tool_call_id,
        content: typeof message.content === "string" ? message.content : JSON.stringify(message.content || ""),
      };

      // Anthropic requires combining consecutive tool results into a single user message
      const lastMsg = converted[converted.length - 1];
      if (lastMsg && lastMsg.role === "user" && Array.isArray(lastMsg.content)) {
        lastMsg.content.push(toolResultBlock);
      } else {
        converted.push({
          role: "user",
          content: [toolResultBlock],
        });
      }
    }
  }

  return {
    systemPrompt: extractedSystemPrompt,
    messages: converted,
  };
}

export function normalizeAnthropicResponse(response) {
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
          arguments: JSON.stringify(block.input || {}),
        },
      });
    }
  }

  return {
    assistantMessage: {
      role: "assistant",
      content: textContent || null,
      tool_calls: toolCalls,
    },
    stopReason: response.stop_reason,
    rawResponse: response,
  };
}

// ============================================================
// Anthropic Call Execution
// ============================================================

async function callAnthropic({
  systemPrompt,
  messages,
  tools,
  toolChoice,
  maxTokens,
  customConfig = {},
}) {
  const client = getAnthropicClient(customConfig);
  const model = customConfig.model || config.anthropic.model;

  const { systemPrompt: finalSystemPrompt, messages: anthropicMessages } =
    convertMessagesForAnthropic(messages, systemPrompt);

  const anthropicTools = convertToolsForAnthropic(tools);
  const anthropicToolChoice = convertToolChoiceForAnthropic(toolChoice);

  const params = {
    model,
    max_tokens: maxTokens || 1500,
    messages: anthropicMessages,
  };

  if (finalSystemPrompt) {
    params.system = finalSystemPrompt;
  }

  if (anthropicTools.length > 0) {
    params.tools = anthropicTools;
    if (anthropicToolChoice) {
      params.tool_choice = anthropicToolChoice;
    }
  }

  const response = await client.messages.create(params);
  return normalizeAnthropicResponse(response);
}

// ============================================================
// OpenAI / Azure / Custom OpenAI Call Execution
// ============================================================

async function callOpenAICompatible({
  client,
  model,
  systemPrompt,
  messages = [],
  tools,
  toolChoice,
  maxTokens,
}) {
  const formattedMessages = [...messages];

  // Prepend system prompt if provided and not already present as first message
  if (systemPrompt && (!formattedMessages[0] || formattedMessages[0].role !== "system")) {
    formattedMessages.unshift({
      role: "system",
      content: systemPrompt,
    });
  }

  const params = {
    model,
    messages: formattedMessages,
  };

  if (maxTokens) {
    params.max_completion_tokens = maxTokens;
  }

  if (tools && tools.length > 0) {
    params.tools = tools;
    if (toolChoice) {
      params.tool_choice = toolChoice;
    }
  }

  let response;
  try {
    response = await client.chat.completions.create(params);
  } catch (err) {
    // Fallback for providers that don't support max_completion_tokens and expect max_tokens
    if (err.message && err.message.includes("max_completion_tokens") && params.max_completion_tokens) {
      params.max_tokens = params.max_completion_tokens;
      delete params.max_completion_tokens;
      response = await client.chat.completions.create(params);
    } else {
      throw err;
    }
  }

  const assistantMessage = response.choices?.[0]?.message;
  if (!assistantMessage) {
    throw new Error("LLM provider returned no assistant message.");
  }

  return {
    assistantMessage: {
      role: "assistant",
      content: assistantMessage.content || null,
      tool_calls: assistantMessage.tool_calls || [],
    },
    stopReason: response.choices?.[0]?.finish_reason,
    rawResponse: response,
  };
}

// ============================================================
// Main Dynamic LLM Client API
// ============================================================

/**
 * Universal dynamic LLM caller.
 * 
 * Supports:
 * - provider: "anthropic" | "azure" | "openai" | "custom" (defaults to env LLM_PROVIDER)
 * - systemPrompt: string (optional)
 * - messages: array of messages
 * - tools: array of OpenAI-format tools (optional)
 * - toolChoice: string | object (optional)
 * - maxTokens: number (optional)
 * - customConfig: object override for credentials/models (optional)
 */
export async function callLLM({
  provider,
  systemPrompt,
  messages = [],
  tools,
  toolChoice,
  maxTokens = 1500,
  customConfig = {},
}) {
  const selectedProvider = (provider || customConfig.provider || config.llmProvider).toLowerCase();

  validateLLMConfig(selectedProvider);

  switch (selectedProvider) {
    case "anthropic":
    case "claude":
      return callAnthropic({
        systemPrompt,
        messages,
        tools,
        toolChoice,
        maxTokens,
        customConfig,
      });

    case "azure":
    case "azure-openai": {
      const client = getAzureClient(customConfig);
      const model = customConfig.deployment || config.azure.deployment;
      return callOpenAICompatible({
        client,
        model,
        systemPrompt,
        messages,
        tools,
        toolChoice,
        maxTokens,
      });
    }

    case "openai": {
      const client = getOpenAIClient(customConfig);
      const model = customConfig.model || config.openai.model;
      return callOpenAICompatible({
        client,
        model,
        systemPrompt,
        messages,
        tools,
        toolChoice,
        maxTokens,
      });
    }

    case "custom":
    case "ollama":
    case "openai-compatible": {
      const client = getCustomClient(customConfig);
      const model = customConfig.model || config.custom.model;
      return callOpenAICompatible({
        client,
        model,
        systemPrompt,
        messages,
        tools,
        toolChoice,
        maxTokens,
      });
    }

    default:
      throw new Error(
        `Unsupported LLM provider "${selectedProvider}". Use "anthropic", "azure", "openai", or "custom".`
      );
  }
}

/**
 * Create a reusable LLM Client instance with a fixed configuration.
 */
export function createLLMClient(defaultOptions = {}) {
  return {
    async call(options) {
      return callLLM({
        ...defaultOptions,
        ...options,
        customConfig: {
          ...(defaultOptions.customConfig || {}),
          ...(options.customConfig || {}),
        },
      });
    },
  };
}