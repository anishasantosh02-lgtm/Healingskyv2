// index.js
//
// Main QA Agent runner.
//
// Flow:
//
// requirements.json
//       ↓
// planner.js
//       ↓
// generated-scenarios.json
//       ↓
// ONE Browser
//       ↓
// ONE Browser Context
//       ↓
// ONE Page
//       ↓
// agent.js
//       ↓
// Playwright
//       ↓
// report
//
// IMPORTANT:
//
// All scenarios use the SAME browser context
// and SAME browser page.
//
// Browser/application state is intentionally preserved.
//
// planner.js determines:
//
// - sequence
// - startMode
// - dependsOn
// - startState
// - endState
//
// index.js:
//
// - loads requirements
// - loads runtime credentials
// - generates scenarios
// - creates one browser/context/page
// - performs initial navigation
// - executes scenarios in sequence
// - enforces continuation dependencies
// - forwards workflow metadata
// - preserves browser state
// - writes reports
//
// agent.js:
//
// - executes the actual browser QA scenario
// - respects scenario workflow metadata
// - securely resolves configured credentials
// - verifies acceptance criteria
//

import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { chromium } from "playwright";

import { runScenario } from "./agent.js";
import { generateScenarios } from "./planner.js";


dotenv.config();


// ============================================================
// Runtime version marker
// ============================================================

const INDEX_VERSION =
  "startMode-dependency-credentials-v3";


// ============================================================
// Configuration
// ============================================================

const REQUIREMENTS_FILE =
  process.argv[2] ||
  "requirements.json";


const OUTPUT_DIR =
  "report";


const SCREENSHOT_DIR =
  path.join(
    OUTPUT_DIR,
    "screenshots"
  );


const GENERATED_SCENARIOS_FILE =
  path.join(
    OUTPUT_DIR,
    "generated-scenarios.json"
  );


// ============================================================
// Load requirements
// ============================================================

function loadRequirements() {

  if (
    !fs.existsSync(
      REQUIREMENTS_FILE
    )
  ) {

    console.error(
      `Could not find ${REQUIREMENTS_FILE}.`
    );

    process.exit(1);
  }


  try {

    return JSON.parse(
      fs.readFileSync(
        REQUIREMENTS_FILE,
        "utf-8"
      )
    );

  } catch (err) {

    console.error(
      `Invalid JSON in ${REQUIREMENTS_FILE}: ${err.message}`
    );

    process.exit(1);
  }
}


// ============================================================
// URL normalization
// ============================================================

function normalizeUrl(value) {

  if (
    !value ||
    typeof value !==
      "string"
  ) {

    return value;
  }


  let url =
    value.trim();


  const markdownMatch =
    url.match(
      /^\[.*?\]\((https?:\/\/.*?)\)$/
    );


  if (
    markdownMatch
  ) {

    url =
      markdownMatch[1];
  }


  url =
    url.replace(
      /^["']|["']$/g,
      ""
    );


  return url;
}


// ============================================================
// Normalize startMode
// ============================================================
//
// We do not allow arbitrary planner values.
//
// Anything other than base_url becomes continue.
//
// ============================================================

function normalizeStartMode(
  value
) {

  return value ===
    "base_url"
      ? "base_url"
      : "continue";
}


// ============================================================
// Safe filename helper
// ============================================================

function safeFileName(
  value
) {

  return String(
    value ||
    "scenario"
  )
    .replace(
      /[^a-z0-9]+/gi,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    )
    .toLowerCase();
}


// ============================================================
// Wait for application UI
// ============================================================

async function waitForInitialApplication(
  page
) {

  console.log(
    "Waiting for application UI..."
  );


  try {

    await page.waitForFunction(
      () => {

        const bodyText =
          document.body
            ?.innerText
            ?.trim() ||
          "";


        const interactiveCount =
          document.querySelectorAll(
            'a, button, input, select, textarea, ' +
            '[role="button"], [role="link"], ' +
            '[role="checkbox"], [role="radio"], ' +
            '[role="tab"], [role="menuitem"]'
          ).length;


        const root =
          document.getElementById(
            "root"
          ) ||
          document.getElementById(
            "app"
          ) ||
          document.querySelector(
            "[data-reactroot]"
          );


        const rootText =
          root
            ?.innerText
            ?.trim() ||
          "";


        const rootChildren =
          root
            ?.children
            ?.length ||
          0;


        return (
          bodyText.length >
            20 ||
          interactiveCount >
            0 ||
          rootText.length >
            0 ||
          rootChildren >
            0
        );
      },

      {
        timeout:
          60000,
      }
    );


    console.log(
      "Application UI is available."
    );


    return true;

  } catch (err) {

    console.log(
      `Application readiness check timed out: ${err.message}`
    );


    return false;
  }
}


// ============================================================
// Cookie / consent handling
// ============================================================

async function handleCookieConsent(
  page
) {

  const possibleButtons = [
    /^Accept$/i,
    /^Accept All$/i,
    /Accept All/i,
    /^Allow$/i,
    /Allow All/i,
    /^Agree$/i,
    /I Agree/i,
    /Got It/i,
  ];


  for (
    const pattern of
    possibleButtons
  ) {

    try {

      const button =
        page
          .getByRole(
            "button",
            {
              name:
                pattern,
            }
          )
          .first();


      if (
        (await button.count()) ===
          0
      ) {

        continue;
      }


      if (
        !(await button.isVisible())
      ) {

        continue;
      }


      console.log(
        `Cookie/consent control detected: ${pattern}`
      );


      await button.click({
        timeout:
          10000,
      });


      await page.waitForTimeout(
        500
      );


      console.log(
        "Cookie/consent accepted."
      );


      return true;

    } catch (err) {

      console.log(
        `Consent candidate could not be handled: ${err.message}`
      );
    }
  }


  return false;
}


// ============================================================
// Result helpers
// ============================================================

function statusEmoji(
  status
) {

  return {

    pass:
      "✅",

    fail:
      "❌",

    blocked:
      "⚠️",

  }[status] || "❓";
}


// ============================================================
// Dependency inspection
// ============================================================

function getDependencyStatus(
  scenario,
  resultByScenarioId
) {

  const dependencyIds =
    Array.isArray(
      scenario.dependsOn
    )
      ? scenario.dependsOn
      : [];


  return dependencyIds.map(
    (dependencyId) => {

      const dependencyResult =
        resultByScenarioId.get(
          dependencyId
        );


      return {

        dependencyId,

        result:
          dependencyResult ||
          null,

        status:
          dependencyResult
            ?.verdict
            ?.status ||
          "missing",
      };
    }
  );
}


// ============================================================
// Build dependency-blocked result
// ============================================================

async function buildDependencyBlockedResult({
  scenario,
  page,
  failedDependencies,
}) {

  let screenshotPath =
    null;


  try {

    screenshotPath =
      path.join(
        SCREENSHOT_DIR,
        `${safeFileName(
          scenario.id
        )}_dependency_blocked.png`
      );


    await page.screenshot({

      path:
        screenshotPath,

      fullPage:
        false,
    });

  } catch (err) {

    console.log(
      `Could not capture dependency-blocked screenshot: ${err.message}`
    );


    screenshotPath =
      null;
  }


  const dependencyDescription =
    failedDependencies
      .map(
        (dependency) =>
          `${dependency.dependencyId}=${dependency.status}`
      )
      .join(
        ", "
      );


  return {

    name:
      scenario.name,

    criteria:
      scenario.criteria,

    scenarioId:
      scenario.id,

    requirementId:
      scenario.requirementId,

    type:
      scenario.type,

    priority:
      scenario.priority,

    sequence:
      scenario.sequence,

    startMode:
      normalizeStartMode(
        scenario.startMode
      ),

    dependsOn:
      scenario.dependsOn ||
      [],

    startState:
      scenario.startState,

    endState:
      scenario.endState,


    verdict: {

      status:
        "blocked",

      summary:
        "A required workflow dependency did not pass, so this continuation scenario was not executed.",

      expected:
        scenario.criteria,

      actual:
        `Required dependencies were not satisfied: ${dependencyDescription}.`,

      severity:
        "high",
    },


    stepsTaken: [
      `dependency_check(${JSON.stringify({
        failedDependencies:
          failedDependencies.map(
            (dependency) => ({
              id:
                dependency.dependencyId,

              status:
                dependency.status,
            })
          ),
      })})`,
    ],


    consoleErrors:
      [],


    screenshotPath,


    finalUrl:
      page.url(),
  };
}


// ============================================================
// Markdown report
// ============================================================

function buildMarkdownReport(
  results,
  baseUrl,
  scenarios
) {

  const passed =
    results.filter(
      (result) =>
        result.verdict.status ===
        "pass"
    ).length;


  const failed =
    results.filter(
      (result) =>
        result.verdict.status ===
        "fail"
    ).length;


  const blocked =
    results.filter(
      (result) =>
        result.verdict.status ===
        "blocked"
    ).length;


  let md =
    "# QA Agent Test Report\n\n";


  md +=
    `**Target:** ${baseUrl}\n\n`;


  md +=
    `**Runner version:** ${INDEX_VERSION}\n\n`;


  md +=
    `**Run at:** ${new Date().toISOString()}\n\n`;


  md +=
    `**Scenarios:** ${scenarios.length}\n\n`;


  md +=
    `**Summary:** ${passed} passed, ${failed} failed, ${blocked} blocked\n\n`;


  md +=
    "---\n\n";


  for (
    const result of
    results
  ) {

    const scenario =
      scenarios.find(
        (item) =>
          item.id ===
          result.scenarioId
      );


    md +=
      `## ${statusEmoji(
        result.verdict.status
      )} ${result.name}\n\n`;


    // --------------------------------------------------------
    // Metadata
    // --------------------------------------------------------

    md +=
      `**Scenario ID:** ${
        result.scenarioId ||
        scenario?.id ||
        "N/A"
      }\n\n`;


    md +=
      `**Requirement:** ${
        result.requirementId ||
        scenario?.requirementId ||
        "N/A"
      }\n\n`;


    md +=
      `**Test type:** ${
        result.type ||
        scenario?.type ||
        "N/A"
      }\n\n`;


    md +=
      `**Priority:** ${
        result.priority ||
        scenario?.priority ||
        "N/A"
      }\n\n`;


    // --------------------------------------------------------
    // Workflow metadata
    // --------------------------------------------------------

    const sequence =
      result.sequence ??
      scenario?.sequence;


    md +=
      `**Sequence:** ${
        sequence ??
        "N/A"
      }\n\n`;


    const startMode =
      result.startMode ||
      scenario?.startMode ||
      "continue";


    md +=
      `**Start mode:** ${startMode}\n\n`;


    const dependsOn =
      result.dependsOn ||
      scenario?.dependsOn ||
      [];


    md +=
      `**Depends on:** ${
        dependsOn.length
          ? dependsOn.join(
              ", "
            )
          : "None"
      }\n\n`;


    const startState =
      result.startState ||
      scenario?.startState;


    if (
      startState
    ) {

      md +=
        `**Expected start state:** ${startState}\n\n`;
    }


    const endState =
      result.endState ||
      scenario?.endState;


    if (
      endState
    ) {

      md +=
        `**Expected end state:** ${endState}\n\n`;
    }


    // --------------------------------------------------------
    // Test result
    // --------------------------------------------------------

    md +=
      `**Criteria:** ${result.criteria}\n\n`;


    md +=
      `**Status:** ${result.verdict.status.toUpperCase()}\n\n`;


    if (
      result.verdict.severity &&
      result.verdict.severity !==
        "n/a"
    ) {

      md +=
        `**Severity:** ${result.verdict.severity}\n\n`;
    }


    md +=
      `**Summary:** ${result.verdict.summary}\n\n`;


    md +=
      `**Expected:** ${result.verdict.expected}\n\n`;


    md +=
      `**Actual:** ${result.verdict.actual}\n\n`;


    if (
      result.finalUrl
    ) {

      md +=
        `**Final URL:** ${result.finalUrl}\n\n`;
    }


    // --------------------------------------------------------
    // Console errors
    // --------------------------------------------------------

    if (
      result.consoleErrors
        ?.length
    ) {

      md +=
        "**Console errors observed:**\n\n";


      for (
        const error of
        result.consoleErrors
      ) {

        md +=
          `- \`${error}\`\n`;
      }


      md +=
        "\n";
    }


    // --------------------------------------------------------
    // Screenshot
    // --------------------------------------------------------

    if (
      result.screenshotPath
    ) {

      md +=
        `**Screenshot:** ${path.relative(
          OUTPUT_DIR,
          result.screenshotPath
        )}\n\n`;
    }


    // --------------------------------------------------------
    // Steps
    // --------------------------------------------------------

    md +=
      `**Steps taken (${
        result.stepsTaken?.length ||
        0
      }):**\n\n`;


    for (
      const step of
      result.stepsTaken ||
      []
    ) {

      md +=
        `- ${step}\n`;
    }


    md +=
      "\n---\n\n";
  }


  return md;
}


// ============================================================
// Main
// ============================================================

async function main() {

  console.log(
    `INDEX VERSION: ${INDEX_VERSION}`
  );


  // ----------------------------------------------------------
  // Read requirements
  // ----------------------------------------------------------

  const {
    baseUrl:
      rawBaseUrl,

    requirements,
  } =
    loadRequirements();


  const baseUrl =
    normalizeUrl(
      rawBaseUrl
    );


  // ----------------------------------------------------------
  // Validate requirements
  // ----------------------------------------------------------

  if (
    !baseUrl ||
    !Array.isArray(
      requirements
    ) ||
    requirements.length ===
      0
  ) {

    console.error(
      "requirements.json must have a baseUrl and a non-empty requirements array."
    );

    process.exit(1);
  }


  console.log(
    `Base URL: ${baseUrl}`
  );


  console.log(
    `Requirements: ${requirements.length}`
  );


  // ==========================================================
  // Runtime test credentials
  // ==========================================================
  //
  // Do not log actual values.
  //
  // ==========================================================

  const testCredentials = {

    clientEmail:
      process.env.CLIENT_TEST_EMAIL,

    clientOtp:
      process.env.CLIENT_TEST_OTP,
  };


  console.log(
    `Client test email configured: ${
      Boolean(
        testCredentials.clientEmail
      )
    }`
  );


  console.log(
    `Client test OTP configured: ${
      Boolean(
        testCredentials.clientOtp
      )
    }`
  );


  if (
    !testCredentials.clientEmail
  ) {

    console.warn(
      "CLIENT_TEST_EMAIL is not configured."
    );
  }


  if (
    !testCredentials.clientOtp
  ) {

    console.warn(
      "CLIENT_TEST_OTP is not configured."
    );
  }


  // ----------------------------------------------------------
  // Create output directories
  // ----------------------------------------------------------

  fs.mkdirSync(
    SCREENSHOT_DIR,
    {
      recursive:
        true,
    }
  );


  // ==========================================================
  // Generate scenarios
  // ==========================================================

  console.log(
    "\n========================================"
  );


  console.log(
    "Generating QA test scenarios..."
  );


  console.log(
    "========================================\n"
  );


  let scenarios;


  try {

    scenarios =
      await generateScenarios({
        baseUrl,
        requirements,
      });

  } catch (err) {

    console.error(
      `Scenario planner failed: ${err.message}`
    );

    process.exit(1);
  }


  if (
    !Array.isArray(
      scenarios
    ) ||
    scenarios.length ===
      0
  ) {

    console.error(
      "Scenario planner returned no scenarios."
    );

    process.exit(1);
  }


  // ==========================================================
  // Normalize generated scenarios
  // ==========================================================

  scenarios =
    scenarios.map(
      (scenario) => ({

        ...scenario,

        startMode:
          normalizeStartMode(
            scenario.startMode
          ),

        dependsOn:
          Array.isArray(
            scenario.dependsOn
          )
            ? scenario.dependsOn
            : [],
      })
    );


  // ----------------------------------------------------------
  // Safety sort
  // ----------------------------------------------------------

  scenarios =
    [...scenarios]
      .sort(
        (a, b) => {

          const sequenceA =
            Number.isInteger(
              a.sequence
            )
              ? a.sequence
              : Number.MAX_SAFE_INTEGER;


          const sequenceB =
            Number.isInteger(
              b.sequence
            )
              ? b.sequence
              : Number.MAX_SAFE_INTEGER;


          return (
            sequenceA -
            sequenceB
          );
        }
      );


  console.log(
    `Generated ${scenarios.length} test scenarios.\n`
  );


  // ==========================================================
  // Print workflow
  // ==========================================================

  console.log(
    "========================================"
  );


  console.log(
    "Generated scenario workflow"
  );


  console.log(
    "========================================\n"
  );


  for (
    const scenario of
    scenarios
  ) {

    console.log(
      `[${String(
        scenario.type ||
        "unknown"
      ).toUpperCase()}] ${scenario.id} - ${scenario.name}`
    );


    console.log(
      `  Sequence: ${
        scenario.sequence ??
        "n/a"
      }`
    );


    console.log(
      `  Requirement: ${
        scenario.requirementId ||
        "n/a"
      }`
    );


    console.log(
      `  Priority: ${
        scenario.priority ||
        "n/a"
      }`
    );


    console.log(
      `  Start mode: ${scenario.startMode}`
    );


    console.log(
      `  Depends on: ${
        scenario.dependsOn.length
          ? scenario.dependsOn.join(
              ", "
            )
          : "none"
      }`
    );


    console.log(
      `  Start state: ${
        scenario.startState ||
        "n/a"
      }`
    );


    console.log(
      `  End state: ${
        scenario.endState ||
        "n/a"
      }`
    );


    console.log(
      `  Criteria: ${
        scenario.criteria ||
        "n/a"
      }`
    );


    if (
      scenario.preconditions
        ?.length
    ) {

      console.log(
        `  Preconditions: ${JSON.stringify(
          scenario.preconditions
        )}`
      );
    }


    if (
      scenario.testData &&
      Object.keys(
        scenario.testData
      ).length >
        0
    ) {

      console.log(
        `  Test data: ${JSON.stringify(
          scenario.testData
        )}`
      );
    }


    console.log("");
  }


  // ==========================================================
  // Save generated scenarios
  // ==========================================================

  fs.writeFileSync(
    GENERATED_SCENARIOS_FILE,

    JSON.stringify(
      {

        generatedAt:
          new Date()
            .toISOString(),

        runnerVersion:
          INDEX_VERSION,

        baseUrl,

        scenarios,
      },

      null,

      2
    )
  );


  console.log(
    `Generated scenarios saved to ${GENERATED_SCENARIOS_FILE}`
  );


  // ==========================================================
  // Browser configuration
  // ==========================================================

  const headless =
    process.env.HEADLESS !==
    "false";


  const slowMo =
    Number(
      process.env.SLOW_MO ||
      100
    );


  console.log(
    "\n========================================"
  );


  console.log(
    "Launching browser..."
  );


  console.log(
    "========================================"
  );


  console.log(
    `Headless: ${headless}`
  );


  console.log(
    `Slow motion: ${slowMo}ms`
  );


  // ==========================================================
  // ONE browser
  // ==========================================================

  const browser =
    await chromium.launch({

      headless,

      slowMo,
    });


  // ==========================================================
  // ONE browser context
  // ==========================================================

  const context =
    await browser.newContext({

      permissions: [
        "geolocation",
      ],


      geolocation: {

        latitude:
          11.0067712,

        longitude:
          77.021184,
      },


      viewport: {

        width:
          1440,

        height:
          900,
      },
    });


  // ==========================================================
  // ONE page
  // ==========================================================

  const page =
    await context.newPage();


  // ==========================================================
  // Browser diagnostics
  // ==========================================================

  page.on(
    "console",

    (msg) => {

      if (
        msg.type() ===
        "error"
      ) {

        console.log(
          `[Browser console error] ${msg.text()}`
        );
      }
    }
  );


  page.on(
    "pageerror",

    (err) => {

      console.log(
        `[Browser page error] ${err.message}`
      );
    }
  );


  // ==========================================================
  // Initial navigation
  // ==========================================================

  console.log(
    `\nOpening initial application page: ${baseUrl}`
  );


  try {

    await page.goto(
      baseUrl,

      {
        waitUntil:
          "commit",

        timeout:
          300000,
      }
    );


    console.log(
      "Initial page navigation committed."
    );


    const ready =
      await waitForInitialApplication(
        page
      );


    if (
      !ready
    ) {

      throw new Error(
        "Initial application did not render usable UI within 60 seconds."
      );
    }


    await handleCookieConsent(
      page
    );


    console.log(
      `Application ready at: ${page.url()}`
    );


  } catch (err) {

    console.error(
      `Initial application navigation failed: ${err.message}`
    );


    try {

      await page.screenshot({

        path:
          path.join(
            SCREENSHOT_DIR,
            "initial-navigation-failure.png"
          ),

        fullPage:
          false,
      });

    } catch {
      // Ignore startup screenshot failure.
    }


    await context.close();

    await browser.close();


    process.exit(1);
  }


  // ==========================================================
  // Results
  // ==========================================================

  const results =
    [];


  const resultByScenarioId =
    new Map();


  // ==========================================================
  // Execute scenarios
  // ==========================================================

  for (
    let index = 0;
    index <
      scenarios.length;
    index++
  ) {

    const scenario =
      scenarios[index];


    const effectiveStartMode =
      normalizeStartMode(
        scenario.startMode
      );


    console.log(
      "\n========================================"
    );


    console.log(
      `Scenario ${index + 1}/${scenarios.length}`
    );


    console.log(
      `▶ ${scenario.id}`
    );


    console.log(
      `▶ ${scenario.name}`
    );


    console.log(
      "========================================"
    );


    console.log(
      `Sequence: ${
        scenario.sequence ??
        "n/a"
      }`
    );


    console.log(
      `Requirement: ${
        scenario.requirementId ||
        "n/a"
      }`
    );


    console.log(
      `Start mode: ${effectiveStartMode}`
    );


    console.log(
      `Depends on: ${
        scenario.dependsOn.length
          ? scenario.dependsOn.join(
              ", "
            )
          : "none"
      }`
    );


    console.log(
      `Expected start state: ${
        scenario.startState ||
        "n/a"
      }`
    );


    console.log(
      `Expected end state: ${
        scenario.endState ||
        "n/a"
      }`
    );


    console.log(
      `Current page before scenario: ${page.url()}`
    );


    // ========================================================
    // Dependency result enforcement
    // ========================================================

    const dependencyStatuses =
      getDependencyStatus(
        scenario,
        resultByScenarioId
      );


    if (
      dependencyStatuses.length >
      0
    ) {

      console.log(
        "Dependency statuses:"
      );


      for (
        const dependency of
        dependencyStatuses
      ) {

        console.log(
          `  ${dependency.dependencyId}: ${dependency.status}`
        );
      }
    }


    const failedDependencies =
      dependencyStatuses.filter(
        (dependency) =>
          dependency.status !==
          "pass"
      );


    // --------------------------------------------------------
    // Strict dependency behavior
    // --------------------------------------------------------
    //
    // Only continuation scenarios are automatically blocked.
    //
    // base_url scenarios represent independent/sibling branches
    // and therefore normally have no dependencies anyway.
    //
    // --------------------------------------------------------

    if (
      effectiveStartMode ===
        "continue" &&
      failedDependencies.length >
        0
    ) {

      console.log(
        "Scenario will not execute because a required continuation dependency did not pass."
      );


      const blockedResult =
        await buildDependencyBlockedResult({

          scenario: {

            ...scenario,

            startMode:
              effectiveStartMode,
          },

          page,

          failedDependencies,
        });


      results.push(
        blockedResult
      );


      resultByScenarioId.set(
        scenario.id,
        blockedResult
      );


      console.log(
        `BLOCKED: ${blockedResult.verdict.summary}`
      );


      console.log(
        `Current page remains: ${page.url()}`
      );


      continue;
    }


    // ========================================================
    // Run scenario
    // ========================================================

    try {

      const result =
        await runScenario(

          page,

          {

            name:
              scenario.name,

            criteria:
              scenario.criteria,

            scenarioId:
              scenario.id,

            requirementId:
              scenario.requirementId,

            type:
              scenario.type,

            priority:
              scenario.priority,

            preconditions:
              scenario.preconditions,

            testData:
              scenario.testData,


            // ----------------------------------------------
            // Workflow metadata
            // ----------------------------------------------

            sequence:
              scenario.sequence,

            startMode:
              effectiveStartMode,

            dependsOn:
              scenario.dependsOn,

            startState:
              scenario.startState,

            endState:
              scenario.endState,
          },

          baseUrl,

          SCREENSHOT_DIR,

          {

            sessionMode:
              "shared",

            testCredentials,
          }
        );


      // ------------------------------------------------------
      // Force planner metadata into stored result
      // ------------------------------------------------------
      //
      // This prevents stale/missing agent metadata from changing
      // the recorded workflow.
      //
      // ------------------------------------------------------

      const storedResult = {

        ...result,

        scenarioId:
          scenario.id,

        requirementId:
          scenario.requirementId,

        type:
          scenario.type,

        priority:
          scenario.priority,

        sequence:
          scenario.sequence,

        startMode:
          effectiveStartMode,

        dependsOn:
          scenario.dependsOn,

        startState:
          scenario.startState,

        endState:
          scenario.endState,
      };


      results.push(
        storedResult
      );


      resultByScenarioId.set(
        scenario.id,
        storedResult
      );


      console.log(
        `\n${storedResult.verdict.status.toUpperCase()}: ${storedResult.verdict.summary}`
      );


      console.log(
        `Final scenario URL: ${
          storedResult.finalUrl ||
          page.url()
        }`
      );


    } catch (err) {

      console.error(
        `Scenario runner error: ${err.message}`
      );


      const currentUrl =
        page.url();


      let screenshotPath =
        null;


      try {

        screenshotPath =
          path.join(
            SCREENSHOT_DIR,
            `${safeFileName(
              scenario.id
            )}_runner_error.png`
          );


        await page.screenshot({

          path:
            screenshotPath,

          fullPage:
            false,
        });


      } catch (
        screenshotError
      ) {

        console.log(
          `Could not save runner error screenshot: ${screenshotError.message}`
        );


        screenshotPath =
          null;
      }


      const blockedResult = {

        name:
          scenario.name,

        criteria:
          scenario.criteria,

        scenarioId:
          scenario.id,

        requirementId:
          scenario.requirementId,

        type:
          scenario.type,

        priority:
          scenario.priority,

        sequence:
          scenario.sequence,

        startMode:
          effectiveStartMode,

        dependsOn:
          scenario.dependsOn,

        startState:
          scenario.startState,

        endState:
          scenario.endState,


        verdict: {

          status:
            "blocked",

          summary:
            `Runner error: ${err.message}`,

          expected:
            scenario.criteria,

          actual:
            "The scenario runner encountered an unexpected error.",

          severity:
            "high",
        },


        stepsTaken:
          [],


        consoleErrors:
          [],


        screenshotPath,


        finalUrl:
          currentUrl,
      };


      results.push(
        blockedResult
      );


      resultByScenarioId.set(
        scenario.id,
        blockedResult
      );


      console.log(
        "Keeping existing browser session for the next scenario."
      );
    }


    // --------------------------------------------------------
    // Scenario completed
    // --------------------------------------------------------

    console.log(
      `\nCompleted scenario ${index + 1}/${scenarios.length}.`
    );


    console.log(
      `Current page after scenario: ${page.url()}`
    );


    console.log(
      `Expected workflow end state: ${
        scenario.endState ||
        "n/a"
      }`
    );
  }


  // ==========================================================
  // All scenarios finished
  // ==========================================================

  console.log(
    "\nAll scenarios completed."
  );


  // ==========================================================
  // Close shared browser
  // ==========================================================

  console.log(
    "Closing shared browser page..."
  );


  try {

    await page.close();

  } catch (err) {

    console.log(
      `Page close warning: ${err.message}`
    );
  }


  console.log(
    "Closing shared browser context..."
  );


  try {

    await context.close();

  } catch (err) {

    console.log(
      `Context close warning: ${err.message}`
    );
  }


  console.log(
    "Closing browser..."
  );


  try {

    await browser.close();

  } catch (err) {

    console.log(
      `Browser close warning: ${err.message}`
    );
  }


  // ==========================================================
  // Write Markdown report
  // ==========================================================

  const markdown =
    buildMarkdownReport(
      results,
      baseUrl,
      scenarios
    );


  fs.writeFileSync(

    path.join(
      OUTPUT_DIR,
      "report.md"
    ),

    markdown
  );


  // ==========================================================
  // Write JSON report
  // ==========================================================

  fs.writeFileSync(

    path.join(
      OUTPUT_DIR,
      "report.json"
    ),

    JSON.stringify(
      results,
      null,
      2
    )
  );


  // ==========================================================
  // Final summary
  // ==========================================================

  const passed =
    results.filter(
      (result) =>
        result.verdict.status ===
        "pass"
    ).length;


  const failed =
    results.filter(
      (result) =>
        result.verdict.status ===
        "fail"
    ).length;


  const blocked =
    results.filter(
      (result) =>
        result.verdict.status ===
        "blocked"
    ).length;


  console.log(
    "\n========================================"
  );


  console.log(
    "QA RUN COMPLETE"
  );


  console.log(
    "========================================"
  );


  console.log(
    `Runner version: ${INDEX_VERSION}`
  );


  console.log(
    `Passed:  ${passed}`
  );


  console.log(
    `Failed:  ${failed}`
  );


  console.log(
    `Blocked: ${blocked}`
  );


  console.log(
    `Total:   ${results.length}`
  );


  console.log(
    `\nReport: ${OUTPUT_DIR}/report.md`
  );


  console.log(
    `JSON report: ${OUTPUT_DIR}/report.json`
  );


  console.log(
    `Scenarios: ${GENERATED_SCENARIOS_FILE}`
  );
}


// ============================================================
// Start
// ============================================================

main().catch(
  async (err) => {

    console.error(
      "\nFatal error:",
      err
    );


    process.exit(1);
  }
);