import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 7_000, toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.015 } },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.mjs",
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge" } },
    { name: "firefox", use: { ...devices["Desktop Firefox"], launchOptions: { timeout: 30_000, firefoxUserPrefs: {
      "gfx.webrender.all": false,
      "gfx.webrender.software": false,
      "gfx.webrender.force-disabled": true,
      "layers.acceleration.disabled": true,
      "media.hardware-video-decoding.enabled": false,
    } } } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-edge", use: { ...devices["Pixel 7"], channel: "msedge" } },
  ],
});
