"use client";

import { useEffect, useState } from "react";
import { TH } from "@/lib/th-dict";

const AUTH_ERRORS = {
  invalid_email: "รูปแบบอีเมลไม่ถูกต้อง / Invalid email address",
  weak_password: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร / Password must be at least 8 characters",
  email_taken: "อีเมลนี้ถูกใช้แล้ว / This email is already registered",
  invalid_name: "ชื่อยาวเกินไป (สูงสุด 80 ตัวอักษร) / Name is too long (max 80 characters)",
  invalid_credentials: "อีเมลหรือรหัสผ่านไม่ถูกต้อง / Incorrect email or password",
  missing_credentials: "กรุณากรอกอีเมลและรหัสผ่าน / Enter email and password",
  rate_limited: "พยายามหลายครั้งเกินไป กรุณารอสักครู่ / Too many attempts, please wait a moment",
  invalid_body: "ข้อมูลไม่ถูกต้อง / Invalid request",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Home() {
  const [authed, setAuthed] = useState(null);
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState(false);
  const [busy, setBusy] = useState(false);

  const clearFormError = () => {
    setAuthError(false);
    setAuthMessage("");
  };

  const switchMode = (next) => {
    if (busy || next === mode) return;
    setMode(next);
    setPassword("");
    setConfirm("");
    clearFormError();
  };

  const submitAuth = async () => {
    if (busy) return;
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();
    if (!trimmedEmail || !password || (mode === "register" && !confirm)) {
      setAuthError(true);
      setAuthMessage("กรุณากรอกข้อมูลให้ครบถ้วน / Please fill in all required fields");
      return;
    }
    if (mode === "register") {
      if (!EMAIL_RE.test(trimmedEmail)) {
        setAuthError(true);
        setAuthMessage(AUTH_ERRORS.invalid_email);
        return;
      }
      if (trimmedName.length > 80) {
        setAuthError(true);
        setAuthMessage(AUTH_ERRORS.invalid_name);
        return;
      }
      if (password.length < 8) {
        setAuthError(true);
        setAuthMessage(AUTH_ERRORS.weak_password);
        return;
      }
      if (password !== confirm) {
        setAuthError(true);
        setAuthMessage("รหัสผ่านทั้งสองช่องไม่ตรงกัน / Passwords do not match");
        return;
      }
    }
    setBusy(true);
    clearFormError();
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          ...(mode === "register" ? { name: trimmedName } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAuthError(true);
        setAuthMessage(AUTH_ERRORS[data.error] || "ดำเนินการไม่สำเร็จ / Something went wrong");
        return;
      }
      setPassword("");
      setConfirm("");
      setFullName("");
      window.__enterApp?.(data.user.email, data.user.name, true);
    } catch {
      setAuthError(true);
      setAuthMessage("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ / Cannot reach the server");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const $ = (id) => document.getElementById(id);
    const getEl = (id) => document.getElementById(id);

    /* ---------- Legacy demo EEG helpers (guarded) ---------- */
    function drawEEG(seed = 0) {
      const c = document.getElementById("eeg");
      if (!c) return;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.strokeStyle = "#33d6ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < c.width; x++) {
        let y = 110 + 24 * Math.sin((x + seed) / 13) + 10 * Math.sin((x + seed) / 4.3) + 7 * Math.sin((x + seed) / 2.1);
        y += (Math.random() - 0.5) * 9;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    function simulate() {
      drawEEG(Math.random() * 100);
      let vals = [
          [14, 68, 18],
          [8, 25, 67],
          [61, 30, 9],
        ][Math.floor(Math.random() * 3)],
        names = ["Low", "Moderate", "High"],
        m = vals.indexOf(Math.max(...vals));
      const w = $("workload"),
        cf = $("confidence");
      if (w) w.textContent = names[m];
      if (cf) cf.textContent = vals[m] + "% confidence";
      ["low", "mid", "high"].forEach((id, i) => {
        const el = $(id),
          bar = $(id + "bar");
        if (el) el.textContent = vals[i] + "%";
        if (bar) bar.style.width = vals[i] + "%";
      });
    }

    function makeFeatures() {
      let f = [
        ["Delta power", (Math.random() * 2 + 0.8).toFixed(3), "Band power"],
        ["Theta power", (Math.random() * 2 + 1).toFixed(3), "Band power"],
        ["Alpha power", (Math.random() * 2 + 1).toFixed(3), "Band power"],
        ["Beta power", (Math.random() * 2 + 0.7).toFixed(3), "Band power"],
        ["Theta/Alpha", (Math.random() * 0.8 + 0.7).toFixed(3), "Workload-related ratio"],
        ["Theta/Beta", (Math.random() * 0.7 + 0.5).toFixed(3), "Spectral ratio"],
      ];
      const rows = $("featureRows");
      if (rows) rows.innerHTML = f.map((x) => `<tr><td>${x[0]}</td><td>${x[1]}</td><td>${x[2]}</td></tr>`).join("");
    }

    const fileInput = $("file");
    if (fileInput) {
      fileInput.onchange = (e) => {
        let f = e.target.files[0];
        if (f) {
          const info = $("fileinfo");
          if (info) info.textContent = `Loaded: ${f.name} (${Math.round(f.size / 1024)} KB)`;
          drawEEG(20);
        }
      };
    }
    drawEEG();
    makeFeatures();

    /* ---------- i18n ---------- */
    let currentLang = "en";
    const originals = new WeakMap();
    function translateNode(node, toThai) {
      if (node.nodeType === 3) {
        let s = node.nodeValue.trim();
        if (!s) return;
        if (!originals.has(node)) originals.set(node, node.nodeValue);
        const orig = originals.get(node);
        const key = orig.trim();
        if (toThai && TH[key]) node.nodeValue = orig.replace(key, TH[key]);
        else node.nodeValue = orig;
      } else if (node.nodeType === 1 && !["SCRIPT", "STYLE"].includes(node.tagName)) {
        [...node.childNodes].forEach((n) => translateNode(n, toThai));
      }
    }
    function toggleLang() {
      currentLang = currentLang === "en" ? "th" : "en";
      translateNode(document.body, currentLang === "th");
      const btn = $("langBtn");
      if (btn) btn.textContent = currentLang === "th" ? "English" : "ไทย";
      document.documentElement.lang = currentLang;
    }

    /* ---------- Mini-Cog / games (free play) ---------- */
    function miniCogInterpret() {
      let v = Number($("mcscore").value),
        el = $("mcresult");
      if (!Number.isFinite(v) || v < 0 || v > 5) {
        el.textContent = "Please enter 0–5 / กรุณากรอกคะแนน 0–5";
        return;
      }
      el.textContent =
        v <= 2
          ? "Screening score indicates a higher likelihood of clinically important cognitive impairment; further professional assessment is appropriate. / คะแนนคัดกรองอยู่ในช่วงที่สัมพันธ์กับโอกาสสูงขึ้นของความบกพร่องทางการรู้คิดที่มีนัยสำคัญ ควรประเมินเพิ่มเติมโดยผู้เชี่ยวชาญ"
          : "Screening score is in the lower-likelihood range, but cognitive impairment is not ruled out. / คะแนนอยู่ในช่วงโอกาสต่ำกว่า แต่ไม่สามารถตัดความบกพร่องทางการรู้คิดออกได้";
    }

    let timerStart = 0,
      correct = 0,
      total = 0,
      errors = 0,
      rts = [];
    function setMetrics() {
      let a = total ? Math.round((correct / total) * 100) : 0;
      $("gacc").textContent = a + "%";
      $("gerr").textContent = errors;
      $("grt").textContent = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) + " ms" : "—";
      if (rts.length > 1) {
        let m = rts.reduce((a, b) => a + b, 0) / rts.length,
          sd = Math.sqrt(rts.reduce((a, b) => a + (b - m) ** 2, 0) / rts.length);
        $("gvar").textContent = Math.round(sd) + " ms";
      } else $("gvar").textContent = "—";
    }
    function startGame(n) {
      correct = 0;
      total = 0;
      errors = 0;
      rts = [];
      setMetrics();
      if (n === 1) game1();
      if (n === 2) game2();
      if (n === 3) game3();
    }
    function game1() {
      $("gtitle").textContent = "Context Switch Trail / บริบทสลับเส้นทาง";
      let box = $("gamebox");
      let rule = Math.random() > 0.5 ? "ODD" : "EVEN",
        num = Math.ceil(Math.random() * 9);
      box.innerHTML = `<div style="text-align:center"><p>Rule / กติกา: <b>${rule}</b></p><div style="font-size:70px">${num}</div><button onclick="answer1(${num % 2 === 1},'${rule}')">ODD</button> <button class="secondary" onclick="answer1(${num % 2 === 0},'${rule}')">EVEN</button></div>`;
      timerStart = performance.now();
    }
    function answer1(isOdd, rule) {
      let chosen = event.target.textContent.trim(),
        truth = rule === "ODD" ? "ODD" : "EVEN";
      total++;
      let ok = chosen === truth;
      if (ok) correct++;
      else errors++;
      rts.push(performance.now() - timerStart);
      setMetrics();
      setTimeout(game1, 250);
    }
    let seq = [];
    function game2() {
      $("gtitle").textContent = "Echo Sequence / ลำดับสะท้อน";
      let box = $("gamebox");
      seq = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6));
      box.innerHTML = `<div style="text-align:center"><p>Remember / จำลำดับ</p><div style="font-size:45px;letter-spacing:20px">${seq.join(" ")}</div></div>`;
      setTimeout(() => {
        box.innerHTML = `<div><p>Enter sequence / ใส่ลำดับ</p><input id="seqin" placeholder="e.g. 1 3 5 2"><button onclick="answer2()">Submit</button></div>`;
        timerStart = performance.now();
      }, 2200);
    }
    function answer2() {
      let v = $("seqin").value.replace(/\s/g, ""),
        truth = seq.join("");
      total++;
      if (v === truth) correct++;
      else errors++;
      rts.push(performance.now() - timerStart);
      setMetrics();
      setTimeout(game2, 400);
    }
    function game3() {
      $("gtitle").textContent = "Pattern Drift / รูปแบบเปลี่ยนแปลง";
      let box = $("gamebox"),
        change = Math.random() > 0.5;
      let arr = ["●", "▲", "■", "◆", "★", "⬟"];
      let a = arr.slice(0, 5),
        b = a.slice();
      if (change) b[2] = "⬟";
      box.innerHTML = `<div style="text-align:center"><p>Did the pattern change? / รูปแบบเปลี่ยนหรือไม่?</p><div style="font-size:40px">${a.join(" ")}</div><div style="font-size:40px;margin:15px">${b.join(" ")}</div><button onclick="answer3(${change},true)">Changed</button> <button class="secondary" onclick="answer3(${change},false)">Same</button></div>`;
      timerStart = performance.now();
    }
    function answer3(truth, choice) {
      total++;
      if (truth === choice) correct++;
      else errors++;
      rts.push(performance.now() - timerStart);
      setMetrics();
      setTimeout(game3, 300);
    }

    /* ---------- Auth / journey ---------- */
    let journey = { step: 1, profile: {}, screen: null, games: [] };

    function initApp(accountEmail, displayName, recordLoginEvent) {
      const e = String(accountEmail || "").toLowerCase();
      if (!e) return;
      sessionStorage.setItem("cogni_login", e);
      sessionStorage.setItem("cogni_name", String(displayName || ""));
      if (recordLoginEvent) {
        let logs = JSON.parse(localStorage.getItem("cogni_logins_" + e) || "[]");
        logs.push(new Date().toISOString());
        localStorage.setItem("cogni_logins_" + e, JSON.stringify(logs.slice(-100)));
      }
      journey = { step: 1, profile: {}, screen: null, games: [] };
      let saved = localStorage.getItem("cogni_progress_" + e);
      if (saved) {
        try {
          journey = JSON.parse(saved);
        } catch {}
      }
      showStep();
      renderDashboard();
      renderHistory();
    }
    async function restoreSession() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data?.user?.email) {
            initApp(data.user.email, data.user.name, false);
            setAuthed(true);
            return;
          }
        }
      } catch {}
      setAuthed(false);
    }
    async function logoutUser() {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {}
      sessionStorage.removeItem("cogni_login");
      sessionStorage.removeItem("cogni_name");
      setAuthed(false);
    }
    window.__enterApp = (accountEmail, displayName, fresh) => {
      initApp(accountEmail, displayName, fresh);
      setAuthed(true);
    };
    restoreSession();
    function saveJourney() {
      let e = sessionStorage.getItem("cogni_login");
      if (e) localStorage.setItem("cogni_progress_" + e, JSON.stringify(journey));
      if ($("dMember")) renderDashboard();
    }
    function nextStep() {
      journey.step++;
      saveJourney();
      showStep();
    }
    function showStep() {
      for (let i = 1; i <= 5; i++) {
        let e = $("s" + i);
        if (e) e.textContent = i < journey.step ? "Completed" : i === journey.step ? "Ready" : "Locked";
      }
      let b = $("stepbox");
      if (!b) return;
      if (journey.step === 1)
        b.innerHTML = `<h3>Step 1: Participant Profile / ข้อมูลผู้เข้าร่วม</h3><div class="formgrid"><label>Participant ID<input id="jpId" value="P001"></label><label>Age / อายุ<input id="jpAge" type="number"></label><label>Dominant hand / มือข้างถนัด<select id="jpHand"><option>Right</option><option>Left</option></select></label><label>Session<input id="jpSession" value="S01"></label></div><div class="controls"><button onclick="saveProfile()">Continue / ต่อไป</button></div>`;
      else if (journey.step === 2) b.innerHTML = mmseForm();
      else if (journey.step >= 3 && journey.step <= 5) {
        let g = journey.step - 2,
          names = ["Context Switch Trail", "Echo Sequence", "Pattern Drift"];
        b.innerHTML = `<h3>Step ${journey.step}: ${names[g - 1]}</h3>
        <p class="muted">${g === 1 ? "Rule switching + inhibition / การสลับกฎและการยับยั้งการตอบสนอง" : g === 2 ? "Sequence memory / ความจำลำดับ" : "Visual change detection / การตรวจจับการเปลี่ยนแปลงทางสายตา"}</p>
        <div id="jgarea" class="card" style="min-height:260px;margin-top:12px"></div>
        <div id="jgmetrics" class="muted" style="margin-top:10px">Trials: 0/6 · Accuracy: — · Mean RT: —</div>`;
        initJourneyGame(g);
      } else showSummary();
    }
    function saveProfile() {
      journey.profile = {
        id: $("jpId").value,
        age: $("jpAge").value,
        hand: $("jpHand").value,
        session: $("jpSession").value,
      };
      nextStep();
    }
    function mmseForm() {
      return `<h3>Step 2: MMSE-Thai 2002 / แบบทดสอบสภาพสมองเบื้องต้นฉบับภาษาไทย</h3>
<p class="notice">Research implementation of the MMSE-Thai 2002 scoring structure. Administer according to the official Thai manual. This screen records domain scores rather than reproducing the full copyrighted administration script.</p>
<label>Education / ระดับการศึกษา<select id="edu" onchange="mmseEdu()"><option value="none">ไม่ได้เรียนหนังสือ/อ่านไม่ออกเขียนไม่ได้</option><option value="primary">จบประถมศึกษา</option><option value="above">สูงกว่าประถมศึกษา</option></select></label>
<table style="margin-top:15px"><tr><th>Domain / ด้าน</th><th>Maximum / เต็ม</th><th>Score / คะแนน</th></tr>
<tr><td>1. Orientation for time / การรับรู้เวลา</td><td>5</td><td><input class="mm" data-max="5" type="number" min="0" max="5" value="0"></td></tr>
<tr><td>2. Orientation for place / การรับรู้สถานที่</td><td>5</td><td><input class="mm" data-max="5" type="number" min="0" max="5" value="0"></td></tr>
<tr><td>3. Registration / การบันทึกความจำ</td><td>3</td><td><input class="mm" data-max="3" type="number" min="0" max="3" value="0"></td></tr>
<tr class="lit"><td>4. Attention/calculation / สมาธิและการคำนวณ</td><td>5</td><td><input class="mm" data-max="5" type="number" min="0" max="5" value="0"></td></tr>
<tr><td>5. Recall / การระลึกได้</td><td>3</td><td><input class="mm" data-max="3" type="number" min="0" max="3" value="0"></td></tr>
<tr><td>6–8. Language tasks / การใช้ภาษา</td><td>6</td><td><input class="mm" data-max="6" type="number" min="0" max="6" value="0"></td></tr>
<tr class="lit"><td>9–10. Reading/writing / การอ่านและเขียน</td><td>2</td><td><input class="mm" data-max="2" type="number" min="0" max="2" value="0"></td></tr>
<tr><td>11. Visuoconstruction / การสร้างภาพ</td><td>1</td><td><input class="mm" data-max="1" type="number" min="0" max="1" value="0"></td></tr></table>
<div class="controls"><button onclick="calculateMMSE()">Calculate / คำนวณ</button><button class="secondary" onclick="saveMMSE()">Save & Continue / บันทึกและต่อไป</button></div>
<div id="mmseres" class="notice">Score not calculated / ยังไม่ได้คำนวณคะแนน</div>`;
    }
    function mmseEdu() {
      let none = $("edu").value === "none";
      document.querySelectorAll(".lit").forEach((r) => (r.style.opacity = none ? 0.35 : 1));
      document.querySelectorAll(".lit input").forEach((i) => {
        i.disabled = none;
        if (none) i.value = 0;
      });
    }
    function calculateMMSE() {
      let edu = $("edu").value,
        total = 0,
        valid = true;
      document.querySelectorAll(".mm").forEach((i) => {
        let v = Number(i.value),
          m = Number(i.dataset.max);
        if (v < 0 || v > m || !Number.isFinite(v)) valid = false;
        total += v;
      });
      if (!valid) {
        alert("Invalid score / คะแนนไม่ถูกต้อง");
        return null;
      }
      let max = edu === "none" ? 23 : 30,
        cut = edu === "none" ? 14 : edu === "primary" ? 17 : 22;
      let flag = total <= cut;
      $("mmseres").innerHTML = `MMSE-Thai 2002: <b>${total}/${max}</b> · Cut-off / จุดตัด ≤ ${cut} · ${flag ? "Screen-positive / ผลคัดกรองเข้าเกณฑ์ ควรประเมินเพิ่มเติม" : "Above screening cut-off / สูงกว่าจุดตัด"}`;
      return { total, max, cut, education: edu, screenPositive: flag };
    }
    function saveMMSE() {
      let r = calculateMMSE();
      if (!r) return;
      journey.screen = r;
      nextStep();
    }
    let jg = { game: 0, trial: 0, total: 6, correct: 0, errors: 0, rts: [], started: 0, truth: null, seq: [] };
    function initJourneyGame(g) {
      jg = { game: g, trial: 0, total: 6, correct: 0, errors: 0, rts: [], started: 0, truth: null, seq: [] };
      renderJGame();
    }
    function jMetrics() {
      let a = jg.trial ? Math.round((jg.correct / jg.trial) * 100) : 0,
        rt = jg.rts.length ? Math.round(jg.rts.reduce((a, b) => a + b, 0) / jg.rts.length) : 0;
      let e = $("jgmetrics");
      if (e) e.textContent = `Trials: ${jg.trial}/${jg.total} · Accuracy: ${jg.trial ? a + "%" : "—"} · Mean RT: ${rt ? rt + " ms" : "—"} · Errors: ${jg.errors}`;
    }
    function renderJGame() {
      let a = $("jgarea");
      if (!a) return;
      if (jg.trial >= jg.total) {
        finishJGame();
        return;
      }
      if (jg.game === 1) {
        let rule = jg.trial % 2 === 0 ? "PARITY" : "MAGNITUDE",
          num = 1 + Math.floor(Math.random() * 9);
        jg.truth = rule === "PARITY" ? (num % 2 === 0 ? "EVEN" : "ODD") : num >= 5 ? "HIGH" : "LOW";
        a.innerHTML = `<div style="text-align:center"><span class="pill">Trial ${jg.trial + 1}/6</span><h3>${rule === "PARITY" ? "Rule: Odd or Even? / คี่หรือคู่?" : "Rule: Low (1–4) or High (5–9)? / ต่ำหรือสูง?"}</h3><div style="font-size:76px;margin:18px">${num}</div><div class="controls" style="justify-content:center">${rule === "PARITY" ? '<button data-a="ODD">ODD / คี่</button><button class="secondary" data-a="EVEN">EVEN / คู่</button>' : '<button data-a="LOW">LOW / ต่ำ</button><button class="secondary" data-a="HIGH">HIGH / สูง</button>'}</div></div>`;
        a.querySelectorAll("button").forEach((x) => x.addEventListener("click", () => scoreJ(x.dataset.a)));
        jg.started = performance.now();
      } else if (jg.game === 2) {
        jg.seq = Array.from({ length: 4 + Math.floor(jg.trial / 2) }, () => 1 + Math.floor(Math.random() * 6));
        a.innerHTML = `<div style="text-align:center"><span class="pill">Trial ${jg.trial + 1}/6</span><h3>Remember this sequence / จำลำดับนี้</h3><div style="font-size:44px;letter-spacing:14px;margin:28px">${jg.seq.join(" ")}</div></div>`;
        setTimeout(() => {
          if (!document.getElementById("jgarea")) return;
          a.innerHTML = `<div style="text-align:center"><h3>Enter the sequence / ใส่ลำดับ</h3><input id="jseq" inputmode="numeric" placeholder="เช่น 1 3 5 2" style="max-width:320px"><div class="controls" style="justify-content:center"><button id="jseqgo">Submit / ตอบ</button></div></div>`;
          jg.started = performance.now();
          $("jseqgo").addEventListener("click", () => scoreJ($("jseq").value.replace(/\D/g, "")));
        }, 1800);
        jg.truth = jg.seq.join("");
      } else {
        let symbols = ["●", "▲", "■", "◆", "★", "⬟"],
          first = Array.from({ length: 5 }, () => symbols[Math.floor(Math.random() * symbols.length)]),
          second = [...first],
          changed = Math.random() > 0.5;
        if (changed) {
          let i = Math.floor(Math.random() * 5),
            v;
          do {
            v = symbols[Math.floor(Math.random() * symbols.length)];
          } while (v === second[i]);
          second[i] = v;
        }
        jg.truth = changed ? "CHANGED" : "SAME";
        a.innerHTML = `<div style="text-align:center"><span class="pill">Trial ${jg.trial + 1}/6</span><h3>Did the pattern change? / รูปแบบเปลี่ยนหรือไม่?</h3><div style="font-size:38px;letter-spacing:10px;margin:16px">${first.join("")}</div><div style="font-size:38px;letter-spacing:10px;margin:16px">${second.join("")}</div><div class="controls" style="justify-content:center"><button data-a="CHANGED">Changed / เปลี่ยน</button><button class="secondary" data-a="SAME">Same / เหมือนเดิม</button></div></div>`;
        a.querySelectorAll("button").forEach((x) => x.addEventListener("click", () => scoreJ(x.dataset.a)));
        jg.started = performance.now();
      }
    }
    function scoreJ(answer) {
      let rt = performance.now() - jg.started;
      jg.rts.push(rt);
      jg.trial++;
      if (answer === jg.truth) jg.correct++;
      else jg.errors++;
      jMetrics();
      setTimeout(renderJGame, 250);
    }
    function finishJGame() {
      let acc = Math.round((jg.correct / jg.total) * 100),
        rt = Math.round(jg.rts.reduce((a, b) => a + b, 0) / jg.rts.length),
        mean = rt,
        sd = Math.round(Math.sqrt(jg.rts.reduce((a, b) => a + (b - mean) ** 2, 0) / jg.rts.length));
      let result = { game: jg.game, accuracy: acc, rt: rt, errors: jg.errors, variability: sd };
      journey.games[jg.game - 1] = result;
      saveJourney();
      $("jgarea").innerHTML = `<div style="text-align:center"><h2>Completed / เสร็จสิ้น</h2><p>Accuracy <b>${acc}%</b> · Mean RT <b>${rt} ms</b> · Errors <b>${jg.errors}</b></p><button id="jgcontinue">Continue / ต่อไป</button></div>`;
      jMetrics();
      $("jgcontinue").addEventListener("click", nextStep);
    }
    function showSummary() {
      $("s5").textContent = "Completed";
      let em = sessionStorage.getItem("cogni_login");
      if (em && !journey.completedSaved) {
        let hist = JSON.parse(localStorage.getItem("cogni_assessments_" + em) || "[]");
        hist.push({ date: new Date().toISOString(), screen: journey.screen, games: journey.games, profile: journey.profile });
        localStorage.setItem("cogni_assessments_" + em, JSON.stringify(hist));
        journey.completedSaved = true;
        saveJourney();
      }
      let avg = journey.games.length ? Math.round(journey.games.reduce((a, x) => a + x.accuracy, 0) / journey.games.length) : 0;
      $("stepbox").innerHTML = `<h2>Assessment Summary / สรุปผลการประเมิน</h2><div class="grid"><div class="card metric"><small>Screening score</small><b>${journey.screen ? journey.screen.total + "/" + journey.screen.max : "—"}</b></div><div class="card metric"><small>Mean game accuracy</small><b>${avg}%</b></div><div class="card metric"><small>Completed games</small><b>${journey.games.length}/3</b></div><div class="card metric"><small>Status</small><b>Complete</b></div></div><div class="card" style="margin-top:14px"><h3>Game results</h3><table><tr><th>Game</th><th>Accuracy</th><th>Reaction time</th><th>Errors</th><th>RT variability</th></tr>${journey.games
        .map(
          (x) =>
            `<tr><td>${["Context Switch Trail", "Echo Sequence", "Pattern Drift"][x.game - 1]}</td><td>${x.accuracy}%</td><td>${x.rt} ms</td><td>${x.errors}</td><td>${x.variability ?? "—"} ms</td></tr>`
        )
        .join("")}</table><p class="notice">Research screening summary only. These results do not diagnose Alzheimer’s disease or another medical condition.</p></div><div class="controls"><button class="secondary" onclick="restartJourney()">Start new assessment / เริ่มการประเมินใหม่</button></div>`;
      renderHistory();
    }
    function restartJourney() {
      journey = { step: 1, profile: {}, screen: null, games: [], completedSaved: false };
      saveJourney();
      showStep();
      renderDashboard();
    }
    function riskLevel() {
      if (!journey.screen || typeof journey.screen !== "object") return null;
      let d = journey.screen.total - journey.screen.cut;
      if (d <= 0) return { level: "red", label: "Red / แดง", text: "Screen-positive on MMSE-Thai 2002; professional cognitive assessment is appropriate." };
      if (d <= 3)
        return {
          level: "yellow",
          label: "Yellow / เหลือง",
          text: "Near the education-specific screening cut-off; this yellow band is a research-dashboard caution zone, not an official MMSE category.",
        };
      return {
        level: "green",
        label: "Green / เขียว",
        text: "Above the education-specific screening cut-off by more than 3 points. This does not rule out cognitive impairment.",
      };
    }
    function renderDashboard() {
      let em = sessionStorage.getItem("cogni_login");
      if (!em) return;
      let logs = JSON.parse(localStorage.getItem("cogni_logins_" + em) || "[]"),
        hist = JSON.parse(localStorage.getItem("cogni_assessments_" + em) || "[]");
      $("dMember").textContent = sessionStorage.getItem("cogni_name") || em;
      $("dLogins").textContent = logs.length;
      $("dAssess").textContent = hist.length;
      $("dMMSE").textContent = journey.screen && journey.screen.total != null ? journey.screen.total + "/" + journey.screen.max : "—";
      let r = riskLevel(),
        rb = $("dashRisk"),
        dn = $("riskDonut"),
        dt = $("riskDonutText");
      rb.className = "risk-banner " + (r ? "risk-" + r.level : "");
      rb.textContent = r ? r.label + " — " + r.text : "Complete an assessment to view the screening level. / ทำการประเมินให้ครบเพื่อดูระดับคัดกรอง";
      dt.textContent = r ? r.label : "No data";
      $("riskExplain").textContent = r ? r.text : "";
      if (r) {
        dn.style.background =
          r.level === "green" ? "conic-gradient(#4bd28b 0 100%,#243449 0)" : r.level === "yellow" ? "conic-gradient(#f1c84c 0 100%,#243449 0)" : "conic-gradient(#ef6672 0 100%,#243449 0)";
      }
      let gc = $("gameChart");
      gc.innerHTML =
        (journey.games || [])
          .map(
            (x, i) =>
              `<div class="barcol"><div class="bar" style="height:${Math.max(3, x.accuracy)}%"></div><div class="barlabel">Game ${i + 1}<br>${x.accuracy}%</div></div>`
          )
          .join("") || '<span class="muted">No game data / ยังไม่มีข้อมูลเกม</span>';
      $("loginHistory").innerHTML =
        logs
          .slice(-5)
          .reverse()
          .map((x) => `<div>${new Date(x).toLocaleString()}</div>`)
          .join("") || "—";
    }
    function csvEscape(v) {
      v = v == null ? "" : String(v);
      return '"' + v.replace(/"/g, '""') + '"';
    }
    function exportCSV() {
      let em = sessionStorage.getItem("cogni_login"),
        hist = JSON.parse(localStorage.getItem("cogni_assessments_" + em) || "[]"),
        logs = JSON.parse(localStorage.getItem("cogni_logins_" + em) || "[]");
      let rows = [
        [
          "email",
          "login_count",
          "assessment_date",
          "participant_id",
          "age",
          "education",
          "mmse_score",
          "mmse_max",
          "mmse_cutoff",
          "screen_positive",
          "dashboard_level",
          "game1_accuracy",
          "game1_rt_ms",
          "game1_errors",
          "game2_accuracy",
          "game2_rt_ms",
          "game2_errors",
          "game3_accuracy",
          "game3_rt_ms",
          "game3_errors",
        ],
      ];
      let records = hist.length ? hist : [{ date: "", screen: journey.screen, games: journey.games, profile: journey.profile }];
      records.forEach((a) => {
        let s = a.screen || {},
          g = a.games || [],
          p = a.profile || {},
          d = s.total == null ? "" : s.total <= s.cut ? "red" : s.total - s.cut <= 3 ? "yellow" : "green";
        rows.push([em, logs.length, a.date, p.id, p.age, s.education, s.total, s.max, s.cut, s.screenPositive, d, ...[0, 1, 2].flatMap((i) => [g[i]?.accuracy, g[i]?.rt, g[i]?.errors])]);
      });
      let blob = new Blob(["\ufeff" + rows.map((r) => r.map(csvEscape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }),
        u = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = u;
      a.download = "CogniLoad_assessment_export.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    }
    function renderHistory() {
      let em = sessionStorage.getItem("cogni_login"),
        box = $("historyTable");
      if (!box || !em) return;
      let hist = JSON.parse(localStorage.getItem("cogni_assessments_" + em) || "[]");
      if (!hist.length) {
        box.innerHTML = '<p class="muted">ยังไม่มีประวัติการประเมิน / No assessment history</p>';
        return;
      }
      box.innerHTML = `<div style="overflow:auto"><table><tr><th>Date / วันที่</th><th>Participant</th><th>MMSE</th><th>Level / ระดับ</th><th>Game 1</th><th>Game 2</th><th>Game 3</th></tr>${hist
        .slice()
        .reverse()
        .map((a) => {
          let s = a.screen || {},
            g = a.games || [],
            lvl = s.total == null ? "—" : s.total <= s.cut ? "🔴 Red / แดง" : s.total - s.cut <= 3 ? "🟡 Yellow / เหลือง" : "🟢 Green / เขียว";
          return `<tr><td>${a.date ? new Date(a.date).toLocaleString() : "—"}</td><td>${a.profile?.id || "—"}</td><td>${s.total != null ? s.total + "/" + s.max : "—"}</td><td>${lvl}</td><td>${g[0]?.accuracy ?? "—"}%</td><td>${g[1]?.accuracy ?? "—"}%</td><td>${g[2]?.accuracy ?? "—"}%</td></tr>`;
        })
        .join("")}</table></div>`;
    }

    /* ---------- Muse 2 EEG (Web Bluetooth) ---------- */
    let museClient = null,
      eegSub = null,
      packetCount = 0,
      baselineTimer = null,
      baselineHardStop = null,
      baselineTick = null,
      baselineStart = 0,
      baselineFinalized = false,
      baselineSamples = [[], [], [], []],
      museConnected = false;
    const plotBuffers = [[], [], [], []],
      maxPlot = 500;
    let latest = [null, null, null, null],
      traces = [[], [], [], []];

    function museMessage(msg, isError = false) {
      const h = $("btHelp");
      if (!h) return;
      h.style.display = "block";
      h.style.borderLeftColor = isError ? "var(--red)" : "var(--cyan)";
      h.textContent = msg;
    }
    function setMuseConnected(on) {
      const s = $("museStatus");
      s.textContent = on ? "● Connected / เชื่อมต่อแล้ว" : "● Not connected / ยังไม่เชื่อมต่อ";
      s.style.background = on ? "#123c2b" : "#0a3140";
    }
    function renderMuse() {
      for (let ch = 0; ch < 4; ch++) {
        const el = $("ch" + ch);
        if (el && latest[ch] != null && Number.isFinite(latest[ch])) el.textContent = latest[ch].toFixed(2);
      }
    }
    function drawMuse() {
      const c = $("museCanvas");
      if (!c) return;
      const x = c.getContext("2d"),
        w = c.width,
        h = c.height;
      x.clearRect(0, 0, w, h);
      x.fillStyle = "#081522";
      x.fillRect(0, 0, w, h);
      x.strokeStyle = "#17314a";
      x.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        x.beginPath();
        x.moveTo(0, (i * h) / 4);
        x.lineTo(w, (i * h) / 4);
        x.stroke();
      }
      const cols = ["#33d6ff", "#9b7bff", "#4fe0a1", "#ffc857"];
      plotBuffers.forEach((buf, ch) => {
        if (buf.length < 2) return;
        let mean = buf.reduce((a, b) => a + b, 0) / buf.length;
        x.strokeStyle = cols[ch];
        x.lineWidth = 1.5;
        x.beginPath();
        buf.forEach((v, i) => {
          let px = (i / (maxPlot - 1)) * w,
            py = ((ch + 0.5) * h) / 4 - Math.max(-50, Math.min(50, v - mean)) * (h / 4) / 120;
          i ? x.lineTo(px, py) : x.moveTo(px, py);
        });
        x.stroke();
      });
    }
    let rafId = requestAnimationFrame(function loop() {
      drawMuse();
      rafId = requestAnimationFrame(loop);
    });

    const secureOK = location.hostname === "localhost" || location.protocol === "https:";
    const chromeOK = /Chrome\//.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent);
    if ($("chromeStatus")) {
      $("chromeStatus").textContent = secureOK ? (chromeOK ? "✓ Chrome + localhost พร้อมใช้งาน" : "✓ localhost พร้อมใช้งาน") : "⚠ เปิดผิดวิธี";
      $("chromeStatus").style.background = secureOK ? "#123c2b" : "#4a1d22";
    }

    let museModulePromise = null;
    let museModuleReady = null;
    let selectedMuseDevice = null;
    let selectedMuseGatt = null;
    const MUSE_SERVICE = "0000fe8d-0000-1000-8000-00805f9b34fb";

    function setMuseStatus(message, isError = false) {
      const s = getEl("museStatus");
      if (s) {
        s.textContent = message;
        s.style.color = isError ? "#ff8b8b" : "#7ee7d8";
      }
      museMessage(message, isError);
    }
    function setStage(stage, state = "active") {
      const el = getEl("museGattStages");
      if (!el) return;
      el.querySelectorAll("[data-stage]").forEach((x) => {
        if (x.dataset.stage === stage) {
          x.textContent = "● " + x.dataset.label;
          x.style.opacity = "1";
        }
      });
    }
    function resetStages() {
      const el = getEl("museGattStages");
      if (!el) return;
      el.querySelectorAll("[data-stage]").forEach((x) => {
        x.textContent = "○ " + x.dataset.label;
        x.style.opacity = ".5";
      });
    }
    async function loadMuseDriver() {
      if (museModuleReady) return museModuleReady;
      if (!museModulePromise) museModulePromise = import("https://cdn.jsdelivr.net/npm/muse-jsx@0.3.1/+esm").then((m) => (museModuleReady = m));
      return museModulePromise;
    }
    async function prepareMuse() {
      const b = getEl("connectMuseBtn");
      b.disabled = true;
      b.textContent = "Preparing Muse…";
      try {
        await loadMuseDriver();
        b.disabled = false;
        b.textContent = "Connect Muse 2 / เชื่อมต่อ Muse 2";
        setMuseStatus("Ready / พร้อมเชื่อมต่อ");
      } catch (e) {
        setMuseStatus("Muse driver load failed: " + e.message, true);
      }
    }
    async function connectMuse() {
      const b = getEl("connectMuseBtn");
      resetStages();
      if (!window.isSecureContext) {
        setMuseStatus("ต้องเปิดผ่าน HTTPS", true);
        return;
      }
      if (!navigator.bluetooth) {
        setMuseStatus("Web Bluetooth ไม่พร้อม กรุณาใช้ Google Chrome", true);
        return;
      }
      if (!museModuleReady) {
        setMuseStatus("Muse driver ยังไม่พร้อม กรุณารอสักครู่", true);
        return;
      }
      try {
        b.disabled = true;
        b.textContent = "Select Muse-xxxx… / เลือก Muse…";
        setMuseStatus("1/4 เลือกอุปกรณ์ Muse-xxxx ในหน้าต่าง Bluetooth");
        museClient = new museModuleReady.MuseClient();

        // Official muse-jsx browser flow: connect() opens Web Bluetooth chooser itself.
        await museClient.connect();
        setStage("found");
        setStage("gatt");
        setStage("service");
        setMuseStatus("2/4 Muse connected. Starting EEG… / เชื่อมต่อแล้ว กำลังเริ่ม EEG");

        await museClient.start();
        setMuseStatus("3/4 EEG started. Waiting for first packet… / รอข้อมูล EEG");

        if (eegSub) {
          try {
            eegSub.unsubscribe();
          } catch (e) {}
        }
        let firstPacket = false;
        eegSub = museClient.eegReadings.subscribe({
          next: (reading) => {
            packetCount++;
            const electrode = Number(reading.electrode);
            const samples = Array.isArray(reading.samples) ? reading.samples : [];
            if (electrode >= 0 && electrode < 4 && samples.length) {
              latest[electrode] = samples[samples.length - 1];
              samples.forEach((v) => {
                if (Number.isFinite(v)) {
                  traces[electrode].push(v);
                  if (traces[electrode].length > 512) traces[electrode].shift();
                  plotBuffers[electrode].push(v);
                  if (plotBuffers[electrode].length > maxPlot) plotBuffers[electrode].shift();
                  if (baselineStart && !baselineFinalized) baselineSamples[electrode].push(v);
                }
              });
              if (!firstPacket) {
                firstPacket = true;
                setStage("eeg");
                setMuseStatus("4/4 Connected + EEG streaming / เชื่อมต่อและรับ EEG แล้ว");
                getEl("baselineBtn").disabled = false;
              }
            }
            renderMuse();
          },
          error: (err) => {
            setMuseStatus("EEG stream error: " + (err?.message || err), true);
            getEl("baselineBtn").disabled = true;
          },
        });
        museConnected = true;
        setMuseConnected(true);
        getEl("disconnectMuseBtn").disabled = false;
        getEl("stopBaselineBtn").disabled = true;
        b.textContent = "Muse 2 Connected / เชื่อมต่อแล้ว";
      } catch (err) {
        museConnected = false;
        setMuseConnected(false);
        b.disabled = false;
        b.textContent = "Connect Muse 2 / เชื่อมต่อ Muse 2";
        const n = err?.name || "Error",
          m = err?.message || String(err);
        if (n === "NotFoundError") setMuseStatus("ยกเลิกการเลือกอุปกรณ์ หรือไม่พบ Muse 2 กรุณากด Connect แล้วเลือก Muse-xxxx", true);
        else setMuseStatus("Muse connection error: " + n + " — " + m, true);
        try {
          if (eegSub) eegSub.unsubscribe();
        } catch (e) {}
        eegSub = null;
        try {
          if (museClient) museClient.disconnect();
        } catch (e) {}
        museClient = null;
      }
    }
    async function disconnectMuse() {
      clearTimeout(baselineTimer);
      clearTimeout(baselineHardStop);
      clearInterval(baselineTick);
      baselineStart = 0;
      try {
        if (eegSub) eegSub.unsubscribe();
      } catch (e) {}
      eegSub = null;
      try {
        if (museClient) museClient.disconnect();
      } catch (e) {}
      museClient = null;
      selectedMuseGatt = null;
      selectedMuseDevice = null;
      museConnected = false;
      const b = getEl("connectMuseBtn");
      b.disabled = false;
      b.textContent = "Connect Muse 2 / เชื่อมต่อ Muse 2";
      getEl("disconnectMuseBtn").disabled = true;
      getEl("baselineBtn").disabled = true;
      getEl("stopBaselineBtn").disabled = true;
      resetStages();
      setMuseStatus("Not connected / ยังไม่เชื่อมต่อ");
    }
    function startBaseline() {
      if (!museConnected) {
        setMuseStatus("Connect Muse 2 before starting the baseline / กรุณาเชื่อมต่อ Muse 2 ก่อน", true);
        return;
      }
      baselineSamples = [[], [], [], []];
      baselineFinalized = false;
      baselineStart = performance.now();
      getEl("baselineBtn").disabled = true;
      getEl("stopBaselineBtn").disabled = false;
      setMuseStatus("Baseline recording… / กำลังบันทึก Baseline 30 วินาที");
      baselineTick = setInterval(() => {
        if (!baselineStart) return;
        let el = performance.now() - baselineStart;
        let pct = Math.min(100, (el / 30000) * 100);
        const p = getEl("baselineProgress");
        if (p) p.style.width = pct + "%";
        const info = getEl("baselineInfo");
        if (info) info.textContent = "Baseline: recording " + Math.round(el / 1000) + "/30 s · Signal packets: " + packetCount;
      }, 200);
      baselineHardStop = setTimeout(() => stopBaseline(true), 30000);
    }
    function stopBaseline(auto) {
      clearTimeout(baselineTimer);
      clearTimeout(baselineHardStop);
      clearInterval(baselineTick);
      baselineHardStop = null;
      baselineTick = null;
      if (!baselineStart) return;
      baselineStart = 0;
      baselineFinalized = true;
      const p = getEl("baselineProgress");
      if (p) p.style.width = "0%";
      getEl("stopBaselineBtn").disabled = true;
      if (museConnected) getEl("baselineBtn").disabled = false;
      const names = ["TP9", "AF7", "AF8", "TP10"];
      const grid = getEl("baselineSummaryGrid");
      if (grid) {
        grid.innerHTML = baselineSamples
          .map((s, ch) => {
            if (!s.length) return `<div class="card metric"><small>${names[ch]}</small><b>—</b><span class="muted">No samples</span></div>`;
            const mean = s.reduce((a, b) => a + b, 0) / s.length;
            const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
            const min = Math.min(...s),
              max = Math.max(...s);
            return `<div class="card metric"><small>${names[ch]}</small><b>${mean.toFixed(2)} µV</b><span class="muted">SD ${sd.toFixed(2)} · ${min.toFixed(2)}–${max.toFixed(2)} µV</span></div>`;
          })
          .join("");
      }
      const sum = getEl("baselineSummary");
      if (sum) sum.style.display = "block";
      const info = getEl("baselineInfo");
      if (info) info.textContent = (auto ? "Baseline 30 s complete / ครบ 30 วินาที" : "Baseline stopped / หยุด Baseline") + " · Signal packets: " + packetCount;
      setMuseStatus(auto ? "Baseline complete / Baseline เสร็จสิ้น" : "Baseline stopped / หยุด Baseline แล้ว");
    }

    prepareMuse();

    getEl("connectMuseBtn").addEventListener("click", connectMuse);
    getEl("disconnectMuseBtn").addEventListener("click", disconnectMuse);
    getEl("baselineBtn").addEventListener("click", startBaseline);
    getEl("stopBaselineBtn").addEventListener("click", () => stopBaseline(false));

    /* ---------- PWA: service worker + install prompt ---------- */
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    let installPrompt = null;
    const onBeforeInstall = (e) => {
      e.preventDefault();
      installPrompt = e;
      const box = document.getElementById("installBox");
      if (box) box.style.display = "block";
    };
    const onInstalled = () => {
      const box = document.getElementById("installBox");
      if (box) box.style.display = "none";
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    const installBtn = document.getElementById("installBtn");
    const onInstallClick = async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      document.getElementById("installBox").style.display = "none";
    };
    if (installBtn) installBtn.addEventListener("click", onInstallClick);

    /* ---------- expose globals (used by innerHTML-generated handlers) ---------- */
    Object.assign(window, {
      logoutUser,
      toggleLang,
      exportCSV,
      simulate,
      makeFeatures,
      miniCogInterpret,
      startGame,
      answer1,
      answer2,
      answer3,
      saveProfile,
      calculateMMSE,
      saveMMSE,
      mmseEdu,
      restartJourney,
      renderDashboard,
      renderHistory,
    });

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(baselineTimer);
      clearTimeout(baselineHardStop);
      clearInterval(baselineTick);
      try {
        if (eegSub) eegSub.unsubscribe();
      } catch (e) {}
      try {
        if (museClient) museClient.disconnect();
      } catch (e) {}
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (installBtn) installBtn.removeEventListener("click", onInstallClick);
    };
  }, []);

  const call = (name, ...args) => {
    if (typeof window !== "undefined" && typeof window[name] === "function") window[name](...args);
  };

  return (
    <>
      {/* ---------- Session check ---------- */}
      {authed === null && (
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "25px",
            background: "linear-gradient(135deg,#050b14,#0b1e35)",
          }}
        >
          <div className="card" style={{ width: "min(470px,100%)", textAlign: "center" }}>
            <div className="brand" style={{ marginBottom: "8px" }}>
              CogniLoad<span>-XAI</span>
            </div>
            <p className="muted">กำลังตรวจสอบเซสชัน… / Checking session…</p>
          </div>
        </div>
      )}

      {/* ---------- Auth screen ---------- */}
      <div
        id="authScreen"
        style={{
          minHeight: "100vh",
          display: authed === false ? "grid" : "none",
          placeItems: "center",
          padding: "25px",
          background: "linear-gradient(135deg,#050b14,#0b1e35)",
        }}
      >
        <div className="card" style={{ width: "min(470px,100%)" }}>
          <div className="brand" style={{ marginBottom: "8px" }}>
            CogniLoad<span>-XAI</span>
            <div style={{ fontSize: "11px", color: "#8da3ba", marginTop: "4px" }}>Cognitive Assessment System</div>
          </div>
          <h2 id="authTitle">{mode === "login" ? "Sign in / เข้าสู่ระบบ" : "Register / สมัครสมาชิก"}</h2>
          <p className="muted">Research participant portal / ระบบสำหรับผู้เข้าร่วมการวิจัย</p>
          <div className="controls" style={{ gap: "8px" }}>
            <button type="button" className={mode === "login" ? "" : "secondary"} onClick={() => switchMode("login")}>
              Sign in / เข้าสู่ระบบ
            </button>
            <button type="button" className={mode === "register" ? "" : "secondary"} onClick={() => switchMode("register")}>
              Register / สมัครสมาชิก
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitAuth();
            }}
          >
            {mode === "register" && (
              <label>
                Full name / ชื่อ-นามสกุล
                <input
                  id="authName"
                  type="text"
                  autoComplete="name"
                  maxLength={80}
                  placeholder="สมชาย ใจดี (optional)"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>
            )}
            <label>
              Email
              <input
                id="authEmail"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password / รหัสผ่าน
              <input
                id="authPass"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                placeholder={mode === "register" ? "At least 8 characters / อย่างน้อย 8 ตัวอักษร" : "Your password / รหัสผ่านของคุณ"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {mode === "register" && (
              <label>
                Confirm password / ยืนยันรหัสผ่าน
                <input
                  id="authPassConfirm"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Type the same password again / กรอกรหัสผ่านเดิมอีกครั้ง"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: "8px", flexDirection: "row", margin: "10px 0" }}>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                style={{ width: "auto", margin: 0 }}
              />
              <span style={{ fontWeight: 400 }}>Show password / แสดงรหัสผ่าน</span>
            </label>
            <div className="controls">
              <button type="submit" disabled={busy}>
                {busy ? "Please wait… / กำลังดำเนินการ" : mode === "login" ? "Sign in / เข้าสู่ระบบ" : "Create account / สมัครสมาชิก"}
              </button>
            </div>
          </form>
          <div id="authMsg" className="muted" style={authError ? { color: "#ff8b8b" } : undefined} aria-live="polite">
            {authMessage ||
              (mode === "register"
                ? "สมัครสมาชิกเพื่อเริ่มการประเมิน / Create an account to start the assessment."
                : "ยังไม่มีบัญชี? กด Register เพื่อสมัคร / No account yet? Use Register to create one.")}
          </div>
        </div>
      </div>

      {/* ---------- App shell ---------- */}
      <div id="appShell" style={{ display: authed === true ? "block" : "none" }}>
        <header>
          <div className="brand">
            CogniLoad<span>-XAI</span>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button className="secondary" id="langBtn" onClick={() => call("toggleLang")}>
              ไทย
            </button>
            <div className="badge">EEG Cognitive Workload Research Prototype</div>
          </div>
        </header>
        <div className="wrap">
          <main>
            {/* ---------- Journey ---------- */}
            <section id="journey" className="active">
              <div className="hero">
                <div>
                  <h1>Assessment Journey / ลำดับการประเมิน</h1>
                  <p>Complete each assessment in order. A summary is shown only after all stages are completed.</p>
                </div>
                <button className="secondary" onClick={() => call("logoutUser")}>
                  Logout / ออกจากระบบ
                </button>
              </div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
                <div className="card metric">
                  <small>1</small>
                  <b style={{ fontSize: "16px" }}>Profile</b>
                  <span id="s1" className="pill">
                    Ready
                  </span>
                </div>
                <div className="card metric">
                  <small>2</small>
                  <b style={{ fontSize: "16px" }}>Screening</b>
                  <span id="s2" className="pill">
                    Locked
                  </span>
                </div>
                <div className="card metric">
                  <small>3</small>
                  <b style={{ fontSize: "16px" }}>Game 1</b>
                  <span id="s3" className="pill">
                    Locked
                  </span>
                </div>
                <div className="card metric">
                  <small>4</small>
                  <b style={{ fontSize: "16px" }}>Game 2</b>
                  <span id="s4" className="pill">
                    Locked
                  </span>
                </div>
                <div className="card metric">
                  <small>5</small>
                  <b style={{ fontSize: "16px" }}>Game 3</b>
                  <span id="s5" className="pill">
                    Locked
                  </span>
                </div>
              </div>

              <div className="card" style={{ marginTop: "14px" }}>
                <div className="hero">
                  <div>
                    <h3 style={{ marginBottom: "6px" }}>Muse 2 EEG / ระบบเชื่อมต่อคลื่นสมอง</h3>
                    <p className="muted">Web Bluetooth · TP9, AF7, AF8, TP10 · 256 Hz</p>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <span id="chromeStatus" className="pill">
                      Checking browser…
                    </span>
                    <span id="museStatus" className="pill">
                      ● Not connected / ยังไม่เชื่อมต่อ
                    </span>
                  </div>
                </div>
                <div className="controls">
                  <button id="connectMuseBtn" type="button" style={{ fontSize: "17px", padding: "14px 22px" }}>
                    Connect Muse 2 &amp; Start Assessment / เชื่อมต่อและเริ่มประเมิน
                  </button>

                  <button id="disconnectMuseBtn" className="secondary" type="button" disabled>
                    Disconnect
                  </button>
                  <button id="baselineBtn" className="secondary" type="button" disabled>
                    Start 30-sec Baseline / เริ่ม Baseline
                  </button>
                  <button id="stopBaselineBtn" className="secondary" type="button" disabled>
                    Stop Baseline / หยุด
                  </button>
                </div>
                <div id="btHelp" className="notice" style={{ display: "none" }}></div>
                <div id="museGattStages" style={{ display: "flex", flexWrap: "wrap", gap: "10px", margin: "10px 0", fontSize: "12px" }}>
                  <span data-stage="found" data-label="Muse Found" style={{ opacity: ".5" }}>
                    ○ Muse Found
                  </span>
                  <span data-stage="gatt" data-label="GATT Connected" style={{ opacity: ".5" }}>
                    ○ GATT Connected
                  </span>
                  <span data-stage="service" data-label="Service Found" style={{ opacity: ".5" }}>
                    ○ Service Found
                  </span>
                  <span data-stage="eeg" data-label="EEG Receiving" style={{ opacity: ".5" }}>
                    ○ EEG Receiving
                  </span>
                </div>
                <div className="muted" style={{ marginTop: "8px" }}>
                  เปิด Muse 2 → กด Connect Muse 2 → เลือก <b>Muse-xxxx</b> → เมื่อขึ้น “Connected + EEG streaming” จึงเริ่ม Baseline 30 วินาที
                </div>

                <div id="installBox" className="notice" style={{ display: "none" }}>
                  <b>Install CogniLoad-XAI / ติดตั้งเป็นแอป</b>
                  <br />
                  เมื่อติดตั้งแล้วสามารถเปิด CogniLoad-XAI จาก Mac ได้เหมือนแอปทั่วไป โดยไม่ต้องเปิดไฟล์หรือ Terminal
                  <div className="controls">
                    <button id="installBtn" type="button">
                      Install App / ติดตั้งแอป
                    </button>
                  </div>
                </div>
                <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
                  <div className="card metric">
                    <small>TP9</small>
                    <b id="ch0">—</b>
                    <span className="muted">µV</span>
                  </div>
                  <div className="card metric">
                    <small>AF7</small>
                    <b id="ch1">—</b>
                    <span className="muted">µV</span>
                  </div>
                  <div className="card metric">
                    <small>AF8</small>
                    <b id="ch2">—</b>
                    <span className="muted">µV</span>
                  </div>
                  <div className="card metric">
                    <small>TP10</small>
                    <b id="ch3">—</b>
                    <span className="muted">µV</span>
                  </div>
                </div>
                <canvas id="museCanvas" width="1100" height="220" style={{ marginTop: "14px" }}></canvas>
                <div style={{ marginTop: "12px", background: "#10243b", borderRadius: "10px", overflow: "hidden", height: "12px" }}>
                  <div id="baselineProgress" style={{ height: "100%", width: "0%", background: "#42d9f5", transition: "width .2s linear" }}></div>
                </div>
                <div id="baselineInfo" className="muted" style={{ marginTop: "10px" }}>
                  Baseline: not recorded / ยังไม่ได้บันทึก · Signal packets: 0
                </div>
                <div
                  id="baselineSummary"
                  style={{ display: "none", marginTop: "14px", padding: "14px", border: "1px solid rgba(255,255,255,.12)", borderRadius: "12px", background: "rgba(8,21,34,.55)" }}
                >
                  <div style={{ fontWeight: 700, marginBottom: "10px" }}>Baseline 30-second Summary / สรุปผล Baseline 30 วินาที</div>
                  <div id="baselineSummaryGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "10px" }}></div>
                  <div className="muted" style={{ marginTop: "10px" }}>
                    ค่าด้านล่างเป็นสรุปคุณภาพ/สถิติของสัญญาณ EEG ที่บันทึก ไม่ใช่ผลวินิจฉัยทางการแพทย์
                  </div>
                </div>
              </div>
              <div id="stepbox" className="card" style={{ marginTop: "14px" }}></div>
            </section>

            {/* ---------- Dashboard ---------- */}
            <section id="dashboard">
              <div className="hero">
                <div>
                  <h1>Research Dashboard / แดชบอร์ด</h1>
                  <p>Member login history, assessment status, cognitive screening and game-performance overview.</p>
                </div>
                <button onClick={() => call("exportCSV")}>Export CSV</button>
              </div>
              <div id="dashRisk" className="risk-banner">
                Complete an assessment to view the screening level. / ทำการประเมินให้ครบเพื่อดูระดับคัดกรอง
              </div>
              <div className="grid">
                <div className="card metric">
                  <small>Current member</small>
                  <b id="dMember" style={{ fontSize: "17px" }}>
                    —
                  </b>
                </div>
                <div className="card metric">
                  <small>Login count</small>
                  <b id="dLogins">0</b>
                </div>
                <div className="card metric">
                  <small>MMSE</small>
                  <b id="dMMSE">—</b>
                </div>
                <div className="card metric">
                  <small>Assessments</small>
                  <b id="dAssess">0</b>
                </div>
              </div>
              <div className="two">
                <div className="card">
                  <h3>Game performance / ผลเกม</h3>
                  <div id="gameChart" className="chartbox"></div>
                  <p className="muted">Accuracy by completed cognitive game.</p>
                </div>
                <div className="card">
                  <h3>Screening level / ระดับคัดกรอง</h3>
                  <div className="donutwrap">
                    <div id="riskDonut" className="donut"></div>
                    <div id="riskDonutText" className="donuttext">
                      No data
                    </div>
                  </div>
                  <p id="riskExplain" className="muted" style={{ textAlign: "center", marginTop: "15px" }}></p>
                </div>
              </div>
              <div className="two">
                <div className="card">
                  <h3>Login history / ประวัติการเข้าสู่ระบบ</h3>
                  <div id="loginHistory" className="muted"></div>
                </div>
                <div className="card">
                  <h3>Interpretation note / หมายเหตุ</h3>
                  <p className="muted">
                    Green/yellow/red is a dashboard communication layer. MMSE-Thai 2002 has validated education-specific screening cut-offs, but it does not provide an official
                    three-color severity classification. Red is therefore used for a score at/below the MMSE screening cut-off; yellow is used for a score within 3 points above
                    that cut-off; green is more than 3 points above it. Game results are shown separately and do not change the MMSE screening category.
                  </p>
                </div>
              </div>
            </section>

            {/* ---------- Participant ---------- */}
            <section id="participant">
              <h1>Participant &amp; Session</h1>
              <div className="card">
                <div className="formgrid">
                  <label>
                    Anonymous Participant ID
                    <input defaultValue="P001" />
                  </label>
                  <label>
                    Age
                    <input type="number" defaultValue="18" />
                  </label>
                  <label>
                    Sex
                    <select defaultValue="Moderate workload">
                      <option>Prefer not to say</option>
                      <option>Female</option>
                      <option>Male</option>
                    </select>
                  </label>
                  <label>
                    Task condition
                    <select defaultValue="Moderate workload">
                      <option>Low workload</option>
                      <option>Moderate workload</option>
                      <option>High workload</option>
                    </select>
                  </label>
                  <label>
                    Session
                    <input defaultValue="S01" />
                  </label>
                  <label>
                    Sampling rate (Hz)
                    <input type="number" defaultValue="256" />
                  </label>
                </div>
              </div>
            </section>

            {/* ---------- Acquisition ---------- */}
            <section id="acquisition">
              <h1>EEG Acquisition</h1>
              <div className="card">
                <p className="muted">Import EEG data for prototype analysis. CSV demo parsing is performed locally in your browser.</p>
                <div className="controls">
                  <label className="filelabel">
                    Import CSV
                    <input id="file" type="file" accept=".csv" hidden />
                  </label>
                  <button className="secondary" onClick={() => call("simulate")}>
                    Use Demo EEG
                  </button>
                </div>
                <div id="fileinfo" className="muted">
                  No file loaded.
                </div>
              </div>
            </section>

            {/* ---------- Preprocess ---------- */}
            <section id="preprocess">
              <h1>EEG Preprocessing</h1>
              <div className="two">
                <div className="card">
                  <h3>Pipeline</h3>
                  <table>
                    <tbody>
                      <tr>
                        <td>1</td>
                        <td>Band-pass filter</td>
                        <td>1–45 Hz</td>
                      </tr>
                      <tr>
                        <td>2</td>
                        <td>Notch filter</td>
                        <td>50 Hz</td>
                      </tr>
                      <tr>
                        <td>3</td>
                        <td>Artifact handling</td>
                        <td>Prototype threshold</td>
                      </tr>
                      <tr>
                        <td>4</td>
                        <td>Epoching</td>
                        <td>2 s windows</td>
                      </tr>
                    </tbody>
                  </table>
                  <button onClick={() => alert("Demo preprocessing completed.")}>Run Preprocessing</button>
                </div>
                <div className="card">
                  <h3>Quality Control</h3>
                  <div className="metric">
                    <small>Usable epochs</small>
                    <b>94%</b>
                  </div>
                  <div className="metric">
                    <small>Rejected epochs</small>
                    <b>6%</b>
                  </div>
                </div>
              </div>
            </section>

            {/* ---------- Features ---------- */}
            <section id="features">
              <h1>EEG Feature Extraction</h1>
              <div className="card">
                <table>
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>Demo value</th>
                      <th>Use</th>
                    </tr>
                  </thead>
                  <tbody id="featureRows"></tbody>
                </table>
                <button onClick={() => call("makeFeatures")}>Extract Features</button>
              </div>
            </section>

            {/* ---------- Models ---------- */}
            <section id="models">
              <h1>Machine &amp; Deep Learning Comparison</h1>
              <div className="card">
                <table>
                  <tbody>
                    <tr>
                      <th>Model</th>
                      <th>Accuracy</th>
                      <th>F1</th>
                      <th>Status</th>
                    </tr>
                    <tr>
                      <td>Random Forest</td>
                      <td>0.86</td>
                      <td>0.85</td>
                      <td>Selected</td>
                    </tr>
                    <tr>
                      <td>SVM</td>
                      <td>0.83</td>
                      <td>0.82</td>
                      <td>Compared</td>
                    </tr>
                    <tr>
                      <td>XGBoost</td>
                      <td>0.85</td>
                      <td>0.84</td>
                      <td>Compared</td>
                    </tr>
                    <tr>
                      <td>1D-CNN</td>
                      <td>0.87</td>
                      <td>0.86</td>
                      <td>Placeholder</td>
                    </tr>
                    <tr>
                      <td>LSTM</td>
                      <td>0.84</td>
                      <td>0.83</td>
                      <td>Placeholder</td>
                    </tr>
                  </tbody>
                </table>
                <p className="muted">Values are demonstration data; replace with validated cross-validation/test results from your study.</p>
              </div>
            </section>

            {/* ---------- Cognitive screening ---------- */}
            <section id="cogscreen">
              <h1>Cognitive Screening / แบบคัดกรองการรู้คิด</h1>
              <div className="card">
                <p>
                  <b>Mini-Cog© integration placeholder for authorized research use</b>
                </p>
                <p className="muted">
                  The research version should use the official Thai Mini-Cog© form and scoring only after obtaining permission for research use. This app intentionally does not
                  reproduce or modify the copyrighted test items.
                </p>
                <p className="muted">
                  สำหรับการวิจัย ควรใช้แบบ Mini-Cog© ฉบับภาษาไทยอย่างเป็นทางการและเกณฑ์การให้คะแนนหลังได้รับอนุญาตสำหรับการวิจัย
                  ระบบนี้จึงไม่คัดลอกหรือดัดแปลงข้อคำถามของแบบทดสอบไว้ในเว็บ
                </p>
                <div className="formgrid">
                  <label>
                    Mini-Cog total score / คะแนนรวม Mini-Cog
                    <input id="mcscore" type="number" min="0" max="5" placeholder="0–5" />
                  </label>
                  <label>
                    Assessment date / วันที่ประเมิน
                    <input type="date" />
                  </label>
                </div>
                <div className="controls">
                  <button onClick={() => call("miniCogInterpret")}>Interpret / แปลผล</button>
                </div>
                <div id="mcresult" className="notice">
                  Enter an authorized Mini-Cog score. / กรุณากรอกคะแนนจากแบบประเมินที่ได้รับอนุญาต
                </div>
              </div>
              <div className="card" style={{ marginTop: "14px" }}>
                <h3>Research data linkage / การเชื่อมโยงข้อมูลวิจัย</h3>
                <p className="muted">
                  Store the screening score separately from EEG/game biomarkers, then test associations with workload features. Do not use the game score as a diagnosis of
                  Alzheimer’s disease.
                </p>
              </div>
            </section>

            {/* ---------- Games ---------- */}
            <section id="games">
              <h1>Experimental Cognitive Games / เกมประเมินการรู้คิดเชิงทดลอง</h1>
              <p className="notice">
                These three tasks are newly designed experimental paradigms for this prototype. They are not validated Alzheimer diagnostic tests. Research validation is required
                before clinical interpretation.
              </p>
              <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
                <div className="card">
                  <h3>1. Context Switch Trail</h3>
                  <p className="muted">บริบทสลับเส้นทาง: ทดสอบ working memory, rule switching และ response inhibition</p>
                  <button onClick={() => call("startGame", 1)}>Start / เริ่ม</button>
                </div>
                <div className="card">
                  <h3>2. Echo Sequence</h3>
                  <p className="muted">ลำดับสะท้อน: ทดสอบ temporal sequence memory และ delayed recognition</p>
                  <button onClick={() => call("startGame", 2)}>Start / เริ่ม</button>
                </div>
                <div className="card">
                  <h3>3. Pattern Drift</h3>
                  <p className="muted">รูปแบบเปลี่ยนแปลง: ทดสอบ visual change detection, attention และ processing speed</p>
                  <button onClick={() => call("startGame", 3)}>Start / เริ่ม</button>
                </div>
              </div>
              <div className="two">
                <div className="card">
                  <h3 id="gtitle">Game workspace / พื้นที่เกม</h3>
                  <div
                    id="gamebox"
                    style={{ minHeight: "240px", display: "grid", placeItems: "center", border: "1px dashed #294963", borderRadius: "12px", padding: "20px" }}
                  >
                    <span className="muted">Choose a game / เลือกเกม</span>
                  </div>
                </div>
                <div className="card">
                  <h3>Digital biomarkers / ตัวชี้วัดดิจิทัล</h3>
                  <table>
                    <tbody>
                      <tr>
                        <td>Accuracy</td>
                        <td id="gacc">—</td>
                      </tr>
                      <tr>
                        <td>Reaction time</td>
                        <td id="grt">—</td>
                      </tr>
                      <tr>
                        <td>Errors</td>
                        <td id="gerr">—</td>
                      </tr>
                      <tr>
                        <td>Variability</td>
                        <td id="gvar">—</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="muted">EEG event markers can later be synchronized to stimulus onset and responses.</p>
                </div>
              </div>
            </section>

            {/* ---------- History ---------- */}
            <section id="history">
              <h1>Assessment History / ประวัติการประเมิน</h1>
              <div className="card">
                <p className="muted">ประวัติผลการประเมินของสมาชิกที่เข้าสู่ระบบ</p>
                <div id="historyTable">ยังไม่มีข้อมูล / No assessment history</div>
                <div className="controls">
                  <button onClick={() => call("exportCSV")}>Export CSV</button>
                </div>
              </div>
            </section>

            {/* ---------- XAI ---------- */}
            <section id="xai">
              <h1>Explainable Artificial Intelligence</h1>
              <div className="two">
                <div className="card">
                  <h3>Feature Contribution</h3>
                  <table>
                    <tbody>
                      <tr>
                        <td>Theta/Alpha ratio</td>
                        <td>
                          <div className="bar">
                            <i style={{ width: "88%" }}></i>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td>Frontal Theta</td>
                        <td>
                          <div className="bar">
                            <i style={{ width: "72%" }}></i>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td>Parietal Alpha</td>
                        <td>
                          <div className="bar">
                            <i style={{ width: "61%" }}></i>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td>Beta power</td>
                        <td>
                          <div className="bar">
                            <i style={{ width: "43%" }}></i>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="card">
                  <h3>Interpretation</h3>
                  <p>The current demo prediction is influenced most strongly by the Theta/Alpha ratio and frontal Theta features.</p>
                  <p className="notice">This describes model behavior, not a causal neurological interpretation.</p>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
