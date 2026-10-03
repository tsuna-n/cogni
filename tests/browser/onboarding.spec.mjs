import { test, expect } from '@playwright/test';

async function workspace(page, { role = 'user', confirmed = false } = {}) {
  let currentEmail = 'first@example.test';
  const store = new Map([[currentEmail, confirmed ? { screeningHistory: { existing: { id: 'existing', answers: Array(8).fill('unchanged'), respondent: 'self', participantId: 'P001', submittedAt: new Date().toISOString() } } } : {}]]);
  let failConfirm = false;
  let failSave = false;
  const study = { baselineSeconds: 30, postTaskSeconds: 30, defaultTaskSeconds: 60, maxTaskSeconds: 300, protocolVersion: 'test' };
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const forms = store.get(currentEmail) || {};
    if (path === '/api/config') return route.fulfill({ json: { registrationEnabled: true, study } });
    if (path === '/api/auth/me') return route.fulfill({ json: { user: { email: currentEmail, name: 'Test', role, participantId: currentEmail === 'first@example.test' ? 'P001' : 'P002', screeningRequired: role === 'user' && !Object.keys(forms.screeningHistory || {}).length } } });
    if (path === '/api/forms') {
      if (route.request().method() === 'GET') return route.fulfill({ json: { forms } });
      const body = route.request().postDataJSON();
      if (route.request().method() === 'POST') {
        if (failConfirm) return route.fulfill({ status: 503, json: { error: 'storage_unavailable' } });
        forms.screeningHistory ||= {};
        forms.screeningHistory[body.id] ||= { ...body, participantId: 'P001', submittedAt: new Date().toISOString() };
      } else {
        if (failSave) return route.fulfill({ status: 503, json: { error: 'storage_unavailable' } });
        forms[body.key] = body.value;
      }
      store.set(currentEmail, forms);
      return route.fulfill({ json: { saved: true } });
    }
    if (path === '/api/research/summaries') return route.fulfill({ json: { records: [] } });
    if (path === '/api/dashboard/users') return route.fulfill({ json: { users: [] } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/');
  return {
    forms: () => store.get(currentEmail),
    failConfirm: (value) => { failConfirm = value; },
    failSave: (value) => { failSave = value; },
    switchAccount: () => { currentEmail = 'second@example.test'; },
  };
}

async function reviewScreening(page) {
  const screen = page.locator('#cogscreen');
  await screen.getByRole('checkbox').check();
  await screen.getByRole('button', { name: 'เริ่มทำแบบประเมิน', exact: true }).click();
  await screen.getByText('ผู้รับการประเมินเอง', { exact: true }).click();
  await screen.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  for (let index = 0; index < 8; index++) {
    await screen.getByText('ไม่มีการเปลี่ยนแปลง', { exact: true }).click();
    await screen.getByRole('button', { name: /^(ถัดไป|ตรวจสอบคำตอบ)$/ }).click();
  }
  return screen;
}

test('first login cannot skip screening; failed confirmation stays locked; saved answers survive reload', async ({ page }) => {
  const state = await workspace(page);
  await expect(page.locator('#cogscreen')).toBeVisible();
  await page.getByRole('button', { name: 'แดชบอร์ด', exact: true }).click();
  await expect(page.locator('#cogscreen')).toBeVisible();
  const screen = await reviewScreening(page);
  state.failConfirm(true);
  await screen.getByRole('button', { name: 'ยืนยันและดูผล', exact: true }).click();
  await expect(screen.getByRole('alert')).toContainText('บันทึกคำตอบไม่สำเร็จ');
  await page.getByRole('button', { name: 'แดชบอร์ด', exact: true }).click();
  await expect(screen).toBeVisible();
  await expect.poll(() => state.forms().screeningDraft?.stage).toBe('review');
  await page.reload();
  await expect(screen.getByRole('heading', { name: 'ตรวจสอบคำตอบ', exact: true })).toBeVisible();
  state.failConfirm(false);
  await screen.getByRole('button', { name: 'ยืนยันและดูผล', exact: true }).click();
  await expect(screen.getByRole('heading', { name: 'ผลการคัดกรองเบื้องต้น', exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'กลับหน้าหลัก', exact: true }).click();
  await expect(page.locator('#dashboard')).toBeVisible();
  await expect(page.locator('main > [role=status]')).toContainText('ข้อมูลแบบฟอร์มบันทึกแล้ว');
  await page.reload();
  await expect(page.locator('#dashboard')).toBeVisible();
  expect(Object.values(state.forms().screeningHistory)[0].answers).toHaveLength(8);
  await page.locator('#mainNav').getByRole('button', { name: 'ประวัติแบบประเมิน', exact: true }).click();
  await expect(page.locator('#history')).toContainText('ประวัติแบบคัดกรองเบื้องต้น');
  await expect(page.locator('#history')).toContainText('P001');
});

test('setup and legacy inputs autosave, restore and stay isolated between accounts', async ({ page }) => {
  const state = await workspace(page, { confirmed: true });
  await page.getByRole('button', { name: 'ห้องทดลอง EEG', exact: true }).click();
  const setup = page.locator('.study-workspace');
  await expect(setup.getByLabel('รหัสผู้เข้าร่วม *', { exact: true })).toHaveValue('P001');
  await expect(setup.getByLabel('รหัสผู้เข้าร่วม *', { exact: true })).toHaveAttribute('readonly', '');
  await setup.getByLabel('รหัสรอบทดลอง *', { exact: true }).fill('S09');
  await setup.getByLabel('กลุ่มวิจัย *').selectOption('control');
  state.failSave(true);
  await setup.getByLabel('เงื่อนไขการทดลอง', { exact: true }).fill('memory');
  await setup.locator('.study-durations input').fill('95');
  await setup.locator('.study-consent input').check();
  await expect(page.locator('main > [role=status]')).toContainText('บันทึกข้อมูลไม่สำเร็จ');
  state.failSave(false);
  await page.getByRole('button', { name: 'ลองบันทึกอีกครั้ง', exact: true }).click();
  await expect.poll(() => state.forms().setup?.sessionId).toBe('S09');
  await expect.poll(() => state.forms().setup?.taskSeconds).toBe('95');
  await page.evaluate(() => window.showSection('participant'));
  await page.locator('#participant input[type=number]').first().fill('68');
  await expect.poll(() => state.forms().workspace?.fields?.['participant:age']).toBe('68');
  await page.locator('#participant [name=sex]').selectOption('Female');
  await page.locator('#participant [name=taskCondition]').selectOption('High workload');
  await page.locator('#participant [name=sessionId]').fill('S04');
  await page.locator('#participant [name=sampleRate]').fill('128');
  await page.locator('#mainNav').getByRole('button', { name: 'แบบคัดกรองเบื้องต้น', exact: true }).click();
  await page.locator('#cogscreen .study-legacy > summary').click();
  await page.locator('#mcscore').fill('3');
  await page.locator('#mcdate').fill('2026-10-03');
  await expect.poll(() => state.forms().workspace?.fields?.['cogscreen:mcdate']).toBe('2026-10-03');
  await page.reload();
  await page.getByRole('button', { name: 'ห้องทดลอง EEG', exact: true }).click();
  await expect(setup.getByLabel('รหัสรอบทดลอง *', { exact: true })).toHaveValue('S09');
  await expect(setup.getByLabel('เงื่อนไขการทดลอง', { exact: true })).toHaveValue('memory');
  await expect(setup.locator('.study-durations input')).toHaveValue('95');
  await expect(setup.locator('.study-consent input')).toBeChecked();
  await page.evaluate(() => window.showSection('participant'));
  await expect(page.locator('#participant input[type=number]').first()).toHaveValue('68');
  await expect(page.locator('#participant [name=sex]')).toHaveValue('Female');
  await expect(page.locator('#participant [name=taskCondition]')).toHaveValue('High workload');
  await expect(page.locator('#participant [name=sessionId]')).toHaveValue('S04');
  await expect(page.locator('#participant [name=sampleRate]')).toHaveValue('128');
  await page.locator('#mainNav').getByRole('button', { name: 'แบบคัดกรองเบื้องต้น', exact: true }).click();
  await page.locator('#cogscreen .study-legacy > summary').click();
  await expect(page.locator('#mcscore')).toHaveValue('3');
  await expect(page.locator('#mcdate')).toHaveValue('2026-10-03');
  await expect(page.locator('main > [role=status]')).toContainText('ข้อมูลแบบฟอร์มบันทึกแล้ว');
  state.switchAccount();
  await page.reload();
  await expect(page.locator('#cogscreen')).toBeVisible();
  expect(state.forms()?.setup).toBeUndefined();
});

for (const role of ['admin', 'researcher']) {
  test(`${role} can enter without first screening`, async ({ page }) => {
    await workspace(page, { role });
    await expect(page.locator('#dashboard')).toBeVisible();
  });
}
