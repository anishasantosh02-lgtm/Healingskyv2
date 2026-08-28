// planner.js
//
// LLM Test Scenario Planner
//
// Responsibilities:
//
// 1. Read application requirements.
// 2. Ask Azure OpenAI to generate meaningful QA scenarios.
// 3. Generate positive / validation scenarios.
// 4. Preserve requirement workflow order.
// 5. Express scenario dependencies.
// 6. Describe expected browser start/end state.
// 7. Detect alternate workflow branches.
// 8. Decide whether a scenario continues the current browser state
//    or starts again from the application base URL.
// 9. Prevent planner-generated authentication credentials/test values.
// 10. Return structured scenarios that agent.js can execute
//     sequentially in one persistent browser page.
//

import dotenv from "dotenv";
import { callLLM } from "./llmclient.js";

dotenv.config();



// ============================================================
// Scenario generation tool
// ============================================================

const tools = [
  {
    type:
      "function",

    function: {

      name:
        "create_test_scenarios",

      description:
        "Create ordered browser QA test scenarios from application requirements. Scenarios may form continuous journeys or independent branches and must identify how each scenario should start.",

      parameters: {

        type:
          "object",

        properties: {

          scenarios: {

            type:
              "array",

            items: {

              type:
                "object",

              properties: {

                // ------------------------------------------------
                // Scenario ID
                // ------------------------------------------------

                id: {

                  type:
                    "string",

                  description:
                    "Unique scenario ID, for example SIGNIN-002-POSITIVE-01.",
                },


                // ------------------------------------------------
                // Requirement mapping
                // ------------------------------------------------

                requirementId: {

                  type:
                    "string",

                  description:
                    "ID of the source requirement being tested.",
                },


                // ------------------------------------------------
                // Execution order
                // ------------------------------------------------

                sequence: {

                  type:
                    "integer",

                  minimum:
                    1,

                  description:
                    "Execution order for the complete test run. Lower sequence numbers run first.",
                },


                // ------------------------------------------------
                // Start mode
                // ------------------------------------------------

                startMode: {

                  type:
                    "string",

                  enum: [
                    "continue",
                    "base_url",
                  ],

                  description:
                    "How the browser should begin this scenario. Use continue when the scenario should consume state left by the previous scenario. Use base_url when this scenario is an independent or sibling branch that must start again from the application's base URL.",
                },


                // ------------------------------------------------
                // Dependency
                // ------------------------------------------------

                dependsOn: {

                  type:
                    "array",

                  items: {

                    type:
                      "string",
                  },

                  description:
                    "Scenario IDs whose successful completion is logically required before this scenario. Do not add a dependency merely because another scenario executes earlier.",
                },


                // ------------------------------------------------
                // Scenario type
                // ------------------------------------------------

                type: {

                  type:
                    "string",

                  enum: [
                    "positive",
                    "validation",
                    "navigation",
                    "ui",
                  ],
                },


                // ------------------------------------------------
                // Scenario name
                // ------------------------------------------------

                name: {

                  type:
                    "string",

                  description:
                    "Short human-readable scenario name.",
                },


                // ------------------------------------------------
                // Acceptance criteria
                // ------------------------------------------------

                criteria: {

                  type:
                    "string",

                  description:
                    "Specific observable acceptance criteria that the browser agent can verify using real UI evidence.",
                },


                // ------------------------------------------------
                // Priority
                // ------------------------------------------------

                priority: {

                  type:
                    "string",

                  enum: [
                    "low",
                    "medium",
                    "high",
                    "critical",
                  ],
                },


                // ------------------------------------------------
                // Preconditions
                // ------------------------------------------------

                preconditions: {

                  type:
                    "array",

                  items: {

                    type:
                      "string",
                  },

                  description:
                    "Conditions expected before scenario execution. Preconditions may describe state established by another scenario or by navigation to the base URL.",
                },


                // ------------------------------------------------
                // Test data
                // ------------------------------------------------

                testData: {

                  type:
                    "object",

                  additionalProperties: {

                    type:
                      "string",
                  },

                  description:
                    "Ordinary non-secret scenario-specific test data only. Do not include authentication emails, passwords, OTPs, tokens, API keys, access tokens or configured credentials.",
                },


                // ------------------------------------------------
                // Starting browser state
                // ------------------------------------------------

                startState: {

                  type:
                    "string",

                  description:
                    "Short concrete description of the browser/application state expected immediately before scenario actions begin.",
                },


                // ------------------------------------------------
                // Ending browser state
                // ------------------------------------------------

                endState: {

                  type:
                    "string",

                  description:
                    "Short concrete description of the browser/application state expected after successful scenario completion.",
                },
              },


              required: [
                "id",
                "requirementId",
                "sequence",
                "startMode",
                "dependsOn",
                "type",
                "name",
                "criteria",
                "priority",
                "preconditions",
                "testData",
                "startState",
                "endState",
              ],


              additionalProperties:
                false,
            },
          },
        },


        required: [
          "scenarios",
        ],


        additionalProperties:
          false,
      },
    },
  },
];


// ============================================================
// Planner
// ============================================================

export async function generateScenarios({
  baseUrl,
  requirements,
}) {

  // ----------------------------------------------------------
  // Validate input
  // ----------------------------------------------------------

  if (
    !baseUrl
  ) {

    throw new Error(
      "baseUrl is required."
    );
  }


  if (
    !Array.isArray(
      requirements
    ) ||
    requirements.length ===
      0
  ) {

    throw new Error(
      "requirements must be a non-empty array."
    );
  }


  // ==========================================================
  // Registration email exemption
  // ==========================================================
  //
  // A generic "email" testData key is only stripped when the planner
  // invented it. An email supplied by the requirements file -- e.g.
  // dynamic registration data resolved from an {{email}} placeholder
  // -- appears verbatim in a requirement description and is ordinary,
  // non-secret test data that a sign-up form legitimately needs.
  //
  // The configured sign-in email is never allowed through, regardless
  // of where it appears.
  //
  // ==========================================================

  const requirementCorpus =
    requirements
      .map(
        (item) =>
          String(
            item?.description ||
            ""
          )
      )
      .join(
        "\n"
      );


  const configuredClientEmail =
    process.env
      .CLIENT_TEST_EMAIL ||
    "";


  function isSuppliedRegistrationEmail(
    key,
    value
  ) {

    if (
      String(
        key
      ).toLowerCase() !==
      "email"
    ) {

      return false;
    }


    if (
      typeof value !==
        "string" ||
      value.trim() ===
        ""
    ) {

      return false;
    }


    if (
      configuredClientEmail &&
      value.trim().toLowerCase() ===
        configuredClientEmail
          .trim()
          .toLowerCase()
    ) {

      return false;
    }


    return requirementCorpus.includes(
      value.trim()
    );
  }


  // ==========================================================
  // Planner system prompt
  // ==========================================================

  const systemPrompt = `
You are a senior software QA test architect.

Your task is to convert application requirements into practical,
ordered browser-based QA test scenarios.

Application URL:

${baseUrl}


============================================================
EXECUTION MODEL
============================================================

The generated scenarios execute in ONE persistent browser session.

There is:

ONE browser
    ->
ONE browser context
    ->
ONE browser page
    ->
Scenario 1
    ->
Scenario 2
    ->
Scenario 3
    ->
...

The browser context is preserved across the entire test run.

Cookies, localStorage, sessionStorage, permissions and authentication
state therefore remain available.

The browser PAGE is also reused.

However, not every scenario must continue from the URL or UI state left
by the immediately previous scenario.

There are two valid scenario start modes:

"continue"

and

"base_url"


============================================================
START MODE: continue
============================================================

Use:

startMode = "continue"

when the current scenario should intentionally consume the browser state
left by the previous scenario.

Example:

Scenario 1:
Click Sign In.

End state:
Sign In menu is open.

Scenario 2:
Select I'm a Client.

Scenario 2 should use:

startMode:
"continue"

because it should use the already-open Sign In menu.


Another example:

Scenario 1:
Click Join Healing Sky.

End state:
Joining options are open.

Scenario 2:
Select Join as a Client.

Scenario 2 should use:

startMode:
"continue"


============================================================
START MODE: base_url
============================================================

Use:

startMode = "base_url"

when the scenario represents another independent path or sibling branch
and should begin again from the application homepage/base URL.

Example:

The homepage Sign In menu contains:

I'm a Client
I'm a Provider

These represent TWO ALTERNATIVE BRANCHES.


Correct execution:

Scenario A:
Open Sign In menu.

startMode:
continue

endState:
Sign In menu is open.


Scenario B:
Choose I'm a Client.

startMode:
continue

endState:
Client sign-in page is open.


Scenario C:
Choose I'm a Provider.

Scenario C MUST NOT continue from the client sign-in page.

It should use:

startMode:
base_url

startState:
Healing Sky homepage is loaded.

Then Scenario C can:

1. Open Sign In.
2. Select I'm a Provider.
3. Verify provider sign-in.


The same rule applies when moving from one completed workflow branch
to a different homepage workflow.

For example:

Client sign-in branch completes
    ->
next requirement tests Join Healing Sky

The Join Healing Sky scenario should generally use:

startMode:
base_url

because the previous branch ended on the client/provider sign-in page.


============================================================
BRANCHING MODEL
============================================================

A browser workflow is not always a single straight line.

It may look like this:

Homepage

    |
    +---- Sign In
    |        |
    |        +---- I'm a Client
    |        |
    |        +---- I'm a Provider
    |
    +---- Join Healing Sky
             |
             +---- Join as a Client


The test execution remains sequential, but alternate branches must reset
their PAGE LOCATION/UI state before beginning.

Therefore:

- continuous child step -> startMode "continue"
- sibling branch -> startMode "base_url"
- new homepage workflow after previous branch -> startMode "base_url"


============================================================
DEPENDENCY RULES
============================================================

dependsOn describes LOGICAL dependencies.

It does NOT mean "whatever scenario happens to run immediately before."

For example:

SIGNIN menu opens
    ->
client branch

The client scenario may depend on the Sign In menu scenario if it
directly continues that state.


But:

client branch
provider branch

are siblings.

The provider branch does NOT depend on successful completion of the
client branch.

It should normally use:

startMode:
base_url

and should not list the client branch as a dependency.


IMPORTANT:

Execution order and dependency are different concepts.

sequence:
controls when scenarios run.

dependsOn:
describes what scenario result/state is logically required.


============================================================
TEST DATA AND CONFIGURED CREDENTIALS
============================================================

Do NOT invent authentication values.

If a requirement refers to:

- configured valid client test email
- configured client email
- configured client OTP
- OTP bypass value
- configured test credentials
- authentication credentials

then DO NOT put a sample, placeholder, fake, guessed or hardcoded value
into testData.

Examples of values you MUST NOT generate:

"test@example.com"
"user@example.com"
"qa@example.com"
"123456"
"000000"
"111111"
"password123"
"testpassword"

For configured authentication data, use:

testData: {}

The execution runtime supplies configured authentication data separately.

The browser execution agent knows symbolic credential names such as:

clientEmail
clientOtp

Those values are NOT planner testData.

Do not place these keys in testData:

email
clientEmail
otp
clientOtp
password
token
apiKey
accessToken
refreshToken

unless the requirement explicitly describes ordinary non-authentication
data with the same word, which is unusual.

REGISTRATION EXCEPTION:

When a requirement spells out a literal email address to type into a
registration, sign-up or onboarding form -- for example "Email: type
literal text 'sam.reed.k92x@yopmail.com'" -- that address is ordinary
test data for creating a NEW account, not a configured credential.

Copy it verbatim into testData.email and keep it in the scenario
description. Do not blank it, do not substitute a placeholder, and do
not replace it with the configured sign-in email.

Configured authentication values belong to runtime configuration, not
the generated scenario.

Only populate testData with ordinary, non-sensitive,
scenario-specific values that are explicitly supported by the
requirement.

If no ordinary test data is needed, always return:

testData: {}


============================================================
AUTHENTICATION WORKFLOW
============================================================

Authentication requirements may describe actions such as:

1. Enter configured valid client email.
2. Select Email OTP.
3. Click Log in.
4. Verify OTP interface.
5. Enter configured OTP bypass.
6. Submit OTP.
7. Verify authenticated client interface.

The planner should describe these behaviors through:

criteria
preconditions
startState
endState
dependsOn
startMode

Do NOT provide the actual credential values.

Example:

Good:

criteria:
"Using the configured valid client test email and selecting Email as
OTP delivery, clicking Log in proceeds to the client OTP verification
interface."

testData:
{}

Bad:

testData:
{
  "email": "test@example.com"
}


Good:

criteria:
"Entering the configured test OTP bypass value and submitting the OTP
verification form successfully authenticates the client."

testData:
{}

Bad:

testData:
{
  "otp": "123456"
}


============================================================
WORKFLOW RULES
============================================================

1. Preserve the logical user journey expressed by the requirements.

2. Requirements are provided in meaningful business order unless there
   is strong evidence otherwise.

3. Use sequence to control test execution order.

4. Sequence values must be unique.

5. Sequence values should normally start at 1 and increase by 1.

6. Use startMode "continue" when a scenario intentionally consumes state
   established by the previous scenario.

7. Use startMode "base_url" when a scenario represents:
   - an alternate branch,
   - a sibling branch,
   - a new homepage workflow,
   - or a flow that cannot meaningfully continue from the previous
     scenario's ending page.

8. Use dependsOn only for real logical dependencies.

9. Never make sibling branches depend on one another.

10. Describe the expected browser state before execution using startState.

11. Describe the expected successful browser state using endState.

12. For startMode "continue", the prior scenario's endState should
    logically support the current scenario's startState.

13. For startMode "base_url", startState should generally describe the
    homepage or base application state.

14. Do not repeatedly navigate to the base URL between genuinely related
    continuous workflow steps.

15. Do navigate to the base URL when switching between incompatible
    branches.

16. Keep related workflow scenarios adjacent where practical.


============================================================
SIGN IN BRANCH EXAMPLE
============================================================

Suppose the requirements are:

HOME-001:
Homepage loads.

SIGNIN-001:
Clicking Sign In displays I'm a Client and I'm a Provider.

SIGNIN-002:
Selecting I'm a Client opens client sign-in.

SIGNIN-003:
Selecting I'm a Provider opens provider sign-in.


A good result is:


Scenario 1

requirementId:
HOME-001

sequence:
1

startMode:
base_url

dependsOn:
[]

startState:
Healing Sky homepage is loaded.

endState:
Healing Sky homepage remains open.


Scenario 2

requirementId:
SIGNIN-001

sequence:
2

startMode:
continue

dependsOn:
["scenario-1"]

startState:
Healing Sky homepage is open.

endState:
Sign In menu is open and displays I'm a Client and I'm a Provider.


Scenario 3

requirementId:
SIGNIN-002

sequence:
3

startMode:
continue

dependsOn:
["scenario-2"]

startState:
Sign In menu is open.

endState:
Client sign-in interface is open.


Scenario 4

requirementId:
SIGNIN-003

sequence:
4

startMode:
base_url

dependsOn:
[]

startState:
Healing Sky homepage is loaded.

endState:
Provider sign-in interface is open.


Scenario 4 must NOT continue from Scenario 3 because Scenario 3 ended
inside the client sign-in branch.


============================================================
CLIENT LOGIN EXAMPLE
============================================================

Suppose requirements say:

CLIENT-LOGIN-001:
Verify client login controls.

CLIENT-LOGIN-002:
Select Email OTP.

CLIENT-LOGIN-003:
Use configured valid client email and Log in.

CLIENT-LOGIN-004:
Verify OTP controls.

CLIENT-LOGIN-005:
Use configured OTP bypass and authenticate.


A good sequence is:

CLIENT-LOGIN-001
startMode: continue
testData: {}

CLIENT-LOGIN-002
startMode: continue
testData: {}

CLIENT-LOGIN-003
startMode: continue
testData: {}

CLIENT-LOGIN-004
startMode: continue
testData: {}

CLIENT-LOGIN-005
startMode: continue
testData: {}


Never invent:

test@example.com

or:

123456

The runtime supplies configured values.


============================================================
JOIN HEALING SKY EXAMPLE
============================================================

If the next requirement after the Sign In scenarios tests:

"Click Join Healing Sky and display Join as a Client"

and the previous scenario ended on provider sign-in, then use:

startMode:
base_url

startState:
Healing Sky homepage is loaded.

After that, related Join Healing Sky scenarios can use:

startMode:
continue

as they progress through:

Homepage
    ->
Join Healing Sky options
    ->
Join as a Client
    ->
Client registration


============================================================
SCENARIO GENERATION RULES
============================================================

1. Generate meaningful scenarios from supplied requirements.

2. Generate positive scenarios where appropriate.

3. Generate validation scenarios only when user input or validation
   behavior is actually relevant.

4. Generate boundary scenarios only when clearly meaningful.

5. Do not invent functionality unrelated to the requirement.

6. Do not assume backend functionality unless explicitly required.

7. Each scenario must have clear observable acceptance criteria.

8. Every scenario must be executable by a browser automation agent.

9. Avoid duplicate or nearly identical scenarios.

10. Keep the number of scenarios reasonable.

11. Do not include passwords, API keys, tokens or secrets.

12. Do not invent authentication emails or OTP values.

13. If credentials are required, refer to configured test credentials.

14. A positive scenario verifies expected successful behavior.

15. A validation scenario verifies observable validation behavior.

16. Do not invent specific error messages unless supported by the
    requirement.

17. Prefer one focused scenario per requirement unless splitting is
    genuinely necessary.

18. Do not generate extra scenarios merely to increase scenario count.

19. Preserve requirement IDs exactly.

20. Scenario IDs must be unique.

21. Sequence numbers must be unique positive integers.

22. Sequence numbers should normally begin with 1 and increment by 1.

23. Dependencies must reference scenario IDs generated in this response.

24. A scenario must never depend on itself.

25. A scenario may only depend on a scenario with a lower sequence number.

26. Sibling branches must NOT depend on each other.

27. Keep startState and endState short and browser-oriented.

28. Use startMode "base_url" whenever continuing from the immediately
    previous scenario would place the browser on the wrong branch.

29. Use startMode "continue" whenever preserving the immediately previous
    scenario's UI state is required.

30. Authentication scenarios should normally use testData: {} because
    configured authentication values are supplied by runtime.


============================================================
ACCEPTANCE CRITERIA
============================================================

These tests are performed by an autonomous browser agent.

Acceptance criteria must describe observable browser behavior.

Good:

"After selecting Join as a Client, the client registration interface
is displayed."

Bad:

"The frontend correctly calls the registration API."


Good:

"After selecting I'm a Provider, the provider sign-in interface is
displayed."

Bad:

"The provider authentication service receives the request."


Good:

"Using the configured valid client test email and selecting Email as
the OTP delivery method, clicking Log in displays the OTP verification
interface."

Bad:

"Enter test@example.com and click Log in."


============================================================
IMPORTANT
============================================================

Always consider whether the current scenario is:

1. a continuation of the previous workflow,

or

2. a sibling/new branch.

Set startMode correctly.

Never invent configured authentication values.

Return scenarios only through the create_test_scenarios tool.
`;


  // ==========================================================
  // Convert requirements to planner input
  // ==========================================================

  const requirementsText =
    requirements
      .map(
        (
          requirement,
          index
        ) => {

          return [

            `Order: ${index + 1}`,

            `Requirement ID: ${requirement.id}`,

            `Description: ${requirement.description}`,

          ].join(
            "\n"
          );
        }
      )
      .join(
        "\n\n"
      );


  // ==========================================================
  // LLM messages
  // ==========================================================

  const messages = [
    {
      role:
        "system",

      content:
        systemPrompt,
    },


    {
      role:
        "user",

      content: `
Create browser QA test scenarios for the following requirements.

The requirements appear in intended business/workflow order.

Some requirements may form a continuous user journey.

Other requirements may represent sibling or alternate branches.

Requirements:

${requirementsText}


Use the create_test_scenarios tool.


Important:

- Generate a focused and non-redundant scenario set.

- Preserve logical business order.

- Assign unique sequence numbers.

- Determine whether each scenario should use:

  startMode = "continue"

  or

  startMode = "base_url"

- Use "continue" only when the scenario should consume browser state
  intentionally left by the immediately previous scenario.

- Use "base_url" when switching to another independent or sibling branch.

- Populate dependsOn only for real dependencies.

- Do not make sibling branches depend on each other.

- Populate startState.

- Populate endState.

- Do not invent credentials.

- Do not invent test email addresses.

- Do not invent OTP values.

- Do not put configured authentication values into testData.

- Authentication scenarios using configured test email or OTP should
  normally use testData: {}.

- Do not invent functionality outside the supplied requirements.
`,
    },
  ];


  // ==========================================================
  // LLM request
  // ==========================================================

  const { assistantMessage } =
    await callLLM({
      messages,
      tools,
      toolChoice: {
        type: "function",
        function: {
          name: "create_test_scenarios",
        },
      },
      maxTokens: 5500,
    });

  if (
    !assistantMessage
  ) {

    throw new Error(
      "LLM planner returned no response."
    );
  }


  const toolCalls =
    assistantMessage.tool_calls ||
    [];


  const scenarioTool =
    toolCalls.find(
      (call) =>
        call.function?.name ===
        "create_test_scenarios"
    );


  if (
    !scenarioTool
  ) {

    throw new Error(
      "Planner did not return create_test_scenarios."
    );
  }


  // ==========================================================
  // Parse planner JSON
  // ==========================================================

  let result;


  try {

    result =
      JSON.parse(
        scenarioTool.function.arguments
      );

  } catch (err) {

    throw new Error(
      `Planner returned invalid JSON: ${err.message}`
    );
  }


  if (
    !result.scenarios ||
    !Array.isArray(
      result.scenarios
    ) ||
    result.scenarios.length ===
      0
  ) {

    throw new Error(
      "Planner returned no scenarios."
    );
  }


  // ==========================================================
  // Validate scenarios
  // ==========================================================

  const scenarioIds =
    new Set();


  const sequenceNumbers =
    new Set();


  const validRequirementIds =
    new Set(
      requirements.map(
        (requirement) =>
          requirement.id
      )
    );


  for (
    const scenario of
    result.scenarios
  ) {

    // --------------------------------------------------------
    // ID
    // --------------------------------------------------------

    if (
      !scenario.id ||
      typeof scenario.id !==
        "string"
    ) {

      throw new Error(
        "Planner returned a scenario without a valid id."
      );
    }


    if (
      scenarioIds.has(
        scenario.id
      )
    ) {

      throw new Error(
        `Planner returned duplicate scenario id: ${scenario.id}`
      );
    }


    scenarioIds.add(
      scenario.id
    );


    // --------------------------------------------------------
    // Requirement ID
    // --------------------------------------------------------

    if (
      !scenario.requirementId ||
      typeof scenario.requirementId !==
        "string"
    ) {

      throw new Error(
        `Scenario ${scenario.id} has no requirementId.`
      );
    }


    if (
      !validRequirementIds.has(
        scenario.requirementId
      )
    ) {

      throw new Error(
        `Scenario ${scenario.id} references unknown requirement ${scenario.requirementId}.`
      );
    }


    // --------------------------------------------------------
    // Sequence
    // --------------------------------------------------------

    if (
      !Number.isInteger(
        scenario.sequence
      ) ||
      scenario.sequence < 1
    ) {

      throw new Error(
        `Scenario ${scenario.id} has invalid sequence.`
      );
    }


    if (
      sequenceNumbers.has(
        scenario.sequence
      )
    ) {

      throw new Error(
        `Duplicate scenario sequence: ${scenario.sequence}`
      );
    }


    sequenceNumbers.add(
      scenario.sequence
    );


    // --------------------------------------------------------
    // Start mode
    // --------------------------------------------------------

    if (
      scenario.startMode !==
        "continue" &&
      scenario.startMode !==
        "base_url"
    ) {

      throw new Error(
        `Scenario ${scenario.id} has invalid startMode: ${scenario.startMode}`
      );
    }


    // --------------------------------------------------------
    // Dependencies
    // --------------------------------------------------------

    if (
      !Array.isArray(
        scenario.dependsOn
      )
    ) {

      scenario.dependsOn =
        [];
    }


    // --------------------------------------------------------
    // Preconditions
    // --------------------------------------------------------

    if (
      !Array.isArray(
        scenario.preconditions
      )
    ) {

      scenario.preconditions =
        scenario.preconditions
          ? [
              String(
                scenario.preconditions
              ),
            ]
          : [];
    }


    // --------------------------------------------------------
    // Test data
    // --------------------------------------------------------

    if (
      !scenario.testData ||
      typeof scenario.testData !==
        "object" ||
      Array.isArray(
        scenario.testData
      )
    ) {

      scenario.testData =
        {};
    }


    // --------------------------------------------------------
    // Remove authentication data invented by the planner
    // --------------------------------------------------------
    //
    // The actual configured authentication data is supplied
    // separately to agent.js from environment variables.
    //
    // These values should never originate from planner.js.
    //
    // --------------------------------------------------------

    const forbiddenTestDataKeys = [
      "email",
      "clientEmail",
      "otp",
      "clientOtp",
      "password",
      "passcode",
      "token",
      "apiKey",
      "accessToken",
      "refreshToken",
      "authorization",
      "secret",
    ];


    for (
      const key of
      forbiddenTestDataKeys
    ) {

      if (
        Object.prototype
          .hasOwnProperty
          .call(
            scenario.testData,
            key
          )
      ) {

        if (
          isSuppliedRegistrationEmail(
            key,
            scenario.testData[
              key
            ]
          )
        ) {

          console.log(
            `Keeping requirement-supplied registration email for ${scenario.id}.`
          );

          continue;
        }


        console.warn(
          `Planner supplied authentication-related testData "${key}" for ${scenario.id}; removing it.`
        );


        delete scenario.testData[
          key
        ];
      }
    }


    // --------------------------------------------------------
    // Start state
    // --------------------------------------------------------

    if (
      !scenario.startState ||
      typeof scenario.startState !==
        "string"
    ) {

      throw new Error(
        `Scenario ${scenario.id} has no valid startState.`
      );
    }


    // --------------------------------------------------------
    // End state
    // --------------------------------------------------------

    if (
      !scenario.endState ||
      typeof scenario.endState !==
        "string"
    ) {

      throw new Error(
        `Scenario ${scenario.id} has no valid endState.`
      );
    }


    // --------------------------------------------------------
    // Criteria
    // --------------------------------------------------------

    if (
      !scenario.criteria ||
      typeof scenario.criteria !==
        "string"
    ) {

      throw new Error(
        `Scenario ${scenario.id} has no valid criteria.`
      );
    }


    // --------------------------------------------------------
    // Name
    // --------------------------------------------------------

    if (
      !scenario.name ||
      typeof scenario.name !==
        "string"
    ) {

      throw new Error(
        `Scenario ${scenario.id} has no valid name.`
      );
    }
  }


  // ==========================================================
  // Sort scenarios by sequence
  // ==========================================================

  const scenarios =
    [...result.scenarios]
      .sort(
        (a, b) =>
          a.sequence -
          b.sequence
      );


  // ==========================================================
  // Validate dependency references
  // ==========================================================

  const scenarioById =
    new Map(
      scenarios.map(
        (scenario) => [
          scenario.id,
          scenario,
        ]
      )
    );


  for (
    const scenario of
    scenarios
  ) {

    for (
      const dependencyId of
      scenario.dependsOn
    ) {

      const dependency =
        scenarioById.get(
          dependencyId
        );


      if (
        !dependency
      ) {

        throw new Error(
          `Scenario ${scenario.id} depends on unknown scenario ${dependencyId}.`
        );
      }


      if (
        dependency.id ===
        scenario.id
      ) {

        throw new Error(
          `Scenario ${scenario.id} cannot depend on itself.`
        );
      }


      if (
        dependency.sequence >=
        scenario.sequence
      ) {

        throw new Error(
          `Scenario ${scenario.id} depends on ${dependencyId}, but the dependency does not run earlier.`
        );
      }
    }
  }


  // ==========================================================
  // Validate sequence continuity
  // ==========================================================
  //
  // The planner is instructed to generate 1, 2, 3, ...
  //
  // We do not reject gaps because they are not technically unsafe,
  // but we print a warning if one occurs.
  //
  // ==========================================================

  for (
    let index = 0;
    index < scenarios.length;
    index++
  ) {

    const expectedSequence =
      index + 1;


    const actualSequence =
      scenarios[index].sequence;


    if (
      actualSequence !==
      expectedSequence
    ) {

      console.warn(
        `Planner sequence warning: expected sequence ${expectedSequence} but received ${actualSequence} for ${scenarios[index].id}.`
      );
    }
  }


  // ==========================================================
  // Validate workflow transitions
  // ==========================================================

  for (
    let index = 0;
    index < scenarios.length;
    index++
  ) {

    const scenario =
      scenarios[index];


    const previousScenario =
      index > 0
        ? scenarios[index - 1]
        : null;


    // --------------------------------------------------------
    // First scenario
    // --------------------------------------------------------

    if (
      index === 0
    ) {

      console.log(
        `Planner start: ${scenario.id} uses ${scenario.startMode}.`
      );


      continue;
    }


    // --------------------------------------------------------
    // Continue scenario
    // --------------------------------------------------------

    if (
      scenario.startMode ===
        "continue"
    ) {

      console.log(
        `Planner transition: ${previousScenario.id} -> ${scenario.id} continues existing page state.`
      );


      // ------------------------------------------------------
      // Helpful dependency warning
      // ------------------------------------------------------
      //
      // A continuation usually has some logical connection to
      // a prior scenario.
      //
      // We only warn because some valid UI checks may still
      // intentionally continue without strict dependency.
      //
      // ------------------------------------------------------

      if (
        scenario.dependsOn.length ===
          0
      ) {

        console.warn(
          `Planner workflow warning: ${scenario.id} uses startMode "continue" but has no dependency.`
        );
      }
    }


    // --------------------------------------------------------
    // Branch reset
    // --------------------------------------------------------

    if (
      scenario.startMode ===
        "base_url"
    ) {

      console.log(
        `Planner branch/reset: ${scenario.id} will start from base URL instead of continuing from ${previousScenario.id}.`
      );
    }
  }


  // ==========================================================
  // Final authentication-data safety scan
  // ==========================================================
  //
  // This scan is defensive.
  //
  // Even though authentication-related testData keys were already
  // removed above, this verifies that no scenario still contains
  // one of the known forbidden keys.
  //
  // ==========================================================

  const forbiddenKeysLowerCase =
    new Set([
      "email",
      "clientemail",
      "otp",
      "clientotp",
      "password",
      "passcode",
      "token",
      "apikey",
      "accesstoken",
      "refreshtoken",
      "authorization",
      "secret",
    ]);


  for (
    const scenario of
    scenarios
  ) {

    for (
      const key of
      Object.keys(
        scenario.testData ||
        {}
      )
    ) {

      if (
        forbiddenKeysLowerCase.has(
          key.toLowerCase()
        )
      ) {

        if (
          isSuppliedRegistrationEmail(
            key,
            scenario.testData[
              key
            ]
          )
        ) {

          continue;
        }


        throw new Error(
          `Scenario ${scenario.id} contains forbidden authentication testData key "${key}".`
        );
      }
    }
  }


  // ==========================================================
  // Print workflow
  // ==========================================================

  console.log(
    "\n========================================"
  );


  console.log(
    "Planner generated workflow"
  );


  console.log(
    "========================================"
  );


  for (
    const scenario of
    scenarios
  ) {

    console.log(
      `\n${scenario.sequence}. ${scenario.id}`
    );


    console.log(
      `   Requirement: ${scenario.requirementId}`
    );


    console.log(
      `   Type: ${scenario.type}`
    );


    console.log(
      `   Priority: ${scenario.priority}`
    );


    console.log(
      `   Start mode: ${scenario.startMode}`
    );


    console.log(
      `   Start: ${scenario.startState}`
    );


    console.log(
      `   End: ${scenario.endState}`
    );


    console.log(
      `   Depends on: ${
        scenario.dependsOn.length
          ? scenario.dependsOn.join(
              ", "
            )
          : "none"
      }`
    );


    console.log(
      `   Criteria: ${scenario.criteria}`
    );


    console.log(
      `   Test data: ${
        Object.keys(
          scenario.testData
        ).length
          ? JSON.stringify(
              scenario.testData
            )
          : "{}"
      }`
    );
  }


  // ==========================================================
  // Return ordered scenarios
  // ==========================================================

  return scenarios;
}