"use client";

import { useEffect, useState } from "react";
import ResearchSession from "@/app/components/ResearchSession";
import ResearchDashboard from "@/app/components/ResearchDashboard";
import { LINE_WINDOW_SAMPLES, summarizeEegWindow } from "@/lib/eeg-signal-quality.mjs";
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
  storage_unavailable:
    "เซิร์ฟเวอร์บันทึกบัญชีไม่ได้ (พื้นที่จัดเก็บเป็นแบบอ่านอย่างเดียว) — ต้องตั้งค่าฐานข้อมูลหรือ deploy บนเซิร์ฟเวอร์ที่เขียนไฟล์ได้ / Server cannot store accounts (read-only filesystem) — configure a database or deploy on a writable server",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Home() {
  const [authed, setAuthed] = useState(null);
  const [account, setAccount] = useState("");
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
    if (authed !== false) return;
    const c = document.getElementById("authWave");
    if (!c || !c.getContext) return;
    const ctx = c.getContext("2d");
    let raf = 0;
    const layers = [
      { color: "rgba(51,214,255,.5)", amp: 46, speed: 0.9, freq: 1.6, width: 2 },
      { color: "rgba(155,123,255,.35)", amp: 30, speed: 1.4, freq: 2.4, width: 1.5 },
      { color: "rgba(79,224,161,.22)", amp: 22, speed: 0.6, freq: 3.2, width: 1 },
    ];
    const draw = (t) => {
      const w = c.width,
        h = c.height;
      ctx.clearRect(0, 0, w, h);
      layers.forEach((L) => {
        ctx.strokeStyle = L.color;
        ctx.lineWidth = L.width;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const p = (x / w) * Math.PI * 2 * L.freq;
          const y =
            h / 2 +
            Math.sin(p + (t / 1000) * L.speed) * L.amp +
            Math.sin(p * 3.7 + (t / 700) * L.speed) * L.amp * 0.3 +
            (Math.random() - 0.5) * 3;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [authed]);

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
      rts = [],
      currentFreeGame = 0,
      currentTrial = 0,
      acceptingResponse = false,
      gameRunId = 0;
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
    function emitTaskMarker(label) {
      window.dispatchEvent(new CustomEvent("research-task-marker", { detail: { label } }));
    }
    function startGame(n) {
      if (window.__studyPhase && window.__studyPhase !== "task") {
        alert("เริ่มเกมได้เฉพาะช่วง Task ของรอบทดลอง / Start a task during the Task phase");
        return;
      }
      if (window.__studyPhase === "task" && window.__studyGameId !== n) {
        alert("รอบทดลองนี้กำหนดเกมอื่นไว้ กรุณาใช้เกมที่เลือกก่อนเริ่มบันทึก");
        return;
      }
      if (window.__studyPhase === "task" && currentFreeGame) return;
      const runId = ++gameRunId;
      currentFreeGame = n;
      currentTrial = 0;
      acceptingResponse = false;
      correct = 0;
      total = 0;
      errors = 0;
      rts = [];
      setMetrics();
      emitTaskMarker(`game_${n}_start`);
      if (n === 1) game1(runId);
      if (n === 2) game2(runId);
      if (n === 3) game3(runId);
    }
    let game1Truth = "";
    function game1(runId) {
      if (currentFreeGame !== 1 || runId !== gameRunId) return;
      currentTrial++;
      $("gtitle").textContent = "Odd or Even / คี่หรือคู่";
      let box = $("gamebox");
      let num = Math.ceil(Math.random() * 9);
      game1Truth = num % 2 === 1 ? "ODD" : "EVEN";
      box.innerHTML = `<div style="text-align:center"><p>Odd or even? / คี่หรือคู่?</p><div style="font-size:70px">${num}</div><button onclick="answer1('ODD')">ODD / คี่</button> <button class="secondary" onclick="answer1('EVEN')">EVEN / คู่</button></div>`;
      timerStart = performance.now();
      acceptingResponse = true;
      emitTaskMarker(`game_1_trial_${currentTrial}_stimulus_${num}`);
    }
    function answer1(chosen) {
      if (currentFreeGame !== 1 || !acceptingResponse) return;
      acceptingResponse = false;
      total++;
      let ok = chosen === game1Truth;
      if (ok) correct++;
      else errors++;
      const rt = Math.round(performance.now() - timerStart);
      rts.push(rt);
      emitTaskMarker(`game_1_trial_${currentTrial}_response_${chosen}_${ok ? "correct" : "incorrect"}_rt_${rt}ms`);
      setMetrics();
      const runId = gameRunId;
      setTimeout(() => game1(runId), 250);
    }
    let seq = [];
    function game2(runId) {
      if (currentFreeGame !== 2 || runId !== gameRunId) return;
      currentTrial++;
      acceptingResponse = false;
      $("gtitle").textContent = "Echo Sequence / ลำดับสะท้อน";
      let box = $("gamebox");
      seq = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6));
      box.innerHTML = `<div style="text-align:center"><p>Remember / จำลำดับ</p><div style="font-size:45px;letter-spacing:20px">${seq.join(" ")}</div></div>`;
      emitTaskMarker(`game_2_trial_${currentTrial}_stimulus_${seq.join("")}`);
      setTimeout(() => {
        if (currentFreeGame !== 2 || runId !== gameRunId) return;
        box.innerHTML = `<div><p>Enter sequence / ใส่ลำดับ</p><input id="seqin" inputmode="numeric" maxlength="16" placeholder="e.g. 1 3 5 2"><button onclick="answer2()">Submit</button></div>`;
        timerStart = performance.now();
        acceptingResponse = true;
        emitTaskMarker(`game_2_trial_${currentTrial}_response_prompt`);
      }, 2200);
    }
    function answer2() {
      if (currentFreeGame !== 2 || !acceptingResponse) return;
      acceptingResponse = false;
      let v = $("seqin").value.replace(/\s/g, "").slice(0, 16).replace(/[^0-9]/g, ""),
        truth = seq.join("");
      total++;
      const ok = v === truth;
      if (ok) correct++;
      else errors++;
      const rt = Math.round(performance.now() - timerStart);
      rts.push(rt);
      emitTaskMarker(`game_2_trial_${currentTrial}_response_${v || "empty"}_${ok ? "correct" : "incorrect"}_rt_${rt}ms`);
      setMetrics();
      const runId = gameRunId;
      setTimeout(() => game2(runId), 400);
    }
    function game3(runId) {
      if (currentFreeGame !== 3 || runId !== gameRunId) return;
      currentTrial++;
      $("gtitle").textContent = "Pattern Drift / รูปแบบเปลี่ยนแปลง";
      let box = $("gamebox"),
        change = Math.random() > 0.5;
      let arr = ["●", "▲", "■", "◆", "★", "⬟"];
      let a = arr.slice(0, 5),
        b = a.slice();
      if (change) b[2] = "⬟";
      box.innerHTML = `<div style="text-align:center"><p>Did the pattern change? / รูปแบบเปลี่ยนหรือไม่?</p><div style="font-size:40px">${a.join(" ")}</div><div style="font-size:40px;margin:15px">${b.join(" ")}</div><button onclick="answer3(${change},true)">Changed</button> <button class="secondary" onclick="answer3(${change},false)">Same</button></div>`;
      timerStart = performance.now();
      acceptingResponse = true;
      emitTaskMarker(`game_3_trial_${currentTrial}_stimulus_${change ? "changed" : "same"}`);
    }
    function answer3(truth, choice) {
      if (currentFreeGame !== 3 || !acceptingResponse) return;
      acceptingResponse = false;
      total++;
      const ok = truth === choice;
      if (ok) correct++;
      else errors++;
      const rt = Math.round(performance.now() - timerStart);
      rts.push(rt);
      emitTaskMarker(`game_3_trial_${currentTrial}_response_${choice ? "changed" : "same"}_${ok ? "correct" : "incorrect"}_rt_${rt}ms`);
      setMetrics();
      const runId = gameRunId;
      setTimeout(() => game3(runId), 300);
    }
    const onResearchTaskEnded = () => {
      if (currentFreeGame && window.__studyPhase === "task") {
        const meanRt = rts.length ? Math.round(rts.reduce((sum, value) => sum + value, 0) / rts.length) : 0;
        emitTaskMarker(`game_${currentFreeGame}_end_trials_${total}_correct_${correct}_errors_${errors}_mean_rt_${meanRt}ms`);
      }
      currentFreeGame = 0;
      acceptingResponse = false;
      gameRunId++;
      const finishTaskBtn = $("finishTaskBtn");
      if (finishTaskBtn) finishTaskBtn.hidden = true;
      const box = $("gamebox");
      if (box) box.innerHTML = '<span class="muted">กิจกรรมสิ้นสุด · กำลังเก็บ EEG ต่ออีก 30 วินาที / Recording 30 more seconds</span>';
    };
    const onResearchTaskStart = (event) => {
      const selectedGame = Number(event.detail?.gameId);
      if (![1, 2, 3].includes(selectedGame)) return;
      showSection("games");
      startGame(selectedGame);
      const finishTaskBtn = $("finishTaskBtn");
      if (finishTaskBtn) finishTaskBtn.hidden = false;
    };
    const onFinishTaskClick = () => window.dispatchEvent(new Event("research-task-complete"));
    const finishTaskBtn = $("finishTaskBtn");
    finishTaskBtn?.addEventListener("click", onFinishTaskClick);
    window.addEventListener("research-task-ended", onResearchTaskEnded);
    window.addEventListener("research-task-start", onResearchTaskStart);
    const onResearchSessionFinished = () => showSection("journey");
    window.addEventListener("research-session-finished", onResearchSessionFinished);

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
      if (window.__studyUnexported && !window.confirm("มีข้อมูลการทดลองที่ยังไม่ได้ส่งออก ต้องการออกจากระบบหรือไม่?")) return;
      if (museConnected) await disconnectMuse();
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {}
      sessionStorage.removeItem("cogni_login");
      sessionStorage.removeItem("cogni_name");
      setAccount("");
      setAuthed(false);
    }
    window.__enterApp = (accountEmail, displayName, fresh) => {
      initApp(accountEmail, displayName, fresh);
      setAccount(String(displayName || accountEmail || ""));
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
      const id = $("jpId").value.trim();
      const age = Number($("jpAge").value);
      if (!id) {
        alert("กรุณากรอกรหัสผู้เข้าร่วม / Please enter a Participant ID");
        return;
      }
      if (!Number.isFinite(age) || age < 10 || age > 120) {
        alert("อายุต้องเป็นตัวเลขระหว่าง 10–120 / Age must be a number between 10–120");
        return;
      }
      journey.profile = {
        id,
        age,
        hand: $("jpHand").value,
        session: $("jpSession").value.trim() || "S01",
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
        hist.push({ date: new Date().toISOString(), screen: journey.screen, games: journey.games, profile: journey.profile, eeg: journey.eeg || null });
        localStorage.setItem("cogni_assessments_" + em, JSON.stringify(hist));
        journey.completedSaved = true;
        saveJourney();
      }
      let avg = journey.games.length ? Math.round(journey.games.reduce((a, x) => a + x.accuracy, 0) / journey.games.length) : 0;
      let baselineCard;
      if (journey.eeg) {
        baselineCard = `<div class="card" style="margin-top:14px"><h3>EEG Baseline (Muse 2) / คลื่นสมองช่วง Baseline</h3><table><tr><th>Channel</th><th>Mean</th><th>SD</th><th>Range</th></tr>${journey.eeg.channels
          .map(
            (c) =>
              `<tr><td>${c.name}</td><td>${c.samples ? c.mean + " µV" : "—"}</td><td>${c.samples ? c.sd + " µV" : "—"}</td><td>${c.samples ? c.min + "–" + c.max + " µV" : "—"}</td></tr>`
          )
          .join("")}</table><p class="muted">Recorded ${new Date(journey.eeg.recordedAt).toLocaleString()} · ${journey.eeg.packets} packets · Research signal-quality metrics, not a medical measurement.</p></div>`;
      } else {
        baselineCard = `<div class="card" style="margin-top:14px"><h3>EEG Baseline (Muse 2) / คลื่นสมองช่วง Baseline</h3><p class="muted">ยังไม่ได้บันทึก Baseline — เชื่อมต่อ Muse 2 แล้วกด Start 30-sec Baseline ที่ส่วนบน / Baseline not recorded — connect Muse 2 and start the 30-second baseline above.</p></div>`;
      }
      $("stepbox").innerHTML = `<h2>Assessment Summary / สรุปผลการประเมิน</h2><div class="grid"><div class="card metric"><small>Screening score</small><b>${journey.screen ? journey.screen.total + "/" + journey.screen.max : "—"}</b></div><div class="card metric"><small>Mean game accuracy</small><b>${avg}%</b></div><div class="card metric"><small>Completed games</small><b>${journey.games.length}/3</b></div><div class="card metric"><small>Status</small><b>Complete</b></div></div>${baselineCard}<div class="card" style="margin-top:14px"><h3>Game results</h3><table><tr><th>Game</th><th>Accuracy</th><th>Reaction time</th><th>Errors</th><th>RT variability</th></tr>${journey.games
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
          "eeg_recorded_at",
          "eeg_packets",
          "tp9_mean_uv",
          "af7_mean_uv",
          "af8_mean_uv",
          "tp10_mean_uv",
        ],
      ];
      let records = hist.length ? hist : [{ date: "", screen: journey.screen, games: journey.games, profile: journey.profile, eeg: journey.eeg || null }];
      records.forEach((a) => {
        let s = a.screen || {},
          g = a.games || [],
          p = a.profile || {},
          e = a.eeg,
          d = s.total == null ? "" : s.total <= s.cut ? "red" : s.total - s.cut <= 3 ? "yellow" : "green";
        let eegCols = e
          ? [e.recordedAt, e.packets, ...[0, 1, 2, 3].map((i) => (e.channels[i]?.samples ? e.channels[i].mean : ""))]
          : ["", "", "", "", "", ""];
        rows.push([em, logs.length, a.date, p.id, p.age, s.education, s.total, s.max, s.cut, s.screenPositive, d, ...[0, 1, 2].flatMap((i) => [g[i]?.accuracy, g[i]?.rt, g[i]?.errors]), ...eegCols]);
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
      museConnected = false,
      museManualDisconnect = false;
    const plotBuffers = [[], [], [], []],
      maxPlot = 500;
    let latest = [null, null, null, null],
      traces = [[], [], [], []],
      lastQualityAt = 0;

    function museMessage(msg, isError = false) {
      const h = $("btHelp");
      if (!h) return;
      h.style.display = "block";
      h.style.borderLeftColor = isError ? "var(--red)" : "var(--cyan)";
      h.textContent = msg;
    }
    function setMuseConnected(on, deviceName = null) {
      const s = $("museStatus");
      s.textContent = on
        ? "● Connected" + (deviceName ? ": " + deviceName : "") + " / เชื่อมต่อแล้ว"
        : "● Not connected / ยังไม่เชื่อมต่อ";
      s.style.background = on ? "#123c2b" : "#0a3140";
      if (!on) {
        latest = [null, null, null, null];
        traces = [[], [], [], []];
        plotBuffers.forEach((buffer) => { buffer.length = 0; });
        for (let channel = 0; channel < 4; channel++) {
          $("ch" + channel).textContent = "—";
          $("muse50_" + channel).textContent = "50 Hz: —";
        }
        $("museNoiseWarning").style.display = "none";
        window.__museReady = false;
        window.dispatchEvent(new CustomEvent("muse-study-status", { detail: { ready: false } }));
      }
    }
    function renderMuse() {
      for (let ch = 0; ch < 4; ch++) {
        const el = $("ch" + ch);
        if (el && latest[ch] != null && Number.isFinite(latest[ch])) el.textContent = latest[ch].toFixed(2);
      }
    }
    function updateMuseQuality() {
      if (Date.now() - lastQualityAt < 1000) return;
      lastQualityAt = Date.now();
      const noisy = [];
      traces.forEach((samples, channel) => {
        const quality = summarizeEegWindow(samples);
        const label = $("muse50_" + channel);
        if (label) label.textContent = quality ? `50 Hz ≈ ${quality.line50AmplitudeUv.toFixed(1)} µV` : "50 Hz: รอข้อมูล 2 วินาที";
        if (quality?.line50Dominant) noisy.push(["TP9", "AF7", "AF8", "TP10"][channel]);
      });
      const warning = $("museNoiseWarning");
      if (warning) {
        warning.style.display = noisy.length ? "block" : "none";
        warning.textContent = noisy.length ? `คลื่นใกล้ 50 Hz เด่นที่ ${noisy.join(", ")} อาจเป็นสัญญาณรบกวนไฟฟ้า ตรวจเซนเซอร์และสภาพแวดล้อมแล้วทดสอบใหม่ก่อนเก็บข้อมูลวิจัย` : "";
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
        const mean = buf.reduce((a, b) => a + b, 0) / buf.length;
        const variance = buf.reduce((sum, value) => sum + (value - mean) ** 2, 0) / buf.length;
        const scale = Math.max(20, 3 * Math.sqrt(variance));
        const rowHeight = h / 4;
        const halfHeight = rowHeight / 2 - 5;
        x.strokeStyle = cols[ch];
        x.lineWidth = 1.5;
        x.beginPath();
        buf.forEach((v, i) => {
          const px = (i / (maxPlot - 1)) * w;
          const py = (ch + 0.5) * rowHeight - Math.max(-1, Math.min(1, (v - mean) / scale)) * halfHeight;
          i ? x.lineTo(px, py) : x.moveTo(px, py);
        });
        x.stroke();
        x.fillStyle = cols[ch];
        x.font = "11px system-ui";
        x.fillText(`±${Math.round(scale)} µV`, 7, ch * rowHeight + 12);
      });
    }
    let rafId = requestAnimationFrame(function loop() {
      drawMuse();
      rafId = requestAnimationFrame(loop);
    });

    const secureOK = location.hostname === "localhost" || location.protocol === "https:";
    const chromeOK = /Chrome\//.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent);
    const linuxDesktop = /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
    const webBluetoothUnavailableMessage = linuxDesktop
      ? "Chrome บน Linux ยังไม่ได้เปิด Web Bluetooth — เปิด chrome://flags/#enable-web-bluetooth และ chrome://flags/#enable-web-bluetooth-new-permissions-backend เป็น Enabled จากนั้นกด Relaunch แล้วรีเฟรชหน้านี้"
      : "Web Bluetooth ไม่พร้อมใช้งาน — ใช้ Google Chrome หรือ Microsoft Edge บนคอมพิวเตอร์/Android และเปิดเว็บผ่าน HTTPS หรือ localhost (Chrome บน iPhone และ browser ในแอป LINE/Facebook ไม่รองรับ)";
    if ($("chromeStatus")) {
      $("chromeStatus").textContent = secureOK ? (chromeOK ? "✓ Chrome + localhost พร้อมใช้งาน" : "✓ localhost พร้อมใช้งาน") : "⚠ เปิดผิดวิธี";
      $("chromeStatus").style.background = secureOK ? "#123c2b" : "#4a1d22";
    }
    if (secureOK && typeof navigator.bluetooth === "undefined" && $("chromeStatus")) {
      $("chromeStatus").textContent = linuxDesktop ? "⚠ ต้องเปิด Web Bluetooth ใน Chrome Linux" : "⚠ Web Bluetooth ถูกปิด/ไม่รองรับ";
      $("chromeStatus").style.background = "#4a1d22";
    }

    let museModulePromise = null;
    let museModuleReady = null;
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
    async function listKnownMuseDevices() {
      if (!navigator.bluetooth || typeof navigator.bluetooth.getDevices !== "function") return [];
      try {
        return (await navigator.bluetooth.getDevices()).filter((d) => (d.name || "").startsWith("Muse"));
      } catch {
        return [];
      }
    }
    async function loadMuseDriver() {
      if (museModuleReady) return museModuleReady;
      if (!museModulePromise) {
        // Bundle the driver with the application. Loading it from a third-party
        // CDN made the Connect button permanently unusable whenever that CDN
        // was blocked or briefly offline.
        museModulePromise = import("muse-jsx")
          .then((module) => {
            if (typeof module.MuseClient !== "function") throw new Error("MuseClient is unavailable");
            museModuleReady = module;
            return module;
          })
          .catch((error) => {
            // A transient chunk/load failure must be retryable on the next click.
            museModulePromise = null;
            throw error;
          });
      }
      return museModulePromise;
    }
    async function prepareMuse() {
      const b = getEl("connectMuseBtn");
      b.disabled = true;
      b.textContent = "Preparing Muse…";
      try {
        await loadMuseDriver();
        b.disabled = false;
        b.textContent = "Connect Muse / เชื่อมต่อ Muse";
        setMuseStatus("Ready / พร้อมเชื่อมต่อ");
      } catch (e) {
        b.disabled = false;
        b.textContent = "Retry Muse setup / ลองเตรียมใหม่";
        setMuseStatus("Muse driver load failed: " + e.message + " — กดปุ่มเพื่อลองใหม่", true);
      }
    }
    function subscribeEeg() {
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
            window.dispatchEvent(new CustomEvent("muse-study-reading", { detail: reading }));
            latest[electrode] = samples[samples.length - 1];
            samples.forEach((v) => {
              if (Number.isFinite(v)) {
                traces[electrode].push(v);
                if (traces[electrode].length > LINE_WINDOW_SAMPLES) traces[electrode].shift();
                plotBuffers[electrode].push(v);
                if (plotBuffers[electrode].length > maxPlot) plotBuffers[electrode].shift();
                if (baselineStart && !baselineFinalized) baselineSamples[electrode].push(v);
              }
            });
            if (!firstPacket) {
              firstPacket = true;
              window.__museReady = true;
              window.dispatchEvent(new CustomEvent("muse-study-status", { detail: { ready: true } }));
              setStage("eeg");
              setMuseStatus("Connected + EEG streaming / เชื่อมต่อและเริ่มรับ EEG แล้ว");
              getEl("baselineBtn").disabled = false;
            }
          }
          renderMuse();
          updateMuseQuality();
        },
        error: (err) => {
          window.__museReady = false;
          window.dispatchEvent(new CustomEvent("muse-study-status", { detail: { ready: false } }));
          setMuseStatus("EEG stream error: " + (err?.message || err), true);
          getEl("baselineBtn").disabled = true;
        },
      });
    }
    async function connectMuseDevice(device, quiet = false) {
      const b = getEl("connectMuseBtn");
      const label = device?.name || "Muse";
      resetStages();
      try {
        b.disabled = true;
        b.textContent = "Connecting " + label + "…";
        if (!quiet) setMuseStatus("Connecting to " + label + "… / กำลังเชื่อมต่อ");
        if (!museModuleReady) museModuleReady = await loadMuseDriver();
        museClient = new museModuleReady.MuseClient();
        const gatt = device.gatt;
        if (!gatt) throw new Error("อุปกรณ์นี้ไม่มี Bluetooth GATT / Device has no Bluetooth GATT server");
        if (!gatt.connected) await gatt.connect();
        await museClient.connect(gatt);
        try {
          localStorage.setItem("museLastDeviceId", device.id);
        } catch (e) {}
        if (!device.__museDiscHook) {
          device.__museDiscHook = true;
          device.addEventListener("gattserverdisconnected", onMuseDisconnected);
        }
        setStage("found");
        setStage("gatt");
        setStage("service");
        setMuseStatus(label + " connected. Starting EEG… / เชื่อมต่อแล้ว กำลังเริ่ม EEG");

        await museClient.start();
        setMuseStatus("EEG started. Waiting for first packet… / รอข้อมูล EEG");

        subscribeEeg();
        museConnected = true;
        setMuseConnected(true, label);
        getEl("disconnectMuseBtn").disabled = false;
        getEl("stopBaselineBtn").disabled = true;
        b.textContent = label + " Connected / เชื่อมต่อแล้ว";
      } catch (err) {
        museConnected = false;
        setMuseConnected(false);
        b.disabled = false;
        b.textContent = "Connect Muse / เชื่อมต่อ Muse";
        const n = err?.name || "Error",
          m = err?.message || String(err);
        if (quiet) setMuseStatus("Auto-reconnect ไม่สำเร็จ (" + (device?.name || "Muse") + " อาจปิดอยู่) — กด Connect หรือเลือกจากรายการด้านบน", true);
        else if (n === "NotFoundError") setMuseStatus("ไม่พบอุปกรณ์ " + label + " กรุณาเปิดเครื่องแล้วลองใหม่", true);
        else if (n === "NetworkError")
          setMuseStatus("เชื่อมต่อ GATT ไม่สำเร็จ — ปิดแอป Muse อื่นที่ใช้อุปกรณ์นี้ ปิด/เปิด Muse แล้วลองใหม่ / Close other Muse apps, power-cycle the headset, and retry", true);
        else if (n === "SecurityError" || n === "NotAllowedError")
          setMuseStatus("เบราว์เซอร์ไม่อนุญาต Bluetooth — เปิดเว็บผ่าน HTTPS/localhost และอนุญาตสิทธิ์ Bluetooth แล้วลองใหม่", true);
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
    function onMuseDisconnected() {
      if (museManualDisconnect) return;
      clearTimeout(baselineTimer);
      clearTimeout(baselineHardStop);
      clearInterval(baselineTick);
      baselineStart = 0;
      museConnected = false;
      setMuseConnected(false);
      resetStages();
      try {
        if (eegSub) eegSub.unsubscribe();
      } catch (e) {}
      eegSub = null;
      try {
        if (museClient) museClient.disconnect();
      } catch (e) {}
      museClient = null;
      getEl("disconnectMuseBtn").disabled = true;
      getEl("baselineBtn").disabled = true;
      getEl("stopBaselineBtn").disabled = true;
      const b = getEl("connectMuseBtn");
      b.disabled = false;
      b.textContent = "Reconnect Muse / เชื่อมต่อใหม่";
      setMuseStatus("อุปกรณ์ตัดการเชื่อมต่อ — กด Reconnect หรือเลือกจากรายการด้านบน", true);
    }
    async function connectMuse() {
      resetStages();
      if (!window.isSecureContext) {
        setMuseStatus("ต้องเปิดผ่าน HTTPS", true);
        return;
      }
      if (!navigator.bluetooth) {
        setMuseStatus(webBluetoothUnavailableMessage, true);
        return;
      }
      const b = getEl("connectMuseBtn");
      b.disabled = true;
      b.textContent = "Select Muse-xxxx… / เลือก Muse…";
      setMuseStatus("1/4 เลือกอุปกรณ์ Muse หรือ MuseS ในหน้าต่าง Bluetooth");
      let device = null;
      try {
        device = await navigator.bluetooth.requestDevice({
          // Some Muse firmware does not include the primary service UUID in
          // every advertising packet. Filtering by name still restricts the
          // chooser to Muse devices; optionalServices grants GATT access.
          filters: [{ namePrefix: "Muse" }],
          optionalServices: [MUSE_SERVICE],
        });
      } catch (err) {
        b.disabled = false;
        b.textContent = "Connect Muse / เชื่อมต่อ Muse";
        if (err?.name === "NotFoundError") setMuseStatus("ยกเลิกการเลือกอุปกรณ์ หรือไม่พบ Muse กรุณากด Connect แล้วเลือก Muse หรือ MuseS", true);
        else setMuseStatus("Device selection error: " + (err?.name || "Error") + " — " + (err?.message || err), true);
        return;
      }
      await connectMuseDevice(device);
    }
    async function disconnectMuse() {
      museManualDisconnect = true;
      setTimeout(() => {
        museManualDisconnect = false;
      }, 500);
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
      museConnected = false;
      setMuseConnected(false);
      const b = getEl("connectMuseBtn");
      b.disabled = false;
      b.textContent = "Connect Muse / เชื่อมต่อ Muse";
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
      const eegChannels = baselineSamples.map((s, ch) => {
        if (!s.length) return { name: names[ch], samples: 0 };
        const mean = s.reduce((a, b) => a + b, 0) / s.length;
        const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
        return {
          name: names[ch],
          samples: s.length,
          mean: Number(mean.toFixed(2)),
          sd: Number(sd.toFixed(2)),
          min: Number(Math.min(...s).toFixed(2)),
          max: Number(Math.max(...s).toFixed(2)),
        };
      });
      journey.eeg = { recordedAt: new Date().toISOString(), packets: packetCount, channels: eegChannels };
      saveJourney();
    }

    prepareMuse();
    (async () => {
      const devices = await listKnownMuseDevices();
      if (!devices.length) return;
      let lastId = null;
      try {
        lastId = localStorage.getItem("museLastDeviceId");
      } catch (e) {}
      const target = devices.find((d) => d.id === lastId);
      if (!target) return;
      setMuseStatus("Auto-reconnect to " + (target.name || "Muse") + "… / กำลังเชื่อมต่ออุปกรณ์เดิม");
      await connectMuseDevice(target, true);
    })();

    const connectMuseBtn = getEl("connectMuseBtn");
    const disconnectMuseBtn = getEl("disconnectMuseBtn");
    const baselineBtn = getEl("baselineBtn");
    const stopBaselineBtn = getEl("stopBaselineBtn");
    const onStopBaselineClick = () => stopBaseline(false);
    connectMuseBtn.addEventListener("click", connectMuse);
    disconnectMuseBtn.addEventListener("click", disconnectMuse);
    baselineBtn.addEventListener("click", startBaseline);
    stopBaselineBtn.addEventListener("click", onStopBaselineClick);

    /* ---------- Section navigation ---------- */
    function showSection(id) {
      if (window.__studyPhase === "task" && id !== "games") {
        window.dispatchEvent(new Event("research-task-screen-left"));
        return;
      }
      document.querySelectorAll("main section").forEach((s) => s.classList.toggle("active", s.id === id));
      const nav = document.getElementById("mainNav");
      if (nav) nav.querySelectorAll("[data-sec]").forEach((b) => b.classList.toggle("active", b.dataset.sec === id));
      if (id === "dashboard") window.dispatchEvent(new Event("research-dashboard-opened"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

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
      showSection,
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
        museManualDisconnect = true;
        if (museClient) museClient.disconnect();
      } catch (e) {}
      connectMuseBtn.removeEventListener("click", connectMuse);
      disconnectMuseBtn.removeEventListener("click", disconnectMuse);
      baselineBtn.removeEventListener("click", startBaseline);
      stopBaselineBtn.removeEventListener("click", onStopBaselineClick);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("research-task-ended", onResearchTaskEnded);
      window.removeEventListener("research-task-start", onResearchTaskStart);
      window.removeEventListener("research-session-finished", onResearchSessionFinished);
      finishTaskBtn?.removeEventListener("click", onFinishTaskClick);
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
      <div id="authScreen" className="auth-bg" style={{ display: authed === false ? "grid" : "none" }}>
        <canvas id="authWave" width="1600" height="420" aria-hidden="true"></canvas>
        <div className="auth-inner">
          <div className="auth-logo">🧠</div>
          <div className="brand" style={{ fontSize: "26px" }}>
            CogniLoad<span>-XAI</span>
          </div>
          <p className="muted" style={{ margin: "4px 0 0" }}>Cognitive Assessment System / ระบบประเมินการรู้คิด</p>
          <div className="auth-card">
            <h2 id="authTitle">{mode === "login" ? "Sign in / เข้าสู่ระบบ" : "Register / สมัครสมาชิก"}</h2>
            <p className="muted">Research workspace / ระบบสำหรับผู้วิจัย</p>
            <div className="auth-tabs">
              <button type="button" className={"auth-tab" + (mode === "login" ? " active" : "")} onClick={() => switchMode("login")}>
                Sign in
              </button>
              <button type="button" className={"auth-tab" + (mode === "register" ? " active" : "")} onClick={() => switchMode("register")}>
                Register
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
                <button type="submit" disabled={busy} style={{ width: "100%" }}>
                  {busy ? "Please wait… / กำลังดำเนินการ" : mode === "login" ? "Sign in / เข้าสู่ระบบ" : "Create account / สมัครสมาชิก"}
                </button>
              </div>
            </form>
            <div id="authMsg" className="muted" style={authError ? { color: "#ff8b8b" } : undefined} aria-live="polite">
              {authMessage ||
                (mode === "register"
                  ? "สมัครสมาชิกเพื่อเริ่มการทดลอง / Create an account to start the study."
                  : "ยังไม่มีบัญชี? กด Register เพื่อสมัคร / No account yet? Use Register to create one.")}
            </div>
          </div>
          <p className="auth-foot">
            📶 เชื่อมต่อ Muse 2 หรือ Muse S และบันทึก EEG ได้ในหน้าการทดลองหลังเข้าสู่ระบบ
          </p>
        </div>
      </div>

      {/* ---------- App shell ---------- */}
      <div id="appShell" style={{ display: authed === true ? "block" : "none" }}>
        <header>
          <div className="brand">
            CogniLoad<span>-XAI</span>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <div className="badge" id="studyLiveBadge">Muse EEG Research Workspace</div>
            <button className="secondary" id="langBtn" onClick={() => call("toggleLang")}>
              ไทย
            </button>
            {account && <div className="badge">👤 {account}</div>}
            <button className="secondary" onClick={() => call("logoutUser")}>
              Logout / ออกจากระบบ
            </button>
          </div>
        </header>
        <div className="wrap">
          <nav className="mainnav" id="mainNav">
            {[
              ["journey", "🔬 Experiment / การทดลอง"],
              ["dashboard", "📊 Dashboard / แดชบอร์ด"],
              ["games", "🎮 Tasks / ภารกิจ"],
              ["history", "🕘 Assessment history / ประวัติเดิม"],
            ].map(([sec, label]) => (
              <button key={sec} data-sec={sec} className={sec === "journey" ? "active" : ""} onClick={() => call("showSection", sec)}>
                {label}
              </button>
            ))}
          </nav>
          <main>
            {/* ---------- Journey ---------- */}
            <section id="journey" className="active">
              <div className="hero">
                <div>
                  <span className="study-kicker">COGNILOAD · MUSE EEG</span>
                  <h1>ห้องทดลอง EEG</h1>
                  <p>ตั้งค่ารอบทดลอง เชื่อมต่อ Muse บันทึกสัญญาณจริง และส่งออกข้อมูลพร้อม marker</p>
                </div>
                <span className="pill">Research use · ไม่ใช่การวินิจฉัย</span>
              </div>
              <ResearchSession />
              <div className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)", display: "none" }}>
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
                    <h3 style={{ marginBottom: "6px" }}>03 · Muse EEG / ตรวจสัญญาณสด</h3>
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
                    Connect Muse / เชื่อมต่อ Muse
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
                  เปิด Muse → กด Connect Muse → เลือก <b>Muse หรือ MuseS</b> ในหน้าต่าง Bluetooth → รอให้สถานะแสดง “EEG ครบ 4 ช่อง” ก่อนเริ่มบันทึก
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
                    <span className="muted">µV · ตัวอย่างดิบล่าสุด</span>
                    <div id="muse50_0" className="muted muse-line-noise">50 Hz: —</div>
                  </div>
                  <div className="card metric">
                    <small>AF7</small>
                    <b id="ch1">—</b>
                    <span className="muted">µV · ตัวอย่างดิบล่าสุด</span>
                    <div id="muse50_1" className="muted muse-line-noise">50 Hz: —</div>
                  </div>
                  <div className="card metric">
                    <small>AF8</small>
                    <b id="ch2">—</b>
                    <span className="muted">µV · ตัวอย่างดิบล่าสุด</span>
                    <div id="muse50_2" className="muted muse-line-noise">50 Hz: —</div>
                  </div>
                  <div className="card metric">
                    <small>TP10</small>
                    <b id="ch3">—</b>
                    <span className="muted">µV · ตัวอย่างดิบล่าสุด</span>
                    <div id="muse50_3" className="muted muse-line-noise">50 Hz: —</div>
                  </div>
                </div>
                <canvas id="museCanvas" width="1100" height="220" style={{ marginTop: "14px" }}></canvas>
                <p className="muted muse-plot-note">กราฟแสดงประมาณ 2 วินาทีล่าสุด โดยหักค่าเฉลี่ยของแต่ละช่องและปรับสเกลอัตโนมัติ ค่าใน CSV ยังเป็นสัญญาณดิบ ไม่ได้กรอง 50 Hz</p>
                <div id="museNoiseWarning" className="study-signal-warning" role="status" style={{ display: "none" }}></div>
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
              <details className="study-legacy"><summary>เครื่องมือประเมินเดิม / Existing assessment tools</summary><div id="stepbox" className="card" style={{ marginTop: "14px" }}></div></details>
            </section>

            {/* ---------- Dashboard ---------- */}
            <section id="dashboard">
              <div className="hero">
                <div>
                  <h1>Research Dashboard / แดชบอร์ด</h1>
                  <p>ภาพรวมข้อมูล EEG จากรอบทดลองที่บันทึกในเบราว์เซอร์นี้</p>
                </div>
              </div>
              <ResearchDashboard />
              <details className="study-legacy">
                <summary>ผลแบบประเมินเดิม / Existing assessment overview</summary>
                <div className="controls"><button onClick={() => call("exportCSV")}>Export assessment CSV</button></div>
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
              </details>
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
              <p className="muted">หากกำลังบันทึก EEG ระบบจะใส่ marker อัตโนมัติเมื่อแสดงสิ่งเร้าและเมื่อผู้เข้าร่วมตอบแต่ละครั้ง ตรวจเวลาของช่วงทดลองได้ที่แถบด้านบน</p>
              <p className="notice">
                These three tasks are newly designed experimental paradigms for this prototype. They are not validated Alzheimer diagnostic tests. Research validation is required
                before clinical interpretation.
              </p>
              <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
                <div className="card">
                  <h3>1. Odd or Even / คี่หรือคู่</h3>
                  <p className="muted">ตัดสินความคี่คู่ของตัวเลข บันทึกความถูกต้องและเวลาตอบสนอง</p>
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
                  <div className="controls"><button id="finishTaskBtn" type="button" className="secondary" hidden>จบกิจกรรม · เก็บ EEG ต่อ 30 วินาที</button></div>
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
