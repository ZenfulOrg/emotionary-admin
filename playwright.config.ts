import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  workers: 2,
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4397",
    channel: "chrome",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "node tests/local-server.mjs",
    url: "http://127.0.0.1:4397/login",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
