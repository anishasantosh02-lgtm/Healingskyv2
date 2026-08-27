import { chromium } from "playwright";

const url = "https://clinic1.doccure.io/patient/login";

const browser = await chromium.launch({
  channel: "chrome",
  headless: false
});

const page = await browser.newPage();

page.on("console", (msg) => {
  console.log(
    `[CONSOLE ${msg.type()}]`,
    msg.text()
  );
});

page.on("pageerror", (err) => {
  console.log(
    `[PAGE ERROR]`,
    err.message
  );
});

page.on("requestfailed", (request) => {
  console.log(
    `[REQUEST FAILED]`,
    request.url(),
    request.failure()?.errorText
  );
});

page.on("response", (response) => {
  if (response.status() >= 400) {
    console.log(
      `[HTTP ${response.status()}]`,
      response.url()
    );
  }
});

console.log("Opening:", url);

const response = await page.goto(url, {
  waitUntil: "domcontentloaded",
  timeout: 30000
});

console.log(
  "Initial response:",
  response?.status(),
  response?.url()
);

await page.waitForTimeout(5000);

console.log("\n===== PAGE INFO =====");

console.log(
  "URL:",
  page.url()
);

console.log(
  "TITLE:",
  await page.title()
);

console.log(
  "BODY TEXT:",
  JSON.stringify(
    await page.locator("body").innerText().catch(() => "")
  )
);

console.log(
  "BODY HTML LENGTH:",
  await page.locator("body").innerHTML().then(x => x.length)
);

console.log(
  "PAGE HTML LENGTH:",
  (await page.content()).length
);

console.log(
  "ROOT:",
  await page.locator("#root").count()
);

if (await page.locator("#root").count()) {
  console.log(
    "ROOT HTML:",
    await page.locator("#root").innerHTML()
  );
}

await page.screenshot({
  path: "debug-page.png",
  fullPage: true
});

console.log("\nScreenshot saved as debug-page.png");

await browser.close();