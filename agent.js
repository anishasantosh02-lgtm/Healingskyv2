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


const MAX_STEPS =
  12;


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

async function clickElement(
  page,
  agentId
) {

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
        await page.waitForTimeout(250);
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

          await page.waitForTimeout(
            250
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


  await page.waitForTimeout(
    250
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
RUNTIME CREDENTIALS
============================================================

Configured credential KEYS that may be available:

clientEmail
clientOtp

You do NOT know their values.

Never guess or invent them.

For client email, use:

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