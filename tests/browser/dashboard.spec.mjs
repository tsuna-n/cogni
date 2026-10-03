import { test, expect } from "@playwright/test";

const users = [
  { email: "admin@example.test", name: "Admin", role: "admin", profile: {} },
  { email: "participant@example.test", name: "Participant", role: "user", profile: { participantId: "P001", studyGroup: "control", age: 54 }, taskPerformance: {
    accuracyPercent: 80, sessionCount: 2, trials: 20,
    games: [{ gameId: 1, sessionCount: 1, accuracyPercent: 60 }, { gameId: 2, sessionCount: 1, accuracyPercent: 100 }, { gameId: 3, sessionCount: 0, accuracyPercent: null }],
  } },
  { email: "pending@example.test", name: "Pending profile", role: "user", profile: {} },
];
const records = [
  { recordId: "complete", participantId: "P001", summary: { sessionId: "S01-G1", studyGroup: "control", gameId: 1, status: "complete", startedMs: 1780000000000 } },
  { recordId: "interrupted", participantId: "P002", summary: { sessionId: "S02-G1", studyGroup: "patient", gameId: 1, status: "disconnect", startedMs: 1780000010000 } },
  { recordId: "test", participantId: "TEST", summary: { sessionId: "CHECK", studyGroup: "device_test", testMode: true, status: "complete", startedMs: 1780000020000 } },
];

async function mockDashboard(page, { role = "admin", failSettings = false, failDashboard = false } = {}) {
  let study = { baselineSeconds: 30, postTaskSeconds: 30, maxTaskSeconds: 540, defaultTaskSeconds: 60, protocolVersion: "test_protocol" };
  let source = "environment";
  const writes = [];
  await page.addInitScript(() => localStorage.setItem("cogni_locale", "th"));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/forms") return route.fulfill({ json: { forms: {} } });
    if (path === "/api/auth/me") return route.fulfill({ json: { user: { email: "admin@example.test", name: "Admin", role } } });
    if (path === "/api/config") return route.fulfill({ json: { registrationEnabled: false, study } });
    if (path === "/api/dashboard/users") return route.fulfill(failDashboard ? { status: 503, json: { error: "storage_unavailable" } } : { json: { users } });
    if (path === "/api/research/summaries") return route.fulfill({ json: { records } });
    if (path === "/api/admin/settings") {
      if (role !== "admin") return route.fulfill({ status: 403, json: { error: "forbidden" } });
      if (route.request().method() === "PUT") {
        writes.push(route.request().postDataJSON());
        if (failSettings) return route.fulfill({ status: 503, json: { error: "settings_unavailable" } });
        study = route.request().postDataJSON(); source = "saved";
      }
      return route.fulfill({ json: { study, source } });
    }
    if (path === "/api/admin/participants") return route.fulfill({ json: { participants: [] } });
    return route.fulfill({ status: 404, json: { error: "not_found" } });
  });
  await page.goto("/");
  await expect(page.locator(".dashboard-live-stats")).toBeVisible();
  await expect(page.locator(".dashboard-live-stats")).not.toContainText("…");
  return writes;
}

test("overview shows synced study data and links to profiles, results and settings", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockDashboard(page);
  await expect(page.locator(".dashboard-live-stats .dash-stat-value")).toHaveText(["3", "3", "2", "1"]);
  await expect(page.locator(".dashboard-recent-scroll tbody tr")).toHaveCount(3);
  await expect(page.locator(".dashboard-session-groups")).toContainText("กลุ่มควบคุม 1");
  await expect(page.locator(".dashboard-pending-card .dashboard-count-badge")).toHaveText("1");
  await page.getByRole("button", { name: "เติมข้อมูล Pending profile", exact: true }).click();
  await expect(page.locator(".dashboard-user-details [name=name]")).toHaveValue("Pending profile");
  await page.getByRole("tab", { name: "ภาพรวม", exact: true }).click();
  await page.getByRole("button", { name: "ดูผลทั้งหมด", exact: true }).click();
  await expect(page.getByRole("tab", { name: "ผลการทดลอง", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "ภาพรวม", exact: true }).click();
  await page.getByRole("button", { name: "เปิดห้องทดลอง EEG", exact: true }).click();
  await expect(page.locator("#journey")).toHaveClass("active");
  expect(errors).toEqual([]);
});

test("settings update the timing preview, persist through reload and refresh the overview", async ({ page }) => {
  const writes = await mockDashboard(page);
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  const settings = page.locator(".admin-study-settings");
  const save = settings.getByRole("button", { name: "บันทึกการตั้งค่า", exact: true });
  await expect(save).toBeDisabled();
  await settings.getByLabel("Task ค่าเริ่มต้น (วินาที)", { exact: true }).fill("90");
  await expect(settings.locator(".admin-settings-total")).toContainText("150 วินาที");
  await expect(settings).toContainText("ยังไม่ได้บันทึก");
  await save.click();
  await expect(settings.getByRole("status").filter({ hasText: "บันทึกแล้ว" })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0].defaultTaskSeconds).toBe(90);
  await expect(save).toBeDisabled();
  await page.getByRole("button", { name: "แดชบอร์ด", exact: true }).click();
  await expect(page.locator(".dashboard-protocol-phases")).toContainText("90");
  await page.reload();
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  await expect(settings.getByLabel("Task ค่าเริ่มต้น (วินาที)", { exact: true })).toHaveValue("90");
});

test("settings failures retain the draft and report a readable error", async ({ page }) => {
  await mockDashboard(page, { failSettings: true });
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  const settings = page.locator(".admin-study-settings");
  await settings.getByLabel("Task ค่าเริ่มต้น (วินาที)", { exact: true }).fill("90");
  await settings.getByRole("button", { name: "บันทึกการตั้งค่า", exact: true }).click();
  await expect(settings.getByRole("alert")).toContainText("โหลดหรือบันทึกการตั้งค่าไม่ได้");
  await expect(settings.getByLabel("Task ค่าเริ่มต้น (วินาที)", { exact: true })).toHaveValue("90");
  await expect(settings).toContainText("ยังไม่ได้บันทึก");
});

test("researchers cannot open admin settings and mobile layout stays within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboard(page, { role: "researcher" });
  await expect(page.getByRole("button", { name: "ตั้งค่า", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("tab", { name: "ผู้ใช้", exact: false }).click();
  await expect(page.locator(".dashboard-user-list")).toBeVisible();
});

test("failed dashboard fetch does not show zero counts as successful data", async ({ page }) => {
  await page.route("**/api/forms", (route) => route.fulfill({ json: { forms: {} } }));
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { user: { email: "admin@example.test", role: "admin" } } }));
  await page.route("**/api/config", (route) => route.fulfill({ json: { study: null } }));
  await page.route("**/api/dashboard/users", (route) => route.fulfill({ status: 503, json: { error: "storage_unavailable" } }));
  await page.route("**/api/research/summaries", (route) => route.fulfill({ json: { records: [] } }));
  await page.addInitScript(() => localStorage.setItem("cogni_locale", "th"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ยังโหลดภาพรวมไม่ได้" })).toBeVisible();
  await expect(page.locator(".dashboard-live-stats")).toHaveCount(0);
});

test("task averages show their sample counts while unassessed MMSE remains blank", async ({ page }) => {
  await mockDashboard(page);
  const row = page.locator(".user-overview-table tbody tr").filter({ hasText: "participant@example.test" });
  await expect(row).toContainText("80");
  await expect(row).toContainText("2 รอบ");
  await expect(row).toContainText("ยังไม่ครบ");
  await row.getByRole("button", { name: "ดู / แก้ไข" }).click();
  const performance = page.locator(".dashboard-user-details .dashboard-task-performance");
  await expect(performance).toContainText("80%");
  await expect(performance).toContainText("20 คำตอบ");
  await expect(performance).toContainText("ใช้แทนผลประเมิน MMSE ไม่ได้");
  await expect(page.locator('[name="mmse-0"]')).toHaveValue("");
});

test("ordinary users see saved task averages update after a successful sync", async ({ page }) => {
  let performance = users[1].taskPerformance;
  await page.addInitScript(() => localStorage.setItem("cogni_locale", "th"));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: { user: { email: "participant@example.test", name: "Participant", role: "user", screeningRequired: false, profile: {} } } });
    if (path === "/api/forms") return route.fulfill({ json: { forms: {} } });
    if (path === "/api/config") return route.fulfill({ json: { registrationEnabled: false, study: null } });
    if (path === "/api/research/summaries") return route.fulfill({ json: { records: [], taskPerformance: performance } });
    return route.fulfill({ status: 404, json: { error: "not_found" } });
  });
  await page.goto("/");
  const panel = page.locator(".research-dashboard .dashboard-task-performance");
  await expect(panel).toContainText("80%");
  performance = { ...performance, accuracyPercent: 90, sessionCount: 3, trials: 30 };
  await page.evaluate(() => window.dispatchEvent(new Event("research-summaries-synced")));
  await expect(panel).toContainText("90%");
  await expect(panel).toContainText("30 คำตอบ");
});
