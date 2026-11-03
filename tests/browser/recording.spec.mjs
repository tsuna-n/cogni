import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const email = "recording@example.test";

async function openRecording(page) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: { user: { email, name: "Recorder", role: "user", participantId: "P001", screeningRequired: false } } });
    if (path === "/api/forms") return route.fulfill({ json: route.request().method() === "GET" ? { forms: {} } : { saved: true } });
    if (path === "/api/config") return route.fulfill({ json: { registrationEnabled: false, study: { baselineSeconds: 30, postTaskSeconds: 30, maxTaskSeconds: 300, defaultTaskSeconds: 60, protocolVersion: "test" } } });
    return route.fulfill({ json: route.request().method() === "POST" ? { uploadedBy: email, uploadedAt: new Date().toISOString() } : { records: [] } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "ห้องกิจกรรม", exact: true }).click();
  const workspace = page.locator(".study-workspace");
  await expect(workspace.getByRole("button", { name: "ทดสอบอุปกรณ์ 15 วินาที", exact: true })).toBeEnabled();
  await page.clock.install();
  return workspace;
}

async function sendReadings(page, index) {
  await page.evaluate((packetIndex) => {
    for (let electrode = 0; electrode < 4; electrode++) {
      window.dispatchEvent(new CustomEvent("muse-study-reading", { detail: {
        electrode, index: packetIndex, timestamp: Date.now(), samples: Array(12).fill(electrode + 1),
      } }));
    }
  }, index);
}

async function downloadRecording(workspace) {
  const pending = workspace.page().waitForEvent("download");
  await workspace.getByRole("button", { name: "ส่งออกข้อมูล + markers (.csv)", exact: true }).click();
  return readFile(await (await pending).path(), "utf8");
}

test("live counts and markers survive stop/reload; a failed export save cannot unlock reset", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const workspace = await openRecording(page);
  await sendReadings(page, 0);
  await workspace.getByRole("button", { name: "ทดสอบอุปกรณ์ 15 วินาที", exact: true }).click();
  await expect(workspace.locator(".study-marker")).toBeVisible();
  await sendReadings(page, 1);
  await page.clock.runFor(600);
  await sendReadings(page, 2);
  await workspace.getByRole("textbox", { name: "ชื่อ marker", exact: true }).fill("view-check");
  await workspace.getByRole("button", { name: "เพิ่ม marker", exact: true }).click();
  await workspace.getByRole("button", { name: "หยุดและเก็บข้อมูลที่มี", exact: true }).click();
  await expect(workspace.locator(".study-run-status")).toContainText("96 samples · 4 markers");
  await expect(workspace.locator(".study-channel-count > span b")).toHaveText(["24", "24", "24", "24"]);
  await expect(workspace.locator(".study-saved-item")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "ห้องกิจกรรม", exact: true }).click();
  await expect(workspace.locator(".study-run-status")).toContainText("96 samples · 4 markers");
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    window.failExportSave = true;
    IDBObjectStore.prototype.put = function (value, ...args) {
      if (window.failExportSave && this.name === "sessions" && value.exported) {
        this.transaction.abort();
        return;
      }
      return put.call(this, value, ...args);
    };
  });
  const csv = await downloadRecording(workspace);
  await expect(workspace.getByRole("button", { name: "เริ่มรอบใหม่", exact: true })).toBeDisabled();
  await expect(workspace.locator(".study-message[role=status]")).toContainText("ส่งออก CSV ไม่สำเร็จ");
  expect(csv.split(/\r?\n/).filter((row) => row.includes(',"eeg",'))).toHaveLength(96);
  expect(csv).toContain('"view-check"');
  await page.evaluate(() => { window.failExportSave = false; });
  await downloadRecording(workspace);
  await expect(workspace.getByRole("button", { name: "เริ่มรอบใหม่", exact: true })).toBeEnabled();
  await workspace.getByRole("button", { name: "เริ่มรอบใหม่", exact: true }).click();
  await expect(workspace.locator(".study-run-status")).toContainText("ยังไม่มีข้อมูลในรอบนี้");
  expect(errors).toEqual([]);
});

test("device callbacks advance baseline/task/rest and retain exact phase markers", async ({ page }) => {
  const workspace = await openRecording(page);
  await sendReadings(page, 0);
  await workspace.getByRole("button", { name: "ทดสอบอุปกรณ์ 15 วินาที", exact: true }).click();
  await expect(workspace.locator(".study-marker")).toBeVisible();
  for (let second = 0; second < 15; second++) {
    await sendReadings(page, second + 1);
    await page.clock.runFor(1000);
  }
  await expect(workspace.locator(".study-run-status")).toContainText("ครบตามแผนการทดลอง");
  await expect(workspace.locator(".study-saved-item")).toHaveCount(1);
  const csv = await downloadRecording(workspace);
  const rows = csv.split(/\r?\n/);
  for (const marker of ["baseline_start", "baseline_end", "task_start", "task_end", "rest_start", "rest_end", "session_complete"])
    expect(rows.filter((row) => row.includes(`"${marker}"`))).toHaveLength(1);
});
