// Deterministic walker for the provider onboarding wizard.
//
// Diagnostic only: it drives every step with plain Playwright so the real
// markup of each step can be dumped, and it stops at the payment form
// WITHOUT submitting a payment.
import { chromium } from "playwright";
import { generateTestData } from "./testdata.js";
import { getPageState, clickElement } from "./agent.js";

const BASE = "https://prod-turningwell.dreamstechnologies.com/";
const data = generateTestData({ randomDob: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

const log = (...a) => console.log(...a);
const brief = (e) => String(e).split("\n")[0].slice(0, 160);
const digits = (s) => (s || "").replace(/[^0-9]/g, "");

async function dismissOverlays() {
  for (const name of [/^Accept$/i, /Accept All/i, /^Got it$/i]) {
    try {
      await page.getByRole("button", { name }).first().click({ timeout: 2500 });
      log("  dismissed overlay:", String(name));
    } catch {}
  }
}

async function dump(label) {
  await page.waitForTimeout(1200);
  log("\n==== " + label + " :: " + page.url() + " ====");
  const info = await page.evaluate(() => {
    const rows = [];
    const sel =
      "select, input, textarea, button, [role=combobox], [role=radio], [role=checkbox], .p-dropdown-label, [class*=card], [class*=plan], label";
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest(".p-hidden-accessible")) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      rows.push({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type") || undefined,
        name: el.getAttribute("name") || undefined,
        id: el.id || undefined,
        cls: String(el.className || "").slice(0, 70) || undefined,
        ph: el.getAttribute("placeholder") || undefined,
        text: (el.innerText || el.value || "").trim().slice(0, 60) || undefined,
      });
    }
    return {
      rows,
      frames: Array.from(document.querySelectorAll("iframe")).map((f) => ({
        name: f.name ? f.name.slice(0, 40) : undefined,
        src: (f.src || "(no src)").slice(0, 70),
        title: f.title || undefined,
      })),
    };
  });
  log(JSON.stringify(info, null, 1));
}

async function clickByText(pattern, what) {
  const target = page
    .locator("button:visible, a:visible, [role=button]:visible, label:visible, div[class*=card]:visible")
    .filter({ hasText: pattern })
    .first();
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await target.click({ timeout: 15000 });
  log("  clicked", what);
  await page.waitForTimeout(2500);
}

async function proceed(what = "Proceed") {
  const before = page.url();
  const btn = page.getByRole("button", { name: /proceed|continue|next|get started|submit/i }).first();
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await btn.click({ timeout: 15000 });
  await page.waitForTimeout(4000);

  const errors = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[class*=error i], [class*=invalid i], .text-danger, [role=alert]"))
      .map((e) => (e.innerText || "").trim())
      .filter((t) => t && t.length < 200)
      .slice(0, 10)
  );

  log("  clicked", what, "->", page.url() === before ? "STAYED" : "advanced");
  if (errors.length) log("  validation:", JSON.stringify(errors));
}

// PrimeReact dropdown: the only reliable trigger is the visible label /
// trigger chevron; the sibling <select> in .p-hidden-accessible is covered.
async function pickPrime(index, optionText, what) {
  const trigger = page.locator(".p-dropdown-label:visible").nth(index);
  await trigger.scrollIntoViewIfNeeded().catch(() => {});
  await trigger.click({ timeout: 10000 });
  await page.waitForTimeout(1200);

  const options = page.locator("li.p-dropdown-item, [role=option]");
  const total = await options.count();

  for (let i = 0; i < total; i += 1) {
    const text = (await options.nth(i).innerText().catch(() => "")).trim();
    if (text === String(optionText)) {
      await options.nth(i).click({ timeout: 8000 });
      await page.waitForTimeout(1500);
      log("  set", what, "=", optionText);
      return true;
    }
  }

  const sample = [];
  for (let i = 0; i < Math.min(total, 12); i += 1) {
    sample.push((await options.nth(i).innerText().catch(() => "")).trim());
  }
  log("  NOT SET", what, "wanted", optionText, "| options:", JSON.stringify(sample));
  await page.keyboard.press("Escape").catch(() => {});
  return false;
}

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  await dismissOverlays();

  await page.locator("button.register-btn").first().click({ timeout: 15000 });
  await page.waitForTimeout(1200);
  await page
    .locator("a:visible, button:visible")
    .filter({ hasText: /List as a Provider/i })
    .first()
    .click({ timeout: 15000 });
  await page.waitForTimeout(3000);

  // ---------- Step 1: personal details ----------
  await dump("step1-personal");
  await page.locator("input[name=fullName]").fill(data.fullName);
  await page.locator("input[name=email]").fill(data.email);

  const phone = page.locator("input[name=phoneNumber], input[type=tel]").first();
  await phone.click();
  await phone.fill(data.phoneE164);

  const dobValues = [data.dobMonth, data.dobDate, data.dobYear];
  for (let i = 0; i < 3; i += 1) {
    await pickPrime(i, dobValues[i], "DOB " + i).catch((e) => log("  DOB", i, brief(e)));
  }

  const referral = page.locator("input[name=referral_code], input[name=referralCode]").first();
  if (await referral.count()) await referral.fill(data.referralCode);
  if (digits(await phone.inputValue()).length < 5) await phone.fill(data.phoneE164);

  await proceed("step1 Proceed");

  // ---------- Step 2: address ----------
  await dump("step2-address");
  const addr = page.locator("input[placeholder*='Address Lookup' i]").first();
  await addr.click();
  await addr.type(data.addressLookup, { delay: 60 });
  await page.waitForTimeout(2800);
  await page
    .locator(".pac-item")
    .first()
    .click({ timeout: 8000 })
    .catch(() => log("  no .pac-item suggestion"));
  await page.waitForTimeout(1500);
  await proceed("step2 Proceed");

  // ---------- Step 3: category ----------
  await dump("step3-category");
  await pickPrime(0, data.providerCategory, "Category");
  await dump("step3-after-category (do classification/sub-category appear?)");

  const labelsNow = await page.evaluate(() =>
    Array.from(document.querySelectorAll("label")).map((l) => l.innerText.trim()).filter(Boolean)
  );
  log("  labels now:", JSON.stringify(labelsNow));

  const primeCount = await page.locator(".p-dropdown-label:visible").count();
  log("  visible prime dropdowns:", primeCount);

  if (primeCount > 1) await pickPrime(1, data.providerClassification, "Classification");
  if ((await page.locator(".p-dropdown-label:visible").count()) > 2) {
    await pickPrime(2, data.providerSubCategory, "Sub-Category");
  }

  // NPI lives on the SAME page, revealed once the category chain is set.
  await dump("step3-filled");
  const npi = page.locator("input[name=npi_number]");
  await npi.fill(data.npiNumber).catch((e) => log("  npi fill failed:", brief(e)));
  log("  set NPI =", data.npiNumber);
  await proceed("step3+npi Proceed");

  // ---------- Step 4: licence status ----------
  await dump("step4-licensed");
  await clickByText(/I am Licensed/i, "I am Licensed").catch((e) => log("  licensed click:", brief(e)));
  await proceed("step4 Proceed");

  // ---------- Step 5: licence details ----------
  await dump("step5-licence-details");

  await page.locator("input[name=licenseNumber]").fill(data.licenseNumber);
  log("  set License Number =", data.licenseNumber);

  // Provider Role is dropdown 0 and comes pre-filled; State is dropdown 1.
  await pickPrime(1, data.licenseState, "State");

  await page.locator("input[name=licenseExpYear]").fill(data.licenseExpiry);
  log("  set License Expiration =", data.licenseExpiry);

  // ---- what does the agent actually SEE on this page? ----
  const snapshot = await getPageState(page, {});
  log("\n  AGENT SNAPSHOT of /provider/credentials:");
  for (const el of snapshot.elements) {
    log("   ", JSON.stringify({
      id: el.id,
      tag: el.tag,
      type: el.type,
      name: el.name,
      text: (el.text || "").slice(0, 45),
      hint: (el.hint || "").slice(0, 40),
      hidden: el.hiddenNativeControl,
    }));
  }

  // ---- the exact failure the agent hit: click the LABEL, not the input ----
  //
  // Every failed run clicked the caption label. Reproduce that through
  // the real clickElement and assert the checkbox ends up ticked.
  const termsLabel = snapshot.elements.find(
    (el) => el.tag === "label" && /accept terms/i.test(el.text || "")
  );

  const box = page.locator("input[name=acceptTerms]");

  if (termsLabel) {
    log("\n  clicking the CAPTION LABEL", termsLabel.id, "as the failing runs did");
    log("  checkbox before:", await box.isChecked().catch(() => "unreadable"));
    await clickElement(page, termsLabel.id).catch((e) => log("   clickElement threw:", brief(e)));
    const after = await box.isChecked().catch(() => "unreadable");
    log("  checkbox after label click:", after);
    log(after === true ? "  LABEL REDIRECT WORKS" : "  LABEL REDIRECT FAILED");
  } else {
    log("  no caption label found in snapshot");
  }

  const state = async () => await box.isChecked().catch(() => "unreadable");

  const markup = await box.evaluate((el) => {
    const row = el.closest("div") ? el.closest("div").parentElement || el.closest("div") : el.parentElement;
    return (row.outerHTML || "").slice(0, 1200);
  });
  log("  terms markup:", markup);

  const geometry = await box.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      box: { w: Math.round(r.width), h: Math.round(r.height) },
      opacity: getComputedStyle(el).opacity,
      pointerEvents: getComputedStyle(el).pointerEvents,
      topElement: top ? top.tagName.toLowerCase() + "." + String(top.className || "").slice(0, 50) : null,
      isSelf: top === el,
      hasLabel: Boolean((el.labels && el.labels[0]) || el.closest("label")),
    };
  });
  log("  checkbox geometry:", JSON.stringify(geometry));

  log("  before:", await state());

  await box.click({ timeout: 8000 }).catch((e) => log("   plain click threw:", brief(e)));
  log("  after plain click:", await state());

  if ((await state()) !== true) {
    await box.evaluate((el) => {
      const label = (el.labels && el.labels[0]) || el.closest("label");
      if (label) label.click();
    });
    log("  after label click:", await state());
  }

  if ((await state()) !== true) {
    await box.click({ force: true, timeout: 8000 }).catch(() => {});
    log("  after forced click:", await state());
  }

  if ((await state()) !== true) {
    await box.evaluate((el) => {
      el.checked = true;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    log("  after DOM set + change:", await state());
  }

  if ((await state()) !== true) {
    await box.evaluate((el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    log("  after dispatched click:", await state());
  }
  log("  accepted terms ->", await state());

  await proceed("step5 Proceed");

  // ---------- Step 6: plan ----------
  await dump("step6-plan");
  await clickByText(/Standard/i, "Standard Account").catch((e) => log("  standard click:", brief(e)));
  await proceed("Get Started");

  // ---------- Step 7: payment (INSPECT ONLY -- never submitted) ----------
  await dump("step7-payment");

  const frameInfo = [];
  for (const f of page.frames()) {
    if (f === page.mainFrame()) continue;
    const fields = await f
      .evaluate(() =>
        Array.from(document.querySelectorAll("input")).map((i) => {
          const r = i.getBoundingClientRect();
          const st = getComputedStyle(i);
          return {
            name: i.getAttribute("name"),
            type: i.getAttribute("type"),
            ph: i.getAttribute("placeholder"),
            label: i.getAttribute("aria-label"),
            ariaHidden: i.getAttribute("aria-hidden"),
            tabindex: i.getAttribute("tabindex"),
            disabled: i.disabled || undefined,
            readOnly: i.readOnly || undefined,
            box: Math.round(r.width) + "x" + Math.round(r.height),
            opacity: st.opacity,
            visibility: st.visibility,
          };
        })
      )
      .catch(() => null);
    if (fields && fields.length) frameInfo.push({ url: f.url().slice(0, 80), fields });
  }
  log("\nPAYMENT IFRAME FIELDS:", JSON.stringify(frameInfo, null, 1));

  const cardSnapshot = await getPageState(page, {});
  log("\n  AGENT SNAPSHOT of /provider/card:");
  for (const el of cardSnapshot.elements) {
    log("   ", JSON.stringify({
      id: el.id,
      tag: el.tag,
      type: el.type,
      name: el.name,
      placeholder: el.placeholder,
      text: (el.text || "").slice(0, 45),
      inFrame: el.inFrame,
    }));
  }

  // ---------- stop before payment; report what we reached ----------
  log("\nFINAL URL:", page.url());
  await page.screenshot({ path: "probe-final.png", fullPage: true });
} catch (err) {
  log("\nWALKER ERROR:", brief(err));
  log("URL at failure:", page.url());
  await page.screenshot({ path: "probe-error.png", fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}
