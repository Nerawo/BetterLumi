import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  outputDir: "./work/browser-results",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:5190",
    channel: "chrome",
    locale: "zh-CN",
    launchOptions: { args: ["--disable-crash-reporter", "--disable-breakpad"] },
    headless: true,
    viewport: { width: 1440, height: 1000 },
    timezoneId: "America/New_York",
  },
  webServer: {
    command: "npm.cmd run dev -- --port 5190 --strictPort",
    url: "http://127.0.0.1:5190",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  reporter: "list",
});
