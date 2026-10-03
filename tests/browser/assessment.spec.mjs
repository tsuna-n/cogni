import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openAssessment(page) {
  // Mock session/config only; assessment components, navigation and state run unchanged.
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          email: "assessment@example.test",
          name: "Assessment tester",
          role: "user",
        },
      },
    }),
  );
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: {
        registrationEnabled: false,
        study: {
          baselineSeconds: 30,
          postTaskSeconds: 30,
          maxTaskSeconds: 300,
          defaultTaskSeconds: 90,
          protocolVersion: "test",
        },
      },
    }),
  );
  await page.route("**/api/forms", (route) => route.fulfill({ json: route.request().method() === 'GET' ? { forms: {} } : { saved: true } }));
  await page.goto("/");
  if (page.viewportSize().width <= 850)
    await page
      .getByRole("button", { name: "เปิดหรือปิดเมนู", exact: true })
      .click();
  await page
    .getByRole("button", { name: "แบบคัดกรองเบื้องต้น", exact: true })
    .click();
  return page.locator("#cogscreen");
}

async function begin(screen, checkRespondent = async () => {}) {
  await expect(
    screen.getByRole("button", { name: "เริ่มทำแบบประเมิน", exact: true }),
  ).toBeDisabled();
  await screen.getByRole("checkbox").check();
  await screen
    .getByRole("button", { name: "เริ่มทำแบบประเมิน", exact: true })
    .click();
  await expect(
    screen.getByRole("button", { name: "ถัดไป", exact: true }),
  ).toBeDisabled();
  await checkRespondent();
  await checkAccess(screen.page());
  await screen.getByText("บุตร", { exact: true }).click();
  await screen.getByRole("button", { name: "ถัดไป", exact: true }).click();
}

async function answer(screen, value = "มีการเปลี่ยนแปลง") {
  await screen.getByText(value, { exact: true }).click();
  await screen.getByRole("button", { name: /^(ถัดไป|ตรวจสอบคำตอบ)$/ }).click();
}

async function checkAccess(page) {
  const results = await new AxeBuilder({ page })
    .include("#cogscreen")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

test("complete flow, review editing, restart and home reset", async ({
  page,
}) => {
  const screen = await openAssessment(page);
  await checkAccess(page);
  await begin(screen);
  await expect(
    screen.getByRole("button", { name: "ถัดไป", exact: true }),
  ).toBeDisabled();
  await expect(
    screen.getByRole("button", { name: "ย้อนกลับ", exact: true }),
  ).toHaveCount(0);
  await checkAccess(page);
  for (let index = 0; index < 8; index++) {
    await expect(
      screen.getByText(`ข้อ ${index + 1} จาก 8`, { exact: true }),
    ).toBeVisible();
    await expect(screen.getByRole("progressbar")).toHaveAttribute(
      "value",
      String(index + 1),
    );
    await answer(screen, index === 7 ? "ไม่ทราบ" : "มีการเปลี่ยนแปลง");
  }
  await expect(
    screen.getByRole("heading", { name: "ตรวจสอบคำตอบ", exact: true }),
  ).toBeFocused();
  await expect(screen.getByRole("listitem")).toHaveCount(8);
  await checkAccess(page);
  await screen
    .getByRole("button", { name: "แก้ไขคำตอบข้อ 2", exact: true })
    .click();
  await expect(
    screen.getByRole("radio", { name: "มีการเปลี่ยนแปลง", exact: true }),
  ).toBeChecked();
  await screen.getByText("ไม่มีการเปลี่ยนแปลง", { exact: true }).click();
  await screen
    .getByRole("button", { name: "กลับไปตรวจสอบคำตอบ", exact: true })
    .click();
  await expect(screen.getByRole("listitem").nth(1)).toContainText(
    "คำตอบ: ไม่มีการเปลี่ยนแปลง",
  );
  await screen
    .getByRole("button", { name: "ยืนยันและดูผล", exact: true })
    .click();
  await expect(
    screen.getByRole("heading", { name: "ผลการคัดกรองเบื้องต้น", exact: true }),
  ).toBeFocused();
  await expect(screen.getByRole("listitem").nth(1)).toContainText(
    "คำตอบ: ไม่มีการเปลี่ยนแปลง",
  );
  await expect(
    screen.getByText("ยังไม่มีเกณฑ์คะแนน", { exact: false }),
  ).toBeVisible();
  await checkAccess(page);
  await screen
    .getByRole("button", { name: "ทำแบบประเมินใหม่", exact: true })
    .click();
  await expect(screen.getByRole("checkbox")).not.toBeChecked();
  await expect(
    screen.getByRole("heading", { name: "ผลการคัดกรองเบื้องต้น", exact: true }),
  ).toHaveCount(0);
  await screen.getByRole("checkbox").check();
  await screen
    .getByRole("button", { name: "เริ่มทำแบบประเมิน", exact: true })
    .click();
  await expect(screen.getByRole("radio", { checked: true })).toHaveCount(0);
  await screen.getByText("ผู้ดูแล", { exact: true }).click();
  await screen.getByRole("button", { name: "ถัดไป", exact: true }).click();
  await expect(screen.getByText("ข้อ 1 จาก 8", { exact: true })).toBeVisible();
  for (let index = 0; index < 8; index++) {
    await expect(screen.getByRole("radio", { checked: true })).toHaveCount(0);
    await answer(screen, "ไม่ทราบ");
  }
  await screen
    .getByRole("button", { name: "ยืนยันและดูผล", exact: true })
    .click();
  await screen
    .getByRole("button", { name: "กลับหน้าหลัก", exact: true })
    .click();
  await expect(page.locator("#dashboard")).toBeVisible();
  await page
    .getByRole("button", { name: "แบบคัดกรองเบื้องต้น", exact: true })
    .click();
  await expect(screen.getByRole("checkbox")).not.toBeChecked();
});

test("question 5 back to 3 saves changed answer and preserves others", async ({
  page,
}) => {
  const screen = await openAssessment(page);
  await begin(screen);
  for (let index = 0; index < 4; index++) await answer(screen);
  await screen.getByRole("button", { name: "ย้อนกลับ", exact: true }).click();
  await screen.getByRole("button", { name: "ย้อนกลับ", exact: true }).click();
  await expect(screen.getByText("ข้อ 3 จาก 8", { exact: true })).toBeVisible();
  await answer(screen, "ไม่มีการเปลี่ยนแปลง");
  await expect(
    screen.getByRole("radio", { name: "มีการเปลี่ยนแปลง", exact: true }),
  ).toBeChecked();
  await screen.getByRole("button", { name: "ถัดไป", exact: true }).click();
  for (let index = 4; index < 8; index++) await answer(screen);
  await expect(screen.getByRole("listitem").nth(2)).toContainText(
    "คำตอบ: ไม่มีการเปลี่ยนแปลง",
  );
});

test("native keyboard radio navigation and language switch preserve answers", async ({
  page,
}) => {
  const screen = await openAssessment(page);
  await begin(screen);
  const changed = screen.getByRole("radio", {
    name: "มีการเปลี่ยนแปลง",
    exact: true,
  });
  await changed.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await expect(
    screen.getByRole("radio", { name: "ไม่มีการเปลี่ยนแปลง", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Switch to English", exact: true })
    .click();
  await expect(
    screen.getByRole("radio", { name: "No change", exact: true }),
  ).toBeChecked();
  await expect(screen.getByRole("heading", { level: 2 })).toHaveText(
    "Has judgment or everyday problem solving become worse than before?",
  );
});

for (const width of [320, 375, 390, 768, 1440]) {
  test(`readable layout without overflow at ${width}px across every step`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const screen = await openAssessment(page);
    async function checkLayout() {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      for (const button of await screen.getByRole("button").all()) {
        if (!(await button.isVisible())) continue;
        const box = await button.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(48);
      }
      expect(
        await screen
          .locator("#assessment-heading")
          .evaluate((element) =>
            parseFloat(getComputedStyle(element).fontSize),
          ),
      ).toBeGreaterThanOrEqual(22);
      const paragraph = screen
        .locator("#assessment-heading")
        .locator("..")
        .locator("p")
        .first();
      expect(
        await paragraph.evaluate((element) =>
          parseFloat(getComputedStyle(element).fontSize),
        ),
      ).toBeGreaterThanOrEqual(18);
    }
    await checkLayout();
    await page.screenshot({
      path: `test-results/assessment-intro-${width}.png`,
      fullPage: true,
    });
    await begin(screen, checkLayout);
    for (let index = 0; index < 8; index++) {
      await checkLayout();
      const progressBox = await screen.getByRole("progressbar").boundingBox();
      const headerBox = await page.locator(".workspace-topbar").boundingBox();
      expect(progressBox.y).toBeGreaterThanOrEqual(
        headerBox.y + headerBox.height,
      );
      if (index === 2)
        await page.screenshot({
          path: `test-results/assessment-question-${width}.png`,
          fullPage: true,
        });
      await answer(screen);
    }
    await checkLayout();
    await page.screenshot({
      path: `test-results/assessment-review-${width}.png`,
      fullPage: true,
    });
    await screen
      .getByRole("button", { name: "ยืนยันและดูผล", exact: true })
      .click();
    await expect(screen.getByRole("heading", { name: "ผลการคัดกรองเบื้องต้น", exact: true })).toBeVisible();
    await checkLayout();
    await page.screenshot({
      path: `test-results/assessment-${width}.png`,
      fullPage: true,
    });
  });
}
