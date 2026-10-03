# รายงานปรับปรุงแบบคัดกรองเบื้องต้น

## วิเคราะห์ของเดิม

โปรเจกต์ใช้ Next.js 16.3.5, React 19 และ JavaScript มี design tokens สำหรับพื้นหลัง สี ตัวอักษร และเส้นขอบ หน้าคัดกรองเดิมเป็นช่องบันทึกคะแนน Mini-Cog ส่วน MMSE อยู่ในเครื่องมือการวิจัยเดิม ยังไม่มีคำถาม 8 ข้อตามข้อกำหนด และไม่มีเมนูไปยังหน้าคัดกรองโดยตรง จึงเพิ่ม flow ในหน้าที่มีอยู่โดยไม่ rewrite ระบบวิจัยหรือระบบบัญชี

## ไฟล์และ components

ไฟล์ที่แก้:

- `app/page.js`: เพิ่มเมนูและเชื่อมแบบประเมินใน `cogscreen`; จัดเครื่องมือวิจัยเดิมไว้ในรายละเอียดที่เปิดดูได้
- `app/workspace.css`: เพิ่มขนาดคำอธิบายหัวหน้าคัดกรองเป็น 18px เฉพาะหน้านี้
- `package.json`, `package-lock.json`: เพิ่มเครื่องมือตรวจและคำสั่งทดสอบ โดยใช้ npm ตาม README และการตั้งค่า Vercel เดิม
- `.gitignore`: ไม่ติดตามผลลัพธ์ Playwright

ไฟล์ใหม่:

- `app/components/assessment/PreliminaryAssessment.js`: ควบคุม state, ภาษา และ focus
- `app/components/assessment/AssessmentSteps.js`: `AssessmentIntro`, `RespondentType`, `QuestionCard`, `AnswerOption`, `ProgressBar`
- `app/components/assessment/AssessmentSummary.js`: `AssessmentReview`, `AssessmentResult` และส่วนสรุปคำตอบที่ใช้ร่วมกัน
- `app/components/assessment/assessment.module.css`: รูปแบบที่จำกัดขอบเขตเฉพาะแบบประเมิน
- `app/components/assessment/css.d.ts`: type ของ CSS Modules
- `lib/assessment.mjs`: ข้อมูลคำถาม ตัวเลือก และ reducer พร้อม JSDoc types
- `eslint.config.mjs`, `tsconfig.assessment.json`, `playwright.config.mjs`: การตั้งค่าตรวจและทดสอบ
- `tests/assessment.test.mjs`, `tests/browser/assessment.spec.mjs`: ทดสอบ state และเบราว์เซอร์
- `docs/preliminary-assessment.md`: รายงานนี้

## Flow และ state

คำชี้แจงพร้อมกล่องข้อมูล 3 ส่วน → checkbox ยืนยัน → เลือกผู้ตอบ → คำถามทีละข้อ → ตรวจสอบคำตอบ → ยืนยัน → สรุปผลการคัดกรองเบื้องต้น

ปุ่มเริ่มใช้ได้หลังยืนยัน checkbox เท่านั้น ผู้ตอบต้องเลือกหนึ่งประเภทก่อนเริ่มคำถาม และปุ่มถัดไปใช้ได้หลังตอบข้อปัจจุบัน หน้า Review มีปุ่มแก้ไขที่กลับไปยังข้อนั้นโดยตรง และบันทึกแล้วกลับ Review โดยไม่ต้องไล่ตอบข้อที่เหลืออีก

`useReducer` เก็บ `{ stage, index, acknowledged, respondent, answers, editing, result }` โดย `answers` เป็น array ยาว 8 ตำแหน่ง มีค่า `null`, `changed`, `unchanged` หรือ `unknown` ส่วน `result` เป็น snapshot ของผู้ตอบและคำตอบหลังยืนยัน ไม่มีคะแนนหรือหมวดความเสี่ยง

มี guard ใน reducer ป้องกันเริ่มก่อนยืนยัน ข้ามข้อที่ยังไม่ตอบ และยืนยันก่อนตอบครบ การย้อนกลับและเปลี่ยนภาษารักษาคำตอบเดิม การเริ่มใหม่และกลับหน้าหลักล้าง state ทั้งหมด การเปลี่ยนบัญชี remount แบบประเมินเพื่อไม่ให้คำตอบติดไปยังบัญชีอื่น

ข้อมูลแบบคำถามใหม่นี้อยู่ใน client state เท่านั้น ไม่มีการเพิ่ม database หรือ localStorage การ refresh ล้างข้อมูลได้ตามข้อกำหนด

## Accessibility และมือถือ

- ตัวอักษรเนื้อหาและข้อความช่วย 18px คำถาม 22–28px ปุ่มสูงอย่างน้อย 52px
- Radio cards กดได้ทั้งกล่อง ใช้ native radio จึงรองรับ Tab, Space และลูกศร
- เชื่อม label กับ input และแยกชื่อคำตอบ (`aria-labelledby`) ออกจากข้อความช่วย (`aria-describedby`)
- ใช้ fieldset ที่มีชื่อกลุ่ม, หัวข้อ, รายการสรุป และ native progress พร้อมจำนวนข้อและเปอร์เซ็นต์สำหรับ screen reader
- ย้าย focus ไปหัวข้อเมื่อเปลี่ยนขั้นตอน และเลื่อนส่วนความคืบหน้าให้อยู่ใต้ sticky header โดยไม่มี animation
- มี focus outline ชัดเจน สถานะที่เลือกใช้ทั้ง radio และเส้นขอบ ปุ่ม disabled มีสีคงที่แม้ hover
- ใช้ tokens เดิมสำหรับ contrast และ layout ที่ยืดหยุ่น; ตรวจไม่มี horizontal overflow ที่ 320, 375, 390, 768 และ 1440px

## การแปลผลและสิ่งที่คงไว้

คำถามภาษาไทยทั้ง 8 ข้อตรงกับไฟล์ข้อกำหนดทุกตัวอักษร แยกข้อมูลออกจาก UI และเพิ่มภาษาอังกฤษเพื่อรองรับตัวเลือกภาษาของโปรเจกต์เดิม

ไม่มี scoring logic ของแบบคำถาม 8 ข้อนี้อยู่ในโปรเจกต์ จึงแสดงเฉพาะคำตอบที่ยืนยันแล้วพร้อม disclaimer และคำแนะนำให้ปรึกษาบุคลากรทางการแพทย์เมื่อมีข้อกังวล ไม่สร้างคะแนน cutoff การจัดความเสี่ยง หรือคำวินิจฉัยขึ้นใหม่

คงเกณฑ์ Mini-Cog, MMSE, dashboard และการบันทึกประวัติเดิม เพราะเป็นคนละเครื่องมือและผู้ใช้กำหนดให้รักษา logic เดิมไว้ ไม่เชื่อมคำตอบใหม่เข้ากับคะแนนของเครื่องมือเหล่านั้น และไม่แก้ส่วน EEG, เกม หรือระบบบัญชีนอกจุดที่เชื่อม UI

## ผลตรวจ

- `npm run lint:assessment`: ผ่าน; ครอบคลุม components/model ใหม่และไฟล์ทดสอบ/การตั้งค่าที่เพิ่ม
- `npm run typecheck`: ผ่าน; ตรวจ JavaScript/JSDoc ของแบบประเมินใหม่ด้วย strict TypeScript และไม่เปลี่ยนโปรเจกต์เป็น TypeScript
- `npm run build`: ผ่าน
- `npm test`: ผ่าน 47 tests รวม state tests ใหม่ 4 tests, diagnostics ของ Muse และ API tests เดิม
- `npm run test:browser`: ผ่าน 8 tests ทั้ง development และ production build ครอบคลุมครบทั้ง 5 scenarios ที่ร้องขอ รวม keyboard เปลี่ยนภาษา และความคืบหน้าที่ไม่ถูก sticky header บัง
- Axe: ไม่พบ WCAG 2 A/AA และ WCAG 2.1 AA violations ในขั้นคำชี้แจง ผู้ตอบ คำถาม Review และ Result ที่ทดสอบ
- ตรวจเทียบคำถามกับไฟล์ข้อกำหนด: ตรงครบ 8 ข้อ
- `git diff --check`: ผ่าน
- `npm run lint` ทั้งโปรเจกต์: พบ 93 errors และ 3 warnings เดิมใน components เช่น `ResearchSession`, `AdminPanel` และ `BleDevicesPanel`; ส่วนใหญ่เป็นกฎเกี่ยวกับ refs และ setState ใน effect ตรวจเทียบ `app/page.js` ก่อน/หลังแล้วไม่มี lint errors ทั้งสองเวอร์ชัน ไฟล์ที่มี errors เป็นไฟล์เดิมที่ไม่ได้เปลี่ยนในงานนี้ จึงไม่ refactor ระบบวิจัยนอกขอบเขต

Browser tests mock เฉพาะ session และ config โดยใช้ components และ navigation จริง ไม่มีการสร้างบัญชีหรือเขียนข้อมูลสุขภาพไปยัง backend การตรวจอัตโนมัติไม่แทนการทดลองใช้กับผู้สูงอายุหรือการทดสอบด้วย screen reader จริง

การแก้ Muse console error ภายหลังเพิ่ม `tests/browser/muse-connection.spec.mjs` ที่จำลอง Web Bluetooth เฉพาะใน tests และตรวจ GATT, service discovery และ EEG startup failures พร้อม manual retry ผ่านทั้ง 3 กรณีบน production build รวม browser suite ล่าสุดผ่าน 11 tests แยก name/message/stage เป็นข้อมูลที่อ่านได้ และไม่เปิด console-error overlay สำหรับ device failure ที่จัดการใน UI แล้ว ยังไม่ได้ยืนยันการเชื่อมต่อกับ Muse จริง คำสั่ง `test:browser` ใช้ CLI ของ `@playwright/test` โดยตรงเพื่อไม่ให้โหลด test runner ซ้ำจากไฟล์ค้างเมื่อสลับ npm กับ pnpm

สำหรับเครื่องใหม่ ติดตั้งด้วย `npm ci` แล้วใช้ `npx playwright install chromium` ก่อน `npm run test:browser` หากมี Chromium ที่ติดตั้งไว้แล้ว ใช้ `ASSESSMENT_CHROMIUM_PATH` ชี้ executable ได้ และใช้ `ASSESSMENT_BASE_URL` เพื่อทดสอบ server ที่เปิดไว้แล้ว ภาพหน้าจอแต่ละช่วงอยู่ใน `test-results/` ซึ่งไม่ติดตามใน Git
