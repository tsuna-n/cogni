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
    if (!enabled) { setSelected(""); setParticipants([]); setRecords([]); }
  }, [enabled]);

  const sessions = records.map((record) => ({ id: record.recordId, ...record.summary, summary: record.summary }));
  return <div className="admin-panel">
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
