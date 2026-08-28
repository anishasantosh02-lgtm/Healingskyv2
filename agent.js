// agent.js
//
// Autonomous browser QA agent.
//
// IMPORTANT ARCHITECTURE:
//
// index.js owns:
//
// ONE browser
// ONE browser context
// ONE page
//
// agent.js receives that SAME page for every scenario.
//
// The browser context and page are intentionally preserved across
// scenarios unless startMode = "base_url", in which case the SAME page
// navigates back to the application's base URL.
//
// Cookies, localStorage, sessionStorage, authentication state,
// permissions and browser context remain preserved.
//
// ============================================================
//
// Security:
//
// Actual configured credentials are never intentionally exposed to
// the LLM.
//
// Supported symbolic runtime credentials:
//
// clientEmail
// clientOtp
//
// Example:
//
// type_text({
//   agent_id: "e4",
//   credential_key: "clientEmail"
// })
//
// type_otp({
//   agent_ids: ["e10", "e11", "e12", "e13"],
//   credential_key: "clientOtp"
// })
//
// agent.js resolves those credential values locally.
//
// ============================================================

import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { callLLM } from "./llmclient.js";

dotenv.config();


// ============================================================
// Version marker
// ============================================================

const AGENT_VERSION =
  "secure-radio-otp-startmode-v4";


// Multi-field forms need a generous budget. A custom dropdown costs
// three steps on its own (open, re-inspect, pick), and an address
// autocomplete costs four, so an eight-field registration form runs to
// roughly 25 steps before any retry. Override with AGENT_MAX_STEPS.

const MAX_STEPS =
  Number(
    process.env
      .AGENT_MAX_STEPS
  ) ||
  40;


const RENDER_TIMEOUT =
  60000;


const NAVIGATION_TIMEOUT =
  300000;


// ============================================================
// Utility
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
// Credential access
// ============================================================

function getCredentialValue(
  key,
  testCredentials
) {

  if (
    key ===
    "clientEmail"
  ) {

    return (
      testCredentials
        ?.clientEmail ||
      null
    );
  }


  if (
    key ===
    "clientOtp"
  ) {

    return (
      testCredentials
        ?.clientOtp ||
      null
    );
  }


  return null;
}


// ============================================================
// Secret redaction
// ============================================================

function getSecretValues(
  testCredentials
) {

  return [
    testCredentials
      ?.clientEmail,

    testCredentials
      ?.clientOtp,
  ]
    .filter(
      (value) =>
        typeof value ===
          "string" &&
        value.length >
          0
    )
    .sort(
      (a, b) =>
        b.length -
        a.length
    );
}


function redactString(
  value,
  testCredentials
) {

  if (
    typeof value !==
    "string"
  ) {

    return value;
  }


  let result =
    value;


  for (
    const secret of
    getSecretValues(
      testCredentials
    )
  ) {

    result =
      result
        .split(
          secret
        )
        .join(
          "[REDACTED]"
        );
  }


  return result;
}


function redactSecrets(
  value,
  testCredentials
) {

  if (
    value ===
      null ||
    value ===
      undefined
  ) {

    return value;
  }


  if (
    typeof value ===
    "string"
  ) {

    return redactString(
      value,
      testCredentials
    );
  }


  if (
    Array.isArray(
      value
    )
  ) {

    return value.map(
      (item) =>
        redactSecrets(
          item,
          testCredentials
        )
    );
  }


  if (
    typeof value ===
    "object"
  ) {

    const output =
      {};


    for (
      const [
        key,
        item,
      ] of
      Object.entries(
        value
      )
    ) {

      output[key] =
        redactSecrets(
          item,
          testCredentials
        );
    }


    return output;
  }


  return value;
}


// ============================================================
// Safe tool-input logging
// ============================================================

function sanitizeToolInput(
  toolName,
  input
) {

  if (
    !input ||
    typeof input !==
      "object"
  ) {

    return input;
  }


  const sanitized = {

    ...input,
  };


  if (
    toolName ===
      "type_text"
  ) {

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          sanitized,
          "text"
        )
    ) {

      sanitized.text =
        "[REDACTED]";
    }
  }


  if (
    toolName ===
      "type_otp"
  ) {

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          sanitized,
          "text"
        )
    ) {

      sanitized.text =
        "[REDACTED]";
    }
  }


  if (
    toolName ===
      "fill_form" &&
    Array.isArray(
      sanitized.fields
    )
  ) {

    sanitized.fields =
      sanitized.fields.map(
        (field) => ({

          ...field,

          ...(
            Object.prototype
              .hasOwnProperty
              .call(
                field,
                "text"
              )
              ? {
                  text:
                    "[REDACTED]",
                }
              : {}
          ),
        })
      );
  }


  return sanitized;
}


// ============================================================
// Wait for rendered application UI
// ============================================================

async function waitForApplicationRender(
  page
) {

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
            [
              "a",
              "button",
              "input",
              "textarea",
              "select",
              "[role='button']",
              "[role='link']",
              "[role='radio']",
              "[role='checkbox']",
              "[role='tab']",
              "[role='menuitem']",
            ].join(
              ","
            )
          ).length;


        const root =
          document.getElementById(
            "root"
          ) ||
          document.getElementById(
            "app"
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
          RENDER_TIMEOUT,
      }
    );


    return true;

  } catch {

    return false;
  }
}


// ============================================================
// Cookie consent
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
    /Accept Cookies/i,
    /^OK$/i,
    /^Close$/i,
    /^Dismiss$/i,
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


      await button.click({
        timeout:
          5000,
      });


      await page.waitForTimeout(
        400
      );


      return true;

    } catch {
      // Try next candidate.
    }
  }


  try {
    const genericButton = page
      .locator("button:has-text('Accept'), button:has-text('Allow'), button:has-text('Agree'), [class*='cookie'] button, [id*='cookie'] button")
      .first();

    if ((await genericButton.count()) > 0 && (await genericButton.isVisible())) {
      await genericButton.click({ timeout: 5000 });
      await page.waitForTimeout(400);
      return true;
    }
  } catch {
    // Ignore
  }


  return false;
}


// ============================================================
// Scenario start preparation
// ============================================================

async function prepareScenarioStart(
  page,
  startMode,
  baseUrl
) {

  const effectiveStartMode =
    startMode ===
      "base_url"
      ? "base_url"
      : "continue";


  if (
    effectiveStartMode ===
    "continue"
  ) {

    return {

      startMode:
        "continue",

      target:
        "current_page",

      url:
        page.url(),
    };
  }


  // ----------------------------------------------------------
  // IMPORTANT:
  //
  // Navigate the SAME Playwright page.
  //
  // We intentionally do NOT create a new browser,
  // context or page.
  //
  // Browser/session state is preserved.
  //
  // The navigation exists only to reset page/UI branch state.
  // ----------------------------------------------------------

  // Clear cookies and storage when resetting to base_url so fresh public flows start unauthenticated
  try {
    await page.context().clearCookies();
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
    }).catch(() => {});
  } catch {}

  await page.goto(
    baseUrl,

    {
      waitUntil:
        "commit",

      timeout:
        NAVIGATION_TIMEOUT,
    }
  );


  await waitForApplicationRender(
    page
  );

  await page.waitForTimeout(1500);

  await handleCookieConsent(
    page
  );


  return {

    startMode:
      "base_url",

    target:
      baseUrl,

    url:
      page.url(),
  };
}


// ============================================================
// Page-state perception
// ============================================================
//
// SECURITY:
//
// Never expose actual values from input/textarea elements.
//
// Instead expose:
//
// hasValue
// valueLength
//
// Known runtime credentials are also redacted from visible text.
//
// RADIO/CHECKBOX SUPPORT:
//
// Visible labels for hidden radio/checkbox inputs are included.
//
// Example:
//
// {
//   id: "e4",
//   tag: "label",
//   text: "Email",
//   linkedControlType: "radio",
//   checked: false
// }
//
// ============================================================

async function getPageState(
  page,
  testCredentials
) {

  const rawState =
    await page.evaluate(
      () => {

        // ----------------------------------------------------
        // Remove all previous generated IDs.
        // ----------------------------------------------------

        document
          .querySelectorAll(
            "[data-agent-id]"
          )
          .forEach(
            (element) => {

              element.removeAttribute(
                "data-agent-id"
              );
            }
          );


        let nextId =
          0;


        const isElementVisible =
          (element) => {

            if (
              !element ||
              !element.isConnected
            ) {

              return false;
            }


            const style =
              window.getComputedStyle(
                element
              );


            if (
              style.display ===
                "none" ||
              style.visibility ===
                "hidden" ||
              Number(
                style.opacity
              ) ===
                0
            ) {

              return false;
            }


            const rect =
              element.getBoundingClientRect();


            return (
              rect.width >
                0 &&
              rect.height >
                0
            );
          };


        const getAssociatedLabel =
          (element) => {

            if (
              !element
            ) {

              return "";
            }


            const ariaLabel =
              element.getAttribute(
                "aria-label"
              );


            if (
              ariaLabel
            ) {

              return ariaLabel
                .trim();
            }


            const labelledBy =
              element.getAttribute(
                "aria-labelledby"
              );


            if (
              labelledBy
            ) {

              const text =
                labelledBy
                  .split(
                    /\s+/
                  )
                  .map(
                    (id) =>
                      document
                        .getElementById(
                          id
                        )
                        ?.innerText
                        ?.trim() ||
                      ""
                  )
                  .filter(
                    Boolean
                  )
                  .join(
                    " "
                  );


              if (
                text
              ) {

                return text;
              }
            }


            if (
              element.labels &&
              element.labels.length >
                0
            ) {

              const text =
                Array.from(
                  element.labels
                )
                  .map(
                    (label) =>
                      label.innerText
                        ?.trim() ||
                      ""
                  )
                  .filter(
                    Boolean
                  )
                  .join(
                    " "
                  );


              if (
                text
              ) {

                return text;
              }
            }


            const parentLabel =
              element.closest(
                "label"
              );


            if (
              parentLabel
            ) {

              const text =
                parentLabel
                  .innerText
                  ?.trim();


              if (
                text
              ) {

                return text;
              }
            }


            return (
              element.getAttribute(
                "placeholder"
              ) ||
              element.getAttribute(
                "title"
              ) ||
              ""
            ).trim();
          };


        // ----------------------------------------------------
        // Semantic hint for icon-only controls
        // ----------------------------------------------------
        //
        // Some important controls carry no text at all. The client
        // dashboard's log-out control, for instance, is an icon in a
        // div.profile-logout-icon and the word "logout" appears
        // nowhere on the page, so an agent looking for "Log Out"
        // cannot find it.
        //
        // For such elements we derive a hint from the class name,
        // id, title, data-testid and any nested icon metadata, so
        // the control's purpose is still discoverable.
        //
        // ----------------------------------------------------

        const HINT_KEYWORDS = [
          "logout", "signout", "log-out", "sign-out",
          "login", "signin", "profile", "avatar", "account",
          "user-menu", "usermenu", "dropdown", "menu",
          "close", "dismiss", "search", "submit", "edit",
          "delete", "remove", "settings", "notification",
          "back", "next", "prev", "toggle", "hamburger",
        ];


        const getSemanticHint =
          (element) => {

            const signature =
              [
                typeof element.className ===
                  "string"
                  ? element.className
                  : "",

                element.id ||
                  "",

                element.getAttribute(
                  "title"
                ) ||
                  "",

                element.getAttribute(
                  "data-testid"
                ) ||
                  "",

                element.parentElement &&
                typeof element.parentElement
                  .className ===
                  "string"
                  ? element.parentElement
                      .className
                  : "",

                Array.from(
                  element.querySelectorAll(
                    "img, svg, i, use"
                  )
                )
                  .slice(
                    0,
                    3
                  )
                  .map(
                    (icon) =>
                      [
                        icon.getAttribute(
                          "alt"
                        ),
                        icon.getAttribute(
                          "title"
                        ),
                        icon.getAttribute(
                          "href"
                        ),
                        icon.getAttribute(
                          "xlink:href"
                        ),
                        icon.getAttribute(
                          "src"
                        ),
                        typeof icon.className ===
                          "string"
                          ? icon.className
                          : "",
                      ]
                        .filter(
                          Boolean
                        )
                        .join(
                          " "
                        )
                  )
                  .join(
                    " "
                  ),
              ]
                .join(
                  " "
                )
                .toLowerCase();


            const matched =
              HINT_KEYWORDS.filter(
                (keyword) =>
                  signature.includes(
                    keyword
                  )
              );


            if (
              matched.length ===
              0
            ) {

              return undefined;
            }


            return matched
              .slice(
                0,
                4
              )
              .join(
                " "
              );
          };


        const getElementText =
          (element) => {

            const tag =
              element.tagName
                ?.toLowerCase();


            // Never expose entered values.
            if (
              tag ===
                "input" ||
              tag ===
                "textarea"
            ) {

              return (
                getAssociatedLabel(
                  element
                ) ||
                element.getAttribute(
                  "placeholder"
                ) ||
                element.getAttribute(
                  "name"
                ) ||
                element.getAttribute(
                  "type"
                ) ||
                tag
              )
                .trim()
                .slice(
                  0,
                  250
                );
            }


            return (
              element.innerText ||
              element.textContent ||
              element.getAttribute(
                "aria-label"
              ) ||
              element.getAttribute(
                "title"
              ) ||
              ""
            )
              .trim()
              .replace(
                /\s+/g,
                " "
              )
              .slice(
                0,
                500
              );
          };


        const assignId =
          (element) => {

            if (
              !element.getAttribute(
                "data-agent-id"
              )
            ) {

              element.setAttribute(
                "data-agent-id",
                `e${nextId++}`
              );
            }


            return element.getAttribute(
              "data-agent-id"
            );
          };


        const candidates =
          Array.from(
            document.querySelectorAll(
              [
                "a",
                "button",
                "input",
                "textarea",
                "select",
                "label",
                "[role='button']",
                "[role='link']",
                "[role='radio']",
                "[role='checkbox']",
                "[role='tab']",
                "[role='menuitem']",
                "[contenteditable='true']",
                "[onclick]",

                // ------------------------------------------
                // Custom dropdown / combobox widgets
                // ------------------------------------------
                //
                // Libraries such as PrimeReact, react-select
                // and Headless UI render their options into a
                // portal on document.body only while the
                // dropdown is open, as <li role="option">.
                //
                // Without these selectors the options are
                // invisible to the agent and a custom
                // dropdown can never be set.
                //
                // ------------------------------------------

                "[role='option']",
                "[role='combobox']",
                "[role='listbox'] li",
                "li.p-dropdown-item",
                "li.p-multiselect-item",
                "li.p-autocomplete-item",
                ".p-dropdown-trigger",
                ".pac-item",

                // ------------------------------------------
                // Icon-only session controls
                // ------------------------------------------
                //
                // A React onClick leaves no [onclick] attribute,
                // so a clickable <div> is invisible to the
                // selectors above. The log-out control on the
                // client dashboard is exactly that: a bare
                // div.profile-logout-icon carrying no text.
                //
                // ------------------------------------------

                "[class*='logout' i]",
                "[class*='signout' i]",
                "[class*='sign-out' i]",
                "[class*='log-out' i]",
                ".dropdown-toggle",
              ].join(
                ","
              )
            )
          );


        const results =
          [];


        const processed =
          new Set();


        for (
          const element of
          candidates
        ) {

          if (
            processed.has(
              element
            )
          ) {

            continue;
          }


          processed.add(
            element
          );


          const tag =
            element.tagName
              ?.toLowerCase();


          const type =
            (
              element.getAttribute(
                "type"
              ) ||
              ""
            ).toLowerCase();


          const role =
            (
              element.getAttribute(
                "role"
              ) ||
              ""
            ).toLowerCase();


          const isRadioOrCheckbox =
            (
              tag ===
                "input" &&
              (
                type ===
                  "radio" ||
                type ===
                  "checkbox"
              )
            ) ||
            role ===
              "radio" ||
            role ===
              "checkbox";


          let visible =
            isElementVisible(
              element
            );


          // --------------------------------------------------
          // Hidden native radios/checkboxes can still be
          // meaningful if their associated label is visible.
          // --------------------------------------------------

          let associatedVisibleLabel =
            null;


          if (
            !visible &&
            tag ===
              "input" &&
            (
              type ===
                "radio" ||
              type ===
                "checkbox"
            )
          ) {

            if (
              element.labels &&
              element.labels.length >
                0
            ) {

              associatedVisibleLabel =
                Array.from(
                  element.labels
                )
                  .find(
                    (label) =>
                      isElementVisible(
                        label
                      )
                  ) ||
                null;
            }


            if (
              !associatedVisibleLabel
            ) {

              const parentLabel =
                element.closest(
                  "label"
                );


              if (
                parentLabel &&
                isElementVisible(
                  parentLabel
                )
              ) {

                associatedVisibleLabel =
                  parentLabel;
              }
            }
          }


          if (
            !visible &&
            !associatedVisibleLabel
          ) {

            continue;
          }


          // --------------------------------------------------
          // Do not include plain labels unless they are
          // associated with a control or are clickable.
          // --------------------------------------------------

          if (
            tag ===
              "label"
          ) {

            const htmlFor =
              element.htmlFor;


            const linkedControl =
              htmlFor
                ? document.getElementById(
                    htmlFor
                  )
                : element.querySelector(
                    "input,select,textarea"
                  );


            const clickable =
              linkedControl ||
              element.onclick ||
              element.getAttribute(
                "role"
              );


            if (
              !clickable
            ) {

              continue;
            }
          }


          const id =
            assignId(
              element
            );


          let checked;


          if (
            typeof element.checked ===
            "boolean"
          ) {

            checked =
              element.checked;
          }


          const ariaChecked =
            element.getAttribute(
              "aria-checked"
            );


          const ariaSelected =
            element.getAttribute(
              "aria-selected"
            );


          const ariaPressed =
            element.getAttribute(
              "aria-pressed"
            );


          const disabled =
            Boolean(
              element.disabled
            ) ||
            element.getAttribute(
              "aria-disabled"
            ) ===
              "true";


          const value =
            tag ===
              "input" ||
            tag ===
              "textarea"
              ? element.value ||
                ""
              : "";


          let linkedControlType;
          let linkedControlChecked;
          let linkedControlName;


          if (
            tag ===
              "label"
          ) {

            const linkedControl =
              element.htmlFor
                ? document.getElementById(
                    element.htmlFor
                  )
                : element.querySelector(
                    "input,select,textarea"
                  );


            if (
              linkedControl
            ) {

              linkedControlType =
                linkedControl.getAttribute(
                  "type"
                ) ||
                linkedControl.tagName
                  ?.toLowerCase();


              linkedControlName =
                linkedControl.getAttribute(
                  "name"
                ) ||
                undefined;


              if (
                typeof linkedControl.checked ===
                "boolean"
              ) {

                linkedControlChecked =
                  linkedControl.checked;
              }
            }
          }


          const rect =
            element.getBoundingClientRect();


          const item = {

            id,

            tag,

            type:
              type ||
              undefined,

            role:
              role ||
              undefined,

            text:
              getElementText(
                element
              ) ||
              undefined,

            label:
              getAssociatedLabel(
                element
              ) ||
              undefined,

            // Only for controls that carry no readable text of their
            // own, so text-bearing elements are not made noisier.
            hint:
              (
                getElementText(
                  element
                ) ||
                getAssociatedLabel(
                  element
                )
              )
                ? undefined
                : getSemanticHint(
                    element
                  ),

            name:
              element.getAttribute(
                "name"
              ) ||
              undefined,

            placeholder:
              element.getAttribute(
                "placeholder"
              ) ||
              undefined,

            href:
              element.getAttribute(
                "href"
              ) ||
              undefined,

            checked,

            ariaChecked:
              ariaChecked ??
              undefined,

            ariaSelected:
              ariaSelected ??
              undefined,

            ariaPressed:
              ariaPressed ??
              undefined,

            disabled:
              disabled ||
              undefined,

            hasValue:
              (
                tag ===
                  "input" ||
                tag ===
                  "textarea"
              )
                ? value.length >
                  0
                : undefined,

            valueLength:
              (
                tag ===
                  "input" ||
                tag ===
                  "textarea"
              )
                ? value.length
                : undefined,

            maxLength:
              (
                tag ===
                  "input" ||
                tag ===
                  "textarea"
              ) &&
              typeof element.maxLength ===
                "number" &&
              element.maxLength >=
                0
                ? element.maxLength
                : undefined,

            className:
              typeof element.className ===
                "string"
                ? element.className
                    .slice(
                      0,
                      200
                    ) ||
                  undefined
                : undefined,

            linkedControlType,

            linkedControlChecked,

            linkedControlName,

            hiddenNativeControl:
              !visible &&
              Boolean(
                associatedVisibleLabel
              )
                ? true
                : undefined,

            x:
              Math.round(
                rect.x
              ),

            y:
              Math.round(
                rect.y
              ),

            width:
              Math.round(
                rect.width
              ),

            height:
              Math.round(
                rect.height
              ),
          };


          // Remove undefined values.
          for (
            const key of
            Object.keys(
              item
            )
          ) {

            if (
              item[key] ===
              undefined
            ) {

              delete item[key];
            }
          }


          results.push(
            item
          );


          // --------------------------------------------------
          // If native radio/checkbox is hidden and associated
          // label is visible, ensure label receives its own ID.
          // --------------------------------------------------

          if (
            associatedVisibleLabel &&
            !processed.has(
              associatedVisibleLabel
            )
          ) {

            processed.add(
              associatedVisibleLabel
            );


            const labelId =
              assignId(
                associatedVisibleLabel
              );


            const labelRect =
              associatedVisibleLabel
                .getBoundingClientRect();


            const labelItem = {

              id:
                labelId,

              tag:
                "label",

              text:
                getElementText(
                  associatedVisibleLabel
                ),

              role:
                "control-label",

              linkedControlType:
                type,

              linkedControlName:
                element.getAttribute(
                  "name"
                ) ||
                undefined,

              checked:
                typeof element.checked ===
                  "boolean"
                  ? element.checked
                  : undefined,

              className:
                typeof associatedVisibleLabel.className ===
                  "string"
                  ? associatedVisibleLabel
                      .className
                      .slice(
                        0,
                        200
                      ) ||
                    undefined
                  : undefined,

              x:
                Math.round(
                  labelRect.x
                ),

              y:
                Math.round(
                  labelRect.y
                ),

              width:
                Math.round(
                  labelRect.width
                ),

              height:
                Math.round(
                  labelRect.height
                ),
            };


            for (
              const key of
              Object.keys(
                labelItem
              )
            ) {

              if (
                labelItem[key] ===
                undefined
              ) {

                delete labelItem[key];
              }
            }


            results.push(
              labelItem
            );
          }
        }


        const bodyText =
          document.body
            ?.innerText
            ?.trim()
            ?.replace(
              /\s+/g,
              " "
            )
            ?.slice(
              0,
              7000
            ) ||
          "";


        return {

          url:
            window.location.href,

          title:
            document.title,

          visibleText:
            bodyText,

          elements:
            results.slice(
              0,
              180
            ),
        };
      }
    );


  return redactSecrets(
    rawState,
    testCredentials
  );
}


// ============================================================
// Find element from current snapshot
// ============================================================

async function findAgentElement(
  page,
  agentId
) {

  if (
    !agentId ||
    typeof agentId !==
      "string"
  ) {

    throw new Error(
      "agent_id is required."
    );
  }


  const locator =
    page.locator(
      `[data-agent-id="${agentId}"]`
    );


  const count =
    await locator.count();


  if (
    count ===
      0
  ) {

    const error =
      new Error(
        `Stale or unknown agent_id "${agentId}". Call get_page_state again before interacting.`
      );


    error.code =
      "STALE_AGENT_ID";


    throw error;
  }


  return locator.first();
}


// ============================================================
// Click
// ============================================================

// ------------------------------------------------------------
// Post-click settle
// ------------------------------------------------------------
//
// A click that triggers authentication, submission or routing
// resolves asynchronously. Snapshotting immediately catches the
// PREVIOUS screen, which makes a passing flow look like a failure
// ("OTP verified successfully" while still on the verify route).
//
// So after a click we give the app a brief window to change route
// and settle its network activity before returning.
//
// ------------------------------------------------------------

async function settleAfterClick(
  page,
  urlBefore
) {

  try {

    await page.waitForFunction(
      (previous) =>
        window.location.href !==
        previous,
      urlBefore,
      {
        timeout:
          3000,
      }
    );


    // A route change landed. Let the new view render.

    try {

      await page.waitForLoadState(
        "networkidle",
        {
          timeout:
            5000,
        }
      );

    } catch {
      // Long-polling apps never reach networkidle.
    }


    await page.waitForTimeout(
      500
    );

    return;

  } catch {
    // No route change; fall through to the in-place settle.
  }


  try {

    await page.waitForLoadState(
      "networkidle",
      {
        timeout:
          2500,
      }
    );

  } catch {
    // Ignore.
  }


  await page.waitForTimeout(
    400
  );
}


async function clickElement(
  page,
  agentId
) {

  const urlBeforeClick =
    page.url();


  const element =
    await findAgentElement(
      page,
      agentId
    );


  try {

    await element
      .scrollIntoViewIfNeeded({
        timeout:
          10000,
      });

  } catch {
    // May be a visually hidden native radio input.
  }


  try {
    const isOptionTag = await element.evaluate((el) => el.tagName.toLowerCase() === "option").catch(() => false);
    if (isOptionTag) {
      const optionInfo = await element.evaluate((el) => ({
        val: el.value || el.textContent.trim(),
        text: el.textContent.trim(),
      }));
      const parentSelect = await element.evaluateHandle((el) => el.closest("select"));
      if (parentSelect && parentSelect.asElement()) {
        await parentSelect.asElement().selectOption({ label: optionInfo.text }).catch(async () => {
          await parentSelect.asElement().selectOption({ value: optionInfo.val });
        });
        await settleAfterClick(page, urlBeforeClick);
        return { clicked: true, via: "select_option" };
      }
    }
  } catch {}


  try {

    await element.click({

      timeout:
        15000,
    });

  } catch (
    normalClickError
  ) {

    // --------------------------------------------------------
    // Hidden native radio/checkbox fallback.
    // --------------------------------------------------------

    try {

      const elementInfo =
        await element.evaluate(
          (el) => ({

            tag:
              el.tagName
                ?.toLowerCase(),

            type:
              (
                el.getAttribute(
                  "type"
                ) ||
                ""
              ).toLowerCase(),

            id:
              el.id ||
              null,

          })
        );


      if (
        elementInfo.tag ===
          "input" &&
        (
          elementInfo.type ===
            "radio" ||
          elementInfo.type ===
            "checkbox"
        )
      ) {

        const clickedLabel =
          await element.evaluate(
            (el) => {

              let label =
                null;


              if (
                el.labels &&
                el.labels.length >
                  0
              ) {

                label =
                  el.labels[0];
              }


              if (
                !label
              ) {

                label =
                  el.closest(
                    "label"
                  );
              }


              if (
                label
              ) {

                label.click();

                return true;
              }


              return false;
            }
          );


        if (
          clickedLabel
        ) {

          await settleAfterClick(
            page,
            urlBeforeClick
          );


          return {

            clicked:
              true,

            via:
              "associated_label",
          };
        }
      }


      // Last-resort click for custom/hidden controls.
      await element.click({

        timeout:
          10000,

        force:
          true,
      });


    } catch (
      fallbackError
    ) {

      throw new Error(
        `Could not click ${agentId}: ${normalClickError.message}; fallback: ${fallbackError.message}`
      );
    }
  }


  await settleAfterClick(
    page,
    urlBeforeClick
  );


  return {

    clicked:
      true,
  };
}


// ============================================================
// Type text
// ============================================================

async function typeText(
  page,
  {
    agent_id:
      agentId,

    text,

    credential_key:
      credentialKey,
  },
  testCredentials
) {

  let resolvedText =
    text;


  if (
    credentialKey
  ) {

    resolvedText =
      getCredentialValue(
        credentialKey,
        testCredentials
      );


    if (
      !resolvedText
    ) {

      return {

        ok:
          false,

        missingCredential:
          true,

        credentialKey,
      };
    }
  }


  if (
    resolvedText ===
      undefined ||
    resolvedText ===
      null
  ) {

    throw new Error(
      "type_text requires either text or credential_key."
    );
  }


  const element =
    await findAgentElement(
      page,
      agentId
    );


  await element
    .scrollIntoViewIfNeeded({
      timeout:
        10000,
    });


  try {
    const isSelectTag = await element.evaluate((el) => el.tagName.toLowerCase() === "select").catch(() => false);
    if (isSelectTag) {
      await element.selectOption({ label: String(resolvedText) }).catch(async () => {
        await element.selectOption({ value: String(resolvedText) }).catch(async () => {
          await element.selectOption(String(resolvedText));
        });
      });
      await page.waitForTimeout(250);
      return { ok: true, typed: true, value: "[REDACTED]" };
    }
  } catch {}


  // ----------------------------------------------------------
  // International phone inputs
  // ----------------------------------------------------------
  //
  // Widgets built on intl-tel-input keep their own formatted state and
  // rewrite the field as you type. Two traps follow from that:
  //
  // 1. A plain fill() on an already-populated field is swallowed --
  //    the widget keeps the previous number and the new one is lost.
  //
  // 2. Bare national digits are parsed as an international number, so
  //    "9847096967" is read as country code +98 rather than a US
  //    number, and the field reports "Enter a valid phone number".
  //
  // Clearing first and then typing real keystrokes drives the widget
  // the same way a person does, which handles both cases. The value is
  // read back afterwards so a silently dropped entry is retried rather
  // than surfacing later as a mystery validation error.
  //
  // ----------------------------------------------------------

  const isPhoneField =
    await element
      .evaluate(
        (el) => {

          const signature =
            [
              el.getAttribute(
                "type"
              ),
              el.name,
              el.id,
              el.placeholder,
              typeof el.className ===
                "string"
                ? el.className
                : "",
            ]
              .join(
                " "
              )
              .toLowerCase();


          return (
            signature.includes(
              "tel"
            ) ||
            signature.includes(
              "phone"
            ) ||
            signature.includes(
              "mobile"
            )
          );
        }
      )
      .catch(
        () => false
      );


  if (
    isPhoneField
  ) {

    const digitsWanted =
      String(
        resolvedText
      ).replace(
        /\D/g,
        ""
      );


    let digitsPresent =
      "";


    for (
      let attempt = 0;
      attempt < 3;
      attempt++
    ) {

      await element.click({
        timeout:
          10000,
      });


      await element.press(
        "Control+A"
      );


      await element.press(
        "Delete"
      );


      await page.waitForTimeout(
        150
      );


      await element.type(
        String(
          resolvedText
        ),

        {
          delay:
            50,
        }
      );


      await page.waitForTimeout(
        300
      );


      digitsPresent =
        (
          await element
            .inputValue()
            .catch(
              () => ""
            )
        ).replace(
          /\D/g,
          ""
        );


      if (
        digitsPresent ===
        digitsWanted
      ) {

        break;
      }
    }


    // A phone widget that silently drops the entry is the single most
    // confusing failure on this form: the field looks populated (it
    // still holds its dial code) but submission reports "Enter a valid
    // phone number". Surface it here rather than letting it appear
    // later as a mystery validation error.

    const phoneEntryMatched =
      digitsPresent ===
      digitsWanted;


    if (
      !phoneEntryMatched
    ) {

      console.warn(
        `Phone entry mismatch on ${agentId}: wanted ${digitsWanted.length} digits, field holds ${digitsPresent.length}.`
      );
    }


    return {

      ok:
        true,

      typed:
        true,

      value:
        "[REDACTED]",

      via:
        "phone_input",

      phoneEntryMatched,
    };
  }


  try {

    await element.fill(
      String(
        resolvedText
      ),

      {
        timeout:
          15000,
      }
    );

  } catch {

    await element.click({

      timeout:
        10000,
    });


    await element.press(
      "Control+A"
    );


    await element.type(
      String(
        resolvedText
      ),

      {
        delay:
          20,
      }
    );
  }


  // ----------------------------------------------------------
  // Verify the entry actually landed
  // ----------------------------------------------------------
  //
  // fill() writes the value and dispatches one input event. Widgets
  // that keep their own state -- phone fields, masked inputs, some
  // controlled React components -- can swallow that when the field is
  // already non-empty, leaving the old content in place and the new
  // value silently lost.
  //
  // The failure only shows up later as a validation error on a field
  // that looks populated, so check here and re-enter with real
  // keystrokes if the value did not take.
  //
  // ----------------------------------------------------------

  const normalize =
    (value) =>
      String(
        value ||
        ""
      )
        .toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          ""
        );


  const expected =
    normalize(
      resolvedText
    );


  if (
    expected
  ) {

    const actual =
      normalize(
        await element
          .inputValue()
          .catch(
            () => ""
          )
      );


    // An address lookup rewrites the field to a fuller address, so
    // containment either way counts as a match.

    const landed =
      actual.includes(
        expected
      ) ||
      expected.includes(
        actual
      ) &&
        actual.length >
          0;


    if (
      !landed
    ) {

      await element.click({
        timeout:
          10000,
      });


      await element.press(
        "Control+A"
      );


      await element.press(
        "Delete"
      );


      await page.waitForTimeout(
        150
      );


      await element.type(
        String(
          resolvedText
        ),

        {
          delay:
            50,
        }
      );


      await page.waitForTimeout(
        300
      );


      const repaired =
        normalize(
          await element
            .inputValue()
            .catch(
              () => ""
            )
        );


      if (
        !repaired.includes(
          expected
        ) &&
        !expected.includes(
          repaired
        )
      ) {

        console.warn(
          `Field ${agentId} did not accept its value after retry.`
        );
      }
    }
  }


  // Automatic Google Places / Address Autocomplete suggestion picker
  try {
    const isAddressField = await element.evaluate((el) => {
      const attr = (el.name + " " + el.id + " " + el.placeholder + " " + el.className).toLowerCase();
      return attr.includes("address") || attr.includes("location");
    }).catch(() => false);

    if (isAddressField) {
      await page.waitForTimeout(800);
      const suggestion = page.locator(".pac-container .pac-item, [class*='pac-item'], [class*='suggestion-item'], [id*='typeahead'] li").first();
      if ((await suggestion.count()) > 0 && (await suggestion.isVisible())) {
        await suggestion.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(400);
      }
    }
  } catch {}


  return {

    ok:
      true,

    typed:
      true,

    value:
      "[REDACTED]",

    credentialKey:
      credentialKey ||
      undefined,
  };
}


// ============================================================
// Set several custom dropdowns in one step
// ============================================================
//
// A custom dropdown costs three agent steps on its own: open it,
// re-inspect so the portal options exist, then click the option. Over
// three dropdowns that is nine decisions, and in practice the agent
// often sets one and believes it has set them all.
//
// select_options performs the whole open-find-click-verify cycle
// locally for each dropdown, so the agent spends a single decision and
// cannot skip one. The option is matched by its visible text, which is
// stable, rather than by an agent_id that only exists while the panel
// is open.
//
// ============================================================

const DROPDOWN_OPTION_SELECTORS = [
  "li.p-dropdown-item",
  "[role='option']",
  ".p-dropdown-panel li",
  ".dropdown-menu li",
  "[role='listbox'] li",
].join(
  ","
);


async function selectOptions(
  page,
  {
    selections,
  }
) {

  if (
    !Array.isArray(
      selections
    ) ||
    selections.length ===
      0
  ) {

    throw new Error(
      "select_options requires a non-empty selections array."
    );
  }


  const results =
    [];


  for (
    const selection of
    selections
  ) {

    const {
      trigger_agent_id:
        triggerId,

      option_text:
        optionText,
    } = selection;


    try {

      const trigger =
        await findAgentElement(
          page,
          triggerId
        );


      await trigger
        .scrollIntoViewIfNeeded({
          timeout:
            10000,
        })
        .catch(
          () => {}
        );


      await trigger.click({
        timeout:
          15000,
      });


      // Wait for the option panel to render.

      await page
        .locator(
          DROPDOWN_OPTION_SELECTORS
        )
        .first()
        .waitFor({
          state:
            "visible",

          timeout:
            5000,
        })
        .catch(
          () => {}
        );


      const wanted =
        String(
          optionText
        ).trim();


      // Exact text first, so "4" does not match "14" or "24".

      const options =
        page.locator(
          DROPDOWN_OPTION_SELECTORS
        );


      const total =
        await options.count();


      let clicked =
        false;


      for (
        let index = 0;
        index < total;
        index++
      ) {

        const option =
          options.nth(
            index
          );


        const text =
          (
            await option
              .innerText()
              .catch(
                () => ""
              )
          ).trim();


        if (
          text ===
          wanted
        ) {

          await option.click({
            timeout:
              10000,
          });


          clicked =
            true;

          break;
        }
      }


      if (
        !clicked
      ) {

        results.push({

          trigger_agent_id:
            triggerId,

          option_text:
            wanted,

          ok:
            false,

          error:
            `No option with exact text "${wanted}" was visible after opening the dropdown.`,
        });


        continue;
      }


      await page.waitForTimeout(
        400
      );


      results.push({

        trigger_agent_id:
          triggerId,

        option_text:
          wanted,

        ok:
          true,
      });

    } catch (error) {

      results.push({

        trigger_agent_id:
          triggerId,

        option_text:
          optionText,

        ok:
          false,

        error:
          error.message,
      });
    }
  }


  return {

    selected:
      results.filter(
        (result) =>
          result.ok
      ).length,

    total:
      selections.length,

    results,
  };
}


// ============================================================
// Fill several fields in one step
// ============================================================
//
// Filling a long form one type_text at a time makes the agent drift:
// across five separate decisions it can lose track of which fields it
// has already handled and submit an incomplete form.
//
// fill_form takes every field from a SINGLE page snapshot and enters
// them in order, so the whole form is one atomic decision. Each field
// is routed through typeText, so phone widgets, address autocomplete
// and credential resolution behave exactly as they do individually.
//
// A field that fails does not abort the rest; its error is reported so
// the agent can retry just that one.
//
// ============================================================

async function fillForm(
  page,
  {
    fields,
  },
  testCredentials
) {

  if (
    !Array.isArray(
      fields
    ) ||
    fields.length ===
      0
  ) {

    throw new Error(
      "fill_form requires a non-empty fields array."
    );
  }


  const results =
    [];


  for (
    const field of
    fields
  ) {

    try {

      const outcome =
        await typeText(
          page,
          field,
          testCredentials
        );


      results.push({

        agent_id:
          field.agent_id,

        ok:
          outcome.ok !==
          false,

        ...(
          outcome.phoneEntryMatched ===
          false
            ? {
                phoneEntryMatched:
                  false,
              }
            : {}
        ),

        ...(
          outcome.missingCredential
            ? {
                missingCredential:
                  true,
              }
            : {}
        ),
      });

    } catch (error) {

      results.push({

        agent_id:
          field.agent_id,

        ok:
          false,

        error:
          error.message,
      });
    }
  }


  return {

    filled:
      results.filter(
        (result) =>
          result.ok
      ).length,

    total:
      fields.length,

    results,
  };
}


// ============================================================
// Type OTP
// ============================================================
//
// Supports:
//
// 1. Four or more separate one-character inputs.
// 2. One normal OTP field.
// 3. Multi-character OTP components.
//
// The actual credential is resolved locally.
//
// The LLM only chooses target element IDs.
//
// ============================================================

async function typeOtp(
  page,
  {
    agent_ids:
      agentIds,

    credential_key:
      credentialKey,
  },
  testCredentials
) {

  const effectiveCredentialKey =
    credentialKey ||
    "clientOtp";


  const otp =
    getCredentialValue(
      effectiveCredentialKey,
      testCredentials
    );


  if (
    !otp
  ) {

    return {

      ok:
        false,

      missingCredential:
        true,

      credentialKey:
        effectiveCredentialKey,
    };
  }


  if (
    !Array.isArray(
      agentIds
    ) ||
    agentIds.length ===
      0
  ) {

    throw new Error(
      "type_otp requires one or more agent_ids."
    );
  }


  const otpText =
    String(
      otp
    );


  // ----------------------------------------------------------
  // One target:
  //
  // Fill entire OTP into one input.
  // ----------------------------------------------------------

  if (
    agentIds.length ===
      1
  ) {

    const element =
      await findAgentElement(
        page,
        agentIds[0]
      );


    await element
      .scrollIntoViewIfNeeded({
        timeout:
          10000,
      });


    try {

      await element.fill(
        otpText
      );

    } catch {

      await element.click();

      await element.type(
        otpText,

        {
          delay:
            40,
        }
      );
    }


    return {

      ok:
        true,

      typed:
        true,

      fieldCount:
        1,

      value:
        "[REDACTED]",

      credentialKey:
        effectiveCredentialKey,
    };
  }


  // ----------------------------------------------------------
  // Multiple targets:
  //
  // Normally one OTP digit per field.
  // ----------------------------------------------------------

  if (
    otpText.length >
    agentIds.length
  ) {

    throw new Error(
      `Configured OTP has ${otpText.length} characters but only ${agentIds.length} OTP fields were provided.`
    );
  }


  if (
    otpText.length <
    agentIds.length
  ) {

    throw new Error(
      `Configured OTP has ${otpText.length} characters but ${agentIds.length} OTP fields were provided.`
    );
  }


  for (
    let index = 0;
    index <
      agentIds.length;
    index++
  ) {

    const agentId =
      agentIds[index];


    const digit =
      otpText[index];


    const element =
      await findAgentElement(
        page,
        agentId
      );


    try {

      await element
        .scrollIntoViewIfNeeded({
          timeout:
            10000,
        });

    } catch {
      // Continue.
    }


    try {

      await element.fill(
        digit
      );

    } catch {

      await element.click({

        timeout:
          10000,
      });


      // Some OTP libraries auto-focus the next field.
      // Still target each field directly for determinism.
      try {

        await element.press(
          "Control+A"
        );

      } catch {
        // Ignore.
      }


      await element.type(
        digit,

        {
          delay:
            50,
        }
      );
    }


    await page.waitForTimeout(
      80
    );
  }


  return {

    ok:
      true,

    typed:
      true,

    fieldCount:
      agentIds.length,

    value:
      "[REDACTED]",

    credentialKey:
      effectiveCredentialKey,
  };
}


// ============================================================
// Navigate
// ============================================================

async function navigatePage(
  page,
  url
) {

  await page.goto(
    url,

    {
      waitUntil:
        "commit",

      timeout:
        NAVIGATION_TIMEOUT,
    }
  );


  await waitForApplicationRender(
    page
  );


  await handleCookieConsent(
    page
  );


  return {

    navigated:
      true,

    url:
      page.url(),
  };
}


// ============================================================
// Tool definitions
// ============================================================

const tools = [
  {
    type:
      "function",

    function: {

      name:
        "get_page_state",

      description:
        "Inspect the current browser page. Returns visible text and fresh agent_id references for interactive controls. Call this before interaction and again after meaningful UI changes.",

      parameters: {

        type:
          "object",

        properties:
          {},

        required:
          [],

        additionalProperties:
          false,
      },
    },
  },


  {
    type:
      "function",

    function: {

      name:
        "click",

      description:
        "Click a visible or associated interactive control using an agent_id from the latest get_page_state result.",

      parameters: {

        type:
          "object",

        properties: {

          agent_id: {

            type:
              "string",
          },
        },

        required: [
          "agent_id",
        ],

        additionalProperties:
          false,
      },
    },
  },


  {
    type:
      "function",

    function: {

      name:
        "type_text",

      description:
        "Enter text into a text input. For configured authentication data, use credential_key rather than literal text.",

      parameters: {

        type:
          "object",

        properties: {

          agent_id: {

            type:
              "string",
          },

          text: {

            type:
              "string",
          },

          credential_key: {

            type:
              "string",

            enum: [
              "clientEmail",
              "clientOtp",
            ],
          },
        },

        required: [
          "agent_id",
        ],

        additionalProperties:
          false,
      },
    },
  },


  {
    type:
      "function",

    function: {

      name:
        "select_options",

      description:
        "Set one or more custom dropdowns (month, date, year, country, state) in a single step. For each dropdown give the agent_id of its trigger and the exact visible text of the option you want. The dropdown is opened, the option is located by its text and clicked for you, so you do NOT need to call get_page_state in between. Strongly preferred over clicking dropdown triggers and options yourself.",

      parameters: {

        type:
          "object",

        properties: {

          selections: {

            type:
              "array",

            description:
              "Dropdowns to set, in order.",

            items: {

              type:
                "object",

              properties: {

                trigger_agent_id: {

                  type:
                    "string",

                  description:
                    "agent_id of the dropdown itself or its trigger, from the current snapshot.",
                },

                option_text: {

                  type:
                    "string",

                  description:
                    "Exact visible text of the option, for example \"June\", \"4\" or \"1999\".",
                },
              },

              required: [
                "trigger_agent_id",
                "option_text",
              ],

              additionalProperties:
                false,
            },
          },
        },

        required: [
          "selections",
        ],

        additionalProperties:
          false,
      },
    },
  },


  {
    type:
      "function",

    function: {

      name:
        "fill_form",

      description:
        "Enter several text fields in one step, using agent_ids from the SAME page snapshot. Strongly preferred over repeated type_text calls when filling a form: it fills every field in one action so none can be missed. Handles phone widgets, address autocomplete and credential_key exactly like type_text.",

      parameters: {

        type:
          "object",

        properties: {

          fields: {

            type:
              "array",

            description:
              "Fields to fill, entered in the given order.",

            items: {

              type:
                "object",

              properties: {

                agent_id: {

                  type:
                    "string",
                },

                text: {

                  type:
                    "string",
                },

                credential_key: {

                  type:
                    "string",

                  enum: [
                    "clientEmail",
                    "clientOtp",
                  ],
                },
              },

              required: [
                "agent_id",
              ],

              additionalProperties:
                false,
            },
          },
        },

        required: [
          "fields",
        ],

        additionalProperties:
          false,
      },
    },
  },


  {
    type:
      "function",

    function: {

      name:
        "type_otp",

      description:
        "Securely enter a configured OTP into one or multiple OTP input fields. For four separate OTP boxes, provide their agent_ids in left-to-right order. The actual OTP value is resolved locally and is never returned.",

      parameters: {

        type:
          "object",

        properties: {

          agent_ids: {

            type:
              "array",

            items: {

              type:
                "string",
            },

            minItems:
              1,

            maxItems:
              12,
          },

          credential_key: {

            type:
              "string",

            enum: [
              "clientOtp",
            ],
          },
        },

        required: [
          "agent_ids",
          "credential_key",
        ],

        additionalProperties:
          false,
      },
    },
  },


  {
    type:
      "function",

    function: {

      name:
        "navigate",

      description:
        "Navigate the SAME browser page to a URL. Use only when the current scenario itself requires navigation or recovery and the required interaction path allows it. Do not use this to bypass required clicks.",

      parameters: {

        type:
          "object",

        properties: {

          url: {

            type:
              "string",
          },
        },

        required: [
          "url",
        ],

        additionalProperties:
          false,
      },
    },
  },


  {
    type:
      "function",

    function: {

      name:
        "wait",

      description:
        "Wait briefly for asynchronous UI behavior.",

      parameters: {

        type:
          "object",

        properties: {

          milliseconds: {

            type:
              "integer",

            minimum:
              100,

            maximum:
              10000,
          },
        },

        required: [
          "milliseconds",
        ],

        additionalProperties:
          false,
      },
    },
  },


  {
    type:
      "function",

    function: {

      name:
        "finish_test",

      description:
        "Finish the current scenario with pass, fail, or blocked. Only pass when the exact required behavior/path has been observed.",

      parameters: {

        type:
          "object",

        properties: {

          status: {

            type:
              "string",

            enum: [
              "pass",
              "fail",
              "blocked",
            ],
          },

          summary: {

            type:
              "string",
          },

          expected: {

            type:
              "string",
          },

          actual: {

            type:
              "string",
          },

          severity: {

            type:
              "string",

            enum: [
              "low",
              "medium",
              "high",
              "critical",
              "n/a",
            ],
          },
        },

        required: [
          "status",
          "summary",
          "expected",
          "actual",
          "severity",
        ],

        additionalProperties:
          false,
      },
    },
  },
];


// ============================================================
// Execute a model-requested tool
// ============================================================

async function executeTool(
  {
    name,
    input,
  },
  {
    page,
    testCredentials,
    navigationState,
  }
) {

  if (
    name ===
    "get_page_state"
  ) {

    return await getPageState(
      page,
      testCredentials
    );
  }


  if (
    name ===
    "click"
  ) {

    return await clickElement(
      page,
      input.agent_id
    );
  }


  if (
    name ===
    "type_text"
  ) {

    return await typeText(
      page,
      input,
      testCredentials
    );
  }


  if (
    name ===
    "select_options"
  ) {

    return await selectOptions(
      page,
      input
    );
  }


  if (
    name ===
    "fill_form"
  ) {

    return await fillForm(
      page,
      input,
      testCredentials
    );
  }


  if (
    name ===
    "type_otp"
  ) {

    return await typeOtp(
      page,
      input,
      testCredentials
    );
  }


  if (
    name ===
    "navigate"
  ) {

    if (
      navigationState.count >=
      1
    ) {

      return {

        ok:
          false,

        navigationLimitReached:
          true,

        message:
          "Only one agent-requested navigate call is allowed per scenario.",
      };
    }


    navigationState.count++;


    return await navigatePage(
      page,
      input.url
    );
  }


  if (
    name ===
    "wait"
  ) {

    await page.waitForTimeout(
      input.milliseconds
    );


    return {

      waited:
        true,

      milliseconds:
        input.milliseconds,
    };
  }


  if (
    name ===
    "finish_test"
  ) {

    return {

      finished:
        true,

      verdict:
        input,
    };
  }


  throw new Error(
    `Unknown tool: ${name}`
  );
}


// ============================================================
// Main scenario runner
// ============================================================

export async function runScenario(
  page,
  scenario,
  baseUrl,
  screenshotDir,
  options = {}
) {

  console.log(
    `AGENT VERSION: ${AGENT_VERSION}`
  );


  const sessionMode =
    options.sessionMode ||
    "shared";


  const testCredentials =
    options.testCredentials ||
    {};


  const scenarioId =
    scenario.scenarioId ||
    scenario.id ||
    "scenario";


  const startMode =
    scenario.startMode ===
      "base_url"
      ? "base_url"
      : "continue";


  const dependsOn =
    Array.isArray(
      scenario.dependsOn
    )
      ? scenario.dependsOn
      : [];


  const startState =
    scenario.startState ||
    "";


  const endState =
    scenario.endState ||
    "";


  const stepsTaken =
    [];


  const consoleErrors =
    [];


  let finishedVerdict =
    null;


  let screenshotPath =
    null;


  const navigationState = {

    count:
      0,
  };


  // ==========================================================
  // Capture browser errors for this scenario only
  // ==========================================================

  const onConsole =
    (message) => {

      if (
        message.type() ===
        "error"
      ) {

        consoleErrors.push(
          redactString(
            message.text(),
            testCredentials
          )
        );
      }
    };


  const onPageError =
    (error) => {

      consoleErrors.push(
        redactString(
          error.message,
          testCredentials
        )
      );
    };


  page.on(
    "console",
    onConsole
  );


  page.on(
    "pageerror",
    onPageError
  );


  try {

    // ========================================================
    // Prepare start state
    // ========================================================

    const prepared =
      await prepareScenarioStart(
        page,
        startMode,
        baseUrl
      );


    stepsTaken.push(
      `prepare_start(${JSON.stringify({
        startMode:
          prepared.startMode,

        target:
          prepared.target,
      })})`
    );


    console.log(
      `Scenario start mode: ${prepared.startMode}`
    );


    console.log(
      `Scenario start URL: ${page.url()}`
    );


    // ========================================================
    // System prompt
    // ========================================================

    const systemPrompt = `
You are an autonomous senior browser QA engineer.

You control an already-running Playwright browser page through tools.

You are executing exactly ONE QA scenario.

The same browser context and same browser page are reused across the
overall test run.

Do not assume a fresh browser session.


============================================================
CURRENT SCENARIO
============================================================

Scenario ID:
${scenarioId}

Requirement ID:
${scenario.requirementId || "N/A"}

Scenario name:
${scenario.name}

Scenario type:
${scenario.type || "positive"}

Priority:
${scenario.priority || "medium"}

Sequence:
${scenario.sequence ?? "N/A"}

Start mode:
${startMode}

Dependencies:
${
  dependsOn.length
    ? dependsOn.join(", ")
    : "None"
}

Expected start state:
${startState || "Not specified"}

Expected end state:
${endState || "Not specified"}

Acceptance criteria:
${scenario.criteria}

Preconditions:
${
  Array.isArray(
    scenario.preconditions
  ) &&
  scenario.preconditions.length
    ? scenario.preconditions.join(
        " | "
      )
    : "None"
}


============================================================
TEST DATA FOR THIS SCENARIO
============================================================

${
  scenario.testData &&
  Object.keys(
    scenario.testData
  ).length >
    0
    ? JSON.stringify(
        scenario.testData,
        null,
        2
      )
    : "None. This scenario needs no typed values."
}

These are the EXACT values to enter. They are generated fresh for this
run, so they are the only correct values.

Use them verbatim. Never invent a name, email, phone number, date or
address, and never substitute a value that appears anywhere in these
instructions. If a field needs a value and no value for it is listed
above, look for it in the acceptance criteria rather than making one
up.

Where a value is nested, for example a date of birth object, use each
part for its matching control.

For dates in particular: select exactly the month, day and year given
here. Do not accept a dropdown's first option as a substitute.


============================================================
RUNTIME CREDENTIALS
============================================================

Configured credential KEYS that may be available:

clientEmail
clientOtp

You do NOT know their values.

Never guess or invent them.

These keys identify an EXISTING, ALREADY-REGISTERED account. They are
for SIGNING IN only.

On a sign-in / log-in / OTP screen, for the client email use:

type_text({
  "agent_id": "...",
  "credential_key": "clientEmail"
})

For OTP, prefer:

type_otp({
  "agent_ids": ["...", "...", "...", "..."],
  "credential_key": "clientOtp"
})

The runtime resolves the actual value locally.

NEVER use credential_key on a registration, sign-up, onboarding,
profile or any other data-entry form. Those forms must create NEW
data, and clientEmail already belongs to an existing account, so
reusing it makes submission fail with a duplicate-account error.

On such forms, type the literal value supplied in the scenario
description or test data instead:

type_text({
  "agent_id": "...",
  "text": "<the exact value given in the scenario>"
})

If the scenario says to type a literal value, or says "without using
credential_key", always obey that instruction even when the field is
an email field.

Do not type placeholder credentials such as:

test@example.com
123456
0000
password


============================================================
PAGE INSPECTION
============================================================

Always use get_page_state before relying on the page.

agent_id values are TEMPORARY.

Every get_page_state creates a fresh snapshot and may replace the IDs.

After navigation or meaningful UI changes, call get_page_state again.

If an agent_id becomes stale, inspect the page again.


============================================================
ICON-ONLY CONTROLS
============================================================

Not every control has a label. Avatars, menu toggles and log-out
buttons are often an icon with no text at all.

For those elements the snapshot provides a "hint" field derived from
the element's own markup, for example:

  { "id": "e31", "tag": "div", "hint": "logout profile" }

Treat "hint" as the control's purpose. An element whose hint contains
"logout" or "signout" IS the log out control -- click it even though
no visible text says "Log Out".

Never conclude that a feature is missing just because its wording does
not appear in visibleText. Check the element list and its hints first.


============================================================
CUSTOM DROPDOWNS (month / date / year / country / state)
============================================================

Many dropdowns are NOT native <select> elements. They render their
options only after they are opened, into a floating panel.

Their options therefore DO NOT EXIST in the current snapshot while the
dropdown is closed. Never guess an option's agent_id.

Use select_options. It opens each dropdown, finds the option by its
visible text and clicks it for you, so several dropdowns are set in a
single step:

select_options({
  "selections": [
    { "trigger_agent_id": "<id of first dropdown>",  "option_text": "<option named by the scenario>" },
    { "trigger_agent_id": "<id of second dropdown>", "option_text": "<option named by the scenario>" },
    { "trigger_agent_id": "<id of third dropdown>",  "option_text": "<option named by the scenario>" }
  ]
})

Every "option_text" must be the exact value the scenario asks for. The
angle-bracket placeholders above are shape, not content: never select
an option because it appears in these instructions.

Set ALL of the dropdowns a scenario asks for in ONE call. Setting one
and assuming the rest followed is the most common way these scenarios
fail. The result reports each dropdown separately, so retry only the
ones that report ok:false.

Afterwards call get_page_state and confirm each control displays the
chosen value rather than its placeholder ("June", not "Select month").

If you ever set a dropdown by hand instead, the options exist only
while the panel is open, so you must click the trigger, call
get_page_state, and only then click the option -- and repeat that
whole cycle for every single dropdown.


============================================================
ADDRESS AUTOCOMPLETE
============================================================

An address lookup field returns suggestions from a third-party service
after you type.

1. type_text the address into the field
2. wait about 2000 ms for suggestions to load
3. get_page_state
4. click the first matching suggestion

A typed address that was never confirmed by clicking a suggestion is
usually rejected by the form.


============================================================
FILLING A FORM
============================================================

When a scenario asks you to fill in more than one text field, use
fill_form ONCE with every field, rather than a chain of type_text
calls:

fill_form({
  "fields": [
    { "agent_id": "<id of first field>",  "text": "<its value from the scenario>" },
    { "agent_id": "<id of second field>", "text": "<its value from the scenario>" },
    { "agent_id": "<id of third field>",  "text": "<its value from the scenario>" }
  ]
})

All agent_ids must come from the SAME get_page_state snapshot.

Every "text" value must be copied from the scenario description or its
test data. The angle-bracket placeholders above are shape, not content:
never type them, and never type a value that appears in these
instructions rather than in the scenario.

This matters: filling fields one at a time across several turns is how
fields get silently skipped and forms get submitted incomplete.
fill_form makes it a single action, and its result reports exactly
which fields succeeded.

Match each field to its target by the "name" or "placeholder" in the
snapshot, never by position in the list.


============================================================
FORM SUBMISSION AND VALIDATION
============================================================

Before clicking Submit, call get_page_state and verify every required
field actually holds its value.

Placeholder text looks like a value but is not one. Treat text such as
"Enter full name", "Select month", "REF123", "john.doe@example.com" or
"+1 (123) 456-7890" as an EMPTY field, not as filled-in data.

If the page shows validation errors after submitting, report which
fields are still empty or rejected in the finish_test "actual" field.

Do NOT finish a form scenario as "blocked" merely because you have not
finished filling it in yet. A partly filled form is unfinished work,
not a blocker. Keep going: fill the remaining fields, click Submit, and
only then judge the outcome.

"blocked" is reserved for a genuine dead end -- a control that does not
exist on the page at all, or a required step that is impossible to
perform. Being unsure of your progress is not a dead end: call
get_page_state and read the current field values.


============================================================
AFTER A NAVIGATING CLICK
============================================================

A click that submits a form, verifies an OTP or signs in may route to a
new screen asynchronously.

If a success message is visible but the expected destination has not
appeared yet, do NOT fail the scenario. Call wait for 2000 ms, then
get_page_state again, and judge the destination from that fresh
snapshot.

Server-side work such as creating an account often takes five to eight
seconds, and the confirmation may be a brief toast, a redirect, or
both. So after submitting:

1. wait 5000 ms
2. get_page_state
3. if nothing has changed yet, wait a further 3000 ms and inspect once
   more

Only report failure after that second look. An unchanged page one or
two seconds after a submit is not evidence of failure -- the request is
usually still in flight.


============================================================
COOKIE BANNERS & OVERLAYS
============================================================

If a Cookie Consent banner or modal overlay is present when inspecting page state:
1. Accept or close the banner first if it obscures or overlaps navigation links or interactive controls.
2. Do NOT fail a page loading test simply because a cookie banner overlay is present alongside the page content. If navigation controls exist or become accessible, judge the test pass/fail on the actual controls.



============================================================
INPUT PRIVACY
============================================================

Input values are intentionally hidden from you.

For input fields you may see:

hasValue: true

or:

valueLength

but you should not expect to see the actual entered email or OTP.


============================================================
RADIO / CHECKBOX CONTROLS
============================================================

The page state may expose radio/checkbox information such as:

checked
ariaChecked
ariaSelected
linkedControlType
linkedControlChecked
className

A custom radio may be represented by a visible label even if its
underlying native input is hidden.

For example:

{
  "id": "e4",
  "tag": "label",
  "text": "Email",
  "linkedControlType": "radio",
  "checked": false
}

After clicking it, inspect the page again.

If the refreshed state shows checked=true, ariaChecked="true",
linkedControlChecked=true, or another clear selected-state change,
that is evidence that the option was selected.


============================================================
OTP ENTRY
============================================================

The client OTP verification page may contain four separate OTP boxes.

If four OTP inputs are shown, identify them from left to right and call:

type_otp({
  "agent_ids": ["e1", "e2", "e3", "e4"],
  "credential_key": "clientOtp"
})

Do not attempt to learn or output the actual OTP value.

After OTP entry, click Verify and inspect the resulting page.


============================================================
DO NOT MUTATE UI FOR OBSERVATION-ONLY TESTS
============================================================

This rule is critical.

If the acceptance criteria only require verifying that an element,
field, heading, button, menu item, option, or control EXISTS or is
VISIBLE:

DO NOT click it.
DO NOT type into it.
DO NOT submit it.
DO NOT change its state.

Use get_page_state and finish the test once sufficient evidence exists.

Examples:

"The client login page displays Email, SMS and Log in."

This requires observation only.

Do NOT click Email.
Do NOT click SMS.
Do NOT click Log in.


"The registration page provides a Submit button."

This requires observation only.

Do NOT click Submit unless the criterion explicitly requires submission.


============================================================
INTERACTION TESTS
============================================================

If the criterion explicitly says:

click
select
choose
enter
submit
verify
navigate

then perform the required interaction.

Do only what is necessary for THIS scenario.


============================================================
REQUIRED INTERACTION PATH
============================================================

The required interaction path matters.

Reaching the same final URL through a different shortcut does NOT prove
the requirement.

Example:

Required:

Homepage
→ Sign In
→ I'm a Provider
→ Provider Login

Invalid shortcut:

Client Login
→ Switch to Provider
→ Provider Login

Even though the final page is the same, the shortcut does not satisfy
the stated requirement.

Do not PASS a scenario after following a different interaction path from
the acceptance criteria.


============================================================
DO NOT OVER-PROGRESS
============================================================

Do not execute later requirements unnecessarily.

Example:

If this scenario only checks that the OTP verification page contains
OTP controls, do not enter the OTP and authenticate.

That belongs to a later scenario.

Similarly, if this scenario only checks that the registration page has
a Submit button, do not submit the form.


============================================================
START MODE
============================================================

The runner already prepared the scenario start.

If startMode is "continue":

The current browser page intentionally preserves the previous scenario's
state.

Do not reset the page unless the current acceptance criteria itself
requires navigation.

If startMode is "base_url":

The runner has already navigated the SAME browser page back to the base
URL.

Begin the required branch from there.


============================================================
NAVIGATION
============================================================

Prefer real UI interaction over direct navigation.

Do not use navigate merely to shortcut a required click path.

The navigate tool exists for legitimate scenario navigation or careful
recovery only.

At most one agent-requested navigate call is allowed in this scenario.


============================================================
PASS / FAIL / BLOCKED
============================================================

PASS:

Use only when there is clear observable evidence that the exact current
acceptance criteria were satisfied.

FAIL:

Use when the application was testable but observable behavior clearly
contradicted the requirement.

BLOCKED:

Use when the scenario cannot be meaningfully executed because a required
credential, prerequisite, environment capability, or required page
state is unavailable.


============================================================
MISSING CREDENTIAL
============================================================

If a credential tool reports missingCredential=true:

Finish as BLOCKED.

Do not guess a replacement credential.


============================================================
FINAL VERDICT
============================================================

Always finish using finish_test.

Do not return prose instead of a tool call.

Be concise and evidence-driven.
`;


    // ========================================================
    // Conversation
    // ========================================================

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

        content:
          `Execute the current QA scenario now. Inspect the current page first and verify only this scenario's acceptance criteria.`,
      },
    ];


    // ========================================================
    // Autonomous tool loop
    // ========================================================

    for (
      let stepIndex = 0;
      stepIndex <
        MAX_STEPS;
      stepIndex++
    ) {

      const { assistantMessage } =
        await callLLM({
          messages,
          tools,
          toolChoice: "auto",
          maxTokens: 1800,
        });


      if (
        !assistantMessage
      ) {

        throw new Error(
          "LLM agent returned no assistant message."
        );
      }


      // ======================================================
      // IMPORTANT FIX:
      //
      // Never add tool_calls: [] to message history.
      //
      // Azure/OpenAI rejects an empty tool_calls array.
      // ======================================================

      const assistantHistoryMessage = {

        role:
          "assistant",

        content:
          assistantMessage.content ||
          null,
      };


      if (
        Array.isArray(
          assistantMessage.tool_calls
        ) &&
        assistantMessage.tool_calls.length >
          0
      ) {

        assistantHistoryMessage.tool_calls =
          assistantMessage.tool_calls;
      }


      messages.push(
        assistantHistoryMessage
      );


      const toolCalls =
        Array.isArray(
          assistantMessage.tool_calls
        )
          ? assistantMessage.tool_calls
          : [];


      // ------------------------------------------------------
      // Model returned no tools.
      // ------------------------------------------------------

      if (
        toolCalls.length ===
        0
      ) {

        messages.push({

          role:
            "user",

          content:
            "You must continue using the available tools. Inspect the page if needed and finish the scenario with finish_test.",
        });


        continue;
      }


      for (
        const toolCall of
        toolCalls
      ) {

        const toolName =
          toolCall.function
            ?.name;


        let toolInput =
          {};


        try {

          toolInput =
            JSON.parse(
              toolCall.function
                ?.arguments ||
              "{}"
            );

        } catch (
          parseError
        ) {

          throw new Error(
            `Invalid arguments for tool ${toolName}: ${parseError.message}`
          );
        }


        const sanitizedInput =
          sanitizeToolInput(
            toolName,
            toolInput
          );


        stepsTaken.push(
          `${toolName}(${JSON.stringify(
            sanitizedInput
          )})`
        );


        console.log(
          `Agent tool: ${toolName}(${JSON.stringify(
            sanitizedInput
          )})`
        );


        let toolResult;


        try {

          toolResult =
            await executeTool(

              {
                name:
                  toolName,

                input:
                  toolInput,
              },

              {
                page,

                testCredentials,

                navigationState,
              }
            );

        } catch (
          toolError
        ) {

          toolResult = {

            ok:
              false,

            error:
              redactString(
                toolError.message,
                testCredentials
              ),

            code:
              toolError.code ||
              undefined,
          };
        }


        const safeToolResult =
          redactSecrets(
            toolResult,
            testCredentials
          );


        // ====================================================
        // Missing runtime credential
        // ====================================================

        if (
          safeToolResult
            ?.missingCredential
        ) {

          const credentialKey =
            safeToolResult
              .credentialKey ||
            "unknown";


          finishedVerdict = {

            status:
              "blocked",

            summary:
              `Required configured test credential ${credentialKey} is unavailable.`,

            expected:
              scenario.criteria,

            actual:
              `The scenario requires configured credential ${credentialKey}, but it was not available in the runtime environment.`,

            severity:
              "high",
          };


          break;
        }


        // ====================================================
        // finish_test
        // ====================================================

        if (
          toolName ===
            "finish_test" &&
          safeToolResult
            ?.finished
        ) {

          finishedVerdict =
            redactSecrets(
              safeToolResult.verdict,
              testCredentials
            );


          break;
        }


        // ====================================================
        // Add tool response to history
        // ====================================================

        messages.push({

          role:
            "tool",

          tool_call_id:
            toolCall.id,

          content:
            JSON.stringify(
              safeToolResult
            ),
        });
      }


      if (
        finishedVerdict
      ) {

        break;
      }
    }


    // ========================================================
    // Max-step fallback
    // ========================================================

    if (
      !finishedVerdict
    ) {

      finishedVerdict = {

        status:
          "blocked",

        summary:
          `Scenario did not reach a reliable verdict within ${MAX_STEPS} autonomous steps.`,

        expected:
          scenario.criteria,

        actual:
          "The browser agent exhausted its scenario step limit before obtaining sufficient evidence.",

        severity:
          "high",
      };
    }


    // ========================================================
    // Screenshot on non-pass
    // ========================================================

    if (
      finishedVerdict.status !==
      "pass"
    ) {

      try {

        fs.mkdirSync(
          screenshotDir,

          {
            recursive:
              true,
          }
        );


        screenshotPath =
          path.join(
            screenshotDir,
            `${safeFileName(
              scenarioId
            )}.png`
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
          `Could not capture scenario screenshot: ${redactString(
            screenshotError.message,
            testCredentials
          )}`
        );


        screenshotPath =
          null;
      }
    }


    // ========================================================
    // Return result
    // ========================================================

    return {

      name:
        scenario.name,

      criteria:
        scenario.criteria,

      scenarioId,

      requirementId:
        scenario.requirementId,

      type:
        scenario.type,

      priority:
        scenario.priority,

      sequence:
        scenario.sequence,

      startMode,

      dependsOn,

      startState,

      endState,

      sessionMode,


      verdict:
        redactSecrets(
          finishedVerdict,
          testCredentials
        ),


      stepsTaken:
        redactSecrets(
          stepsTaken,
          testCredentials
        ),


      consoleErrors:
        redactSecrets(
          consoleErrors,
          testCredentials
        ),


      screenshotPath,


      finalUrl:
        page.url(),
    };


  } finally {

    // ========================================================
    // Remove per-scenario listeners
    // ========================================================

    page.off(
      "console",
      onConsole
    );


    page.off(
      "pageerror",
      onPageError
    );
  }
}