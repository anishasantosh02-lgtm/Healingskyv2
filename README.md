# LLM QA Agent — prototype

An AI tester that explores your web app in a real browser and judges pass/fail
against acceptance criteria you write in plain English. No test scripts to
maintain — you write scenarios like a ticket, not code.

## How it works

For each scenario:
1. Claude gets a snapshot of the current page (visible text + a list of
   clickable/typeable elements).
2. Claude decides what a QA tester would do next — click, type, navigate —
   using tool calls.
3. Playwright executes that action in a real headless Chromium browser.
4. Repeat until Claude has enough evidence to call `finish_test` with a
   verdict: **pass**, **fail**, or **blocked** (environment issue, not a bug),
   plus expected vs. actual behavior and severity.

Results are written to `report/report.md` (human-readable) and
`report/report.json` (for piping into other tools), with a screenshot saved
for every failed/blocked scenario.

## Setup

Requires Node.js 18+.

```bash
cd llm-qa-agent
npm install
npm run install-browsers   # downloads Chromium for Playwright, one-time

export ANTHROPIC_API_KEY=sk-ant-...
```

## Write your test scenarios

Copy the example and edit it for your app:

```bash
cp requirements.example.json requirements.json
```

```json
{
  "baseUrl": "https://your-staging-app.com",
  "scenarios": [
    {
      "name": "Login form validates empty submission",
      "criteria": "Submitting the login form with both fields empty should show a validation error and must NOT log the user in."
    }
  ]
}
```

Each scenario is just a name + one sentence of expected behavior — this is
the "requirements/acceptance criteria in plain English" your QA team already
writes, no code required.

## Run it

```bash
npm test
```

You'll see live progress in the terminal, then a full report at
`report/report.md`.

## What this is good at vs. not (be realistic about it)

**Good at:**
- Exploratory testing — catching things you didn't think to script (confusing
  error messages, broken flows, unexpected states)
- Turning plain-English requirements directly into test execution, no scripting
- Judgment calls (does this response make sense, not just does it match a fixed string)

**Not a replacement for:**
- High-volume deterministic regression suites — an LLM call per step is
  slower and costs money per run compared to a compiled Playwright script.
  Once a flow is stable, consider asking the agent to also emit the raw
  Playwright actions it took (easy extension — log `stepsTaken` already
  captures this) so you can freeze it into a fast scripted regression test.
- Pixel-perfect visual regression — this uses the DOM/text, not vision. For
  visual diffing, pair this with a screenshot-diffing tool.
- Testing behind complex auth/2FA without extra setup (you may need to seed
  a logged-in browser session — ask me and I can add that).

## Natural next steps once this works for you

- **API testing**: same pattern, but tools become `call_endpoint` instead of
  `click`/`type`, and Claude reasons over your OpenAPI spec instead of DOM.
  I can build this as a second module that plugs into the same report format.
- **CI/scheduling**: this already runs headless and exits cleanly, so it can
  drop straight into a GitHub Actions / cron job once you're ready — just
  needs the API key as a secret.
- **Auto-freezing regression tests**: convert an agent run that passed into a
  literal Playwright script (from `stepsTaken`) so future regression runs are
  instant and free, and only re-invoke the LLM when the flow actually changes.
