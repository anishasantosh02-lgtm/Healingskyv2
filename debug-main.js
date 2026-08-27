import { chromium } from "playwright";

const browser = await chromium.launch({
  channel: "chrome",
  headless: false
});

const page = await browser.newPage();

page.on("console", (msg) => {
  console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`);
});

page.on("pageerror", (err) => {
  console.log(`[PAGE ERROR] ${err.message}`);
});

page.on("requestfailed", (request) => {
  console.log(
    `[REQUEST FAILED] ${request.method()} ${request.url()}`
  );
  console.log(
    "  Failure:",
    request.failure()
  );
});

page.on("response", async (response) => {
  if (
    response.url().includes("main.tsx") ||
    response.url().includes("@vite/client")
  ) {
    console.log(
      `[RESPONSE] ${response.status()} ${response.url()}`
    );

    console.log(
      "Headers:",
      await response.allHeaders()
    );
  }
});

console.log("Opening application...");

await page.goto(
  "https://clinic1.doccure.io/patient/login",
  {
    waitUntil: "commit",
    timeout: 300000
  }
);

await page.waitForTimeout(50000);

console.log("\n========== MAIN.TSX TEST ==========");

const response = await page.request.get(
  "https://clinic1.doccure.io/src/main.tsx"
);

console.log(
  "Status:",
  response.status()
);

console.log(
  "URL:",
  response.url()
);

console.log(
  "Headers:",
  await response.allHeaders()
);

const body = await response.text();

console.log(
  "Body length:",
  body.length
);

console.log(
  "Body first 1000 chars:"
);

console.log(
  body.slice(0, 1000)
);

console.log("\n========== PAGE ==========");

console.log(
  "URL:",
  page.url()
);

console.log(
  "Title:",
  await page.title()
);

console.log(
  "Root children:",
  await page.locator("#root").locator("> *").count()
);

await browser.close();