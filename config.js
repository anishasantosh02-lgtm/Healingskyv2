import dotenv from "dotenv";

dotenv.config();

export const config = {
  llmProvider: (process.env.LLM_PROVIDER || "anthropic").toLowerCase(),

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o",
    baseURL: process.env.OPENAI_BASE_URL,
    organization: process.env.OPENAI_ORGANIZATION,
  },

  azure: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview",
  },

  custom: {
    endpoint: process.env.CUSTOM_LLM_BASE_URL || process.env.OPENAI_BASE_URL,
    apiKey: process.env.CUSTOM_LLM_API_KEY || process.env.OPENAI_API_KEY || "dummy-key",
    model: process.env.CUSTOM_LLM_MODEL || process.env.OPENAI_MODEL || "local-model",
  },
};

/**
 * Validates configuration for a given provider or current default provider.
 */
export function validateLLMConfig(provider = config.llmProvider) {
  const normalizedProvider = provider.toLowerCase();

  switch (normalizedProvider) {
    case "anthropic":
    case "claude":
      if (!config.anthropic.apiKey) {
        throw new Error(
          "Missing ANTHROPIC_API_KEY. Please set ANTHROPIC_API_KEY in your environment or .env file."
        );
      }
      break;

    case "azure":
    case "azure-openai":
      if (!config.azure.endpoint || !config.azure.apiKey || !config.azure.deployment) {
        throw new Error(
          "Missing Azure OpenAI configuration. Check AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT_NAME."
        );
      }
      break;

    case "openai":
      if (!config.openai.apiKey) {
        throw new Error(
          "Missing OPENAI_API_KEY. Please set OPENAI_API_KEY in your environment or .env file."
        );
      }
      break;

    case "custom":
    case "ollama":
    case "openai-compatible":
      if (!config.custom.endpoint) {
        throw new Error(
          "Missing custom LLM base URL endpoint. Check CUSTOM_LLM_BASE_URL or OPENAI_BASE_URL."
        );
      }
      break;

    default:
      throw new Error(
        `Unsupported LLM_PROVIDER "${provider}". Supported values: "anthropic", "azure", "openai", "custom".`
      );
  }
}