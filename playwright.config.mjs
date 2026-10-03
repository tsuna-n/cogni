import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: process.env.ASSESSMENT_BASE_URL || "http://127.0.0.1:3107",
    locale: "th-TH",
    serviceWorkers: "block",
    launchOptions: process.env.ASSESSMENT_CHROMIUM_PATH
      ? { executablePath: process.env.ASSESSMENT_CHROMIUM_PATH }
      : {},
  },
  webServer: process.env.ASSESSMENT_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --hostname 127.0.0.1 --port 3107",
        url: "http://127.0.0.1:3107",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
