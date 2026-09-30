# ติดตั้ง ตั้งค่า ทดสอบ และ deploy

[สารบัญคู่มือ](README.md) · [โครงสร้างและ API](architecture-and-api.th.md) · [DBeaver](database-admin.th.md) · [แก้ปัญหา](troubleshooting.th.md)

## 1. เปิดโปรเจกต์

ต้องมี Git, Node.js และ npm คู่มือ Next ที่ติดตั้งระบุขั้นต่ำ Node 20.9 สำหรับ standalone ESM scripts, `--env-file` และชุดทดสอบในบทนี้ให้ใช้ Node 22.18 ขึ้นไป สภาพแวดล้อมที่ตรวจโปรเจกต์งานนี้ใช้ Node 26.10.0

```bash
git clone https://github.com/tsuna-n/cogni.git
cd cogni
npm ci
cp settings.example.env .env.local
npm run dev
```

เปิด `http://localhost:3000` ถ้า port ถูกใช้ Next อาจเลือก port อื่น อ่าน terminal ก่อนเข้าเว็บ port/origin ต่างกันใช้ IndexedDB/localStorage คนละชุด แก้ `.env.local` ก่อนใช้งาน ไฟล์ตัวอย่างตั้ง Register ปิดและไม่มี DB/secret จริง หากต้องสมัคร local ตั้ง `REGISTRATION_ENABLED=true` แล้ว restart ส่วน staff สร้าง/กำหนด role ใน store ตามบทฐานข้อมูล

มีทั้ง npm/pnpm lockfiles ใช้ pnpm dev/build/start ในเครื่องได้ แต่ Vercel ระบุ `npm ci` จึงใช้ package-lock เป็นแนวทางตรวจ reproducible install ก่อนปล่อย เพิ่ม dependency แล้วตรวจ lockfiles ที่ทีมใช้ให้สอดคล้องกัน

## 2. Local JSON กับ Neon

ถ้า DATABASE_URL ว่างและไม่อยู่บน Vercel ใช้ไฟล์ใน `data/` หรือ directory override:

```text
data/
  users.json
  research-summaries.json
  study-settings.json
  session-secret
```

ไฟล์เกิดเมื่อมีการใช้งานที่เกี่ยวข้อง ไม่ต้องมีครบตั้งแต่แรก users เป็น object keyed by email; summary รูป `{version:1,records:[...]}`; settings รูป `{version:1,study:{...}}` Secret local ถูกสร้างถ้าไม่ได้กำหนด environment secret

เปลี่ยน role ใน JSON ให้หยุด server แก้เฉพาะ `role` ของบัญชีเป้าหมายเป็น researcher/admin คง email/passwordHash/profile/metadata แล้วเปิด serverใหม่ อย่าแก้ขณะมี write queue โหมด disk ไม่มี lock ระหว่างหลาย process จึงใช้ single local server

ตั้ง DATABASE_URL แล้วจะใช้ Neon ที่ URL ระบุ แม้หน้าเป็น localhost ถ้า URL เป็น Production local API ก็อ่าน/แก้ Production จริง Raw EEG ยังคงเก็บใน origin localhost ไม่ถูกย้ายไป Production browser storage

## 3. Environment

| Variable | Default/เงื่อนไข | หน้าที่ |
| --- | --- | --- |
| `DATABASE_URL` | ไม่กำหนดใช้ local JSON; จำเป็นบน Vercel | Neon connection string |
| `SESSION_SECRET` | local สร้างไฟล์ถ้าไม่กำหนด; จำเป็นบน Vercel | เซ็น cookie; production/Vercel ต้อง ≥32 ตัวอักษร |
| `REGISTRATION_ENABLED` | true ใน development, false ใน production หากไม่กำหนด; example ตั้ง false | เปิด/ปิด ordinary signup ต้อง true/false ตรงตัว |
| `COGNILOAD_DATA_DIR` | `./data` | directory ของ JSON/secret |
| `RESEARCH_DATA_DIR` | ไม่กำหนด | legacy summary directory; COGNILOAD_DATA_DIR มีลำดับก่อน |
| `STUDY_BASELINE_SECONDS` | 30 | integer 1–300 |
| `STUDY_POST_TASK_SECONDS` | 30 | integer 1–300 |
| `STUDY_MAX_TASK_SECONDS` | min(540,600−baseline−rest) | integer ≥5 ไม่เกินเวลาที่เหลือ |
| `STUDY_DEFAULT_TASK_SECONDS` | min(60,maxTask) | integer 5–maxTask |
| `STUDY_PROTOCOL_VERSION` | alz_web_games_v1 | รหัส 1–64 ตาม validator |
| `NODE_ENV` | คำสั่ง Next กำหนด | signup default/Secure cookie/secret validation |
| `VERCEL` | Platform กำหนด | บังคับ persistent DB/secret และใช้ forwarded IP |

ADMIN_USERS, RESEARCHER_USERS และ DEMO_USERS ไม่สร้างบัญชี/เพิ่มสิทธิ์ `DATABASE_URL_UNPOOLED` ถ้ามีใช้กับ DB client แต่แอปไม่เลือกค่านี้เอง Secrets ไม่ใช้ prefix NEXT_PUBLIC ซึ่งทำให้ส่งไป browser

สร้าง signing secret แล้วนำผลไปใส่ environment ส่วนตัว:

```bash
openssl rand -base64 32
```

`data/`, `.env*`, `.vercel/` อยู่ใน .gitignore อย่า commit credentials จริง ไฟล์ตัวอย่าง settings.example.env ไม่มี secret

## 4. การตั้งค่า study และ protocol

ลำดับค่าคือ saved DB/JSON settings → environment → defaults ใน code หากเคยบันทึกผ่าน Admin การแก้ STUDY_* env ไม่เปลี่ยน effective config จนกดคืนค่าเซิร์ฟเวอร์หรือแก้ saved settings

Client โหลด `/api/config` ครั้งแรก เมื่อ focus และ settings update ก่อนเริ่มแต่ละรอบตรวจอีกครั้ง ถ้าอ่านไม่ได้ block start รอบ active เก็บ durations/protocol ที่เริ่มไว้ รอบเก่าไม่เปลี่ยนตาม config ใหม่ แต่เกมถัดไปตรวจใหม่ จึงหลีกเลี่ยงเปลี่ยนกลาง sequence

Baseline+Rest ต้องเหลือ Task อย่างน้อยห้าวินาทีภายใน 600 วินาที ค่า 300+300 ใช้ไม่ได้แม้แต่ละค่าไม่เกิน max เปลี่ยน procedure แล้วเปลี่ยน protocolVersion ตามโครงการ ไม่มี settings history ใน DB จึงบันทึกเหตุผล/ประวัติแยก

## 5. Production build ในเครื่อง

```bash
npm run build
npm run start
```

Build ก่อน start อย่ารัน dev/start port เดียวกัน หากจะแยก port:

```bash
npm run start -- --port 3100
```

Production เปิด Secure cookie ตรวจ auth บน localhost/HTTPS ที่เหมาะสม หาก build fail จาก font/network ให้ตรวจ `next/font/google` และ logs ของ build ก่อนแก้ config ไม่มี custom Next config หลาย environment ใน repository

## 6. ชุดทดสอบ

package.json มี dev/build/start ไม่มี npm test/lint script ใช้ Node test runner:

```bash
node --test --test-isolation=none tests/*.test.mjs
```

| กลุ่ม | สิ่งที่ตรวจ |
| --- | --- |
| access-rules/access-api/researcher-config | Stored roles, ordinary signup, revoke/delete, staff/user API และ credential fields |
| user-profile/user-overview | Profile validation/revision/MMSE/age/filter/empty data |
| game-sequence/local-ownership | ลำดับ/durable save/retry/owner และไม่ปะปน sequence/test |
| muse-connection | Classic ไม่บังคับ IMU, decoder/time, discovery retry, missing channel และ cleanup |
| research-summary/admin-research | Actual times/counts/game/ownership conflict |
| server-config/study-settings | Defaults/ranges/600-second ceiling/save/reset |
| serverless-storage/local-json-migration | Parameterized SQL, Vercel ไม่ fallback และ import ไม่ทับ rows |

API test ใช้ fixtures/temp directories และเปิด server ของ test มีขั้นตอน build จึงนานกว่า unit test หลีกเลี่ยง run พร้อมงานที่ใช้ `.next` เดียวกันหาก output ชน ตัวอย่างตรวจเฉพาะ Muse:

```bash
node --test --test-isolation=none tests/muse-connection.test.mjs
```

Tests ไม่วัด hardware จริง ต้องตรวจ chooser, EEG สี่ช่อง, retry/disconnect, สามเกม/CSV, mobile/ภาษา และสิทธิ์ API แยกตาม [รายการตรวจรับ](troubleshooting.th.md)

เมื่อรัน standalone scripts อาจเห็น MODULE_TYPELESS_PACKAGE_JSON warning เพราะ package.json ไม่ได้ตั้ง type=module แต่ไฟล์ .js ของ lib ใช้ ESM Node รุ่นที่ระบุสามารถตรวจ module syntax ได้ Warning นี้ไม่ใช่ผลว่า command สำเร็จหรือล้มเหลว ให้ดู exit code/output ไม่เปลี่ยน package type เพียงเพื่อซ่อน warning โดยไม่ตรวจ Next และ dependencies

## 7. Vercel และ Neon

Repository งานนี้คือ tsuna-n/cogni main ที่ผูก autodeploy สำหรับ environment ใหม่:

1. Import repository ใน Vercel ใช้ root app และ Next framework ตรวจ installCommand npm ci
2. เชื่อม Neon/ฐานข้อมูลของ Production และใช้ Preview DB/branch แยกตามงาน
3. ตั้ง DATABASE_URL, SESSION_SECRET คงที่ ≥32 และ REGISTRATION_ENABLED ใน environment ที่ถูกต้อง
4. ตั้ง STUDY_* defaults ถ้าต้องการ แล้ว deploy/redeploy ให้รับ env ใหม่
5. เปิด /api/config ตรวจ config/login/storage และเพิ่ม staff/role ผ่าน DBeaver ของฐานนั้น
6. ตรวจ Dashboard/Admin ตาม role และรับ EEG จริงก่อนใช้งานเก็บข้อมูล

Schema first use ต้องมี PostgreSQL privileges ให้ CREATE/ALTER/INDEX ตาม server-database.js หากไม่พอจะ initialize ไม่สำเร็จ ไม่ใช่รหัสผ่านบัญชีเว็บผิด Preview/Production/Development variables ไม่เท่ากันโดยอัตโนมัติ เปลี่ยน env ไม่ย้ายข้อมูลให้ เปลี่ยน secret ทำให้ cookie เดิม verify ไม่ผ่าน

## 8. Commit, push และ autodeploy

ตัวอย่างสำหรับเอกสาร เลือกไฟล์ตามงานจริงและตรวจไม่มี JSON/CSV/secret ที่ใส่ผิดที่:

```bash
git status --short
git diff --check
git diff
git add docs README.md
git diff --cached --stat
git commit -m "docs: add Thai system manual"
git push origin main
```

Push main เริ่ม Production autodeploy เมื่อผูก integration แล้ว ผล push success ยังไม่แปลว่า deploy success ตรวจ GitHub commit/Vercel status หรือ CLI ที่ login แล้ว:

```bash
gh api repos/tsuna-n/cogni/commits/main/status --jq '{state,statuses:[.statuses[]|{context,state,description,target_url}]}'
```

ถ้ามี push หลายคนใช้ SHA เป้าหมายแทน main รอ Vercel success แล้วเปิด deployment/domain/environment ถูกอันตรวจหน้าและ API หาก pending รอรายการเดิม หาก fail อ่าน logs ของ deployment นั้น

## 9. ย้าย JSON เข้า Neon

Script นำเข้า users, server summaries, saved settings ไม่รวม IndexedDB/localStorage/CSV ต้องมีไฟล์ local จริงและ backup ก่อน apply

```bash
node scripts/migrate-local-json.mjs
```

คำสั่งนี้ dry run อ่าน directory จาก process.env แล้วพิมพ์ counts ไม่เขียน Neon หาก custom dir ให้ตั้ง COGNILOAD_DATA_DIR/RESEARCH_DATA_DIR ถูกต้อง ถ้าไฟล์ไม่มีจะนับศูนย์ อย่า apply เมื่อ counts ผิดคาด

Next โหลด `.env.local` แต่ standalone script ไม่เรียก Next loader ใช้ Node ที่รองรับ --env-file หรือ environment ของ shell/process manager ที่ตั้งแล้ว:

```bash
node --env-file=.env.local scripts/migrate-local-json.mjs
node --env-file=.env.local scripts/migrate-local-json.mjs --apply
```

ตรวจ URL เป้าหมายและ counts ก่อน apply อย่าใส่ URL มี credentials ใน command history Script ตรวจรูป JSON/version/account mapping แล้ว INSERT missing rows ด้วย ON CONFLICT DO NOTHING คง role/profile/metadata/uploader/time ตาม JSON และไม่ทับข้อมูล DB เดิม

ไม่มี transaction ใหญ่ครอบ import ทั้งหมด หากหยุดกลางทางรันใหม่เติม missing ได้ Script ไม่ normalize profile/summary เต็มแบบ API ต้องตรวจข้อมูลเดิมโดยเฉพาะที่แก้มือ เมื่อเสร็จตรวจ counts/login/สิทธิ์/profile/summary/effective config ของ target ก่อนเลิกใช้ไฟล์ local

## 10. Backup, retention, rollback

| งาน | วิธี/ผลกระทบ |
| --- | --- |
| Neon backup | DB/native backup รวม schema/data และตรวจ restore ในฐานทดสอบ |
| JSON backup | หยุด server คัดลอก directories และ session-secret |
| Browser backup | Export raw EEG ของแต่ละเกม, summary และ assessment ถ้าใช้ |
| ลดพื้นที่ browser | Prune raw หลังตรวจ CSV; คง summary |
| Server retention | ไม่มี UI delete ผู้ดูแลจัดการตาม record IDs และนโยบาย |
| Code rollback | Revert/deployment rollback ไม่ rollback Neon data |
| Data rollback | Restore backup ที่เลือก ต้องประเมินข้อมูลใหม่หลัง backup |

Code rollback รุ่นเก่าอาจไม่รองรับ schema/roles/profile ใหม่ ตรวจความเข้ากันก่อน Database dump ไม่มี browser raw การส่งมอบต้องมี repository/commit, env ที่เก็บแยก, DB backup และ CSV ของเครื่องเก็บข้อมูล

## 11. ดูแลประจำและส่งต่อผู้รับช่วง

ก่อนเก็บข้อมูลตรวจ config/protocol, browser/device test/CSV, พื้นที่เครื่อง และ DB sync หลังแต่ละชุดตรวจ complete กับ quality แยกกัน ส่งออก raw และตรวจ pending sync ก่อนปิดเครื่อง

เมื่อมีปัญหาเก็บ commit/deployment, origin/browser/OS, role, participant/session/record ID, Stage/UUID/Error Bluetooth หรือ HTTP/error API โดยไม่ส่ง passwords/cookie/secrets ผู้รับช่วงต้องเข้าใจว่า ML demo, raw cloud storage, participant table แยก, password-reset UI, profile/settings history และ offline backend ยังไม่ได้พัฒนาเป็น workflow จริง
