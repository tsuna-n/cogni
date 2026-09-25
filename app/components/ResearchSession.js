"use client";

import { useEffect, useRef, useState } from "react";
import { deleteResearchSession, getResearchChunks, getResearchGameSummaryMarker, listResearchSessions, markResearchSummarySynced, openResearchDatabase, pruneResearchRawData, saveResearchSession, saveResearchSummary } from "./researchStorage";
import { localizeText } from "@/lib/localization";
import { parseGameSummaryMarker, summarizeResearchSession } from "@/lib/research-summary.mjs";

const CHANNELS = ["TP9", "AF7", "AF8", "TP10"];
const PHASES = [
  { key: "baseline", label: "Baseline / พักนิ่ง" },
  { key: "task", label: "Task / ทำภารกิจ" },
  { key: "rest", label: "Rest / พักหลังงาน" },
];
const SAMPLE_RATE = 256;
const BASELINE_SECONDS = 30;
const POST_TASK_SECONDS = 30;
const PROTOCOL_VERSION = "alz_web_games_v1";
const GAMES = [
  { id: 1, name: "Odd or Even / คี่หรือคู่" },
  { id: 2, name: "Echo Sequence / ลำดับสะท้อน" },
  { id: 3, name: "Pattern Drift / รูปแบบเปลี่ยนแปลง" },
];

function csvCell(value) {
  const raw = String(value ?? "");
  const safe = !/^-?(?:\d+\.?\d*|\.\d+)$/.test(raw) && /^[=+@\-\t\r]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replaceAll('"', '""') + '"';
}

function filePart(value) {
  return String(value).trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "unknown";
}

export default function ResearchSession({ locale = "th", enabled = false, accountEmail = "" }) {
  const [participant, setParticipant] = useState("");
  const [sessionId, setSessionId] = useState("S01");
  const [studyGroup, setStudyGroup] = useState("");
  const [gameId, setGameId] = useState(1);
  const [condition, setCondition] = useState("standard");
  const [taskSeconds, setTaskSeconds] = useState(60);
  const [consent, setConsent] = useState(false);
  const [ready, setReady] = useState(false);
  const [liveRailPercents, setLiveRailPercents] = useState([0, 0, 0, 0]);
  const [status, setStatus] = useState("idle");
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [clock, setClock] = useState(0);
  const [, setViewTick] = useState(0);
  const [markerText, setMarkerText] = useState("");
  const [message, setMessage] = useState("");
  const [exported, setExported] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [savedSessions, setSavedSessions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const syncRef = useRef(Promise.resolve());
  const dataRef = useRef(null);
  const writeQueueRef = useRef(Promise.resolve());
  const activeRef = useRef(false);
  const phaseRef = useRef(0);
  const phaseStartedRef = useRef(0);
  const lastViewRef = useRef(0);
  const lastPersistRef = useRef(0);
  const lastClockViewRef = useRef(0);
  const lastQualityViewRef = useRef(0);
  const recentPacketsRef = useRef(CHANNELS.map(() => []));
  const lastChannelAtRef = useRef([0, 0, 0, 0]);
  const readyRef = useRef(false);
  const finishRef = useRef(null);
  const advanceRef = useRef(null);
  const markerRef = useRef(null);

  function snapshot(data) {
    const { rows, nextSequence, lastIndices, ...saved } = data;
    return { ...saved, nextSequence };
  }

  function persist(force = false) {
    const data = dataRef.current;
    if (!data || (!force && data.rows.length < 512)) return writeQueueRef.current;
    const rows = data.rows.splice(0);
    const sequence = data.nextSequence++;
    const saved = snapshot(data);
    writeQueueRef.current = writeQueueRef.current.then(async () => {
      await saveResearchSession(saved, sequence, rows);
      if (saved.status !== "recording") setSavedSessions(await listResearchSessions());
    }).catch((error) => {
      data.rows.unshift(...rows);
      activeRef.current = false;
      data.status = "storage_error";
      window.__studyPhase = null;
      window.__studyGameId = null;
      window.dispatchEvent(new Event("research-task-ended"));
      setStatus("storage_error");
      setStorageReady(false);
      setMessage(`บันทึกลงเครื่องไม่สำเร็จ (${error.message}) โปรดส่งออกข้อมูลที่ยังอยู่ในแท็บทันที`);
    });
    return writeQueueRef.current;
  }

  useEffect(() => {
    let mounted = true;
    openResearchDatabase().then(listResearchSessions).then((sessions) => {
      if (!mounted) return;
      setStorageReady(true);
      setSavedSessions(sessions);
      const latest = sessions.find((session) => !session.exported);
      if (latest && !latest.exported) {
        const recovered = { ...latest, rows: [], lastIndices: [null, null, null, null], nextSequence: latest.nextSequence || 0 };
        if (recovered.status === "recording") {
          recovered.status = "interrupted";
          recovered.endedMs = recovered.lastPacketMs || recovered.startedMs;
          recovered.summary = summarizeResearchSession(recovered);
          writeQueueRef.current = saveResearchSession(snapshot(recovered), recovered.nextSequence, []).then(async () => {
            if (mounted) setSavedSessions(await listResearchSessions());
          }).catch((error) => {
            if (mounted) setMessage(`กู้สถานะรอบก่อนล้มเหลว: ${error.message}`);
          });
        }
        dataRef.current = recovered;
        setStatus(recovered.status);
        setMessage("พบข้อมูลรอบก่อนในเครื่อง กรุณาส่งออก CSV แล้วจึงเริ่มรอบใหม่");
      }
    }).catch((error) => {
      if (mounted) setMessage(`เปิดที่เก็บข้อมูลไม่ได้: ${error.message}`);
    });
    return () => { mounted = false; };
  }, []);

  async function syncPending() {
    if (!enabled || !accountEmail) return;
    const run = syncRef.current.then(async () => {
      setSyncing(true);
      setSyncError("");
      try {
        const sessions = await listResearchSessions();
        const failures = [];
        for (const session of sessions) {
          if (session.status === "recording" || (session.ownerEmail && session.ownerEmail !== accountEmail) || (session.serverSyncedBy && session.serverSyncedBy !== accountEmail) || (session.serverSyncedAt && session.serverSyncedBy === accountEmail)) continue;
          try {
            let summary = session.summary;
            if (!summary) {
              const gameSummary = session.gameSummary || parseGameSummaryMarker(await getResearchGameSummaryMarker(session.id));
              summary = summarizeResearchSession(session, gameSummary);
              await saveResearchSummary(session.id, summary, gameSummary);
            }
            const response = await fetch("/api/research/summaries", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ recordId: session.id, summary }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.detail || result.error || `HTTP ${response.status}`);
            if (result.uploadedBy !== accountEmail) throw new Error("Account changed during sync");
            await markResearchSummarySynced(session.id, summary, accountEmail, result.uploadedAt);
            if (dataRef.current?.id === session.id && JSON.stringify(dataRef.current.summary) === JSON.stringify(summary)) {
              dataRef.current.serverSyncedAt = result.uploadedAt;
              dataRef.current.serverSyncedBy = accountEmail;
            }
          } catch (error) {
            failures.push(`${session.sessionId || session.id}: ${error.message}`);
          }
        }
        setSavedSessions(await listResearchSessions());
        if (failures.length) setSyncError(failures.join(" · "));
      } catch (error) {
        setSyncError(error.message);
      } finally {
        setSyncing(false);
      }
    });
    syncRef.current = run.catch(() => {});
    await run;
  }

  useEffect(() => {
    if (!enabled || !storageReady) return;
    syncPending();
    const onFinished = () => syncPending();
    window.addEventListener("research-session-finished", onFinished);
    return () => window.removeEventListener("research-session-finished", onFinished);
  // Sync is intentionally tied to the authenticated account, not each local list update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, storageReady, accountEmail]);

  function addMarker(label, phase = PHASES[phaseRef.current]?.key || "", now = Date.now()) {
    const data = dataRef.current;
    if (!data) return;
    data.rows.push(["event", now, now - data.startedMs, phase, "", "", "", "", "", label, now].map(csvCell).join(","));
    data.events++;
    persist();
  }

  function finish(reason) {
    if (!activeRef.current) return;
    window.dispatchEvent(new Event("research-task-ended"));
    addMarker(reason === "complete" ? "session_complete" : reason === "disconnect" ? "device_disconnected" : reason === "signal_lost" ? "signal_lost" : reason === "hidden" ? "tab_hidden" : reason === "task_screen_left" ? "task_screen_left" : reason === "task_not_started" ? "task_not_started" : "session_stopped");
    activeRef.current = false;
    dataRef.current.status = reason;
    dataRef.current.endedMs = Date.now();
    dataRef.current.summary = summarizeResearchSession(dataRef.current);
    window.__studyPhase = null;
    window.__studyGameId = null;
    setStatus(reason);
    persist(true).then(() => {
      if (dataRef.current?.status !== "storage_error") window.dispatchEvent(new Event("research-session-finished"));
    });
    const clipped = dataRef.current.railSamples?.some((count, channel) => count / Math.max(1, dataRef.current.channels[channel]) >= 0.01);
    setMessage(reason === "disconnect" ? "Muse ขาดการเชื่อมต่อ ข้อมูลที่บันทึกไว้ยังส่งออกได้" : reason === "signal_lost" ? "สัญญาณ EEG หายเกิน 3 วินาที การทดลองหยุดแล้ว" : reason === "hidden" ? "แท็บถูกซ่อนระหว่างบันทึก การทดลองหยุดเพื่อรักษาความถูกต้องของเวลา" : reason === "task_screen_left" ? "ออกจากหน้าเกมระหว่าง Task รอบนี้ไม่สมบูรณ์ กรุณาส่งออกข้อมูลที่มี" : reason === "task_not_started" ? "เกมไม่เริ่มในช่วง Task รอบนี้ไม่สมบูรณ์ กรุณาส่งออกข้อมูลที่มี" : reason === "complete" && clipped ? "บันทึกครบ แต่สัญญาณบางช่องชนขอบช่วงวัด กรุณาปรับเซนเซอร์และทดสอบซ้ำก่อนเก็บผู้เข้าร่วม" : reason === "complete" ? "ครบทุกช่วงแล้ว กรุณาส่งออก CSV" : "หยุดการทดลองแล้ว กรุณาส่งออก CSV");
  }

  function advance() {
    if (!activeRef.current) return;
    if (phaseRef.current === 1) {
      // The task can end early; keep the exported duration aligned with its markers.
      dataRef.current.durations[1] = Math.round((performance.now() - phaseStartedRef.current)) / 1000;
    }
    if (phaseRef.current === 1) window.dispatchEvent(new Event("research-task-ended"));
    const boundaryMs = Date.now();
    addMarker(PHASES[phaseRef.current].key + "_end", PHASES[phaseRef.current].key, boundaryMs);
    if (phaseRef.current === 1 && dataRef.current.gameId && !dataRef.current.gameStartedAtMs) {
      finish("task_not_started");
      return;
    }
    const next = phaseRef.current + 1;
    if (next === PHASES.length) {
      finish("complete");
      return;
    }
    phaseRef.current = next;
    window.__studyPhase = PHASES[next].key;
    dataRef.current.phaseStarts[next] = boundaryMs;
    phaseStartedRef.current = performance.now();
    setPhaseIndex(next);
    setClock(0);
    addMarker(PHASES[next].key + "_start", PHASES[next].key, boundaryMs);
    if (next === 1 && dataRef.current.gameId) {
      window.dispatchEvent(new CustomEvent("research-task-start", { detail: { gameId: dataRef.current.gameId } }));
    }
  }

  finishRef.current = finish;
  advanceRef.current = advance;
  markerRef.current = addMarker;

  useEffect(() => {
    readyRef.current = false;
    setReady(false);
    const onStatus = (event) => {
      if (!event.detail?.ready) {
        readyRef.current = false;
        lastChannelAtRef.current = [0, 0, 0, 0];
        recentPacketsRef.current = CHANNELS.map(() => []);
        setLiveRailPercents([0, 0, 0, 0]);
        setReady(false);
        if (activeRef.current) finishRef.current("disconnect");
      }
    };
    const onReading = (event) => {
      const reading = event.detail;
      const channel = Number(reading?.electrode);
      if (!Number.isInteger(channel) || channel < 0 || channel >= CHANNELS.length || !Array.isArray(reading.samples) || !reading.samples.some(Number.isFinite)) return;
      const now = Date.now();
      const finite = reading.samples.filter(Number.isFinite);
      const recent = recentPacketsRef.current[channel];
      recent.push({ at: now, count: finite.length, rail: finite.filter((value) => value <= -999.5 || value >= 999.5).length });
      while (recent.length && recent[0].at < now - 3000) recent.shift();
      if (now - lastQualityViewRef.current >= 500) {
        lastQualityViewRef.current = now;
        const percents = recentPacketsRef.current.map((packets) => {
          const count = packets.reduce((sum, packet) => sum + packet.count, 0);
          return count ? 100 * packets.reduce((sum, packet) => sum + packet.rail, 0) / count : 0;
        });
        setLiveRailPercents(percents);
        if (percents.every((value) => value < 1)) setMessage((previous) => previous.startsWith("สัญญาณ EEG ล่าสุดชนขอบ") ? "" : previous);
      }
      lastChannelAtRef.current[channel] = now;
      if (!readyRef.current && lastChannelAtRef.current.every((at) => now - at < 3000)) {
        readyRef.current = true;
        setReady(true);
      }
      if (!activeRef.current || !dataRef.current) return;
      const data = dataRef.current;
      const receivedAt = Date.now();
      const packetIndex = Number(reading.index);
      if (Number.isInteger(packetIndex) && packetIndex >= 0 && packetIndex <= 65535) {
        const previous = data.lastIndices[channel];
        if (previous !== null) {
          const gap = (packetIndex - previous + 65536) % 65536;
          if (gap === 0) data.duplicatePackets[channel]++;
          else if (gap > 1 && gap < 1024) data.missingPackets[channel] += gap - 1;
          else if (gap >= 1024) data.reorderedPackets[channel]++;
        }
        data.lastIndices[channel] = packetIndex;
        data.packets[channel]++;
      }
      const firstSampleMs = Number.isFinite(reading.timestamp) ? reading.timestamp : receivedAt;
      for (let i = 0; i < reading.samples.length; i++) {
        const value = reading.samples[i];
        if (!Number.isFinite(value)) continue;
        const sampleMs = firstSampleMs + (i * 1000) / SAMPLE_RATE;
        if (sampleMs < data.startedMs) continue;
        const samplePhase = data.phaseStarts[2] && sampleMs >= data.phaseStarts[2] ? 2 : data.phaseStarts[1] && sampleMs >= data.phaseStarts[1] ? 1 : 0;
        data.rows.push(["eeg", sampleMs.toFixed(3), (sampleMs - data.startedMs).toFixed(3), PHASES[samplePhase].key, CHANNELS[channel], channel, reading.index, i, value, "", receivedAt].map(csvCell).join(","));
        data.samples++;
        data.channels[channel]++;
        if (value <= -999.5 || value >= 999.5) data.railSamples[channel]++;
      }
      data.lastPacketMs = receivedAt;
      persist();
      if (receivedAt - lastViewRef.current > 500) {
        lastViewRef.current = receivedAt;
        setViewTick((n) => n + 1);
      }
    };
    const timer = setInterval(() => {
      if (readyRef.current && lastChannelAtRef.current.some((at) => Date.now() - at > 3000)) {
        readyRef.current = false;
        setReady(false);
        if (activeRef.current) finishRef.current("signal_lost");
      }
      if (!activeRef.current || !dataRef.current) return;
      if (Date.now() - lastPersistRef.current >= 1000) {
        lastPersistRef.current = Date.now();
        persist(true);
      }
      const elapsed = (performance.now() - phaseStartedRef.current) / 1000;
      if (Date.now() - lastClockViewRef.current >= 200) {
        lastClockViewRef.current = Date.now();
        setClock(elapsed);
      }
      if (elapsed >= dataRef.current.durations[phaseRef.current]) advanceRef.current();
    }, 50);
    const onVisibility = () => {
      if (document.hidden && activeRef.current) finishRef.current("hidden");
    };
    const onPageHide = () => {
      if (activeRef.current) finishRef.current("hidden");
      else if (dataRef.current?.rows.length) persist(true);
    };
    const onTaskMarker = (event) => {
      if (activeRef.current && event.detail?.label) {
        const label = String(event.detail.label).slice(0, 120);
        if (label === `game_${dataRef.current?.gameId}_start`) dataRef.current.gameStartedAtMs = Date.now();
        const gameSummary = parseGameSummaryMarker(label);
        if (gameSummary) dataRef.current.gameSummary = gameSummary;
        markerRef.current(label);
      }
    };
    const onTaskScreenLeft = () => {
      if (activeRef.current && phaseRef.current === 1) finishRef.current("task_screen_left");
    };
    const onTaskComplete = () => {
      if (activeRef.current && phaseRef.current === 1) advanceRef.current();
    };
    window.addEventListener("muse-study-status", onStatus);
    window.addEventListener("muse-study-reading", onReading);
    window.addEventListener("research-task-marker", onTaskMarker);
    window.addEventListener("research-task-screen-left", onTaskScreenLeft);
    window.addEventListener("research-task-complete", onTaskComplete);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(timer);
      window.removeEventListener("muse-study-status", onStatus);
      window.removeEventListener("muse-study-reading", onReading);
      window.removeEventListener("research-task-marker", onTaskMarker);
      window.removeEventListener("research-task-screen-left", onTaskScreenLeft);
      window.removeEventListener("research-task-complete", onTaskComplete);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  useEffect(() => {
    window.__studyUnexported = Boolean(activeRef.current || dataRef.current?.rows.length);
    const warnBeforeClose = (event) => {
      if (!window.__studyUnexported) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeClose);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeClose);
      window.__studyUnexported = false;
    };
  }, [status, exported]);

  useEffect(() => {
    const badge = document.getElementById("studyLiveBadge");
    if (badge) badge.textContent = status === "recording" ? `${PHASES[phaseIndex].label} · ${Math.max(0, Math.ceil((dataRef.current?.durations[phaseIndex] || 0) - clock))}s` : status === "idle" ? "Muse EEG Research Workspace" : "EEG session · ready to export";
  }, [status, phaseIndex, clock]);

  async function start(testMode = false) {
    const cleanParticipant = testMode ? "TEST" : participant.trim();
    const cleanSession = testMode ? `CHECK-${Date.now()}` : sessionId.trim();
    if (!testMode && (!cleanParticipant || !cleanSession || !studyGroup || !GAMES.some((game) => game.id === Number(gameId)))) {
      setMessage("กรอกรหัสผู้เข้าร่วม รหัสรอบ เลือกกลุ่ม และเลือกเกมให้ครบ");
      return;
    }
    if (!testMode && !consent) {
      setMessage("ยืนยันการได้รับความยินยอมตามโครงการก่อนเริ่ม");
      return;
    }
    if (!ready || lastChannelAtRef.current.some((at) => Date.now() - at > 3000)) {
      setMessage("เชื่อมต่อ Muse และรอรับ EEG ครบทั้ง 4 ช่องก่อนเริ่ม");
      return;
    }
    if (!storageReady || busy) {
      setMessage("ที่เก็บข้อมูลในเครื่องยังไม่พร้อม กรุณารอหรือตรวจสอบพื้นที่ว่าง");
      return;
    }
    if (!testMode) {
      const recentQuality = recentPacketsRef.current.map((packets) => ({
        count: packets.reduce((sum, packet) => sum + packet.count, 0),
        rail: packets.reduce((sum, packet) => sum + packet.rail, 0),
      }));
      if (recentQuality.some(({ count }) => count < SAMPLE_RATE)) {
        setMessage("รอสัญญาณ EEG ต่อเนื่องอย่างน้อย 1 วินาทีครบทั้ง 4 ช่องก่อนเริ่มรอบผู้เข้าร่วม");
        return;
      }
      if (recentQuality.some(({ count, rail }) => rail / count >= 0.01)) {
        setMessage("สัญญาณ EEG ล่าสุดชนขอบช่วงวัด กรุณาปรับเซนเซอร์แล้วทดสอบอุปกรณ์ใหม่ก่อนเริ่มรอบผู้เข้าร่วม");
        return;
      }
    }
    if (!testMode && (!Number.isInteger(Number(taskSeconds)) || Number(taskSeconds) < 5 || Number(taskSeconds) > 540)) {
      setMessage("ช่วงทำกิจกรรมต้องอยู่ระหว่าง 5–540 วินาที");
      return;
    }
    let startedMs = Date.now();
    const data = {
      id: crypto.randomUUID(),
      ownerEmail: accountEmail,
      participant: cleanParticipant,
      sessionId: cleanSession,
      studyGroup: testMode ? "device_test" : studyGroup,
      gameId: testMode ? 0 : Number(gameId),
      gameStartedAtMs: null,
      protocolVersion: testMode ? "device_check_v1" : PROTOCOL_VERSION,
      condition: testMode ? "device-check" : condition.trim(),
      taskName: testMode ? "system-test" : GAMES.find((game) => game.id === Number(gameId)).name,
      testMode,
      startedMs,
      phaseStarts: [startedMs],
      durations: testMode ? [5, 5, 5] : [BASELINE_SECONDS, Number(taskSeconds), POST_TASK_SECONDS],
      rows: [],
      samples: 0,
      channels: [0, 0, 0, 0],
      railSamples: [0, 0, 0, 0],
      events: 0,
      lastPacketMs: startedMs,
      endedMs: null,
      status: "recording",
      exported: false,
      nextSequence: 0,
      packets: [0, 0, 0, 0],
      missingPackets: [0, 0, 0, 0],
      duplicatePackets: [0, 0, 0, 0],
      reorderedPackets: [0, 0, 0, 0],
      lastIndices: [null, null, null, null],
    };
    setBusy(true);
    try {
      await saveResearchSession(snapshot(data), 0, []);
    } catch (error) {
      setMessage(`เริ่มบันทึกไม่ได้: ${error.message}`);
      setBusy(false);
      return;
    }
    setBusy(false);
    startedMs = Date.now();
    data.startedMs = startedMs;
    data.phaseStarts[0] = startedMs;
    data.lastPacketMs = startedMs;
    window.dispatchEvent(new Event("research-task-ended"));
    dataRef.current = data;
    phaseRef.current = 0;
    phaseStartedRef.current = performance.now();
    activeRef.current = true;
    window.__studyPhase = "baseline";
    window.__studyGameId = data.gameId;
    window.__studyUnexported = true;
    setPhaseIndex(0);
    setClock(0);
    setStatus("recording");
    setExported(false);
    setMessage(testMode ? "กำลังทดสอบอุปกรณ์ 15 วินาที ข้อมูลชุดนี้ระบุ test_mode=true" : "กำลังบันทึก EEG ลงที่เก็บข้อมูลในเบราว์เซอร์อัตโนมัติ");
    addMarker("session_start", "baseline", startedMs);
    addMarker("baseline_start", "baseline", startedMs);
  }

  async function exportCsv(target = dataRef.current) {
    if (!target || target.rawDeleted || busy) return;
    setBusy(true);
    if (target === dataRef.current) await persist(true);
    await writeQueueRef.current;
    const data = target === dataRef.current ? dataRef.current : target;
    try {
      const chunks = await getResearchChunks(data.id);
      const rows = chunks.flatMap((chunk) => chunk.rows);
      if (target === dataRef.current) rows.push(...data.rows);
      if (!rows.length) throw new Error("ไม่พบแถวข้อมูลในรอบนี้");
    const prefix = [data.participant, data.sessionId, data.studyGroup || "", data.gameId || "", data.protocolVersion || "", data.condition, data.taskName, new Date(data.startedMs).toISOString(), data.testMode, !data.testMode, SAMPLE_RATE, ...data.durations].map(csvCell).join(",");
    const header = "participant_id,session_id,study_group,game_id,protocol_version,condition,task_name,started_at_iso,test_mode,consent_confirmed,sample_rate_hz,baseline_seconds,task_seconds,rest_seconds,record_type,timestamp_ms,relative_ms,phase,channel,electrode,packet_index,sample_index,value_uv,marker,received_at_ms";
    const parts = ["\ufeff", header, "\r\n"];
    for (let i = 0; i < rows.length; i += 5000) {
      parts.push(rows.slice(i, i + 5000).map((row) => prefix + "," + row).join("\r\n") + "\r\n");
    }
    const url = URL.createObjectURL(new Blob(parts, { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `muse_${filePart(data.participant)}_${filePart(data.sessionId)}_${new Date(data.startedMs).toISOString().replaceAll(":", "-")}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    data.exported = true;
    await saveResearchSession(snapshot(data), data.nextSequence, []);
    setSavedSessions(await listResearchSessions());
    if (target === dataRef.current) setExported(true);
    window.__studyUnexported = false;
    setMessage("สั่งดาวน์โหลด CSV แล้ว ตรวจสอบไฟล์ใน Downloads ก่อนลบข้อมูลที่เก็บในเบราว์เซอร์");
    } catch (error) {
      setMessage(`ส่งออก CSV ไม่สำเร็จ: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function pruneSaved(session) {
    if (busy || !session.exported || session.rawDeleted || !window.confirm(locale === "th" ? `ลบ EEG ดิบของรอบ ${session.sessionId} หรือไม่? ระบบจะเก็บผลสรุปไว้เพื่อเปรียบเทียบ` : `Delete raw EEG for session ${session.sessionId}? Its summary will remain for comparison.`)) return;
    setBusy(true);
    try {
      const gameSummary = session.gameSummary || parseGameSummaryMarker(await getResearchGameSummaryMarker(session.id));
      const summary = summarizeResearchSession(session, gameSummary);
      const changed = JSON.stringify(summary) !== JSON.stringify(session.summary);
      await pruneResearchRawData({ ...session, gameSummary, summary, serverSyncedAt: changed ? null : session.serverSyncedAt });
      if (dataRef.current?.id === session.id) {
        dataRef.current.rawDeleted = true;
        setViewTick((value) => value + 1);
      }
      setSavedSessions(await listResearchSessions());
      window.dispatchEvent(new Event("research-session-finished"));
    } catch (error) {
      setMessage(`ลบ EEG ดิบไม่สำเร็จ: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function removeSaved(session) {
    if (busy || session.status === "recording" || session.id === dataRef.current?.id || !window.confirm(locale === "th" ? `ลบรอบ ${session.sessionId} และผลสรุปถาวรหรือไม่?` : `Permanently delete session ${session.sessionId} and its summary?`)) return;
    setBusy(true);
    try {
      await deleteResearchSession(session.id);
      setSavedSessions(await listResearchSessions());
      window.dispatchEvent(new Event("research-session-finished"));
    } catch (error) {
      setMessage(`ลบข้อมูลไม่สำเร็จ: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    if (activeRef.current || !exported) return;
    dataRef.current = null;
    window.__studyUnexported = false;
    setStatus("idle");
    setPhaseIndex(0);
    setClock(0);
    setExported(false);
    setMessage("");
  }

  const data = dataRef.current;
  const groupLabel = (value) => value === "patient" ? (locale === "th" ? "ผู้ป่วย" : "Patient") : value === "control" ? (locale === "th" ? "กลุ่มควบคุม" : "Control") : value || (locale === "th" ? "ไม่ระบุกลุ่ม" : "No group specified");
  const savedStatusLabel = (value) => value === "recording" ? (locale === "th" ? "ค้างจากการปิดหน้า" : "Interrupted when page closed") : value === "complete" ? (locale === "th" ? "ครบถ้วน" : "Complete") : value === "disconnect" ? (locale === "th" ? "อุปกรณ์ตัดการเชื่อมต่อ" : "Device disconnected") : value === "stopped" ? (locale === "th" ? "หยุดแล้ว" : "Stopped") : value;
  const hasFinished = status !== "idle" && status !== "recording";
  const remaining = status === "recording" ? Math.max(0, Math.ceil((data?.durations[phaseIndex] || 0) - clock)) : 0;
  const shownDurations = data?.durations || [BASELINE_SECONDS, taskSeconds, POST_TASK_SECONDS];
  const totalDuration = shownDurations.map(Number).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const elapsedPrevious = data?.durations.slice(0, phaseIndex).reduce((sum, value) => sum + value, 0) || 0;
  const progress = status === "recording" && totalDuration ? Math.min(100, ((elapsedPrevious + clock) / totalDuration) * 100) : status === "complete" ? 100 : data && totalDuration ? Math.min(100, (((data.endedMs || data.lastPacketMs) - data.startedMs) / 1000 / totalDuration) * 100) : 0;
  const runLabel = status === "recording" ? PHASES[phaseIndex].label : status === "complete" ? "ครบตามแผนการทดลอง" : hasFinished ? "รอบไม่สมบูรณ์ · ข้อมูลบางส่วน" : "พร้อมตั้งค่าการทดลอง";

  return (
    <div className="study-workspace">
      <div className="card study-card">
        <div className="study-heading"><div><span className="study-kicker">01 · STUDY SETUP</span><h2>เตรียมรอบทดลอง</h2><p className="muted">ใช้รหัสแทนชื่อจริง ตั้งเงื่อนไข และบันทึกความยินยอมตามเอกสารโครงการ</p></div><span className="pill">Muse 2 / Muse S · 4 EEG channels</span></div>
        <div className="study-form">
          <label>รหัสผู้เข้าร่วม *<input value={participant} onChange={(e) => setParticipant(e.target.value)} placeholder="เช่น P001" maxLength={40} disabled={status !== "idle"} /></label>
          <label>รหัสรอบทดลอง *<input value={sessionId} onChange={(e) => setSessionId(e.target.value)} placeholder="S01" maxLength={40} disabled={status !== "idle"} /></label>
          <label>กลุ่มวิจัย *<select value={studyGroup} onChange={(e) => setStudyGroup(e.target.value)} disabled={status !== "idle"}><option value="">เลือกกลุ่ม</option><option value="patient">ผู้ป่วย / Patient</option><option value="control">กลุ่มควบคุม / Control</option></select></label>
          <label>เกมในช่วง Task *<select value={gameId} onChange={(e) => setGameId(Number(e.target.value))} disabled={status !== "idle"}>{GAMES.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}</select></label>
          <label>เงื่อนไขการทดลอง<input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="standard" maxLength={80} disabled={status !== "idle"} /></label>
        </div>
        <div className="study-durations">
          <label>{PHASES[0].label}<span>{BASELINE_SECONDS} วินาที</span></label>
          <label>{PHASES[1].label}<span><input type="number" min="5" max="540" value={taskSeconds} disabled={status !== "idle"} onChange={(e) => setTaskSeconds(e.target.value)} /> วินาทีสูงสุด</span></label>
          <label>{PHASES[2].label}<span>{POST_TASK_SECONDS} วินาที</span></label>
        </div>
        <p className="muted" style={{ fontSize: "12px", margin: "10px 0 0" }}>EEG บันทึกต่อเนื่อง: พักนิ่ง 30 วินาที → ทำกิจกรรมจนกว่าจะกดจบหรือครบเวลาที่ตั้ง → พักหลังงานอีก 30 วินาที · หนึ่งเกมต่อหนึ่งรอบ · เวลารวมสูงสุด 600 วินาที</p>
        <label className="study-consent"><input type="checkbox" checked={consent} disabled={status !== "idle"} onChange={(e) => setConsent(e.target.checked)} /> <span>ผู้วิจัยยืนยันว่าได้รับความยินยอมตามขั้นตอนของโครงการแล้ว</span></label>
      </div>

      <div className="card study-card">
        <div className="study-heading"><div><span className="study-kicker">02 · RECORDING</span><h2>ดำเนินการทดลอง</h2><p className="muted">EEG บันทึกตลอด Baseline 30 วินาที → Task → Rest 30 วินาที · เกมเปิดเองเมื่อเริ่ม Task</p></div><span className={ready ? liveRailPercents.some((value) => value >= 1) ? "pill study-warn" : "pill study-ready" : "pill"}>{ready ? liveRailPercents.some((value) => value >= 1) ? "● EEG ครบ 4 ช่อง · ตรวจสัมผัสเซนเซอร์" : "● EEG ครบ 4 ช่อง" : "○ รอ EEG ครบ 4 ช่อง"}</span></div>
        {ready && liveRailPercents.some((value) => value >= 1) && <p className="study-signal-warning" role="alert">สัญญาณล่าสุด 3 วินาทีชนขอบ: {CHANNELS.map((name, index) => `${name} ${liveRailPercents[index].toFixed(1)}%`).join(" · ")} · ปรับเซนเซอร์ก่อนเริ่มรอบผู้เข้าร่วม</p>}
        <div className="study-phase-grid">{PHASES.map((phase, index) => <div className={"study-phase" + (status === "recording" && phaseIndex === index ? " current" : "")} key={phase.key}><small>0{index + 1}</small><strong>{phase.label}</strong><span>{index === 1 && phaseIndex > 1 ? shownDurations[index].toFixed(1) : shownDurations[index]} วินาที</span></div>)}</div>
        <div className="study-runbar"><div style={{ width: `${progress}%` }} /></div>
        <div className="study-run-status"><strong>{runLabel}</strong><span>{status === "recording" ? `เหลือ ${remaining} วินาที` : data ? `${data.samples.toLocaleString()} samples · ${data.events} markers` : "ยังไม่มีข้อมูลในรอบนี้"}</span></div>
        <div className="controls">
          {status === "idle" && <button type="button" onClick={() => start(false)} disabled={!storageReady || busy}>เริ่มบันทึกการทดลอง</button>}
          {status === "idle" && <button type="button" className="secondary" onClick={() => start(true)} disabled={!storageReady || busy}>ทดสอบอุปกรณ์ 15 วินาที</button>}
          {status === "recording" && <button type="button" className="secondary" onClick={() => finish("stopped")}>หยุดและเก็บข้อมูลที่มี</button>}
          {hasFinished && !data?.rawDeleted && <button type="button" onClick={() => exportCsv()} disabled={busy}>ส่งออก EEG + markers (.csv)</button>}
          {hasFinished && <button type="button" className="secondary" onClick={reset} disabled={!exported || busy}>เริ่มรอบใหม่</button>}
          {!ready && status === "idle" && <button type="button" className="secondary" onClick={() => document.getElementById("connectMuseBtn")?.click()}>เชื่อมต่อ Muse</button>}
        </div>
        {status === "recording" && <div className="study-marker"><input value={markerText} onChange={(e) => setMarkerText(e.target.value)} maxLength={80} placeholder="ข้อความ marker เช่น stimulus_onset" aria-label="ชื่อ marker" /><button type="button" className="secondary" onClick={() => { const label = markerText.trim(); if (label) { addMarker(label); setMarkerText(""); setViewTick((n) => n + 1); } }}>เพิ่ม marker</button></div>}
        {data && <div className="study-channel-count" aria-live="polite">{CHANNELS.map((name, index) => {
          const railPercent = 100 * (data.railSamples?.[index] || 0) / Math.max(1, data.channels[index]);
          return <span className={railPercent >= 1 ? "study-channel-alert" : ""} key={name}>{name} <b>{data.channels[index].toLocaleString()}</b> samples · {(data.channels[index] / Math.max(1, ((data.endedMs || Date.now()) - data.startedMs) / 1000)).toFixed(1)} Hz จริง · ขาด {data.missingPackets[index]} packets · ชนขอบ {railPercent.toFixed(1)}%</span>;
        })}</div>}
        {data?.railSamples?.some((count, index) => count / Math.max(1, data.channels[index]) >= 0.01) && <p className="study-signal-warning" role="alert">สัญญาณบางช่องชนขอบช่วงวัดของ Muse มากกว่า 1% ข้อมูลช่องนั้นอาจใช้วิเคราะห์ไม่ได้ ตรวจให้เซนเซอร์สัมผัสผิวหนังแนบสนิท แล้วทดสอบใหม่ก่อนเก็บข้อมูลผู้เข้าร่วม</p>}
        {data && hasFinished && <p className="study-message">ตรวจคุณภาพ: {data.missingPackets.reduce((sum, value) => sum + value, 0).toLocaleString()} packets ที่ตรวจพบว่าขาด · {data.duplicatePackets.reduce((sum, value) => sum + value, 0).toLocaleString()} packets ซ้ำ · {data.reorderedPackets.reduce((sum, value) => sum + value, 0).toLocaleString()} packets ลำดับผิดปกติ การนับนี้เป็นการประมาณจากลำดับแพ็กเก็ตของ Muse</p>}
        <p className="study-message" role="status">{message || (storageReady ? "ข้อมูล EEG จะบันทึกในเบราว์เซอร์นี้ โปรดส่งออก CSV เพื่อสำรองข้อมูล" : "กำลังตรวจสอบที่เก็บข้อมูลในเบราว์เซอร์")}</p>
      </div>
      {savedSessions.length > 0 && <div className="card study-card">
        <div className="study-heading"><div><span className="study-kicker">03 · LOCAL RECORDINGS</span><h2>รอบทดลองที่เก็บในเครื่อง</h2><p className="muted">ผลสรุปแต่ละรอบอยู่ใน Dashboard และจะส่งขึ้นเซิร์ฟเวอร์ให้ admin ดูตามรหัสผู้เข้าร่วม</p></div><button type="button" className="secondary" disabled={!enabled || syncing} onClick={syncPending}>{syncing ? (locale === "th" ? "กำลังซิงก์…" : "Syncing…") : (locale === "th" ? "ซิงก์ผลสรุปอีกครั้ง" : "Retry summary sync")}</button></div>
        {syncError && <p className="study-signal-warning" role="alert">{locale === "th" ? "ซิงก์ผลสรุปไม่สำเร็จ" : "Summary sync failed"}: {syncError}</p>}
        <div className="study-saved-list">{savedSessions.map((session) => <div className="study-saved-item" key={session.id}>
          <div><strong>{session.participant} · {session.sessionId}</strong><small>{new Date(session.startedMs).toLocaleString(locale === "th" ? "th-TH" : "en-US")} · {session.testMode ? (locale === "th" ? "ทดสอบอุปกรณ์" : "Device test") : `${groupLabel(session.studyGroup)} · ${localizeText(session.taskName, locale)}`} · {savedStatusLabel(session.status)} · {session.samples.toLocaleString()} samples{session.rawDeleted ? (locale === "th" ? " · เก็บเฉพาะสรุป" : " · summary only") : ""} · {session.serverSyncedAt && session.serverSyncedBy === accountEmail ? (locale === "th" ? "ซิงก์แล้ว" : "Synced") : (locale === "th" ? "รอซิงก์" : "Pending sync")}</small></div>
          <div className="controls">
            <button type="button" className="secondary" onClick={() => { window.showSection?.("dashboard"); window.dispatchEvent(new CustomEvent("research-summary-select", { detail: { id: session.id } })); requestAnimationFrame(() => document.querySelector(".research-history")?.scrollIntoView({ behavior: "smooth" })); }}>{locale === "th" ? "ดูสรุป" : "View summary"}</button>
            {!session.rawDeleted && <button type="button" className="secondary" disabled={busy || session.status === "recording"} onClick={() => exportCsv(session)}>{locale === "th" ? "ส่งออก CSV" : "Export CSV"}</button>}
            {!session.rawDeleted && <button type="button" className="secondary" disabled={busy || !session.exported || session.status === "recording"} onClick={() => pruneSaved(session)}>{locale === "th" ? "ลบ EEG ดิบ เก็บสรุป" : "Delete raw EEG, keep summary"}</button>}
            <button type="button" className="secondary" disabled={busy || session.status === "recording" || session.id === data?.id} onClick={() => removeSaved(session)}>{locale === "th" ? "ลบรอบถาวร" : "Delete session"}</button>
          </div>
        </div>)}</div>
      </div>}
    </div>
  );
}
