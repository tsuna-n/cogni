import { test, expect } from "@playwright/test";

const removedCopy = /\bEEG\b|สัญญาณสมอง|คลื่นสมอง|brain signals?|brainwave/i;
const study = { baselineSeconds: 30, postTaskSeconds: 30, defaultTaskSeconds: 60, maxTaskSeconds: 300, protocolVersion: "test" };

async function openWorkspace(page, locale, role) {
  await page.addInitScript((language) => localStorage.setItem("cogni_locale", language), locale);
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: { user: role ? { email: "copy@example.test", name: "Test", role, screeningRequired: false } : null } });
    if (path === "/api/config") return route.fulfill({ json: { registrationEnabled: true, study } });
    if (path === "/api/forms") return route.fulfill({ json: { forms: {} } });
    if (path === "/api/dashboard/users") return route.fulfill({ json: { users: [] } });
    if (path === "/api/admin/settings") return route.fulfill({ json: { study, source: "environment" } });
    if (path === "/api/admin/participants") return route.fulfill({ json: { participants: [] } });
    return route.fulfill({ json: { records: [] } });
  });
  await page.goto("/");
  await expect(page.locator(role ? "#appShell" : "#authScreen")).toBeVisible();
}

for (const locale of ["th", "en"]) {
  test(`sign-in and registration use the new illustration and neutral copy in ${locale}`, async ({ page, request }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspace(page, locale);
    const auth = page.locator("#authScreen");
    await expect(auth).not.toContainText(removedCopy);
    await expect(page).not.toHaveTitle(removedCopy);
    const descriptions = await page.locator('meta[name="description"]').evaluateAll((nodes) => nodes.map((node) => node.content));
    expect(descriptions.length).toBeGreaterThan(0);
    for (const description of descriptions) expect(description).not.toMatch(removedCopy);
    await expect(page.locator(".auth-activity-visual")).toHaveCSS("background-image", /activity-workspace\.svg/);
    const illustration = await request.get("/activity-workspace.svg");
    expect(illustration.ok()).toBe(true);
    expect(await illustration.text()).not.toMatch(removedCopy);
    const manifest = await request.get("/manifest.webmanifest");
    expect(await manifest.text()).not.toMatch(removedCopy);
    await page.screenshot({ path: testInfo.outputPath("auth-desktop.png"), fullPage: true });
    await auth.locator(".auth-tabs button").nth(1).click();
    await expect(page.locator("#authPassConfirm")).toBeVisible();
    await expect(auth).not.toContainText(removedCopy);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });

  for (const role of ["user", "researcher", "admin"]) {
    test(`every workspace section uses neutral copy for ${role} in ${locale}`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await openWorkspace(page, locale, role);
      const sections = await page.locator("main > section").evaluateAll((nodes) => nodes.map((node) => node.id));
      expect(sections).toContain("journey");
      expect(sections).toContain("dashboard");
      for (const id of sections) {
        await page.evaluate((section) => window.showSection(section), id);
        await expect(page.locator(`main > #${id}`)).toBeVisible();
        await expect(page.locator("#appShell")).not.toContainText(removedCopy);
      }
      await page.evaluate(() => window.showSection("dashboard"));
      for (const tab of await page.locator("#dashboard").getByRole("tab").all()) {
        await tab.click();
        await expect(page.locator("#dashboard")).not.toContainText(removedCopy);
      }
      expect(errors).toEqual([]);
    });
  }
}
