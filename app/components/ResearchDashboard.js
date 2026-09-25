"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getResearchGameSummaryMarker, listResearchSessions, saveResearchSummary } from "./researchStorage";
import { parseGameSummaryMarker, summarizeResearchSession } from "@/lib/research-summary.mjs";
import ResearchHistory from "./ResearchHistory";

const CHANNELS = ["TP9", "AF7", "AF8", "TP10"];
const PHASES = [
  { label: "ก่อนกิจกรรม", color: "#33d6ff" },
  { label: "ทำกิจกรรม", color: "#9b7bff" },
  { label: "หลังกิจกรรม", color: "#4fe0a1" },
];

function phaseSeconds(session) {
  const [baselineStart, taskStart, restStart] = session.phaseStarts || [];
  const end = session.endedMs;
  if (![baselineStart, taskStart, restStart, end].every(Number.isFinite) || !(baselineStart < taskStart && taskStart < restStart && restStart < end)) return null;
  return [(taskStart - baselineStart) / 1000, (restStart - taskStart) / 1000, (end - restStart) / 1000];
}

function sessionRate(session) {
  const duration = (session.endedMs - session.startedMs) / 1000;
  if (!Number.isFinite(duration) || duration <= 0 || !Array.isArray(session.channels)) return null;
  const samples = session.channels.reduce((total, value) => total + (Number(value) || 0), 0);
  return samples > 0 ? samples / 4 / duration : null;
}

export default function ResearchDashboard({ locale = "th" }) {
  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(0);
  const refreshId = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++refreshId.current;
    try {
      const saved = await listResearchSessions();
      if (requestId !== refreshId.current) return;
      setSessions(saved.map((session) => session.summary ? session : { ...session, summary: summarizeResearchSession(session) }));
      setError("");
      setLoading(false);
      const legacy = saved.filter((session) => !session.summary && session.status !== "recording" && !session.rawDeleted);
      setBackfilling(legacy.length);
      for (const session of legacy) {
        if (requestId !== refreshId.current) return;
        try {
          const gameSummary = session.gameSummary || parseGameSummaryMarker(await getResearchGameSummaryMarker(session.id));
          const summary = summarizeResearchSession(session, gameSummary);
          await saveResearchSummary(session.id, summary, gameSummary);
          if (requestId === refreshId.current) setSessions((current) => current.map((item) => item.id === session.id ? { ...item, gameSummary, summary } : item));
        } catch (cause) {
          if (requestId === refreshId.current) setError(`อ่านผลสรุปรอบ ${session.sessionId} ไม่สำเร็จ: ${cause.message}`);
        } finally {
          if (requestId === refreshId.current) setBackfilling((count) => Math.max(0, count - 1));
        }
      }
    } catch (cause) {
      if (requestId !== refreshId.current) return;
      setError(`อ่านข้อมูลรอบ EEG ไม่สำเร็จ: ${cause.message}`);
      setBackfilling(0);
    } finally {
      if (requestId === refreshId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("research-dashboard-opened", refresh);
    window.addEventListener("research-session-finished", refresh);
    return () => {
      window.removeEventListener("research-dashboard-opened", refresh);
      window.removeEventListener("research-session-finished", refresh);
    };
  }, [refresh]);

  const complete = sessions.filter((session) => !session.testMode && session.status === "complete");
  const latest = complete[0];
  const latestSamples = latest?.channels?.map((value) => Number(value) || 0) || [];
  const maxSamples = Math.max(0, ...latestSamples);
  const phases = latest && phaseSeconds(latest);
  const phaseTotal = phases?.reduce((sum, value) => sum + value, 0) || 0;
  let share = 0;
  const pieStops = phases?.map((seconds, index) => {
    const start = share;
    share += 100 * seconds / phaseTotal;
    return `${PHASES[index].color} ${start.toFixed(2)}% ${share.toFixed(2)}%`;
  });
  const recent = complete.slice(0, 12).reverse().map((session) => ({ session, rate: sessionRate(session) })).filter((item) => item.rate !== null);
  const maxRate = Math.max(256, ...recent.map((item) => item.rate));
  const axisMax = Math.ceil(maxRate / 50) * 50;
  const x = (index) => recent.length === 1 ? 310 : 50 + index * 510 / (recent.length - 1);
  const y = (rate) => 175 - rate * 145 / axisMax;
  const linePoints = recent.map((item, index) => `${x(index)},${y(item.rate)}`).join(" ");

  return (
    <div className="research-dashboard">
      <div className="study-heading">
        <div><span className="study-kicker">EEG RECORDINGS</span><h2>ภาพรวมรอบทดลอง EEG</h2><p className="muted">แสดงเฉพาะรอบทดลองที่บันทึกครบและไม่ใช่การทดสอบอุปกรณ์ · ข้อมูลอยู่ในเบราว์เซอร์นี้</p></div>
        <div className="controls" style={{ margin: 0 }}>
          <button type="button" className="secondary" onClick={() => document.querySelector(".research-history")?.scrollIntoView({ behavior: "smooth" })}>{locale === "th" ? "ดูประวัติและเปรียบเทียบ" : "View history and compare"}</button>
          <button type="button" className="secondary" onClick={refresh}>อัปเดตกราฟ</button>
        </div>
      </div>
      {error && <p className="study-signal-warning" role="alert">{error}</p>}
      <div className="research-chart-summary" aria-live="polite">
        <span><strong>{sessions.length}</strong> {locale === "th" ? "รอบทั้งหมด" : "all sessions"}</span>
        <span><strong>{complete.length}</strong> รอบที่บันทึกครบ</span>
        <span><strong>{latest ? new Date(latest.startedMs).toLocaleString(dateLocale) : "—"}</strong> รอบล่าสุด</span>
        <span><strong>{latest ? (latest.channels || []).reduce((sum, value) => sum + (Number(value) || 0), 0).toLocaleString() : "—"}</strong> EEG samples รอบล่าสุด</span>
      </div>
      <div className="research-charts">
        <figure className="card research-chart-card">
          <figcaption><h3>กราฟแท่ง · EEG samples แยกช่อง</h3><p className="muted">จำนวนตัวอย่างของรอบล่าสุดที่บันทึกครบ</p></figcaption>
          {maxSamples > 0 ? <div className="research-bar-plot" role="img" aria-label={CHANNELS.map((channel, index) => `${channel} ${latestSamples[index].toLocaleString()} samples`).join(", ")}>
            {CHANNELS.map((channel, index) => <div className="research-bar-column" key={channel}>
              <span className="research-bar-value">{latestSamples[index].toLocaleString()}</span>
              <div className="research-bar-track"><div className="research-bar-fill" style={{ height: `${100 * latestSamples[index] / maxSamples}%` }} /></div>
              <strong>{channel}</strong>
            </div>)}
          </div> : <p className="research-chart-empty">{loading ? "กำลังโหลดข้อมูล…" : "ยังไม่มีรอบ EEG ที่บันทึกครบ"}</p>}
        </figure>
        <figure className="card research-chart-card">
          <figcaption><h3>กราฟวงกลม · เวลาของแต่ละช่วง</h3><p className="muted">เวลาที่เกิดขึ้นจริงในรอบล่าสุด</p></figcaption>
          {phaseTotal > 0 ? <div className="research-pie-layout">
            <div className="research-pie" style={{ background: `conic-gradient(${pieStops.join(", ")})` }} role="img" aria-label={PHASES.map((phase, index) => `${phase.label} ${phases[index].toFixed(1)} วินาที`).join(", ")} />
            <ul className="research-pie-legend">{PHASES.map((phase, index) => <li key={phase.label}><span className="research-legend-color" style={{ backgroundColor: phase.color }} /><span>{phase.label}</span><strong>{phases[index].toFixed(1)} วิ · {(100 * phases[index] / phaseTotal).toFixed(0)}%</strong></li>)}</ul>
          </div> : <p className="research-chart-empty">{loading ? "กำลังโหลดข้อมูล…" : "ยังไม่มีเวลาของรอบ EEG ที่บันทึกครบ"}</p>}
        </figure>
        <figure className="card research-chart-card research-chart-wide">
          <figcaption><h3>กราฟเส้น · อัตราตัวอย่าง EEG ตามรอบทดลอง</h3><p className="muted">ค่าเฉลี่ยต่อช่อง (Hz) ของรอบที่บันทึกครบ สูงสุด 12 รอบ เรียงตามเวลา</p></figcaption>
          {recent.length ? <>
            <svg className="research-line-plot" viewBox="0 0 600 220" role="img" aria-label={`อัตราตัวอย่าง EEG ตามรอบทดลอง: ${recent.map((item, index) => `รอบ ${index + 1} ${item.rate.toFixed(1)} Hz`).join(", ")}`}>
              {[0, 1, 2, 3, 4].map((tick) => {
                const value = axisMax * tick / 4;
                return <g key={tick}><line x1="50" x2="560" y1={y(value)} y2={y(value)} className="research-grid-line" /><text x="42" y={y(value) + 4} textAnchor="end">{value.toFixed(0)}</text></g>;
              })}
              {recent.length > 1 && <polyline points={linePoints} className="research-data-line" />}
              {recent.map((item, index) => <g key={item.session.id}><circle cx={x(index)} cy={y(item.rate)} r="5" className="research-data-point"><title>{new Date(item.session.startedMs).toLocaleString(dateLocale)} · {item.rate.toFixed(1)} Hz</title></circle><text x={x(index)} y="202" textAnchor="middle">{index + 1}</text></g>)}
            </svg>
            {recent.length === 1 && <p className="muted research-line-note">มีข้อมูลหนึ่งรอบ กราฟจะแสดงเส้นแนวโน้มเมื่อมีรอบที่บันทึกครบอย่างน้อยสองรอบ</p>}
            <p className="muted research-line-note">เลขใต้กราฟคือรอบที่ {recent.map((item, index) => `${index + 1}: ${new Date(item.session.startedMs).toLocaleDateString(dateLocale)} (${item.rate.toFixed(1)} Hz)`).join(" · ")}</p>
          </> : <p className="research-chart-empty">{loading ? "กำลังโหลดข้อมูล…" : "ยังไม่มีรอบ EEG ที่บันทึกครบ"}</p>}
        </figure>
      </div>
      <ResearchHistory sessions={sessions} locale={locale} loading={loading} backfilling={backfilling} />
    </div>
  );
}
