import dotenv from "dotenv";
import { chromium } from "playwright";
import { sendEmail } from "./sendEmail.js";

dotenv.config();

const screenshotPath = `images/daily-activity.png`;

const today = new Date();
const queryParamConformDate = today
  .toISOString()
  .slice(0, 10)
  .replace(/-/g, ""); // e.g. "20250715"

const inputUrl = new URL(process.env.STATS_HUNTERS_SHARE_URL + "/activities");
inputUrl.searchParams.set("to", queryParamConformDate);
inputUrl.searchParams.set("from", queryParamConformDate);
const url = inputUrl.toString();

const run = async () => {
  const browser = await chromium.launch({
    tracesDir: "traces",
  });
  const context = await browser.newContext({
    locale: "en-US",
  });
  const page = await context.newPage();

  // set to a fixed view port to have uniform images
  await page.setViewportSize({ width: 1280, height: 800 });
  // disable animations for consistent screenshots
  await page.addStyleTag({
    content: `* { transition: none !important; animation: none !important; }`,
  });

  await page.goto(url, { waitUntil: "networkidle" });

  // Wait for the initial data sync dialog and extract the participant name
  const participantName = await page
    .getByRole("dialog")
    .locator("text=StatsHunters page of")
    .evaluate((el) => el.querySelector("strong")?.textContent?.trim());

  // Wait for the "Close" button to appear, indicating data has finished syncing
  await page
    .getByRole("dialog")
    .locator("button")
    .filter({ hasText: "Close" })
    .click({ timeout: 60_000 });

  // Dismiss help popups to clean up the UI
  await page.locator(".settings-help").click();
  await page.locator(".menu-help").click();

  // Add the participant name to the totals element for clarity in the screenshot
  await page.evaluate((name) => {
    const totalEl = document.getElementById("total");
    if (totalEl)
      totalEl.textContent += ` – ${name}, ${new Intl.DateTimeFormat("en", {
        dateStyle: "short",
      }).format(new Date())}`;
  }, participantName);

  // Open column visibility settings
  await page.getByRole("button", { name: "Show activities settings" }).click();

  // Move specific columns to "Visible"
  const columnsToShow = ["Type"];
  for (const column of columnsToShow) {
    await page
      .getByRole("dialog")
      .getByText(column, { exact: true })
      .dragTo(
        page
          .getByRole("dialog")
          .locator(".columns", { hasText: "Visible columns" })
      );
  }

  // Move specific columns to "Hidden"
  const columnsToHide = ["New grid_on", "Tiles", "Gear"];
  for (const column of columnsToHide) {
    await page
      .getByRole("dialog")
      .getByText(column, { exact: true })
      .dragTo(
        page
          .getByRole("dialog")
          .locator(".columns", { hasText: "Hidden columns" })
      );
  }

  // Close the settings dialog
  await page.getByRole("button", { name: "Close" }).click();

  // Dismiss any lingering tooltip (from the open settings button) by clicking outside
  await page.locator("body").click();

  // wait until at least one table row is rendered and fail if it is not to avoid sending empty mails
  await page.waitForSelector("table tr.activity-row", {
    state: "visible",
    timeout: 30000,
  });

  // Scroll to the bottom and take a full-page screenshot
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  await browser.close();

  await sendEmail({
    attachmentPath: screenshotPath,
    statsHuntersUrl: url,
    senderMail: process.env.SENDER_MAIL ?? process.env.SMTP_USER,
    author: participantName,
    receiverMail: process.env.RECEIVER_MAIL,
    smtp: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

run();
