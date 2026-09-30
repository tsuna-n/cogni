# แก้ปัญหาและตรวจรับระบบ

[สารบัญคู่มือ](README.md) · [ขั้นตอนทดลอง](user-manual.th.md) · [EEG/CSV](eeg-and-data.th.md) · [DB](database-admin.th.md)

## 1. พบ Muse แต่เชื่อมไม่ได้

ชื่อ Muse-703D ใน chooser หรือ OS Paired ยังไม่แปลว่าเว็บเปิด GATT/service/EEG ได้ หากมีรอบอยู่จบและ export ก่อน reload จากนั้นปิดแอป Muse/โปรแกรมอื่นที่เชื่อมเครื่องเดียวกัน เปิด Bluetooth ปิด/เปิด Muse อยู่ใกล้เครื่อง เปิดเว็บ HTTPS/localhost ด้วย browser ที่มี Web Bluetooth กด Ctrl+Shift+R เพื่อโหลดโค้ดล่าสุด กด Connect เลือกเครื่องและ Pair

ถ้ายังไม่ได้เปิด “รายละเอียดการเชื่อมต่อ” ดู Device, Stage, UUID และ Error:

| Stage/อาการ | ความหมาย | ตรวจต่อ |
| --- | --- | --- |
| ยกเลิก chooser | ยังไม่ได้ device | กดใหม่และเลือก ไม่ใช่ service failure |
| gatt/NetworkError | Device พบแต่ connect ไม่ผ่าน | แอปอื่น เครื่อง/Bluetooth ระยะ power cycle |
| service | GATT ถึงแต่ Muse service ไม่เปิด | รุ่น Classic/UUID/แอปอื่น; code retry discovery สามครั้งแล้ว |
| control | Control characteristic เปิดไม่ได้ | UUID/protocol/permissions และ browser error |
| eeg | EEG ช่องใดไม่พบ | UUID ของช่องขาด ไม่ใช้ partial แทนสี่ช่อง |
| notifications | พบ characteristic แต่เปิด notify ไม่ผ่าน | capability/connection/browser message |
| start | ขั้นตอนเริ่ม EEG/คำสั่ง driver ผิดพลาด | Bundle/error/เครื่องยัง connected |
| SecurityError/NotAllowedError | สิทธิ์ Bluetooth ไม่ผ่าน | เลือก/อนุญาต origin และ device ใหม่ |

Classic adapter ใช้ control + สี่ EEG ไม่บังคับ IMU/telemetry ที่แอปไม่ใช้ ไม่ต้องเพิ่ม optional sensor เพื่อให้ EEG ทำงาน Driver ไม่รองรับทุก protocol ของ Muse รุ่นอื่น

## 2. Web Bluetooth ไม่มี

ตรวจ secure context และ navigator.bluetooth ใช้ HTTPS หรือ localhost แทน HTTP ผ่าน LAN IP ที่ไม่ secure ข้อความช่วยในโค้ดแนะนำ Chrome/Edge คอมพิวเตอร์/Android; browser ในแอป/platform ไม่มี API จะใช้รับ EEG ไม่ได้แม้ Dashboard ได้

Chrome Linux มีข้อความช่วยเรื่อง flags ในโค้ด แต่ชื่อ/ความพร้อมขึ้นกับ browser build ให้ตรวจเครื่องจริง ไม่ถือว่ามี flags เหมือนกันทุก version หาก dynamic driver chunk โหลดไม่ได้ดู Network/load รุ่นล่าสุดแล้วลอง Connect ใหม่ Driver bundle อยู่กับแอป ไม่ใช้ CDN

## 3. Connected แต่เริ่มรอบไม่ได้

| อาการ | ตรวจ |
| --- | --- |
| รอ EEG 4 ช่อง | TP9/AF7/AF8/TP10 ต้องมีค่าล่าสุดอัปเดต Connected อย่างเดียวไม่พอ |
| รอข้อมูลหนึ่งวินาที | อย่างน้อย 256 finite sample ต่อช่องในหน้าต่างล่าสุดสามวินาที |
| ชนขอบ | ตรวจ contact/fit ทดสอบใหม่ เริ่ม research block ถ้าช่องใด rail ≥1% |
| Signal lost | ช่องใดหายเกินสามวินาที recorder หยุด reconnect/retry เกมเดิม |
| Config fail | ตรวจ /api/config/backend แม้จอรับสดยังอยู่ก็ start ไม่ได้ |
| Storage ไม่พร้อม | IndexedDB/site permissions/พื้นที่/แท็บอื่น |
| ฟอร์มไม่ครบ | Participant/base session/group/consent และ Task ถูกช่วง |
| รอบเดิมค้าง | ตรวจ recovery/export แล้วใช้ retry/new ตามปุ่ม |

ค่า µV ติดลบ/บวก/drift ไม่ใช่คะแนนความจำ 50 Hz เป็น heuristic ให้ตรวจเซนเซอร์และ environment ไม่ได้แก้ raw โดย filter และไม่พิสูจน์สาเหตุด้วยตัวเอง

## 4. หยุดเอง/Next ปิด/เกมไม่เริ่ม

ซ่อนแท็บ/minimize/pagehide ทำให้ hidden ออกจากหน้าเกมระหว่าง Task ทำให้ task_screen_left เครื่อง disconnect/ช่องหายมีสถานะตามสาเหตุ Partial raw export ได้หลังบันทึกสำเร็จ

Next ถัดไปต้อง complete และ save ลง IndexedDB พร้อมเกมก่อนหน้าครบ sequence/account เดียวกัน รอบไม่ครบต้อง retry เกมเดิม Practice ไม่ปลดล็อก ถ้าเกมไม่เปิด/ไม่มี game-start marker จะเป็น task_not_started ตรวจ console และ event integration

Storage_error ปิด Next อย่า refresh ทิ้งข้อมูลใน memory ส่งออกที่ยังมีเท่าที่ทำได้ ตรวจไฟล์และแก้ storage ก่อนเริ่มใหม่

## 5. ไม่เห็นข้อมูล/ข้อมูลหาย

| สถานการณ์ | เหตุที่ควรตรวจ |
| --- | --- |
| เก็บ localhost แต่เปิด Production | Origin ใช้ IndexedDB คนละชุด |
| Account เดิม แต่ browser/OS profile ใหม่ | Local ไม่ย้ายตาม login |
| เปลี่ยน localhost port | คนละ origin |
| Server summary อยู่แต่ raw หาย | Sync ไม่ upload raw อาจ prune/clear site data |
| ประวัติเดิมมีแต่ Dashboard profile ไม่มี | localStorage assessment ไม่ import profile |
| Admin ไม่เห็น raw ของคนอื่น | Local filter owner ส่วน staff รวมอ่านเฉพาะ synced summary |
| รอบเก่าไม่มี owner | Admin บนเครื่องเดิมต้อง review/claim ไม่ auto sync |

Clear site data อาจลบ IndexedDB/localStorage ต่างจากแค่ล้าง static cache Neon ไม่มี raw ให้คืน ต้องใช้ CSV backup

## 6. Pending sync/Admin ไม่เห็นรอบ

1. Login เจ้าของบน browser/origin เดิม เปิดรายการรอบ ตรวจ finalized
2. กดซิงก์ผลสรุปอีกครั้ง อ่าน error ของรอบ
3. 401 login ใหม่; 403 ตรวจสิทธิ์/origin; 503 DB; 400 detail validation; 409 เจ้าของ/participant ของ UUID
4. เมื่อ synced เปิด results/Admin refresh และตรวจตัวกรอง

User ส่ง summary ตนเองได้ แค่ export raw ไม่ทำให้ Admin เห็นหาก sync fail Staff กรองบัญชีด้วย uploader OR profile participant ID ส่วน Admin ค้น participant ID โดยตรง ตรวจค่าทั้งสามเมื่อผลต่างจากคาด

## 7. Login/Register/role

| อาการ | ตรวจ/แก้ |
| --- | --- |
| Register ไม่มี | REGISTRATION_ENABLED ของ deployment; default production ปิด |
| สมัครไม่เป็น staff | Register user ตามนโยบาย เปลี่ยนผ่าน DB |
| INSERT แล้ว password ไม่ผ่าน | password_hash ต้อง hashPassword ของแอป ไม่ใช่ plaintext/DB password |
| Role เปลี่ยนแต่เมนูเดิม | DB environment/commit transaction แล้ว reload/login API อ่าน role ใหม่ทุกครั้ง |
| Local login ไม่ได้แต่ Production ได้ | Accounts JSON/DB URL คนละ store |
| Redeploy แล้ว session หาย | SESSION_SECRET คงที่/≥32, cookie origin/Secure/expiry |
| 429 | รอ Retry-After IP เดียวแชร์ bucket |
| บัญชีถูกลบ | Cookie ยังมีแต่ authorize ไม่พบ |

ไม่มี email verification/reset link/password UI ใช้ DB workflow ที่ระบุ

## 8. Profile conflict/validation

Profile_conflict คือ revision เก่า จดค่าที่ต้องการ โหลดล่าสุดตรวจอีกคนแก้ แล้ว merge ใหม่ ไม่ฝืน expectedUpdatedAt เพื่อทับ Invalid_body ตรวจอายุ integer 10–120, คะแนน integer/max, education ก่อนคะแนน, none สองด้านที่ปิดไม่ >0, notes ≤2,000 และไม่ส่ง email/role/password ใน body

แก้ SQL ต้องเปลี่ยน profile revision metadata ด้วย มิฉะนั้น draft เก่าอาจเขียนทับ ใช้ Dashboard เพื่อ validation/metadata อัตโนมัติ

## 9. Config/storage/deploy

Vercel ต้องมี DATABASE_URL/SESSION_SECRET ใน environment ที่ deployment ใช้ 503 storage อาจเกิด network/credentials/DB privileges/schema init ไม่ใช่ password เว็บผิดเสมอ ตรวจ public config ใน local:

```bash
curl -fsS http://localhost:3000/api/config
```

ควรได้ registrationEnabled/study หาก invalid_server_config ตรวจ true/false, secret length, study ranges/protocol และ saved config Saved settings มีลำดับก่อน env ใหม่ Push success แต่เว็บไม่เปลี่ยนให้ตรวจ Vercel commit/branch/domain และ reload หลังจบรอบ Deploy fail อ่าน logs ของงานนั้น

Local EACCES/EROFS/ENOSPC ตรวจ directory/permissions/พื้นที่ ไม่ใช้หลาย server เขียน JSON ชุดเดียวกัน

## 10. CSV error

Validator ใช้ raw EEG CSV ไม่ใช้ assessment/summary ซึ่ง header ต่างกัน:

| Report | วิธีอ่าน |
| --- | --- |
| Missing EEG channel | Recording ไม่มีข้อมูลครบช่อง |
| Complete missing phase marker | State/marker ไม่สอดคล้องต้องตรวจ workflow |
| Gap/duplicate | Integrity ตาม index/arrival |
| Rail/nearRail | ADC clipping ตรวจคุณภาพ |
| 50 Hz | Heuristic สองวินาทีตรวจสัญญาณ/สภาพแวดล้อม |
| Response ไม่มี stimulus/ซ้ำ | Marker pairing หรือเกมรับซ้ำ |
| Unanswered trials | สิ่งเร้าไม่ตอบ รวม deadline cut วิเคราะห์แยก |
| Incomplete | ไม่มี session_complete ตรวจ stop marker |

Exit 0 ยังมี warnings ได้ อย่าเปลี่ยน marker ด้วยมือให้ดู complete เก็บ original ก่อนเปิด spreadsheet แล้ว save ใหม่ซึ่งอาจเปลี่ยนเวลา/เลข/encoding

## 11. ตรวจรับก่อนเก็บจริงและหลังแก้โค้ด

รายการนี้เป็นขั้นตอนทดสอบ ไม่ใช่รับรอง hardware ทุกเครื่อง ใช้ fixture/environment ทดสอบ:

| งาน | ผลที่ต้องเห็น |
| --- | --- |
| Signup role ปลอม | Store/response ยัง user |
| User เรียก staff/admin API | 403 ไม่มีข้อมูลคนอื่น |
| Researcher profile | ดู/แก้ได้ ไม่มี credential fields/role editor |
| Researcher admin API | 403 |
| Admin save/reset | Effective config/source ใหม่ รอบใหม่ใช้ |
| เปลี่ยน role หลัง login | API authorize role ใหม่ |
| สอง profile drafts | revision เก่า 409 |
| Classic Muse | สี่ EEG ไม่บังคับ IMU/telemetry |
| พบ device แต่ service ไม่พบ | Found/service stage/UUID ไม่อ้างว่าเครื่องหาย |
| Disconnect/retry | รับครบใหม่ ไม่มี chooser/subscription ซ้ำ |
| Device check | 5+5+5s test_mode=true ไม่มีเกม |
| สามเกม | G1/G2/G3 แยก UUID/raw Next รอ Rest/save |
| Double response | หนึ่ง response/trial |
| Echo RT | เริ่มที่ response prompt หลัง display |
| Hidden/channel loss/game leave | หยุดและมี partial export |
| Reload รอบค้าง | Interrupted/retry เดิม |
| Summary sync | Uploader/summary ไม่มี raw arrays |
| CSV | Header/phase/counts/validator ตรงประเภทไฟล์ |
| Prune/delete | Local raw หาย summary ตามปุ่ม server summary ไม่ถูกลบ |
| Thai/English/mobile | ปุ่ม/form/table/details ใช้งานไม่ล้น |
| Offline/config fail | Block start ใหม่ Pending data อยู่ local |

เก็บผล automated tests, CSV report และ hardware แยกกัน การยืนยัน EEG ครบสี่ช่องจริงยืนยัน stream ของการทดสอบนั้น ยังต้องตรวจ quality/timing ตามโครงการ

## 12. รายงานปัญหา

ให้ลำดับปุ่ม/เมนู origin/browser/OS รุ่น Muse role phase/status protocol และ participant/session/record ID พร้อม Stage/UUID/Error หรือ HTTP/error/detail ถ้าเป็น CSV แนบ report ที่อนุญาตให้แชร์ ไม่ต้องส่ง password/cookie/session secret/DB URL เพื่อแยกสาเหตุ ผู้ดูแลตรวจ credentials จากช่องทางของ environment เอง
