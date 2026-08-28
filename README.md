# LLM QA Agent & Dynamic LLM Module

An LLM-driven browser QA testing framework and reusable multi-provider LLM module supporting **Anthropic Claude**, **Azure OpenAI**, **Standard OpenAI**, and **Custom OpenAI-compatible models** (e.g. Ollama, Groq, DeepSeek).

---

## 🌟 Dynamic LLM Support & Reusable Module

This project includes a standalone, unified LLM client (`llmclient.js`) that abstracts provider differences (messages conversion, tool schemas, function calling, tool choice, response normalization).

### Using `llmclient.js` in your NPM project

```javascript
import { callLLM, createLLMClient } from "llm-qa-agent";

// Option 1: Direct function call
const response = await callLLM({
  provider: "anthropic", // "anthropic" | "azure" | "openai" | "custom"
  systemPrompt: "You are a helpful QA assistant.",
  messages: [{ role: "user", content: "Hello world!" }],
  maxTokens: 1000,
});

console.log(response.assistantMessage.content);

// Option 2: Reusable client instance
const client = createLLMClient({
  provider: "openai",
  customConfig: {
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o",
  },
});

const result = await client.call({
  messages: [{ role: "user", content: "Perform analysis..." }],
});
```

---

## ⚙️ Configuration & Environment Variables

Copy `.env_example` to `.env` and set your preferred `LLM_PROVIDER`:

```bash
cp .env_example .env
```

### 1. Anthropic Claude (`LLM_PROVIDER=anthropic`)
```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### 2. Standard OpenAI (`LLM_PROVIDER=openai`)
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

### 3. Azure OpenAI (`LLM_PROVIDER=azure`)
```env
LLM_PROVIDER=azure
AZURE_OPENAI_API_KEY=your_azure_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_VERSION=2024-08-01-preview
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
```

### 4. Custom / Local OpenAI-Compatible (`LLM_PROVIDER=custom`)
```env
LLM_PROVIDER=custom
CUSTOM_LLM_BASE_URL=http://localhost:11434/v1
CUSTOM_LLM_API_KEY=dummy-key
CUSTOM_LLM_MODEL=llama3.2
```

---

## 🧪 Testing LLM Connection

Run the LLM connection test script:

```bash
npm run test:llm
```

---

## 🚀 Running QA Agent Tests

1. Install dependencies and Playwright Chromium:
   ```bash
   npm install
   npm run install-browsers
   ```

2. Setup requirements file:
   ```bash
   cp requirements.example.json requirements.json
   ```

3. Run QA test agent:
   ```bash
   npm test
   ```

Results will be saved in `report/report.md` and `report/report.json`.
