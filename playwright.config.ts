import { defineConfig } from "@playwright/test";
const testPort=process.env.BETTERLUMI_TEST_PORT??"5190";
const testURL=`http://127.0.0.1:${testPort}`;
export default defineConfig({
  testDir: "./tests",
  // Production-only assertions run with playwright.goal-preview.config.ts.
  testIgnore: "**/goal-preview.spec.ts",
  outputDir: "./work/browser-results",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: testURL,
    channel: "chrome",
    locale: "zh-CN",
    launchOptions: { args: ["--disable-crash-reporter", "--disable-breakpad"] },
    headless: true,
    viewport: { width: 1440, height: 1000 },
    timezoneId: "America/New_York",
  },
  webServer: process.env.BETTERLUMI_TEST_EXTERNAL_SERVER==="1"?undefined:{
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${testPort} --strictPort`,
    url: testURL,
    reuseExistingServer: false,
    timeout: 30000,
  },
  reporter: "list",
});
