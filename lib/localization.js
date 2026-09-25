import { TH } from "./th-dict.js";

// Keys are the original Thai UI copy. Keep saved research data and CSV fields
// independent of this display-only dictionary.
const EN = {
  "กำลังตรวจสอบเซสชัน…": "Checking session…",
  "ห้องทดลอง EEG": "EEG research workspace",
  "ตั้งค่ารอบทดลอง เชื่อมต่อ Muse บันทึกสัญญาณจริง และส่งออกข้อมูลพร้อม marker": "Set up a session, connect Muse, record live signals, and export data with event markers.",
  "เตรียมรอบทดลอง": "Set up a research session",
  "ใช้รหัสแทนชื่อจริง ตั้งเงื่อนไข และบันทึกความยินยอมตามเอกสารโครงการ": "Use participant IDs instead of names, set the condition, and confirm consent under your study protocol.",
  "รหัสผู้เข้าร่วม *": "Participant ID *",
  "รหัสรอบทดลอง *": "Session ID *",
  "กลุ่มวิจัย *": "Study group *",
  "เลือกกลุ่ม": "Select a group",
  "เกมในช่วง Task *": "Task game *",
  "เงื่อนไขการทดลอง": "Study condition",
  "วินาที": "seconds",
  "วินาทีสูงสุด": "seconds maximum",
  "EEG บันทึกต่อเนื่อง: พักนิ่ง 30 วินาที → ทำกิจกรรมจนกว่าจะกดจบหรือครบเวลาที่ตั้ง → พักหลังงานอีก 30 วินาที · หนึ่งเกมต่อหนึ่งรอบ · เวลารวมสูงสุด 600 วินาที": "Continuous EEG recording: 30 seconds of baseline → task until completed or timed out → 30 seconds of rest. One game per session; maximum total time is 600 seconds.",
  "ผู้วิจัยยืนยันว่าได้รับความยินยอมตามขั้นตอนของโครงการแล้ว": "I confirm that consent was obtained under the study protocol.",
  "ดำเนินการทดลอง": "Run the experiment",
  "EEG บันทึกตลอด Baseline 30 วินาที → Task → Rest 30 วินาที · เกมเปิดเองเมื่อเริ่ม Task": "EEG is recorded through a 30-second baseline, the task, and a 30-second rest. The game opens when the task starts.",
  "● EEG ครบ 4 ช่อง · ตรวจสัมผัสเซนเซอร์": "● All 4 EEG channels active · check sensor contact",
  "● EEG ครบ 4 ช่อง": "● All 4 EEG channels active",
  "○ รอ EEG ครบ 4 ช่อง": "○ Waiting for all 4 EEG channels",
  "ครบตามแผนการทดลอง": "Session complete",
  "รอบไม่สมบูรณ์ · ข้อมูลบางส่วน": "Incomplete session · partial data",
  "พร้อมตั้งค่าการทดลอง": "Ready to set up a session",
  "ยังไม่มีข้อมูลในรอบนี้": "No data for this session yet",
  "เริ่มบันทึกการทดลอง": "Start research recording",
  "ทดสอบอุปกรณ์ 15 วินาที": "Test device for 15 seconds",
  "หยุดและเก็บข้อมูลที่มี": "Stop and keep recorded data",
  "ส่งออก EEG + markers (.csv)": "Export EEG + markers (.csv)",
  "เริ่มรอบใหม่": "Start a new session",
  "เชื่อมต่อ Muse": "Connect Muse",
  "ชื่อ marker": "Marker name",
  "เพิ่ม marker": "Add marker",
  "รอบทดลองที่เก็บในเครื่อง": "Sessions saved on this device",
  "ข้อมูลอยู่ในเบราว์เซอร์นี้เท่านั้น ส่งออกและตรวจไฟล์ก่อนลบ": "Data is stored in this browser only. Export and check the file before deleting it.",
  "ผลสรุปแต่ละรอบอยู่ใน Dashboard และยังคงอยู่เมื่อลบ EEG ดิบหลังส่งออก CSV": "Each session summary is available on the dashboard and remains after raw EEG is removed following CSV export.",
  "ข้อมูล EEG จะบันทึกในเบราว์เซอร์นี้ โปรดส่งออก CSV เพื่อสำรองข้อมูล": "EEG data is saved in this browser. Export a CSV to back it up.",
  "กำลังตรวจสอบที่เก็บข้อมูลในเบราว์เซอร์": "Checking browser storage…",
  "ภาพรวมรอบทดลอง EEG": "EEG session overview",
  "แสดงเฉพาะรอบทดลองที่บันทึกครบและไม่ใช่การทดสอบอุปกรณ์ · ข้อมูลอยู่ในเบราว์เซอร์นี้": "Shows completed sessions excluding device tests. Data remains in this browser.",
  "อัปเดตกราฟ": "Refresh charts",
  "รอบที่บันทึกครบ": "completed sessions",
  "รอบล่าสุด": "latest session",
  "EEG samples รอบล่าสุด": "EEG samples in latest session",
  "กราฟแท่ง · EEG samples แยกช่อง": "Bar chart · EEG samples by channel",
  "จำนวนตัวอย่างของรอบล่าสุดที่บันทึกครบ": "Sample counts from the latest completed session",
  "กราฟวงกลม · เวลาของแต่ละช่วง": "Pie chart · phase durations",
  "เวลาที่เกิดขึ้นจริงในรอบล่าสุด": "Actual durations in the latest session",
  "กราฟเส้น · อัตราตัวอย่าง EEG ตามรอบทดลอง": "Line chart · EEG sample rate by session",
  "ค่าเฉลี่ยต่อช่อง (Hz) ของรอบที่บันทึกครบ สูงสุด 12 รอบ เรียงตามเวลา": "Average per-channel rate (Hz) for up to 12 completed sessions, in time order",
  "กำลังโหลดข้อมูล…": "Loading data…",
  "ยังไม่มีรอบ EEG ที่บันทึกครบ": "No completed EEG sessions yet",
  "ยังไม่มีเวลาของรอบ EEG ที่บันทึกครบ": "No completed session durations yet",
  "ก่อนกิจกรรม": "Baseline",
  "ทำกิจกรรม": "Task",
  "หลังกิจกรรม": "Rest",
  "มีข้อมูลหนึ่งรอบ กราฟจะแสดงเส้นแนวโน้มเมื่อมีรอบที่บันทึกครบอย่างน้อยสองรอบ": "One session is available. The trend line appears after at least two completed sessions.",
  "กรุณากรอกข้อมูลให้ครบถ้วน": "Please fill in all required fields",
  "รหัสผ่านทั้งสองช่องไม่ตรงกัน": "Passwords do not match",
  "ดำเนินการไม่สำเร็จ": "Something went wrong",
  "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้": "Cannot reach the server",
  "สมชาย ใจดี (optional)": "Your name (optional)",
  "เช่น P001": "e.g. P001",
  "ข้อความ marker เช่น stimulus_onset": "Marker text, e.g. stimulus_onset",
  "📶 เชื่อมต่อ Muse 2 หรือ Muse S และบันทึก EEG ได้ในหน้าการทดลองหลังเข้าสู่ระบบ": "📶 Connect a Muse 2 or Muse S and record EEG from the experiment page after signing in.",
  "มีข้อมูลการทดลองที่ยังไม่ได้ส่งออก ต้องการออกจากระบบหรือไม่?": "Some experiment data has not been exported. Sign out anyway?",
  "กรอกรหัสผู้เข้าร่วม รหัสรอบ เลือกกลุ่ม และเลือกเกมให้ครบ": "Enter a participant ID and session ID, then choose a group and game.",
  "ยืนยันการได้รับความยินยอมตามโครงการก่อนเริ่ม": "Confirm consent under the study protocol before starting.",
  "เชื่อมต่อ Muse และรอรับ EEG ครบทั้ง 4 ช่องก่อนเริ่ม": "Connect Muse and wait for all 4 EEG channels before starting.",
  "ที่เก็บข้อมูลในเครื่องยังไม่พร้อม กรุณารอหรือตรวจสอบพื้นที่ว่าง": "Browser storage is not ready. Wait or check available space.",
  "รอสัญญาณ EEG ต่อเนื่องอย่างน้อย 1 วินาทีครบทั้ง 4 ช่องก่อนเริ่มรอบผู้เข้าร่วม": "Wait for at least one second of continuous EEG on all 4 channels before starting.",
  "สัญญาณ EEG ล่าสุดชนขอบช่วงวัด กรุณาปรับเซนเซอร์แล้วทดสอบอุปกรณ์ใหม่ก่อนเริ่มรอบผู้เข้าร่วม": "Recent EEG hit the measurement limit. Adjust the sensors and retest before starting.",
  "ช่วงทำกิจกรรมต้องอยู่ระหว่าง 5–540 วินาที": "Task duration must be 5–540 seconds.",
  "กำลังทดสอบอุปกรณ์ 15 วินาที ข้อมูลชุดนี้ระบุ test_mode=true": "Testing the device for 15 seconds. This data is marked test_mode=true.",
  "กำลังบันทึก EEG ลงที่เก็บข้อมูลในเบราว์เซอร์อัตโนมัติ": "Automatically saving EEG to browser storage.",
  "ครบทุกช่วงแล้ว กรุณาส่งออก CSV": "All phases complete. Please export the CSV.",
  "หยุดการทดลองแล้ว กรุณาส่งออก CSV": "The session stopped. Please export the CSV.",
  "สั่งดาวน์โหลด CSV แล้ว ตรวจสอบไฟล์ใน Downloads ก่อนลบข้อมูลที่เก็บในเบราว์เซอร์": "CSV download started. Check the file in Downloads before deleting browser data.",
  "Research use · ไม่ใช่การวินิจฉัย": "Research use · not a diagnosis",
  "เปิด Muse → กด Connect Muse → เลือก": "Turn on Muse → select Connect Muse → choose",
  "ในหน้าต่าง Bluetooth → รอให้สถานะแสดง “EEG ครบ 4 ช่อง” ก่อนเริ่มบันทึก": "in the Bluetooth dialog → wait for all 4 EEG channels before recording.",
  "เมื่อติดตั้งแล้วสามารถเปิด CogniLoad-XAI จาก Mac ได้เหมือนแอปทั่วไป โดยไม่ต้องเปิดไฟล์หรือ Terminal": "Once installed, open CogniLoad-XAI on your Mac like any other app.",
  "µV · ตัวอย่างดิบล่าสุด": "µV · latest raw sample",
  "กราฟแสดงประมาณ 2 วินาทีล่าสุด โดยหักค่าเฉลี่ยของแต่ละช่องและปรับสเกลอัตโนมัติ ค่าใน CSV ยังเป็นสัญญาณดิบ ไม่ได้กรอง 50 Hz": "The chart shows approximately the last 2 seconds, centers each channel, and scales automatically. CSV values remain raw and are not filtered at 50 Hz.",
  "ค่าด้านล่างเป็นสรุปคุณภาพ/สถิติของสัญญาณ EEG ที่บันทึก ไม่ใช่ผลวินิจฉัยทางการแพทย์": "The values below summarize recorded EEG quality and statistics. They are not a medical diagnosis.",
  "ภาพรวมข้อมูล EEG จากรอบทดลองที่บันทึกในเบราว์เซอร์นี้": "Overview of EEG sessions recorded in this browser.",
  "หากกำลังบันทึก EEG ระบบจะใส่ marker อัตโนมัติเมื่อแสดงสิ่งเร้าและเมื่อผู้เข้าร่วมตอบแต่ละครั้ง ตรวจเวลาของช่วงทดลองได้ที่แถบด้านบน": "During EEG recording, markers are added automatically at each stimulus and response. Check phase time in the bar above.",
  "ตัดสินความคี่คู่ของตัวเลข บันทึกความถูกต้องและเวลาตอบสนอง": "Judge whether numbers are odd or even. Accuracy and response time are recorded.",
  "ลำดับสะท้อน: ทดสอบ temporal sequence memory และ delayed recognition": "Echo Sequence tests sequence memory and delayed recognition.",
  "รูปแบบเปลี่ยนแปลง: ทดสอบ visual change detection, attention และ processing speed": "Pattern Drift tests visual change detection, attention, and processing speed.",
  "จบกิจกรรม · เก็บ EEG ต่อ 30 วินาที": "Finish task · record EEG for 30 more seconds",
  "ประวัติผลการประเมินของสมาชิกที่เข้าสู่ระบบ": "Assessment history for the signed-in account.",
  "ยังไม่มีข้อมูล": "No data yet",
  "รอข้อมูล": "Waiting for data",
  "ทดสอบอุปกรณ์": "Device test",
  "ไม่ระบุกลุ่ม": "No group specified",
  "ค้างจากการปิดหน้า": "Interrupted when page closed",
  "ส่งออกอีกครั้ง": "Export again",
  "ลบจากเครื่อง": "Delete from device",
  "สัญญาณบางช่องชนขอบช่วงวัดของ Muse มากกว่า 1% ข้อมูลช่องนั้นอาจใช้วิเคราะห์ไม่ได้ ตรวจให้เซนเซอร์สัมผัสผิวหนังแนบสนิท แล้วทดสอบใหม่ก่อนเก็บข้อมูลผู้เข้าร่วม": "Some Muse channels hit the measurement limit more than 1% of the time. Those channels may be unsuitable for analysis. Check sensor contact and retest before collecting participant data.",
  "บันทึกลงเครื่องไม่สำเร็จ": "Failed to save on this device",
  "โปรดส่งออกข้อมูลที่ยังอยู่ในแท็บทันที": "Export the data still in this tab immediately.",
  "กู้สถานะรอบก่อนล้มเหลว": "Could not recover the previous session",
  "พบข้อมูลรอบก่อนในเครื่อง กรุณาส่งออก CSV แล้วจึงเริ่มรอบใหม่": "Previous session data was found. Export its CSV before starting a new session.",
  "เปิดที่เก็บข้อมูลไม่ได้": "Could not open browser storage",
  "Muse ขาดการเชื่อมต่อ ข้อมูลที่บันทึกไว้ยังส่งออกได้": "Muse disconnected. Recorded data can still be exported.",
  "สัญญาณ EEG หายเกิน 3 วินาที การทดลองหยุดแล้ว": "EEG signal was lost for more than 3 seconds. The session stopped.",
  "แท็บถูกซ่อนระหว่างบันทึก การทดลองหยุดเพื่อรักษาความถูกต้องของเวลา": "The tab was hidden during recording. The session stopped to protect timing accuracy.",
  "ออกจากหน้าเกมระหว่าง Task รอบนี้ไม่สมบูรณ์ กรุณาส่งออกข้อมูลที่มี": "The game page was left during the task. This session is incomplete; export the data.",
  "เกมไม่เริ่มในช่วง Task รอบนี้ไม่สมบูรณ์ กรุณาส่งออกข้อมูลที่มี": "The game did not start during the task. This session is incomplete; export the data.",
  "บันทึกครบ แต่สัญญาณบางช่องชนขอบช่วงวัด กรุณาปรับเซนเซอร์และทดสอบซ้ำก่อนเก็บผู้เข้าร่วม": "Recording completed, but some channels hit the measurement limit. Adjust the sensors and retest before collecting participant data.",
  "ไม่พบแถวข้อมูลในรอบนี้": "No data rows found for this session.",
  "ส่งออก CSV ไม่สำเร็จ": "CSV export failed",
  "ลบข้อมูลไม่สำเร็จ": "Could not delete data",
  "Web Bluetooth ไม่พร้อมใน browser นี้ — ใช้ Chrome/Edge ผ่าน HTTPS หรือ localhost และเปิด Web Bluetooth flags บน Linux": "Web Bluetooth is unavailable in this browser. Use Chrome or Edge over HTTPS or localhost, and enable Web Bluetooth flags on Linux.",
  "รองรับสายคาดอกและเซนเซอร์ที่ใช้ Bluetooth Heart Rate Service มาตรฐาน": "Supports chest straps and sensors using the standard Bluetooth Heart Rate Service.",
  "เลือก preset หรือกรอก UUID จากคู่มืออุปกรณ์ จากนั้นเลือกอุปกรณ์ใน Bluetooth popup": "Choose a preset or enter UUIDs from the device manual, then choose the device in the Bluetooth dialog.",
  "เช่น 181a หรือ UUID เต็ม": "e.g. 181a or a full UUID",
  "เช่น 2a6e หรือ UUID เต็ม": "e.g. 2a6e or a full UUID",
  "ข้อมูลสุขภาพเป็นข้อมูลจากเซนเซอร์สำหรับงานทดลอง ไม่ใช่ผลวินิจฉัยทางการแพทย์ · IoT ต้องเป็น BLE GATT; อุปกรณ์ Wi-Fi/MQTT และ Bluetooth Classic ต้องใช้ gateway หรือ API เพิ่มเติม": "Health data comes from experimental sensors and is not a medical diagnosis. IoT devices must use BLE GATT; Wi-Fi, MQTT, and Bluetooth Classic devices need a gateway or API.",
  "Characteristic นี้ไม่รองรับ Read": "This characteristic does not support Read",
  "Characteristic นี้ไม่รองรับ Write": "This characteristic does not support Write",
  "Hex ต้องเป็นคู่ เช่น 01 ff 0a": "Hex input must contain byte pairs, e.g. 01 ff 0a",
  "⚠ เปิดผิดวิธี": "⚠ Open the site via HTTPS or localhost",
  "พร้อมเชื่อมต่อ": "Ready to connect",
  "ตรวจสัญญาณสด": "Live signal check",
  "Muse หรือ MuseS": "Muse or MuseS",
  "พักนิ่ง": "Baseline",
  "ทำภารกิจ": "Task",
  "พักหลังงาน": "Rest",
  "ข้อมูลผู้เข้าร่วม": "Participant details",
  "มือข้างถนัด": "Dominant hand",
  "เซสชัน": "Session",
  "ต่อไป": "Next",
  "ทำการประเมินให้ครบเพื่อดูระดับคัดกรอง": "Complete an assessment to view the screening level.",
  "ยังไม่มีข้อมูลเกม": "No game data yet",
  "ประวัติการเข้าสู่ระบบ": "Sign-in history",
  "หมายเหตุ": "Note",
  "เริ่ม": "Start",
  "คี่หรือคู่": "Odd or Even",
  "เครื่องมือประเมินเดิม": "Previous assessment tools",
  "เหลือ": "Remaining",
  "Hz จริง · ขาด": "Hz actual · missing",
  "packets · ชนขอบ": "packets · clipped",
  "เลขใต้กราฟคือรอบที่": "Numbers below the chart are sessions",
  "ตรวจคุณภาพ:": "Quality check:",
  "packets ที่ตรวจพบว่าขาด ·": "packets detected missing ·",
  "packets ซ้ำ ·": "duplicate packets ·",
  "packets ลำดับผิดปกติ การนับนี้เป็นการประมาณจากลำดับแพ็กเก็ตของ Muse": "out-of-order packets. Counts are estimated from Muse packet sequence numbers.",
  "สัญญาณล่าสุด 3 วินาทีชนขอบ:": "The signal clipped in the last 3 seconds:",
  "· ปรับเซนเซอร์ก่อนเริ่มรอบผู้เข้าร่วม": "· Adjust sensors before starting a participant session",
  "สัญญาณ EEG ล่าสุดชนขอบช่วงวัด": "Recent EEG reached the measurement limit",
  "อ่านข้อมูลสำเร็จ": "Read complete",
  "ส่งข้อมูลสำเร็จ": "Write complete",
  "กำลังรับข้อมูล": "Receiving data",
  "กำลังรับค่าชีพจร": "Receiving heart rate",
  "การเชื่อมต่อถูกตัด": "Disconnected",
  "กำลังเชื่อมต่อ": "Connecting",
  "ยังไม่เชื่อมต่อ": "Not connected",
  "ยกเลิกการเลือกหรือไม่พบอุปกรณ์": "Selection cancelled or device not found",
  "Bluetooth ถูกบล็อก — ใช้ HTTPS/localhost และอนุญาตสิทธิ์ Bluetooth": "Bluetooth is blocked. Use HTTPS or localhost and allow Bluetooth access.",
  "เชื่อมต่อ GATT ไม่สำเร็จ — ปิดแอปอื่นที่ใช้อุปกรณ์แล้วลองใหม่": "GATT connection failed. Close other apps using the device and retry.",
  "สำหรับการวิจัย ควรใช้แบบ Mini-Cog© ฉบับภาษาไทยอย่างเป็นทางการและเกณฑ์การให้คะแนนหลังได้รับอนุญาตสำหรับการวิจัย ระบบนี้จึงไม่คัดลอกหรือดัดแปลงข้อคำถามของแบบทดสอบไว้ในเว็บ": "For research, use the official Thai Mini-Cog© form and scoring only after obtaining permission. This app does not reproduce or adapt the copyrighted test items.",
  "รอบทดลองนี้กำหนดเกมอื่นไว้ กรุณาใช้เกมที่เลือกก่อนเริ่มบันทึก": "This session is configured for another game. Use the selected game before recording.",
  "ไม่ได้เรียนหนังสือ/อ่านไม่ออกเขียนไม่ได้": "No formal education / unable to read or write",
  "จบประถมศึกษา": "Completed primary education",
  "เช่น 1 3 5 2": "e.g. 1 3 5 2",
  "50 Hz: รอข้อมูล 2 วินาที": "50 Hz: waiting for 2 seconds of data",
  "Chrome บน Linux ยังไม่ได้เปิด Web Bluetooth — เปิด chrome://flags/#enable-web-bluetooth และ chrome://flags/#enable-web-bluetooth-new-permissions-backend เป็น Enabled จากนั้นกด Relaunch แล้วรีเฟรชหน้านี้": "Web Bluetooth is disabled in Chrome on Linux. Enable chrome://flags/#enable-web-bluetooth and chrome://flags/#enable-web-bluetooth-new-permissions-backend, relaunch Chrome, then refresh this page.",
  "Web Bluetooth ไม่พร้อมใช้งาน — ใช้ Google Chrome หรือ Microsoft Edge บนคอมพิวเตอร์/Android และเปิดเว็บผ่าน HTTPS หรือ localhost (Chrome บน iPhone และ browser ในแอป LINE/Facebook ไม่รองรับ)": "Web Bluetooth is unavailable. Use Google Chrome or Microsoft Edge on desktop or Android over HTTPS or localhost. Chrome on iPhone and in-app browsers such as LINE or Facebook are unsupported.",
  "✓ Chrome + localhost พร้อมใช้งาน": "✓ Chrome and secure context ready",
  "✓ localhost พร้อมใช้งาน": "✓ Secure context ready",
  "⚠ ต้องเปิด Web Bluetooth ใน Chrome Linux": "⚠ Enable Web Bluetooth in Chrome on Linux",
  "⚠ Web Bluetooth ถูกปิด/ไม่รองรับ": "⚠ Web Bluetooth is disabled or unsupported",
  "เบราว์เซอร์ไม่อนุญาต Bluetooth — เปิดเว็บผ่าน HTTPS/localhost และอนุญาตสิทธิ์ Bluetooth แล้วลองใหม่": "The browser denied Bluetooth access. Use HTTPS or localhost, allow Bluetooth, and retry.",
  "อุปกรณ์ตัดการเชื่อมต่อ — กด Reconnect หรือเลือกจากรายการด้านบน": "Device disconnected. Select Reconnect or choose a device above.",
  "ต้องเปิดผ่าน HTTPS": "Open the site over HTTPS or localhost.",
  "1/4 เลือกอุปกรณ์ Muse หรือ MuseS ในหน้าต่าง Bluetooth": "1/4 Select a Muse or MuseS in the Bluetooth dialog.",
  "ยกเลิกการเลือกอุปกรณ์ หรือไม่พบ Muse กรุณากด Connect แล้วเลือก Muse หรือ MuseS": "Device selection was cancelled or Muse was not found. Select Connect and choose a Muse or MuseS.",
  " — กดปุ่มเพื่อลองใหม่": " — Select the button to retry",
  "กรุณาเปิดเครื่องแล้วลองใหม่": "Turn on the device and retry.",
  "อาจปิดอยู่) — กด Connect หรือเลือกจากรายการด้านบน": "may be off). Select Connect or choose a device above.",
};

const TH_EXTRA = {
  "EEG RECORDINGS": "ข้อมูล EEG ที่บันทึก",
  "01 · STUDY SETUP": "01 · ตั้งค่าการทดลอง",
  "02 · RECORDING": "02 · บันทึกข้อมูล",
  "03 · LOCAL RECORDINGS": "03 · รอบทดลองในเครื่อง",
  "Muse EEG Research Workspace": "พื้นที่วิจัย Muse EEG",
  "EEG session · ready to export": "รอบ EEG · พร้อมส่งออก",
  "Email": "อีเมล",
  "Login": "เข้าสู่ระบบ",
  "Register": "สมัครสมาชิก",
  "Research use": "ใช้เพื่อการวิจัย",
  "Research comparison mode": "โหมดเปรียบเทียบเพื่อการวิจัย",
  "Checking Bluetooth…": "กำลังตรวจสอบ Bluetooth…",
  "Web Bluetooth unavailable": "Web Bluetooth ไม่พร้อมใช้งาน",
  "Connecting…": "กำลังเชื่อมต่อ…",
  "Not reported": "ไม่มีข้อมูล",
  "Demo preprocessing completed.": "ประมวลผลข้อมูลสาธิตเสร็จแล้ว",
  "Profile": "ข้อมูลผู้เข้าร่วม",
  "Ready": "พร้อม",
  "Screening": "การคัดกรอง",
  "Locked": "ยังไม่พร้อม",
  "Game 1": "เกม 1",
  "Game 2": "เกม 2",
  "Game 3": "เกม 3",
  "Disconnect": "ตัดการเชื่อมต่อ",
  "○ Muse Found": "○ พบ Muse",
  "○ GATT Connected": "○ เชื่อมต่อ GATT",
  "○ Service Found": "○ พบ Service",
  "○ EEG Receiving": "○ กำลังรับ EEG",
  "Participant ID": "รหัสผู้เข้าร่วม",
  "Right": "ขวา",
  "Left": "ซ้าย",
  "Export assessment CSV": "ส่งออกผลประเมิน CSV",
  "Current member": "สมาชิกปัจจุบัน",
  "Login count": "จำนวนครั้งที่เข้าสู่ระบบ",
  "Assessments": "การประเมิน",
  "Accuracy by completed cognitive game.": "ความแม่นยำของเกมการรู้คิดที่ทำเสร็จแล้ว",
  "No data": "ยังไม่มีข้อมูล",
  "Prefer not to say": "ไม่ประสงค์ระบุ",
  "Female": "หญิง",
  "Male": "ชาย",
  "Low workload": "ภาระงานต่ำ",
  "Moderate workload": "ภาระงานปานกลาง",
  "High workload": "ภาระงานสูง",
  "Prototype threshold": "เกณฑ์ต้นแบบ",
  "2 s windows": "หน้าต่างเวลา 2 วินาที",
  "Delta power": "กำลังสัญญาณ Delta",
  "Theta power": "กำลังสัญญาณ Theta",
  "Alpha power": "กำลังสัญญาณ Alpha",
  "Beta power": "กำลังสัญญาณ Beta",
  "Band power": "กำลังสัญญาณแต่ละย่าน",
  "Workload-related ratio": "อัตราส่วนที่สัมพันธ์กับภาระงาน",
  "Spectral ratio": "อัตราส่วนสเปกตรัม",
  "Reaction time": "เวลาตอบสนอง",
  "Errors": "ข้อผิดพลาด",
  "Variability": "ความแปรปรวน",
  "Export CSV": "ส่งออก CSV",
  "Frontal Theta": "Theta บริเวณหน้าผาก",
  "Parietal Alpha": "Alpha บริเวณข้างศีรษะ",
  "Theta/Alpha ratio": "อัตราส่วน Theta/Alpha",
  "2. Echo Sequence": "2. ลำดับสะท้อน",
  "3. Pattern Drift": "3. รูปแบบเปลี่ยนแปลง",
  "Muse 2 / Muse S · 4 EEG channels": "Muse 2 / Muse S · EEG 4 ช่อง",
  "Mini-Cog© integration placeholder for authorized research use": "พื้นที่สำหรับเชื่อมต่อ Mini-Cog© เมื่อได้รับอนุญาตให้ใช้ในการวิจัย",
  "The research version should use the official Thai Mini-Cog© form and scoring only after obtaining permission for research use. This app intentionally does not reproduce or modify the copyrighted test items.": "งานวิจัยควรใช้แบบฟอร์มและเกณฑ์ให้คะแนน Mini-Cog© ฉบับภาษาไทยอย่างเป็นทางการหลังได้รับอนุญาต แอปนี้ไม่ได้คัดลอกหรือดัดแปลงข้อคำถามที่มีลิขสิทธิ์",
  "Store the screening score separately from EEG/game biomarkers, then test associations with workload features. Do not use the game score as a diagnosis of Alzheimer’s disease.": "เก็บคะแนนคัดกรองแยกจากตัวชี้วัด EEG และเกม แล้ววิเคราะห์ความสัมพันธ์กับคุณลักษณะภาระงาน อย่าใช้คะแนนเกมวินิจฉัยโรคอัลไซเมอร์",
  "These three tasks are newly designed experimental paradigms for this prototype. They are not validated Alzheimer diagnostic tests. Research validation is required before clinical interpretation.": "ทั้งสามภารกิจเป็นรูปแบบการทดลองที่ออกแบบใหม่สำหรับต้นแบบนี้ ยังไม่ได้รับการตรวจสอบว่าใช้วินิจฉัยโรคอัลไซเมอร์ ต้องผ่านการวิจัยยืนยันก่อนแปลผลทางคลินิก",
  "EEG event markers can later be synchronized to stimulus onset and responses.": "สามารถนำ marker เหตุการณ์ EEG ไปเทียบเวลาที่แสดงสิ่งเร้าและการตอบสนองภายหลังได้",
  "Green/yellow/red is a dashboard communication layer. MMSE-Thai 2002 has validated education-specific screening cut-offs, but it does not provide an official three-color severity classification. Red is therefore used for a score at/below the MMSE screening cut-off; yellow is used for a score within 3 points above that cut-off; green is more than 3 points above it. Game results are shown separately and do not change the MMSE screening category.": "สีเขียว เหลือง และแดงเป็นวิธีสื่อสารบนแดชบอร์ด MMSE-Thai 2002 มีเกณฑ์คัดกรองตามระดับการศึกษา แต่ไม่มีระดับความรุนแรงสามสีอย่างเป็นทางการ สีแดงหมายถึงคะแนนเท่ากับหรือต่ำกว่าเกณฑ์คัดกรอง สีเหลืองหมายถึงสูงกว่าเกณฑ์ไม่เกิน 3 คะแนน และสีเขียวหมายถึงสูงกว่านั้น ผลเกมแสดงแยกและไม่เปลี่ยนหมวดคัดกรอง MMSE",
  "Screen-positive on MMSE-Thai 2002; professional cognitive assessment is appropriate.": "ผลคัดกรอง MMSE-Thai 2002 เข้าเกณฑ์ ควรรับการประเมินการรู้คิดเพิ่มเติมจากผู้เชี่ยวชาญ",
  "Near the education-specific screening cut-off; this yellow band is a research-dashboard caution zone, not an official MMSE category.": "คะแนนใกล้เกณฑ์คัดกรองตามระดับการศึกษา สีเหลืองเป็นเพียงการเตือนในแดชบอร์ดวิจัย ไม่ใช่หมวด MMSE อย่างเป็นทางการ",
  "Above the education-specific screening cut-off by more than 3 points. This does not rule out cognitive impairment.": "คะแนนสูงกว่าเกณฑ์คัดกรองตามระดับการศึกษามากกว่า 3 คะแนน แต่ยังไม่สามารถตัดภาวะบกพร่องทางการรู้คิดได้",
};

const THAI = /[ก-๙]/;
const LATIN = /[A-Za-z]/;
const EN_DYNAMIC = [
  [/^เหลือ (\d+) วินาที$/, (_, seconds) => `${seconds} seconds remaining`],
  [/^ไม่พบอุปกรณ์ (.+) กรุณาเปิดเครื่องแล้วลองใหม่$/, (_, device) => `${device} was not found. Turn it on and retry.`],
  [/^Auto-reconnect ไม่สำเร็จ \((.+) อาจปิดอยู่\) — กด Connect หรือเลือกจากรายการด้านบน$/, (_, device) => `Could not reconnect automatically (${device} may be off). Select Connect or choose a device above.`],
  [/^Muse driver load failed: (.+) — กดปุ่มเพื่อลองใหม่$/, (_, cause) => `Muse driver load failed: ${cause}. Select the button to retry.`],
  [/^คลื่นใกล้ 50 Hz เด่นที่ (.+) อาจเป็นสัญญาณรบกวนไฟฟ้า ตรวจเซนเซอร์และสภาพแวดล้อมแล้วทดสอบใหม่ก่อนเก็บข้อมูลวิจัย$/, (_, channels) => `Strong 50 Hz interference at ${channels}. Check the sensors and surroundings, then retest before collecting research data.`],
  [/^เริ่มบันทึกไม่ได้: (.+)$/, (_, cause) => `Could not start recording: ${cause}`],
  [/^บันทึกลงเครื่องไม่สำเร็จ \((.+)\) โปรดส่งออกข้อมูลที่ยังอยู่ในแท็บทันที$/, (_, cause) => `Could not save on this device (${cause}). Export the data still in this tab immediately.`],
  [/^กู้สถานะรอบก่อนล้มเหลว: (.+)$/, (_, cause) => `Could not recover the previous session: ${cause}`],
  [/^ส่งออก CSV ไม่สำเร็จ: (.+)$/, (_, cause) => `CSV export failed: ${cause}`],
  [/^ลบข้อมูลไม่สำเร็จ: (.+)$/, (_, cause) => `Could not delete data: ${cause}`],
  [/^ลบ EEG ดิบไม่สำเร็จ: (.+)$/, (_, cause) => `Could not delete raw EEG: ${cause}`],
  [/^เปิดที่เก็บข้อมูลไม่ได้: (.+)$/, (_, cause) => `Could not open browser storage: ${cause}`],
  [/^อ่านข้อมูลรอบ EEG ไม่สำเร็จ: (.+)$/, (_, cause) => `Could not read EEG sessions: ${cause}`],
  [/^อ่านผลสรุปรอบ (.+) ไม่สำเร็จ: (.+)$/, (_, sessionId, cause) => `Could not summarize session ${sessionId}: ${cause}`],
];

export function localizeText(value, locale) {
  const source = String(value);
  const trimmed = source.trim();
  if (!trimmed) return source;
  let translated;
  if (locale === "en") {
    translated = EN[trimmed];
    if (!translated) {
      for (const [pattern, replacement] of EN_DYNAMIC) {
        const match = trimmed.match(pattern);
        if (match) { translated = replacement(...match); break; }
      }
    }
    if (!translated) {
      const halves = trimmed.split(/\s+\/\s+/);
      if (halves.length === 2 && THAI.test(trimmed) && LATIN.test(trimmed)) translated = halves.find((part) => !THAI.test(part));
    }
  } else {
    translated = TH_EXTRA[trimmed] || TH[trimmed];
    if (!translated) {
      const halves = trimmed.split(/\s+\/\s+/);
      if (halves.length === 2 && THAI.test(trimmed) && LATIN.test(trimmed)) translated = halves.find((part) => THAI.test(part));
    }
  }
  return translated ? source.replace(trimmed, translated) : source;
}

export function startLocalization(getLocale) {
  const originals = new WeakMap();
  const rendered = new WeakMap();
  const translateValue = (node, value, apply) => {
    if (rendered.get(node) !== value) originals.set(node, value);
    const original = originals.get(node) ?? value;
    const next = localizeText(original, getLocale());
    rendered.set(node, next);
    if (next !== value) apply(next);
  };
  const translateTree = (root) => {
    if (root.nodeType === Node.TEXT_NODE) {
      if (root.parentElement?.closest("script,style,[data-no-translate]")) return;
      translateValue(root, root.nodeValue, (value) => { root.nodeValue = value; });
    } else if (root.nodeType === Node.ELEMENT_NODE) {
      if (root.matches("script,style,[data-no-translate]")) return;
      for (const name of ["placeholder", "title", "aria-label"]) {
        if (!root.hasAttribute(name)) continue;
        const attr = root.getAttributeNode(name);
        translateValue(attr, attr.value, (value) => { attr.value = value; });
      }
      for (const child of root.childNodes) translateTree(child);
    }
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") translateTree(record.target);
      else if (record.type === "attributes") translateTree(record.target);
      else for (const node of record.addedNodes) translateTree(node);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label"] });
  translateTree(document.body);
  return { refresh: () => translateTree(document.body), stop: () => observer.disconnect() };
}
