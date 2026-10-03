import { test, expect } from "@playwright/test";

async function mockMuse(page, stage) {
  await page.addInitScript((failureStage) => {
    const device = new EventTarget();
    device.id = "mock-muse";
    device.name = "MuseS-test";
    let fail = true;
    const characteristics = new Map();
    const service = {
      async getCharacteristic(uuid) {
        if (!characteristics.has(uuid)) {
          const characteristic = new EventTarget();
          characteristic.uuid = uuid;
          characteristic.startNotifications = async () => characteristic;
          characteristic.writeValue = async () => {
            if (fail && failureStage === "start")
              throw new DOMException(
                "EEG command write failed",
                "NetworkError",
              );
          };
          characteristics.set(uuid, characteristic);
        }
        return characteristics.get(uuid);
      },
    };
    device.gatt = {
      device,
      connected: false,
      async connect() {
        if (fail && failureStage === "gatt")
          throw new DOMException("Connection attempt failed", "NetworkError");
        this.connected = true;
        return this;
      },
      async getPrimaryService() {
        if (fail && failureStage === "service")
          throw new DOMException("Muse service unavailable", "NotFoundError");
        return service;
      },
      disconnect() {
        if (!this.connected) return;
        this.connected = false;
        device.dispatchEvent(new Event("gattserverdisconnected"));
      },
    };
    Object.defineProperty(navigator, "bluetooth", {
      configurable: true,
      value: {
        async getDevices() {
          return [device];
        },
        async requestDevice() {
          fail = false;
          return device;
        },
      },
    });
    localStorage.setItem("museLastDeviceId", device.id);
    localStorage.setItem("cogni_locale", "th");
  }, stage);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: { email: "muse@example.test", name: "Muse tester", role: "user" },
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
}

for (const [stage, errorName, message, status] of [
  [
    "gatt",
    "NetworkError",
    "Connection attempt failed",
    /Bluetooth connection failed|เชื่อมต่อ Bluetooth ไม่สำเร็จ/,
  ],
  [
    "service",
    "NotFoundError",
    "Muse service unavailable",
    /service discovery failed|เปิด Muse Service ไม่สำเร็จ/,
  ],
  [
    "start",
    "NetworkError",
    "EEG command write failed",
    /EEG startup failed|เริ่ม EEG ไม่สำเร็จ/,
  ],
]) {
  test(`automatic ${stage} failure shows readable diagnostics and permits manual recovery`, async ({
    page,
  }) => {
    const warnings = [],
      consoleErrors = [],
      pageErrors = [];
    page.on("console", (entry) => {
      if (entry.type() === "warning") warnings.push(entry.text());
      if (entry.type() === "error") consoleErrors.push(entry.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await mockMuse(page, stage);
    await page.goto("/");
    await page
      .getByRole("button", { name: "ห้องทดลอง EEG", exact: true })
      .click();
    await expect(page.locator("#museErrorDetails")).toBeVisible();
    await expect(page.locator("#museErrorText")).toContainText(
      "Device: MuseS-test",
    );
    await expect(page.locator("#museErrorText")).toContainText(
      `Stage: ${stage}`,
    );
    await expect(page.locator("#museErrorText")).toContainText(
      `${errorName}: ${message}`,
    );
    await expect(page.locator("#museStatus")).toContainText(status);
    if (stage === "service")
      await expect(page.locator("#museErrorText")).toContainText(
        "UUID: 0000fe8d-0000-1000-8000-00805f9b34fb",
      );
    expect(
      warnings.filter((entry) =>
        entry.startsWith("Muse auto-reconnect failed"),
      ),
    ).toHaveLength(1);
    expect(
      consoleErrors.filter((entry) => entry.includes("Muse connection failed")),
    ).toEqual([]);
    await expect(page.locator("#connectMuseBtn")).toBeEnabled();
    await expect(page.locator("#baselineBtn")).toBeDisabled();
    expect(await page.evaluate(() => Boolean(window.__museReady))).toBe(false);
    await page.locator("#connectMuseBtn").click();
    await expect(page.locator("#disconnectMuseBtn")).toBeEnabled();
    await expect(page.locator("#museErrorDetails")).toBeHidden();
    await expect(page.locator("#museStatus")).toContainText(
      /Connected|เชื่อมต่อแล้ว/,
    );
    // Connected without EEG packets must not be reported as ready to record.
    await expect(page.locator("#baselineBtn")).toBeDisabled();
    expect(pageErrors).toEqual([]);
    await page.locator("#disconnectMuseBtn").click();
  });
}
