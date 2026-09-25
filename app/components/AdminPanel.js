"use client";

import { useCallback, useEffect, useState } from "react";
import ResearchHistory from "./ResearchHistory";

export default function AdminPanel({ locale = "th", enabled = false }) {
  const [query, setQuery] = useState("");
  const [participants, setParticipants] = useState([]);
  const [selected, setSelected] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [studyDraft, setStudyDraft] = useState(null);
  const [studySource, setStudySource] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");

  const load = useCallback(async (url) => {
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    setError("");
    load(`/api/admin/participants?q=${encodeURIComponent(query)}`).then((data) => {
      if (active) setParticipants(data.participants);
    }).catch((cause) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enabled, query, refresh, load]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setSettingsError("");
    load("/api/admin/settings").then((data) => {
      if (!active) return;
      setStudyDraft(data.study);
      setStudySource(data.source);
    }).catch((cause) => { if (active) setSettingsError(cause.message); });
    return () => { active = false; };
  }, [enabled, refresh, load]);

  const changeStudy = (key, value) => setStudyDraft((previous) => {
    const next = { ...previous, [key]: value };
    const baseline = Number(next.baselineSeconds);
    const rest = Number(next.postTaskSeconds);
    if (Number.isInteger(baseline) && baseline >= 1 && Number.isInteger(rest) && rest >= 1) {
      const available = 600 - baseline - rest;
      if (available >= 5 && Number(next.maxTaskSeconds) > available) next.maxTaskSeconds = available;
    }
    if (Number(next.defaultTaskSeconds) > Number(next.maxTaskSeconds)) next.defaultTaskSeconds = next.maxTaskSeconds;
    return next;
  });

  const submitSettings = async (event) => {
    event.preventDefault();
    if (!studyDraft || settingsBusy) return;
    setSettingsBusy(true);
    setSettingsError("");
    setSettingsMessage("");
    try {
      const study = {
        baselineSeconds: Number(studyDraft.baselineSeconds),
        postTaskSeconds: Number(studyDraft.postTaskSeconds),
        maxTaskSeconds: Number(studyDraft.maxTaskSeconds),
        defaultTaskSeconds: Number(studyDraft.defaultTaskSeconds),
        protocolVersion: studyDraft.protocolVersion.trim(),
      };
      const response = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(study) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
      setStudyDraft(data.study);
      setStudySource(data.source);
      setSettingsMessage(locale === "th" ? "บันทึกแล้ว รอบทดลองใหม่จะใช้ค่านี้" : "Saved. New sessions will use these settings.");
      window.dispatchEvent(new Event("study-config-updated"));
    } catch (cause) {
      setSettingsError(cause.message);
    } finally {
      setSettingsBusy(false);
    }
  };

  const restoreSettings = async () => {
    if (settingsBusy || !window.confirm(locale === "th" ? "คืนค่าการทดลองตามตัวแปรเซิร์ฟเวอร์หรือไม่?" : "Restore study settings from the server environment?")) return;
    setSettingsBusy(true);
    setSettingsError("");
    setSettingsMessage("");
    try {
      const response = await fetch("/api/admin/settings", { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
      setStudyDraft(data.study);
      setStudySource(data.source);
      setSettingsMessage(locale === "th" ? "คืนค่าแล้ว" : "Defaults restored.");
      window.dispatchEvent(new Event("study-config-updated"));
    } catch (cause) {
      setSettingsError(cause.message);
    } finally {
      setSettingsBusy(false);
    }
  };

  useEffect(() => {
    if (!enabled || !selected) return;
    let active = true;
    setLoading(true);
    setError("");
    load(`/api/admin/participants/${encodeURIComponent(selected)}`).then((data) => {
      if (active) setRecords(data.records);
    }).catch((cause) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enabled, selected, refresh, load]);

  useEffect(() => {
    if (!enabled) { setSelected(""); setParticipants([]); setRecords([]); setStudyDraft(null); }
  }, [enabled]);

  const sessions = records.map((record) => ({ id: record.recordId, ...record.summary, summary: record.summary }));
  return <div className="admin-panel">
    <div className="card study-card">
      <div className="study-heading"><div><span className="study-kicker">ADMIN · STUDY SETTINGS</span><h2>{locale === "th" ? "ตั้งค่ารอบทดลอง" : "Study settings"}</h2><p className="muted">{locale === "th" ? "ค่าที่บันทึกจะใช้กับรอบทดลองใหม่ รอบที่กำลังบันทึกยังใช้ค่าเดิม" : "Saved values apply to new sessions. Active sessions keep their existing values."}</p></div><span className="pill">{studySource === "saved" ? (locale === "th" ? "ค่าจากหน้าเว็บ" : "Saved in app") : (locale === "th" ? "ค่าเซิร์ฟเวอร์" : "Server defaults")}</span></div>
      {studyDraft && <form onSubmit={submitSettings}>
        <div className="study-form">
          <label>{locale === "th" ? "Baseline (วินาที)" : "Baseline (seconds)"}<input type="number" min="1" max="300" required value={studyDraft.baselineSeconds} onChange={(event) => changeStudy("baselineSeconds", event.target.value)} disabled={settingsBusy} /></label>
          <label>{locale === "th" ? "พักหลังงาน (วินาที)" : "Post-task rest (seconds)"}<input type="number" min="1" max="300" required value={studyDraft.postTaskSeconds} onChange={(event) => changeStudy("postTaskSeconds", event.target.value)} disabled={settingsBusy} /></label>
          <label>{locale === "th" ? "Task สูงสุด (วินาที)" : "Maximum task (seconds)"}<input type="number" min="5" max={Math.max(5, 600 - Number(studyDraft.baselineSeconds) - Number(studyDraft.postTaskSeconds))} required value={studyDraft.maxTaskSeconds} onChange={(event) => changeStudy("maxTaskSeconds", event.target.value)} disabled={settingsBusy} /></label>
          <label>{locale === "th" ? "Task ค่าเริ่มต้น (วินาที)" : "Default task (seconds)"}<input type="number" min="5" max={studyDraft.maxTaskSeconds} required value={studyDraft.defaultTaskSeconds} onChange={(event) => changeStudy("defaultTaskSeconds", event.target.value)} disabled={settingsBusy} /></label>
          <label>{locale === "th" ? "รหัสโปรโตคอล" : "Protocol version"}<input type="text" required maxLength={64} value={studyDraft.protocolVersion} onChange={(event) => changeStudy("protocolVersion", event.target.value)} disabled={settingsBusy} /></label>
        </div>
        <p className="muted">{locale === "th" ? "เวลารวมตามแผนสูงสุด 600 วินาที · เปลี่ยนรหัสโปรโตคอลเมื่อขั้นตอนทดลองเปลี่ยน" : "Planned total is capped at 600 seconds. Change the protocol version when the study procedure changes."}</p>
        <div className="controls"><button type="submit" disabled={settingsBusy}>{locale === "th" ? "บันทึกการตั้งค่า" : "Save settings"}</button><button type="button" className="secondary" onClick={restoreSettings} disabled={settingsBusy}>{locale === "th" ? "คืนค่าเซิร์ฟเวอร์" : "Restore server defaults"}</button></div>
      </form>}
      {!studyDraft && <div className="controls"><button type="button" className="secondary" onClick={restoreSettings} disabled={settingsBusy}>{locale === "th" ? "คืนค่าเซิร์ฟเวอร์" : "Restore server defaults"}</button></div>}
      {settingsError && <p className="study-signal-warning" role="alert">{settingsError}</p>}
      {settingsMessage && <p className="study-message" role="status">{settingsMessage}</p>}
    </div>
    <div className="card study-card">
      <div className="study-heading"><div><span className="study-kicker">ADMIN · PARTICIPANTS</span><h2>{locale === "th" ? "ข้อมูลรายรหัสผู้เข้าร่วม" : "Participant records"}</h2><p className="muted">{locale === "th" ? "ค้นหารหัสเพื่อดูผลสรุปทุกครั้งที่ทดลองและเปรียบเทียบสองรอบ ข้อมูล EEG ดิบอยู่ในเครื่องผู้วิจัย" : "Search an ID to see every session summary and compare two runs. Raw EEG remains on the researcher's device."}</p></div><button type="button" className="secondary" onClick={() => setRefresh((value) => value + 1)}>{locale === "th" ? "รีเฟรช" : "Refresh"}</button></div>
      <label className="admin-search">{locale === "th" ? "ค้นหารหัสผู้เข้าร่วม" : "Search participant ID"}<input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={40} placeholder="P001" /></label>
      {error && <p className="study-signal-warning" role="alert">{error}</p>}
      <p className="muted" role="status">{loading ? (locale === "th" ? "กำลังโหลด…" : "Loading…") : `${participants.length} ${locale === "th" ? "รหัส" : "IDs"}`}</p>
      <div className="admin-participants">{participants.map((item) => <button key={item.id} type="button" className={selected === item.id ? "active" : "secondary"} onClick={() => { setSelected(item.id); setRecords([]); }}>{item.id} <span>{item.sessionCount} {locale === "th" ? "รอบ" : "sessions"}</span></button>)}</div>
    </div>
    {selected && <>
      <div className="card study-card"><h3>{locale === "th" ? "รหัสผู้เข้าร่วม" : "Participant ID"}: {selected}</h3><p className="muted">{records.length} {locale === "th" ? "รอบที่ซิงก์แล้ว" : "synced sessions"}</p>{records.length > 0 && <p className="muted">{locale === "th" ? "ผู้บันทึก" : "Uploaded by"}: {[...new Set(records.map((record) => record.uploadedBy))].join(", ")}</p>}</div>
      <ResearchHistory sessions={sessions} locale={locale} loading={loading} source="server" />
    </>}
  </div>;
}
