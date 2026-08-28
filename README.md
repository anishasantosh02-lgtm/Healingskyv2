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

## 🎲 Dynamic Test Data (`testdata.js`)

Requirement descriptions are **templates**. Any `{{placeholder}}` token is
replaced at load time with freshly generated data, so a registration flow can be
replayed over and over without hitting "email already registered".

`requirements.json`:

```json
{
  "id": "CLIENT-REG-002",
  "description": "Full Name: '{{fullName}}'. Email: '{{email}}'. Phone: '{{phoneNumber}}'. Address: '{{addressLookup}}'. Referral: '{{referralCode}}'."
}
```

Available placeholders:

| Placeholder | Example | Notes |
| --- | --- | --- |
| `{{fullName}}` | `Harper Hayes` | random first + last name |
| `{{email}}` | `harper.hayes.mtcfp7sh129@yopmail.com` | unique disposable address |
| `{{phoneCountryCode}}` | `+1` | |
| `{{phoneCountryLabel}}` | `United States (+1)` | dropdown label variant |
| `{{phoneNumber}}` | `2125550181` | NANP reserved `555-01XX` testing block |
| `{{dobMonth}}` / `{{dobDate}}` / `{{dobYear}}` | `June` / `4` / `1999` | |
| `{{addressLookup}}` | `350 5th Ave, New York, NY` | real US address so autocomplete resolves |
| `{{referralCode}}` | `NAN5EM09` | |

Pin any value with an env var (`TEST_FULL_NAME`, `TEST_EMAIL`,
`TEST_PHONE_NUMBER`, `TEST_ADDRESS`, `TEST_REFERRAL_CODE`, `TEST_DOB_*`) or with
a `testData` object in `requirements.json` to make a run reproducible.

The exact values used are printed at startup, written to `report/test-data.json`,
and included as a table in `report/report.md`.

### Reusing the generator

```javascript
import { generateTestData, resolveTemplates } from "llm-qa-agent/testdata";

const data = generateTestData({ referralCode: "ABC123" });
const scenario = resolveTemplates(myTemplateObject, data);
```

> **Test data vs. credentials.** Generated data is non-secret and is passed to the
> LLM as literal text. Login credentials (`CLIENT_TEST_EMAIL`, `CLIENT_TEST_OTP`)
> stay out of the LLM context — the agent references them symbolically via
> `credential_key` and resolves them locally.

---

## 🧰 Agent Browser Tools

Beyond `click` / `type_text` / `type_otp` / `navigate` / `wait`, the agent has two
batch tools. Both exist because filling a long form one decision at a time is
where an LLM agent drifts and silently skips fields.

| Tool | Purpose |
| --- | --- |
| `fill_form` | Enter many text fields in one step, from one snapshot |
| `select_options` | Open, find and click options in several custom dropdowns in one step |

```jsonc
// Three PrimeReact dropdowns set in a single agent decision
select_options({
  "selections": [
    { "trigger_agent_id": "e10", "option_text": "June" },
    { "trigger_agent_id": "e13", "option_text": "4" },
    { "trigger_agent_id": "e16", "option_text": "1999" }
  ]
})
```

### Page-state improvements

- **Custom dropdown options are visible.** Libraries like PrimeReact render
  options into a body portal as `<li role="option">` only while open. Those
  selectors are now scanned, so options can be found at all.
- **Address autocomplete is visible.** Google Places `.pac-item` suggestions
  are scanned, and `type_text` clicks the first suggestion automatically.
- **Icon-only controls carry a `hint`.** An element with no text gets a hint
  derived from its class, id, title and nested icon markup. The client
  dashboard's log-out control is a bare `div.profile-logout-icon` with no text
  anywhere on the page; the hint is what makes it findable.
- **Clicks settle before the next snapshot.** `settleAfterClick` waits for a
  route change plus network idle, which fixed OTP verification being reported
  as a failure purely because the snapshot preceded the redirect.
- **Every field entry is verified.** `fill()` is silently swallowed by widgets
  that hold their own state when the field is already non-empty. Entries are
  read back and re-entered with real keystrokes if they did not land.

### Application quirks this suite accounts for

| Quirk | Handling |
| --- | --- |
| Phone field is `intl-tel-input`; bare digits are parsed as a country code (`9847096967` → `+98`) | `{{phoneE164}}` supplies `+1XXXXXXXXXX` |
| `555-01XX` numbers fail `libphonenumber` validation | Generator emits structurally valid NANP numbers |
| Setting Date of Birth re-renders the form and can clear the phone field | Phone entered last, and re-entered if empty |
| Registration confirmation takes ~6.5s and then redirects to `/client/login` | Requirement waits 5s, re-checks, accepts either signal |

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
