"use client";

import { useEffect, useState } from "react";

const COPY = {
  th: {
    title: "สรุปผลทุกครั้งที่ทดลอง",
    note: "เก็บผลสรุปแยกตามรอบในเบราว์เซอร์นี้ รวมถึงรอบที่หยุดก่อนกำหนดและรอบทดสอบอุปกรณ์",
    empty: "ยังไม่มีรอบทดลองที่บันทึกไว้",
    loading: "กำลังโหลดรอบทดลอง…",
    backfilling: "กำลังสรุปรอบทดลองเดิม",
    export: "ส่งออกสรุปทุกครั้ง (.csv)",
    date: "วันที่",
    run: "ผู้เข้าร่วม / รอบ",
    group: "กลุ่ม",
    game: "เกม",
    protocol: "โปรโตคอล",
    status: "สถานะ",
    task: "Task (วินาที)",
    samples: "EEG samples",
    rate: "เฉลี่ยต่อช่อง (Hz)",
    accuracy: "ความแม่นยำเกม",
    raw: "EEG ดิบ",
    available: "เก็บอยู่",
    removed: "ลบแล้ว",
    compare: "เปรียบเทียบผลสรุปสองรอบ",
    differentProtocol: "สองรอบนี้ใช้คนละโปรโตคอล โปรดตรวจขั้นตอนและเวลาที่ตั้งก่อนตีความผลต่าง",
    first: "รอบอ้างอิง",
    second: "รอบที่เปรียบเทียบ",
    choose: "เลือกรอบ",
    difference: "ผลต่าง (รอบที่เปรียบเทียบ − รอบอ้างอิง)",
    selectTwo: "เลือกรอบที่ต่างกันสองรอบเพื่อดูผลเปรียบเทียบ",
    metric: "ตัวชี้วัด",
    duration: "เวลารวม (วินาที)",
    baseline: "Baseline (วินาที)",
    rest: "Rest (วินาที)",
    clipped: "สัญญาณชนขอบ (%)",
    missing: "แพ็กเก็ตที่ขาด",
    duplicate: "แพ็กเก็ตซ้ำ",
    reordered: "แพ็กเก็ตผิดลำดับ",
    markers: "จำนวน marker",
    trials: "จำนวนครั้งที่ตอบ",
    reaction: "เวลาตอบเฉลี่ย (ms)",
    patient: "ผู้ป่วย",
    control: "กลุ่มควบคุม",
    deviceTest: "ทดสอบอุปกรณ์",
    noGroup: "ไม่ระบุกลุ่ม",
    noGame: "ไม่มีเกม",
    complete: "ครบถ้วน",
    recording: "กำลังบันทึก",
    interrupted: "ขัดจังหวะ",
    stopped: "หยุดก่อนครบ",
    disconnect: "อุปกรณ์ตัดการเชื่อมต่อ",
    signal_lost: "สัญญาณหาย",
    hidden: "แท็บถูกซ่อน",
    task_screen_left: "ออกจากหน้าเกม",
    task_not_started: "เกมไม่เริ่ม",
    storage_error: "บันทึกผิดพลาด",
  },
  en: {
    title: "Summary of every session",
    note: "Each session is kept separately in this browser, including incomplete runs and device tests.",
    empty: "No saved sessions yet",
    loading: "Loading sessions…",
    backfilling: "Summarizing earlier sessions",
    export: "Export all summaries (.csv)",
    date: "Date",
    run: "Participant / session",
    group: "Group",
    game: "Game",
    protocol: "Protocol",
    status: "Status",
    task: "Task (seconds)",
    samples: "EEG samples",
    rate: "Per-channel average (Hz)",
    accuracy: "Game accuracy",
    raw: "Raw EEG",
    available: "Saved",
    removed: "Removed",
    compare: "Compare two session summaries",
    differentProtocol: "These sessions use different protocols. Check the procedure and planned timing before interpreting differences.",
    first: "Reference session",
    second: "Comparison session",
    choose: "Select a session",
    difference: "Difference (comparison − reference)",
    selectTwo: "Select two different sessions to compare their results.",
    metric: "Metric",
    duration: "Total duration (seconds)",
    baseline: "Baseline (seconds)",
    rest: "Rest (seconds)",
    clipped: "Clipped signal (%)",
    missing: "Missing packets",
    duplicate: "Duplicate packets",
    reordered: "Out-of-order packets",
    markers: "Event markers",
    trials: "Responses",
    reaction: "Mean response time (ms)",
    patient: "Patient",
    control: "Control",
    deviceTest: "Device test",
    noGroup: "Unspecified group",
    noGame: "No game",
    complete: "Complete",
    recording: "Recording",
    interrupted: "Interrupted",
    stopped: "Stopped early",
    disconnect: "Device disconnected",
    signal_lost: "Signal lost",
    hidden: "Tab hidden",
    task_screen_left: "Game page left",
    task_not_started: "Game not started",
    storage_error: "Storage error",
  },
};

const METRICS = [
  ["duration", "durationSeconds", 1],
  ["baseline", "baselineSeconds", 1],
  ["task", "taskSeconds", 1],
  ["rest", "restSeconds", 1],
  ["samples", "samples", 0],
  ["rate", "averageHzPerChannel", 1],
  ["clipped", "clippedPercent", 2],
  ["missing", "missingPackets", 0],
  ["duplicate", "duplicatePackets", 0],
  ["reordered", "reorderedPackets", 0],
  ["markers", "markers", 0],
  ["trials", "game.trials", 0],
  ["accuracy", "game.accuracyPercent", 1],
  ["reaction", "game.meanRtMs", 0],
];

function number(value, digits, locale, signed = false) {
  if (value == null || !Number.isFinite(value)) return "—";
  const formatted = new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  return signed && value > 0 ? `+${formatted}` : formatted;
}

function valueAt(summary, path) {
  return path.split(".").reduce((value, key) => value?.[key], summary);
}

function csvCell(value) {
  const raw = String(value ?? "");
  const safe = !/^-?(?:\d+\.?\d*|\.\d+)$/.test(raw) && /^[=+@\-\t\r]/.test(raw) ? "'" + raw : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export default function ResearchHistory({ sessions, locale = "th", loading, backfilling, source = "browser" }) {
  const copy = COPY[locale] || COPY.th;
  const [firstId, setFirstId] = useState("");
  const [secondId, setSecondId] = useState("");

  useEffect(() => {
    setFirstId((previous) => sessions.some((session) => session.id === previous) ? previous : sessions[1]?.id || sessions[0]?.id || "");
    setSecondId((previous) => sessions.some((session) => session.id === previous) ? previous : sessions[0]?.id || "");
  }, [sessions]);

  useEffect(() => {
    const onSelect = (event) => {
      const id = event.detail?.id;
      if (id) setSecondId(id);
    };
    window.addEventListener("research-summary-select", onSelect);
    return () => window.removeEventListener("research-summary-select", onSelect);
  }, []);

  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  const gameName = (session) => session.testMode ? copy.noGame : ["", locale === "th" ? "คี่หรือคู่" : "Odd or Even", locale === "th" ? "ลำดับสะท้อน" : "Echo Sequence", locale === "th" ? "รูปแบบเปลี่ยนแปลง" : "Pattern Drift"][session.gameId] || copy.noGame;
  const groupName = (session) => session.testMode ? copy.deviceTest : session.studyGroup === "patient" ? copy.patient : session.studyGroup === "control" ? copy.control : copy.noGroup;
  const statusName = (session) => copy[session.status] || session.status;
  const optionLabel = (session) => `${new Date(session.startedMs).toLocaleString(dateLocale)} · ${session.participant || "—"} / ${session.sessionId || "—"} · ${statusName(session)}`;
  const first = sessions.find((session) => session.id === firstId);
  const second = sessions.find((session) => session.id === secondId);
  const comparable = first && second && first.id !== second.id;

  const exportSummaries = () => {
    const headers = ["record_id", "started_at_iso", "ended_at_iso", "participant_id", "session_id", "study_group", "condition", "protocol_version", "game_id", "status", "test_mode", "raw_eeg_removed", "total_seconds", "baseline_seconds", "task_seconds", "rest_seconds", "eeg_samples", "tp9_samples", "af7_samples", "af8_samples", "tp10_samples", "average_hz_per_channel", "clipped_samples", "clipped_percent", "missing_packets", "duplicate_packets", "reordered_packets", "event_markers", "game_trials", "game_correct", "game_errors", "game_accuracy_percent", "mean_reaction_ms"];
    const rows = sessions.map((session) => {
      const summary = session.summary;
      return [session.id, new Date(summary.startedMs).toISOString(), summary.endedMs ? new Date(summary.endedMs).toISOString() : "", summary.participant, summary.sessionId, summary.studyGroup, summary.condition, summary.protocolVersion || "", summary.gameId || "", summary.status, summary.testMode, source === "server" ? "" : Boolean(session.rawDeleted), summary.durationSeconds, summary.baselineSeconds, summary.taskSeconds, summary.restSeconds, summary.samples, ...summary.channelSamples, summary.averageHzPerChannel, summary.clippedSamples, summary.clippedPercent, summary.missingPackets, summary.duplicatePackets, summary.reorderedPackets, summary.markers, summary.game?.trials, summary.game?.correct, summary.game?.errors, summary.game?.accuracyPercent, summary.game?.meanRtMs].map(csvCell).join(",");
    });
    const blob = new Blob(["\ufeff", headers.join(","), "\r\n", rows.join("\r\n"), "\r\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cogniload_session_summaries_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <section className="research-history" aria-label={copy.title}>
    <div className="study-heading">
      <div><span className="study-kicker">SESSION HISTORY</span><h2>{copy.title}</h2><p className="muted">{source === "server" ? (locale === "th" ? "ผลสรุปที่ซิงก์ขึ้นเซิร์ฟเวอร์สำหรับรหัสผู้เข้าร่วมนี้" : "Server-synced summaries for this participant ID") : copy.note}</p></div>
      <button type="button" className="secondary" disabled={!sessions.length || backfilling > 0} onClick={exportSummaries}>{copy.export}</button>
    </div>
    {backfilling > 0 && <p className="muted" role="status">{copy.backfilling}: {backfilling}</p>}
    {!sessions.length ? <p className="card research-history-empty">{loading ? copy.loading : copy.empty}</p> : <>
      <div className="research-history-scroll"><table className="research-history-table">
        <thead><tr><th>{copy.date}</th><th>{copy.run}</th><th>{copy.group}</th><th>{copy.protocol}</th><th>{copy.game}</th><th>{copy.status}</th><th>{copy.task}</th><th>{copy.samples}</th><th>{copy.rate}</th><th>{copy.accuracy}</th><th>{copy.raw}</th></tr></thead>
        <tbody>{sessions.map((session) => <tr key={session.id}>
          <td>{new Date(session.startedMs).toLocaleString(dateLocale)}</td><td><strong>{session.participant || "—"}</strong><br />{session.sessionId || "—"}</td><td>{groupName(session)}</td><td>{session.summary.protocolVersion || "—"}</td><td>{gameName(session)}</td><td>{statusName(session)}</td>
          <td>{number(session.summary.taskSeconds, 1, locale)}</td><td>{number(session.summary.samples, 0, locale)}</td><td>{number(session.summary.averageHzPerChannel, 1, locale)}</td><td>{number(session.summary.game?.accuracyPercent, 1, locale)}{session.summary.game?.accuracyPercent != null ? "%" : ""}</td><td>{source === "server" ? (locale === "th" ? "อยู่ในเครื่องผู้วิจัย" : "Researcher's device") : session.rawDeleted ? copy.removed : copy.available}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="card research-compare">
        <h3>{copy.compare}</h3>
        <div className="research-compare-pickers">
          <label>{copy.first}<select value={firstId} onChange={(event) => setFirstId(event.target.value)}><option value="">{copy.choose}</option>{sessions.map((session) => <option key={session.id} value={session.id}>{optionLabel(session)}</option>)}</select></label>
          <label>{copy.second}<select value={secondId} onChange={(event) => setSecondId(event.target.value)}><option value="">{copy.choose}</option>{sessions.map((session) => <option key={session.id} value={session.id}>{optionLabel(session)}</option>)}</select></label>
        </div>
        {comparable && first.summary.protocolVersion && second.summary.protocolVersion && first.summary.protocolVersion !== second.summary.protocolVersion && <p className="study-signal-warning" role="status">{copy.differentProtocol} ({first.summary.protocolVersion} / {second.summary.protocolVersion})</p>}
        {comparable ? <div className="research-history-scroll"><table className="research-history-table research-compare-table"><thead><tr><th>{copy.metric}</th><th>{copy.first}</th><th>{copy.second}</th><th>{copy.difference}</th></tr></thead><tbody>
          {METRICS.map(([label, path, digits]) => {
            const left = valueAt(first.summary, path);
            const right = valueAt(second.summary, path);
            return <tr key={path}><th scope="row">{copy[label]}</th><td>{number(left, digits, locale)}</td><td>{number(right, digits, locale)}</td><td>{number(left != null && right != null ? right - left : null, digits, locale, true)}</td></tr>;
          })}
        </tbody></table></div> : <p className="muted">{copy.selectTwo}</p>}
      </div>
    </>}
  </section>;
}
