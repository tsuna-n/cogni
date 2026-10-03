"use client";

import { researchOverview } from "@/lib/dashboard/research-overview.mjs";
import Icon from "./DashboardIcon";

export default function DashboardResearchOverview({ users, records, loading, locale, studyConfig, configError, onShowSummaries, onOpenSettings, onOpenExperiment, onSelectUser, onShowUsers }) {
  const t = (th, en) => locale === "th" ? th : en;
  const summary = researchOverview(records);
  const number = (value) => loading ? "…" : value.toLocaleString(locale === "th" ? "th-TH" : "en-US");
  const pending = users.filter((user) => user.role === "user" && (!user.profile?.participantId || !["patient", "control"].includes(user.profile?.studyGroup)));
  const groupName = (group) => ({ patient: t("ผู้ป่วย", "Patient"), control: t("กลุ่มควบคุม", "Control"), device_test: t("ทดสอบอุปกรณ์", "Device test") })[group] || t("ยังไม่ระบุกลุ่ม", "Unassigned");
  const date = (value) => value ? new Date(value).toLocaleString(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

  return <div className="dashboard-research-overview">
    <div className="dash-stats dashboard-live-stats" aria-live="polite">
      {[
        ["users", "blue", t("บัญชีผู้ใช้", "User accounts"), users.length, t("บัญชีทั้งหมดในระบบ", "All registered accounts")],
        ["file", "purple", t("รอบที่ซิงก์แล้ว", "Synced sessions"), summary.total, `${number(summary.studyCount)} ${t("รอบวิจัย", "study")} · ${number(summary.deviceTests)} ${t("ทดสอบอุปกรณ์", "device tests")}`],
        ["flask", "green", t("รหัสผู้เข้าร่วมที่ทดลอง", "Recorded participants"), summary.participants, t("รหัสไม่ซ้ำจากรอบวิจัย", "Unique IDs in study recordings")],
        ["check", "orange", t("รอบวิจัยสมบูรณ์", "Completed study sessions"), summary.complete, `${number(summary.interrupted)} ${t("รอบหยุดก่อนครบ", "interrupted sessions")}`],
      ].map(([icon, color, label, value, note]) => <div className="dash-panel dash-stat" key={icon}><span className={`dash-stat-icon ${color}`}><Icon name={icon} size={22} /></span><div><small className="dash-stat-label">{label}</small><strong className="dash-stat-value">{number(value)}</strong><p className="dash-stat-note">{note}</p></div></div>)}
    </div>
    <div className="dashboard-activity-grid">
      <div className="card dashboard-recent-sessions">
        <div className="dashboard-table-heading"><div><span className="dashboard-section-label">{t("ข้อมูลที่ซิงก์แล้ว", "SYNCED RECORDINGS")}</span><h2>{t("รอบทดลองล่าสุด", "Recent sessions")}</h2></div><button type="button" className="dash-text-link" onClick={onShowSummaries}>{t("ดูผลทั้งหมด", "All results")} <Icon name="arrow" size={16} /></button></div>
        <div className="dashboard-session-groups" aria-label={t("กลุ่มจากรอบวิจัย", "Groups from study sessions")}>{Object.entries(summary.groups).map(([group, count]) => <span key={group}><i className={`dashboard-dot ${group}`} />{groupName(group)} <strong>{number(count)}</strong></span>)}</div>
        {loading ? <p className="dashboard-inline-empty" role="status">{t("กำลังโหลดรอบทดลอง…", "Loading sessions…")}</p> : !summary.recent.length ? <div className="dashboard-inline-empty"><Icon name="pulse" size={28} /><h3>{t("เริ่มเก็บข้อมูลรอบแรก", "Record your first session")}</h3><p>{t("ผลจะปรากฏที่นี่เมื่อจบรอบและซิงก์สำเร็จ", "Results appear here after a session finishes and syncs.")}</p><button type="button" className="dash-button" onClick={onOpenExperiment}>{t("เปิดห้องทดลอง", "Open experiment")}</button></div> : <div className="dashboard-recent-scroll"><table><caption className="dashboard-sr-only">{t("รอบทดลองที่ซิงก์ล่าสุด 5 รอบ", "Five most recent synced sessions")}</caption><thead><tr><th>{t("ผู้เข้าร่วม / รอบ", "Participant / session")}</th><th>{t("กลุ่ม / เกม", "Group / game")}</th><th>{t("สถานะ", "Status")}</th><th>{t("เริ่มทดลอง", "Started")}</th></tr></thead><tbody>{summary.recent.map((record) => <tr key={record.recordId}><td><strong>{record.participantId}</strong><small>{record.summary.sessionId}</small></td><td><span>{groupName(record.summary.studyGroup)}</span><small>{record.summary.testMode ? t("ตรวจอุปกรณ์", "Device check") : `${t("เกม", "Game")} ${record.summary.gameId}`}</small></td><td><span className={`dashboard-session-status ${record.summary.status === "complete" ? "complete" : "interrupted"}`}>{record.summary.status === "complete" ? t("สมบูรณ์", "Complete") : t("หยุดก่อนครบ", "Interrupted")}</span></td><td className="dashboard-session-date">{date(record.summary.startedMs)}</td></tr>)}</tbody></table></div>}
        <p className="dashboard-source-note">{t("กลุ่มในส่วนนี้มาจากรอบทดลอง ส่วนกลุ่มในตารางผู้ใช้มาจากโปรไฟล์ที่บันทึก", "Session groups come from recordings. User groups come from saved profiles.")}</p>
      </div>
      <aside className="dashboard-overview-aside">
        <div className="card dashboard-protocol-card">
          <div className="dashboard-table-heading"><h2><Icon name="flask" size={19} />{t("รอบทดลองปัจจุบัน", "Current study protocol")}</h2>{onOpenSettings && <button type="button" className="dash-text-link" onClick={onOpenSettings}>{t("ตั้งค่า", "Settings")} <Icon name="arrow" size={16} /></button>}</div>
          {studyConfig ? <><code className="dashboard-protocol-name">{studyConfig.protocolVersion}</code><div className="dashboard-protocol-phases">{[["Baseline", studyConfig.baselineSeconds], ["Task", studyConfig.defaultTaskSeconds], [t("พักหลังงาน", "Rest"), studyConfig.postTaskSeconds]].map(([label, seconds]) => <div key={label}><small>{label}</small><strong>{seconds}<span> {t("วิ", "s")}</span></strong></div>)}</div><p className="dashboard-source-note">{t("Task สูงสุด", "Maximum task")}: {studyConfig.maxTaskSeconds} {t("วินาที", "seconds")} · {t("ใช้กับรอบใหม่", "Applies to new sessions")}</p></> : <p className="dashboard-source-note" role={configError ? "alert" : "status"}>{configError ? t("โหลดการตั้งค่าไม่ได้ กรุณาเปิดหน้าตั้งค่าเพื่อลองใหม่", "Settings unavailable. Open settings to retry.") : t("กำลังโหลดการตั้งค่า…", "Loading settings…")}</p>}
          <button type="button" className="dash-button dash-outline dashboard-experiment-button" onClick={onOpenExperiment}><Icon name="pulse" size={17} />{t("เปิดห้องทดลอง EEG", "Open EEG experiment")}</button>
        </div>
        <div className="card dashboard-pending-card">
          <div className="dashboard-table-heading"><h2>{t("โปรไฟล์ที่ต้องเติม", "Profiles to complete")}</h2><span className="dashboard-count-badge">{number(pending.length)}</span></div>
          <p className="dashboard-source-note">{t("บัญชีผู้ใช้ที่ยังไม่มีรหัสผู้เข้าร่วมหรือกลุ่มทดลอง", "User accounts missing a participant ID or study group.")}</p>
          {loading ? <p role="status">{t("กำลังโหลด…", "Loading…")}</p> : pending.length ? <ul>{pending.slice(0, 3).map((user) => <li key={user.email}><span><strong>{user.name || user.email}</strong><small>{!user.profile?.participantId ? t("ยังไม่มีรหัสผู้เข้าร่วม", "Participant ID missing") : t("ยังไม่ระบุกลุ่ม", "Study group missing")}</small></span><button type="button" className="dash-text-link" onClick={() => onSelectUser(user)} aria-label={`${t("เติมข้อมูล", "Edit profile")} ${user.name || user.email}`}><Icon name="arrow" size={16} /></button></li>)}</ul> : <p className="dashboard-all-complete"><Icon name="check" size={17} />{t("ระบุรหัสและกลุ่มครบแล้ว", "All IDs and groups recorded")}</p>}
          <button type="button" className="dash-text-link" onClick={onShowUsers}>{t("จัดการผู้ใช้ทั้งหมด", "Manage all users")} <Icon name="arrow" size={16} /></button>
        </div>
      </aside>
    </div>
  </div>;
}
