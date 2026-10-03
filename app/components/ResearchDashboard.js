"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getResearchGameSummaryMarker,
  listResearchSessions,
  saveResearchSummary,
} from "./researchStorage";
import {
  parseGameSummaryMarker,
  summarizeResearchSession,
} from "@/lib/research-summary.mjs";
import { isOwnedResearchSession } from "@/lib/research/local-ownership.mjs";
import ResearchHistory from "./ResearchHistory";
import SyncedTaskPerformance from "./SyncedTaskPerformance";
import Icon from "./DashboardIcon";

const CHANNELS = ["TP9", "AF7", "AF8", "TP10"];
const PHASES = [
  { label: "ก่อนกิจกรรม", color: "#33d6ff" },
  { label: "ทำกิจกรรม", color: "#9b7bff" },
  { label: "หลังกิจกรรม", color: "#4fe0a1" },
];

function phaseSeconds(session) {
  const [baselineStart, taskStart, restStart] = session.phaseStarts || [];
  const end = session.endedMs;
  if (
    ![baselineStart, taskStart, restStart, end].every(Number.isFinite) ||
    !(baselineStart < taskStart && taskStart < restStart && restStart < end)
  )
    return null;
  return [
    (taskStart - baselineStart) / 1000,
    (restStart - taskStart) / 1000,
    (end - restStart) / 1000,
  ];
}

function sessionRate(session) {
  const duration = (session.endedMs - session.startedMs) / 1000;
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Array.isArray(session.channels)
  )
    return null;
  const samples = session.channels.reduce(
    (total, value) => total + (Number(value) || 0),
    0,
  );
  return samples > 0 ? samples / 4 / duration : null;
}

export default function ResearchDashboard({
  locale = "th",
  accountEmail = "",
  accountName = "",
  search = "",
  onClearSearch,
}) {
  const t = (th, en) => (locale === "th" ? th : en);
  const [period, setPeriod] = useState("all");
  const [selectedDay, setSelectedDay] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  useEffect(() => setCalendarMonth(new Date()), []);
  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(0);
  const refreshId = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++refreshId.current;
    try {
      const saved = (await listResearchSessions()).filter((session) =>
        isOwnedResearchSession(session, accountEmail),
      );
      if (requestId !== refreshId.current) return;
      setSessions(
        saved.map((session) =>
          session.summary
            ? session
            : { ...session, summary: summarizeResearchSession(session) },
        ),
      );
      setError("");
      setLoading(false);
      const legacy = saved.filter(
        (session) =>
          !session.summary &&
          session.status !== "recording" &&
          !session.rawDeleted,
      );
      setBackfilling(legacy.length);
      for (const session of legacy) {
        if (requestId !== refreshId.current) return;
        try {
          const gameSummary =
            session.gameSummary ||
            parseGameSummaryMarker(
              await getResearchGameSummaryMarker(session.id),
            );
          const summary = summarizeResearchSession(session, gameSummary);
          await saveResearchSummary(session.id, summary, gameSummary);
          if (requestId === refreshId.current)
            setSessions((current) =>
              current.map((item) =>
                item.id === session.id
                  ? { ...item, gameSummary, summary }
                  : item,
              ),
            );
        } catch (cause) {
          if (requestId === refreshId.current)
            setError(
              `อ่านผลสรุปรอบ ${session.sessionId} ไม่สำเร็จ: ${cause.message}`,
            );
        } finally {
          if (requestId === refreshId.current)
            setBackfilling((count) => Math.max(0, count - 1));
        }
      }
    } catch (cause) {
      if (requestId !== refreshId.current) return;
      setError(`อ่านข้อมูลรอบ EEG ไม่สำเร็จ: ${cause.message}`);
      setBackfilling(0);
    } finally {
      if (requestId === refreshId.current) setLoading(false);
    }
  }, [accountEmail]);

  useEffect(() => {
    refresh();
    window.addEventListener("research-dashboard-opened", refresh);
    window.addEventListener("research-session-finished", refresh);
    return () => {
      window.removeEventListener("research-dashboard-opened", refresh);
      window.removeEventListener("research-session-finished", refresh);
    };
  }, [refresh]);

  const dayKey = (time) => {
    const date = new Date(time);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  };
  const filtered = sessions.filter((session) => {
    const matchesSearch =
      `${session.participant || ""} ${session.sessionId || ""} ${session.studyGroup || ""}`
        .toLowerCase()
        .includes(search.toLowerCase().trim());
    const matchesPeriod =
      period === "all" ||
      session.startedMs >= Date.now() - Number(period) * 86400000;
    return (
      matchesSearch &&
      matchesPeriod &&
      (!selectedDay || dayKey(session.startedMs) === selectedDay)
    );
  });
  const complete = filtered.filter(
    (session) => !session.testMode && session.status === "complete",
  );
  const latest = complete[0];
  const latestSamples = Array.from(
    { length: 4 },
    (_, i) => Number(latest?.channels?.[i]) || 0,
  );
  const maxSamples = Math.max(1, ...latestSamples);
  const phases = latest && phaseSeconds(latest);
  const phaseTotal = phases?.reduce((sum, value) => sum + value, 0) || 0;
  const recent = complete
    .slice(0, 8)
    .reverse()
    .map((session) => ({ session, rate: sessionRate(session) }))
    .filter((item) => item.rate !== null);
  const axisMax =
    Math.ceil(Math.max(256, ...recent.map((item) => item.rate)) / 50) * 50;
  const x = (index) =>
    recent.length === 1 ? 170 : 32 + (index * 290) / (recent.length - 1);
  const y = (rate) => 130 - (rate * 108) / axisMax;
  const linePoints = recent
    .map((item, index) => `${x(index)},${y(item.rate)}`)
    .join(" ");
  const completionRate = filtered.length
    ? (100 * complete.length) / filtered.length
    : 0;
  const participants = new Set(
    filtered
      .filter((s) => s.participant && !s.testMode)
      .map((s) => s.participant),
  ).size;
  const sampleTotal = complete.reduce(
    (sum, s) => sum + (s.summary?.samples || 0),
    0,
  );
  const interrupted = filtered.filter(
    (s) => !s.testMode && s.status !== "complete",
  ).length;
  const tests = filtered.filter((s) => s.testMode).length;
  const number = (value, digits = 0) =>
    Number.isFinite(value)
      ? value.toLocaleString(dateLocale, { maximumFractionDigits: digits })
      : "—";
  const navigate = (id) => window.showSection?.(id);
  const openHistory = () =>
    document
      .querySelector("#dashboard .research-history")
      ?.scrollIntoView({ behavior: "smooth" });
  const inspectSession = (session) => {
    window.dispatchEvent(
      new CustomEvent("research-summary-select", {
        detail: { id: session.id },
      }),
    );
    openHistory();
  };
  const phaseColors = ["#3695f5", "#a07be9", "#28c7a0"];
  let share = 0;
  const phaseGradient = phases
    ?.map((seconds, i) => {
      const start = share;
      share += (100 * seconds) / phaseTotal;
      return `${phaseColors[i]} ${start}% ${share}%`;
    })
    .join(", ");
  const statusGradient = filtered.length
    ? `#3488fa 0 ${completionRate}%, #f7c25a ${completionRate}% ${completionRate + (100 * interrupted) / filtered.length}%, #b38bf0 ${completionRate + (100 * interrupted) / filtered.length}% 100%`
    : "var(--surface-raised) 0 100%";
  const month = calendarMonth || new Date(2026, 0, 1);
  const calendarDays = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const firstWeekday = new Date(
    month.getFullYear(),
    month.getMonth(),
    1,
  ).getDay();
  const monthLabel = calendarMonth
    ? month.toLocaleDateString(dateLocale, { month: "long", year: "numeric" })
    : "…";
  const changeMonth = (offset) =>
    setCalendarMonth(
      new Date(month.getFullYear(), month.getMonth() + offset, 1),
    );
  const empty = (
    <div className="dash-empty">
      <span>
        <Icon name="pulse" size={27} />
      </span>
      <p>
        {loading
          ? t("กำลังโหลดข้อมูล…", "Loading recordings…")
          : t("ยังไม่มีข้อมูลรอบทดลอง", "No recordings yet")}
      </p>
      <small>
        {t(
          "กราฟจะแสดงเมื่อบันทึก EEG ครบหนึ่งรอบ",
          "Charts appear after a completed EEG recording",
        )}
      </small>
    </div>
  );
  const gameLabels = [
    t("คี่หรือคู่", "Odd or Even"),
    t("ลำดับสะท้อน", "Echo Sequence"),
    t("รูปแบบเปลี่ยนแปลง", "Pattern Drift"),
  ];

  return (
    <div className="research-dashboard dash-design" data-no-translate>
      <div className="dash-heading">
        <div>
          <div className="dash-breadcrumb">
            {t("พื้นที่วิจัย", "Research workspace")} <span>/</span>{" "}
            {t("ภาพรวม", "Overview")}
          </div>
          <h1>{t("แดชบอร์ดการวิจัย", "Research dashboard")}</h1>
        </div>
        <div className="dash-heading-actions">
          <span className="dash-local">
            <i />
            {t("ข้อมูลในเบราว์เซอร์นี้", "Stored in this browser")}
          </span>
          <button
            className="dash-button dash-primary"
            onClick={() => navigate("journey")}
          >
            <Icon name="flask" size={16} />
            {t("เริ่มรอบทดลอง", "New experiment")}
          </button>
        </div>
      </div>
      {error && (
        <p className="study-signal-warning" role="alert">
          {error}
        </p>
      )}
      <div className="dash-workspace">
        <div className="dash-main-column">
          <div className="dash-welcome">
            <div className="dash-welcome-copy">
              <span className="dash-eyebrow">COGNILOAD · EEG RESEARCH</span>
              <h2>
                {t("ยินดีต้อนรับ", "Welcome back")}
                {accountName ? `, ${accountName.split(" ")[0]}` : ""}
              </h2>
              <p>
                {t(
                  "บันทึกสัญญาณสมอง ติดตามภารกิจ และทบทวนผลการทดลอง",
                  "Record brain signals, track tasks, and review your sessions.",
                )}
              </p>
              <button
                className="dash-text-link"
                onClick={() => navigate("journey")}
              >
                {t("เริ่มรอบทดลอง EEG", "Start an EEG session")}{" "}
                <Icon name="arrow" size={16} />
              </button>
            </div>
            <div className="dash-welcome-caption">
              <Icon name="pulse" size={26} />
              <span>
                EEG RESEARCH
                <br />
                <strong>Baseline · Task · Rest</strong>
              </span>
            </div>
          </div>
          <div className="dash-filter-row">
            <span>
              <Icon name="grid" size={15} />
              {t("ภาพรวมข้อมูลการทดลอง", "Your research at a glance")}
            </span>
            <div>
              {selectedDay && (
                <button
                  className="dash-clear-filter"
                  onClick={() => setSelectedDay("")}
                >
                  {t("ล้างตัวกรองวันที่", "Clear date filter")} ×
                </button>
              )}
              <label className="dash-period">
                <Icon name="calendar" size={14} />
                <select
                  aria-label={t("ช่วงเวลาข้อมูล", "Data period")}
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="all">{t("ทุกช่วงเวลา", "All time")}</option>
                  <option value="30">
                    {t("30 วันที่ผ่านมา", "Last 30 days")}
                  </option>
                  <option value="7">
                    {t("7 วันที่ผ่านมา", "Last 7 days")}
                  </option>
                </select>
              </label>
            </div>
          </div>
          <div className="dash-stats" aria-live="polite">
            {[
              [
                "users",
                "blue",
                t("ผู้เข้าร่วมทดลอง", "Participants"),
                number(participants),
                t("คน", "people"),
                t("ผู้เข้าร่วมที่มีรอบบันทึก", "Participants with recordings"),
              ],
              [
                "flask",
                "purple",
                t("รอบทดลองทั้งหมด", "Total sessions"),
                number(filtered.length),
                t("รอบ", "sessions"),
                t("รวมรอบทดสอบอุปกรณ์", "Includes device tests"),
              ],
              [
                "check",
                "green",
                t("รอบที่บันทึกครบ", "Completed sessions"),
                `${number(completionRate, 1)}%`,
                "",
                `${number(complete.length)} ${t("รอบพร้อมวิเคราะห์", "sessions ready to analyze")}`,
              ],
              [
                "pulse",
                "orange",
                "EEG samples",
                number(sampleTotal),
                "",
                t("จากรอบทดลองที่บันทึกครบ", "From completed sessions"),
              ],
            ].map(([icon, color, label, value, unit, note]) => (
              <div className="dash-stat dash-panel" key={icon}>
                <span className={`dash-stat-icon ${color}`}>
                  <Icon name={icon} size={24} />
                </span>
                <div>
                  <span className="dash-stat-label">{label}</span>
                  <div className="dash-stat-value">
                    {loading ? "…" : value}
                    <small>{unit}</small>
                  </div>
                  <span className={`dash-stat-note ${color}`}>
                    <i />
                    {note}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {filtered.length === 0 && !loading && (
            <div className="dash-panel dash-getting-started">
              <div className="dash-panel-title">
                <h3>
                  {sessions.length
                    ? t("ไม่พบรอบทดลองที่ตรงกัน", "No matching sessions")
                    : t(
                        "เริ่มบันทึกรอบทดลองแรก",
                        "Your first recording starts here",
                      )}
                </h3>
              </div>
              <p>
                {sessions.length
                  ? t(
                      "ลองเปลี่ยนคำค้น ช่วงเวลา หรือวันที่ที่เลือก",
                      "Try another search, time period, or date.",
                    )
                  : t(
                      "ทำตาม 3 ขั้นตอนนี้ ผลสรุปและกราฟจะปรากฏเมื่อบันทึกครบ",
                      "Follow these three steps. Summaries and charts appear after a completed recording.",
                    )}
              </p>
              {sessions.length ? (
                <button
                  className="dash-button dash-outline"
                  onClick={() => {
                    setPeriod("all");
                    setSelectedDay("");
                    onClearSearch?.();
                  }}
                >
                  {t("ล้างตัวกรองทั้งหมด", "Clear all filters")}
                </button>
              ) : (
                <ol className="dash-start-steps">
                  {[
                    [
                      "users",
                      t("ตั้งค่าผู้เข้าร่วม", "Set up a participant"),
                      t("กรอกข้อมูลและยืนยันความยินยอม", "Enter details and confirm consent"),
                    ],
                    [
                      "pulse",
                      t("เชื่อมต่อ Muse", "Connect Muse"),
                      t("ตรวจสัญญาณ EEG ทั้ง 4 ช่อง", "Check all four EEG channels"),
                    ],
                    [
                      "flask",
                      t("เริ่มรอบทดลอง", "Record a session"),
                      "Baseline → Task → Rest",
                    ],
                  ].map(([icon, title, description], index) => (
                    <li key={icon}>
                      <span>
                        <Icon name={icon} size={19} />
                      </span>
                      <div>
                        <strong>{index + 1}. {title}</strong>
                        <small>{description}</small>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
          {(loading || filtered.length > 0) && (
            <>
              <div className="dash-chart-row">
                <div className="dash-panel dash-trend">
                  <div className="dash-panel-title">
                    <h3>{t("แนวโน้มอัตราสัญญาณ EEG", "EEG sampling trend")}</h3>
                    <span>{t("8 รอบล่าสุด", "Last 8 sessions")}</span>
                  </div>
                  <div className="dash-chart-subtitle">
                    <strong>
                      {number(latest ? sessionRate(latest) : null, 1)}{" "}
                      <small>Hz</small>
                    </strong>
                    <span>
                      <i className="dash-dot green" />
                      {t(
                        "เฉลี่ยต่อช่อง · รอบล่าสุด",
                        "Per channel · latest session",
                      )}
                    </span>
                  </div>
                  {recent.length ? (
                    <svg
                      className="dash-line-chart"
                      viewBox="0 0 345 163"
                      role="img"
                      aria-label={t(
                        "อัตราตัวอย่าง EEG ตามรอบทดลอง หน่วย Hz",
                        "EEG sample rate per session in Hz",
                      )}
                    >
                      <defs>
                        <linearGradient
                          id="dash-line-fill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="#3599ef" stopOpacity=".18" />
                          <stop offset="100%" stopColor="#3599ef" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="dash-line-stroke">
                          <stop stopColor="#ad83e8" />
                          <stop offset="55%" stopColor="#27bca1" />
                          <stop offset="100%" stopColor="#348bfa" />
                        </linearGradient>
                      </defs>
                      {[0, 1, 2, 3].map((tick) => (
                        <g key={tick}>
                          <line
                            x1="32"
                            x2="322"
                            y1={y((axisMax * tick) / 3)}
                            y2={y((axisMax * tick) / 3)}
                            stroke="var(--border)"
                          />
                          <text
                            x="24"
                            y={y((axisMax * tick) / 3) + 3}
                            textAnchor="end"
                          >
                            {number((axisMax * tick) / 3)}
                          </text>
                        </g>
                      ))}
                      {recent.length > 1 && (
                        <>
                          <polygon
                            points={`32,130 ${linePoints} 322,130`}
                            fill="url(#dash-line-fill)"
                          />
                          <polyline
                            points={linePoints}
                            fill="none"
                            stroke="url(#dash-line-stroke)"
                            strokeWidth="2.5"
                          />
                        </>
                      )}
                      {recent.map((item, i) => (
                        <g key={item.session.id}>
                          <circle
                            cx={x(i)}
                            cy={y(item.rate)}
                            r="3.7"
                            fill={phaseColors[i % 3]}
                            stroke="white"
                            strokeWidth="1.5"
                          >
                            <title>
                              {item.session.sessionId} · {number(item.rate, 1)} Hz
                            </title>
                          </circle>
                          <text x={x(i)} y="151" textAnchor="middle">
                            {i + 1}
                          </text>
                        </g>
                      ))}
                    </svg>
                  ) : (
                    empty
                  )}
                </div>
                <div className="dash-panel dash-channels">
                  <div className="dash-panel-title">
                    <h3>{t("สัญญาณแยกช่อง", "Channel recordings")}</h3>
                    <span>{t("รอบล่าสุด", "Latest")}</span>
                  </div>
                  <div className="dash-mini-legend">
                    <i className="dash-dot blue" /> EEG samples{" "}
                    <span>Muse · 4 channels</span>
                  </div>
                  {latest && latestSamples.some(Boolean) ? (
                    <div className="dash-bar-chart">
                      {CHANNELS.map((channel, i) => (
                        <div className="dash-bar-column" key={channel}>
                          <span>{number(latestSamples[i])}</span>
                          <div className="dash-bar-track">
                            <div
                              style={{
                                height: `${(100 * latestSamples[i]) / maxSamples}%`,
                                background: [
                                  "#3999ef",
                                  "#9c7bea",
                                  "#2dc5b2",
                                  "#f7be53",
                                ][i],
                              }}
                            />
                          </div>
                          <strong>{channel}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    empty
                  )}
                </div>
                <div className="dash-panel dash-phases">
                  <div className="dash-panel-title">
                    <h3>{t("สัดส่วนเวลาทดลอง", "Session phases")}</h3>
                    <span>{t("รอบล่าสุด", "Latest")}</span>
                  </div>
                  <div
                    className="dash-ring"
                    style={{
                      background: phaseTotal
                        ? `conic-gradient(${phaseGradient})`
                        : "var(--surface-raised)",
                    }}
                    role="img"
                    aria-label={
                      phaseTotal
                        ? PHASES.map(
                            (p, i) =>
                              `${t(p.label, ["Baseline", "Task", "Rest"][i])} ${phases[i].toFixed(1)} s`,
                          ).join(", ")
                        : t("ยังไม่มีข้อมูลเวลา", "No phase duration data")
                    }
                  >
                    <div>
                      <strong>{phaseTotal ? number(phaseTotal) : "—"}</strong>
                      <small>{t("วินาทีทั้งหมด", "total seconds")}</small>
                    </div>
                  </div>
                  <div className="dash-ring-legend">
                    {PHASES.map((phase, i) => (
                      <div key={phase.label}>
                        <i
                          className="dash-dot"
                          style={{ background: phaseColors[i] }}
                        />
                        <span>
                          {t(phase.label, ["Baseline", "Task", "Rest"][i])}
                        </span>
                        <strong>
                          {phaseTotal
                            ? `${number((100 * phases[i]) / phaseTotal, 1)}%`
                            : "—"}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="dash-detail-row">
                <div className="dash-panel dash-recent">
                  <div className="dash-panel-title">
                    <h3>{t("รอบทดลองล่าสุด", "Recent recordings")}</h3>
                    <button className="dash-text-link" onClick={openHistory}>
                      {t("ดูทั้งหมด", "View all")} <Icon name="chevron" size={12} />
                    </button>
                  </div>
                  <div className="dash-table-scroll">
                    <table className="dash-recent-table">
                      <thead>
                        <tr>
                          <th>{t("ผู้เข้าร่วม / รอบ", "Participant / session")}</th>
                          <th>{t("วันที่", "Date")}</th>
                          <th>{t("อัตรา EEG", "EEG rate")}</th>
                          <th>{t("สถานะ", "Status")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice(0, 5).map((session, i) => (
                          <tr key={session.id}>
                            <td>
                              <button
                                className="dash-session-link"
                                onClick={() => inspectSession(session)}
                              >
                                <span className={`dash-avatar avatar-${i % 3}`}>
                                  <Icon
                                    name={session.testMode ? "pulse" : "users"}
                                    size={15}
                                  />
                                </span>
                                <span>
                                  <strong>
                                    {session.participant ||
                                      t("ทดสอบอุปกรณ์", "Device test")}
                                  </strong>
                                  <small>
                                    {session.sessionId || session.id.slice(0, 8)}
                                  </small>
                                </span>
                              </button>
                            </td>
                            <td>
                              {new Date(session.startedMs).toLocaleDateString(
                                dateLocale,
                                { day: "numeric", month: "short" },
                              )}
                            </td>
                            <td>
                              {number(sessionRate(session), 1)} <small>Hz</small>
                            </td>
                            <td>
                              <span
                                className={`dash-status ${session.testMode ? "purple" : session.status === "complete" ? "green" : "orange"}`}
                              >
                                {session.testMode
                                  ? t("ทดสอบ", "Test")
                                  : session.status === "complete"
                                    ? t("ครบแล้ว", "Complete")
                                    : session.status === "recording"
                                      ? t("กำลังบันทึก", "Recording")
                                      : t("หยุดก่อนจบ", "Interrupted")}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!filtered.length && (
                    <div className="dash-table-empty">
                      {loading
                        ? t("กำลังโหลดข้อมูล…", "Loading…")
                        : search || selectedDay || period !== "all"
                          ? t(
                              "ไม่พบรอบทดลองตามตัวกรอง",
                              "No sessions match your filters",
                            )
                          : t(
                              "เริ่มการทดลองเพื่อบันทึกข้อมูลรอบแรก",
                              "Start an experiment to record your first session",
                            )}
                    </div>
                  )}
                </div>
                <div className="dash-panel dash-performance">
                  <div className="dash-panel-title">
                    <h3>{t("ผลการทำภารกิจ", "Task performance")}</h3>
                    <span>{t("ความแม่นยำเฉลี่ย", "Mean accuracy")}</span>
                  </div>
                  <p className="dash-panel-note">
                    {t(
                      "ผลเกมจากรอบทดลองที่บันทึกครบ",
                      "Game results from completed recordings",
                    )}
                  </p>
                  <div className="dash-progress-list">
                    {gameLabels.map((label, i) => {
                      const results = complete.filter(
                        (s) =>
                          s.gameId === i + 1 &&
                          Number.isFinite(s.summary?.game?.accuracyPercent),
                      );
                      const accuracy = results.length
                        ? results.reduce(
                            (sum, s) => sum + s.summary.game.accuracyPercent,
                            0,
                          ) / results.length
                        : null;
                      return (
                        <div className="dash-progress-item" key={label}>
                          <div>
                            <span>{label}</span>
                            <strong>
                              {accuracy === null ? "—" : `${number(accuracy, 1)}%`}
                            </strong>
                          </div>
                          <div className="dash-progress-track">
                            <div
                              style={{
                                width: `${accuracy || 0}%`,
                                background: phaseColors[i],
                              }}
                            />
                          </div>
                          <small>
                            {number(results.length)} {t("รอบทดลอง", "sessions")}
                          </small>
                        </div>
                      );
                    })}
                  </div>
                  <div className="dash-scale">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
                <div className="dash-panel dash-record-status">
                  <div className="dash-panel-title">
                    <h3>{t("สถานะการบันทึก", "Recording status")}</h3>
                  </div>
                  <div
                    className="dash-ring"
                    style={{ background: `conic-gradient(${statusGradient})` }}
                    role="img"
                    aria-label={`${complete.length} ${t("รอบครบ", "complete")}, ${interrupted} ${t("รอบไม่ครบ", "incomplete")}, ${tests} ${t("รอบทดสอบ", "tests")}`}
                  >
                    <div>
                      <strong>{number(filtered.length)}</strong>
                      <small>{t("รอบทั้งหมด", "total sessions")}</small>
                    </div>
                  </div>
                  <div className="dash-ring-legend">
                    {[
                      ["blue", t("บันทึกครบ", "Complete"), complete.length],
                      ["orange", t("ยังไม่ครบ", "Incomplete"), interrupted],
                      ["purple", t("ทดสอบอุปกรณ์", "Device tests"), tests],
                    ].map(([color, label, count]) => (
                      <div key={color}>
                        <i className={`dash-dot ${color}`} />
                        <span>{label}</span>
                        <strong>
                          {number(count)} <small>{t("รอบ", "runs")}</small>
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
          <div className="dash-bottom-row">
            <div className="dash-panel dash-storage">
              <div className="dash-panel-title">
                <h3>
                  <Icon name="file" size={16} />
                  {t("ข้อมูลและการส่งออก", "Data & export")}
                </h3>
              </div>
              <div className="dash-storage-values">
                <div>
                  <span className="dash-soft-icon green">
                    <Icon name="pulse" size={18} />
                  </span>
                  <div>
                    <small>
                      {t("ข้อมูล EEG ครบทุกช่อง", "Recorded EEG samples")}
                    </small>
                    <strong>{number(sampleTotal)}</strong>
                  </div>
                </div>
                <div>
                  <span className="dash-soft-icon purple">
                    <Icon name="file" size={18} />
                  </span>
                  <div>
                    <small>
                      {t("ไฟล์ดิบที่ยังเก็บอยู่", "Raw recordings retained")}
                    </small>
                    <strong>
                      {number(filtered.filter((s) => !s.rawDeleted).length)}{" "}
                      <small>{t("รอบ", "runs")}</small>
                    </strong>
                  </div>
                </div>
              </div>
              <button className="dash-text-link" onClick={openHistory}>
                {t(
                  "ส่งออก CSV และเปรียบเทียบผล",
                  "Export CSV & compare sessions",
                )}{" "}
                <Icon name="arrow" size={14} />
              </button>
            </div>
            <div className="dash-panel dash-shortcuts">
              <div className="dash-panel-title">
                <h3>
                  <Icon name="flask" size={16} />
                  {t("เครื่องมือการวิจัย", "Research tools")}
                </h3>
              </div>
              {[
                [
                  "journey",
                  "pulse",
                  t("เชื่อมต่อและบันทึก EEG", "Connect & record EEG"),
                  "blue",
                ],
                [
                  "games",
                  "game",
                  t("ภารกิจการรู้คิด", "Cognitive tasks"),
                  "purple",
                ],
                [
                  "history",
                  "clock",
                  t("ประวัติแบบประเมิน", "Assessment history"),
                  "green",
                ],
              ].map(([id, icon, label, color]) => (
                <button
                  className="dash-shortcut"
                  key={id}
                  onClick={() => navigate(id)}
                >
                  <span className={`dash-soft-icon ${color}`}>
                    <Icon name={icon} size={16} />
                  </span>
                  <span>{label}</span>
                  <Icon name="chevron" size={13} />
                </button>
              ))}
            </div>
            <div className="dash-panel dash-protocol">
              <div className="dash-panel-title">
                <h3>
                  <Icon name="shield" size={16} />
                  {t("โปรโตคอลการทดลอง", "Study protocol")}
                </h3>
              </div>
              <div className="dash-protocol-flow">
                {["Baseline", "Task", "Rest"].map((label, i) => (
                  <span key={label}>
                    <i style={{ background: phaseColors[i] }}>{i + 1}</i>
                    {label}
                    {i < 2 && <Icon name="chevron" size={11} />}
                  </span>
                ))}
              </div>
              <p>
                {t(
                  "บันทึกเหตุการณ์พร้อมสัญญาณ EEG ในทุกช่วงของการทดลอง",
                  "Capture event markers alongside EEG through every phase.",
                )}
              </p>
              <button
                className="dash-button dash-primary"
                onClick={() => navigate("journey")}
              >
                {t("ตั้งค่ารอบทดลอง", "Set up a session")}
                <Icon name="arrow" size={13} />
              </button>
            </div>
          </div>
        </div>
        <aside
          className="dash-right-column"
          aria-label={t("ข้อมูลประกอบการวิจัย", "Research information")}
        >
          <div className="dash-panel dash-notices">
            <div className="dash-panel-title">
              <h3>
                <span className="dash-soft-icon orange">
                  <Icon name="book" size={16} />
                </span>
                {t("ก่อนเริ่มการทดลอง", "Before you begin")}
              </h3>
              <span>03</span>
            </div>
            {[
              [
                "shield",
                "purple",
                t("ตรวจสอบความยินยอม", "Confirm participant consent"),
                t(
                  "ยืนยันข้อมูลผู้เข้าร่วมก่อนบันทึก",
                  "Confirm participant details before recording",
                ),
              ],
              [
                "pulse",
                "blue",
                t("ตรวจสัญญาณทั้ง 4 ช่อง", "Check all 4 EEG channels"),
                "TP9 · AF7 · AF8 · TP10",
              ],
              [
                "download",
                "green",
                t("ส่งออกข้อมูลหลังจบรอบ", "Export after each session"),
                t(
                  "เก็บ CSV พร้อม event markers",
                  "Save CSV with event markers",
                ),
              ],
            ].map(([icon, color, title, note]) => (
              <div className="dash-notice" key={icon}>
                <span className={`dash-soft-icon ${color}`}>
                  <Icon name={icon} size={16} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <small>{note}</small>
                </div>
              </div>
            ))}
            <button
              className="dash-text-link"
              onClick={() => navigate("journey")}
            >
              {t("ไปที่ห้องทดลอง", "Open experiment workspace")}
              <Icon name="arrow" size={13} />
            </button>
          </div>
          <div className="dash-panel dash-calendar">
            <div className="dash-panel-title">
              <h3>
                <Icon name="calendar" size={16} />
                {t("ปฏิทินการบันทึก", "Recording calendar")}
              </h3>
            </div>
            <div className="dash-calendar-month">
              <button
                aria-label={t("เดือนก่อนหน้า", "Previous month")}
                onClick={() => changeMonth(-1)}
              >
                <Icon
                  name="chevron"
                  size={14}
                  style={{ transform: "rotate(180deg)" }}
                />
              </button>
              <strong>{monthLabel}</strong>
              <button
                aria-label={t("เดือนถัดไป", "Next month")}
                onClick={() => changeMonth(1)}
              >
                <Icon name="chevron" size={14} />
              </button>
            </div>
            <div className="dash-calendar-grid">
              {t(
                ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"],
                ["S", "M", "T", "W", "T", "F", "S"],
              ).map((day, i) => (
                <span className="dash-weekday" key={`w${i}`}>
                  {day}
                </span>
              ))}
              {Array.from({ length: firstWeekday }, (_, i) => (
                <span key={`e${i}`} />
              ))}
              {Array.from({ length: calendarDays }, (_, i) => {
                const date = new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  i + 1,
                );
                const key = dayKey(date);
                const count = sessions.filter(
                  (s) => dayKey(s.startedMs) === key,
                ).length;
                const today = calendarMonth && key === dayKey(Date.now());
                return (
                  <button
                    key={key}
                    className={`${today ? "today" : ""} ${count ? "has-recording" : ""} ${selectedDay === key ? "selected" : ""}`}
                    aria-pressed={selectedDay === key}
                    aria-label={`${date.toLocaleDateString(dateLocale)} · ${count} ${t("รอบทดลอง", "sessions")}`}
                    onClick={() =>
                      setSelectedDay(selectedDay === key ? "" : key)
                    }
                  >
                    {i + 1}
                    {count > 0 && <i />}
                  </button>
                );
              })}
            </div>
            <div className="dash-calendar-key">
              <span>
                <i className="dash-dot blue" />
                {t("วันนี้", "Today")}
              </span>
              <span>
                <i className="dash-dot purple" />
                {t("มีรอบบันทึก", "Recorded sessions")}
              </span>
            </div>
          </div>
          <div className="dash-panel dash-assistant">
            <div className="dash-panel-title">
              <h3>
                <span className="dash-assistant-avatar">
                  <Icon name="brain" size={23} />
                </span>
                <span>
                  {t("ผู้ช่วยการวิจัย", "Research companion")}
                  <small>RECORDING INSIGHTS</small>
                </span>
                <i className="dash-dot green" />
              </h3>
            </div>
            <div className="dash-assistant-intro">
              {t(
                "ข้อมูลสำคัญจากรอบทดลองของคุณ",
                "A quick look at your recording activity.",
              )}
            </div>
            <div className="dash-assistant-content">
              <strong>
                <span className="dash-soft-icon green">
                  <Icon name="check" size={15} />
                </span>
                {latest
                  ? t("สรุปการบันทึกล่าสุด", "Latest recording summary")
                  : t("เริ่มต้นการวิจัยของคุณ", "Start your research")}
              </strong>
              {latest ? (
                <ul>
                  <li>
                    {t("รอบทดลอง", "Session")}: {latest.sessionId || "—"}
                  </li>
                  <li>
                    {t("อัตราตัวอย่างเฉลี่ย", "Mean sample rate")}:{" "}
                    {number(sessionRate(latest), 1)} Hz
                  </li>
                  <li>
                    {t("เวลาบันทึก", "Duration")}:{" "}
                    {number(latest.summary?.durationSeconds, 1)}{" "}
                    {t("วินาที", "seconds")}
                  </li>
                  <li>
                    {t("แพ็กเก็ตขาดหาย", "Missing packets")}:{" "}
                    {number(latest.summary?.missingPackets)}
                  </li>
                </ul>
              ) : (
                <p>
                  {t(
                    "ตั้งค่าผู้เข้าร่วม เชื่อมต่อ Muse แล้วเริ่มบันทึก รอบทดลองที่ครบจะแสดงในแดชบอร์ดนี้",
                    "Set up a participant, connect Muse, and record a session. Completed recordings will appear here.",
                  )}
                </p>
              )}
              <button
                className="dash-button dash-outline"
                onClick={
                  latest
                    ? () => inspectSession(latest)
                    : () => navigate("journey")
                }
              >
                {latest
                  ? t("ดูรายละเอียดรอบทดลอง", "View session details")
                  : t("เริ่มรอบทดลองแรก", "Start your first session")}
                <Icon name="arrow" size={13} />
              </button>
            </div>
            <button
              className="dash-guide-toggle"
              aria-expanded={guideOpen}
              onClick={() => setGuideOpen(!guideOpen)}
            >
              <Icon name="info" size={15} />
              {t(
                "ข้อมูลบนแดชบอร์ดมาจากไหน?",
                "Where does this data come from?",
              )}
              <span>{guideOpen ? "−" : "+"}</span>
            </button>
            {guideOpen && (
              <p className="dash-guide-copy">
                {t(
                  "อ่านข้อมูลจริงจากรอบ EEG ของบัญชีนี้ในเบราว์เซอร์ปัจจุบัน กราฟใช้เฉพาะรอบที่บันทึกครบและไม่ใช่รอบทดสอบอุปกรณ์ ผลเกมแสดงเฉพาะรอบที่มีคะแนนบันทึกไว้",
                  "Data comes from this account’s EEG sessions stored in this browser. Charts use completed sessions and exclude device tests. Task scores appear only when recorded.",
                )}
              </p>
            )}
          </div>
          <div className="dash-research-note">
            <Icon name="shield" size={15} />
            <span>
              {t("ใช้เพื่อการวิจัย", "For research use")}
              <small>
                {t(
                  "ข้อมูลนี้ไม่ใช่ผลการวินิจฉัยทางการแพทย์",
                  "These results are not a medical diagnosis",
                )}
              </small>
            </span>
          </div>
        </aside>
      </div>
      <div className="dash-footer">
        <span>
          CogniLoad-XAI <i>·</i> Muse EEG Research Workspace
        </span>
        <span>
          {t(
            "บันทึกทุกการค้นพบอย่างเป็นระบบ",
            "Every discovery, thoughtfully recorded",
          )}
        </span>
      </div>
      <SyncedTaskPerformance key={accountEmail} locale={locale} />
      <ResearchHistory
        sessions={filtered}
        locale={locale}
        loading={loading}
        backfilling={backfilling}
      />
    </div>
  );
}
