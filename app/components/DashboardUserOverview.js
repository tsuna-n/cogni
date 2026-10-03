"use client";

import { userOverview } from "@/lib/dashboard/user-overview.mjs";
import { hasSimulatedProfile } from "@/lib/auth/user-profile.mjs";
import Icon from "./DashboardIcon";

export default function DashboardUserOverview({ users, totalUsers, loading, locale = "th", role, group, onRoleChange, onGroupChange, onSelect, onShowAll, disabled = false, showHeader = true, showStats = true, tableLimit = 6 }) {
  const t = (th, en) => locale === "th" ? th : en;
  const summary = userOverview(users);
  const number = (value, digits = 0) => value == null ? "—" : value.toLocaleString(locale === "th" ? "th-TH" : "en-US", { maximumFractionDigits: digits });
  const count = (value) => loading ? "…" : number(value);
  const groupLabels = { patient: t("ผู้ป่วย", "Patient"), control: t("กลุ่มควบคุม", "Control"), unassigned: t("ยังไม่ระบุกลุ่ม", "Not specified") };
  const educationLabels = { none: t("ไม่ได้เรียนหนังสือ", "No formal education"), primary: t("ประถมศึกษา", "Primary"), above: t("สูงกว่าประถมศึกษา", "Above primary"), unassigned: t("ยังไม่ระบุ", "Not specified") };
  const colors = { patient: "var(--violet)", control: "var(--accent-text)", unassigned: "var(--muted)" };
  const assessedByEmail = new Map(summary.assessed.map((item) => [item.user.email, item]));
  let share = 0;
  const gradient = Object.entries(summary.groups).map(([key, value]) => {
    const start = share;
    share += summary.count ? 100 * value / summary.count : 0;
    return `${colors[key]} ${start}% ${share}%`;
  }).join(", ");
  const maxAgeCount = Math.max(1, ...summary.ageBands.map((band) => band.count));
  const maxEducation = Math.max(1, ...Object.values(summary.education));
  const empty = (message) => <div className="user-overview-empty">{loading ? t("กำลังโหลดข้อมูลผู้ใช้…", "Loading user data…") : message}</div>;

  return <div className="user-overview" data-no-translate aria-labelledby="user-overview-title">
    {!showHeader && <h2 id="user-overview-title" className="dashboard-sr-only">{t("ภาพรวมผู้ใช้", "User overview")}</h2>}
    {showHeader && <div className="user-overview-heading">
      <div><h2 id="user-overview-title">{t("ภาพรวมข้อมูลผู้ใช้", "User overview")}</h2><p className="muted">{t("สรุปจากข้อมูลผู้ใช้ที่บันทึกแล้ว อัปเดตหลังบันทึกข้อมูล", "Based on saved user profiles. Updates when details are saved.")}</p></div>
      <div className="user-overview-filters">
        <label>{t("ประเภทบัญชี", "Account role")}<select aria-label={t("กรองประเภทบัญชี", "Filter account role")} value={role} onChange={(event) => onRoleChange(event.target.value)} disabled={disabled}>
          <option value="all">{t("ทุกประเภท", "All roles")}</option><option value="user">{t("ผู้ใช้ทั่วไป", "User")}</option><option value="researcher">{t("นักวิจัย", "Researcher")}</option><option value="admin">{t("แอดมิน", "Administrator")}</option>
        </select></label>
        <label>{t("กลุ่มทดลอง", "Study group")}<select aria-label={t("กรองกลุ่มทดลอง", "Filter study group")} value={group} onChange={(event) => onGroupChange(event.target.value)} disabled={disabled}>
          <option value="all">{t("ทุกกลุ่ม", "All groups")}</option>{Object.entries(groupLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>
    </div>}
    {showStats && <div className="dash-stats user-overview-stats" aria-live="polite">
      {[
        ["users", t("บัญชีตามตัวกรอง", "Matching accounts"), count(summary.count), `${t("จากทั้งหมด", "Of")} ${count(totalUsers)} ${t("บัญชี", "accounts")}`],
        ["flask", t("มีรหัสผู้เข้าร่วม", "Participant profiles"), count(summary.participants), t("บัญชีที่ระบุรหัสผู้เข้าร่วมแล้ว", "Accounts with a participant ID")],
        ["calendar", t("อายุเฉลี่ย", "Average age"), loading ? "…" : number(summary.averageAge, 1), `${t("จากข้อมูลอายุ", "Based on")} ${count(summary.agesKnown)} ${t("บัญชี", "ages")}`],
        ["pulse", t("ประเมิน MMSE ครบ", "Completed MMSE"), count(summary.assessed.length), `${t("ยังไม่ครบหรือยังไม่กรอก", "Incomplete or unassessed")}: ${count(summary.assessmentsMissing)}`],
      ].map(([icon, label, value, note]) => <div className="dash-panel dash-stat" key={icon}><span className="dash-stat-icon blue"><Icon name={icon} size={23} /></span><div><small className="dash-stat-label">{label}</small><strong className="dash-stat-value">{value}</strong><p className="dash-stat-note">{note}</p></div></div>)}
    </div>}
    <div className="user-overview-charts">
      <div className="card user-overview-chart"><h3>{t("สัดส่วนกลุ่มทดลอง", "Study groups")}</h3><p className="muted">{t("เลือกกลุ่มเพื่อกรองรายชื่อผู้ใช้", "Select a group to filter the user list.")}</p>
        {!summary.count || loading ? empty(t("ไม่พบผู้ใช้ตามตัวกรอง", "No users match these filters.")) : <div className="user-group-chart">
          <div className="user-group-ring" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label={Object.entries(summary.groups).map(([key, value]) => `${groupLabels[key]}: ${value}`).join(", ")}><div><strong>{number(summary.count)}</strong><small>{t("บัญชี", "accounts")}</small></div></div>
          <div className="user-group-legend">{Object.entries(summary.groups).map(([key, value]) => <button type="button" key={key} disabled={disabled} onClick={() => onGroupChange(group === key ? "all" : key)} aria-pressed={group === key}><i style={{ background: colors[key] }} /><span>{groupLabels[key]}</span><strong>{number(value)}</strong></button>)}</div>
        </div>}
      </div>
      <div className="card user-overview-chart"><h3>{t("ช่วงอายุผู้ใช้", "User age ranges")}</h3><p className="muted">{t("ยังไม่มีข้อมูลอายุ", "Age not recorded")}: {count(summary.agesMissing)} {t("บัญชี", "accounts")}</p>
        {!summary.agesKnown || loading ? empty(t("ยังไม่มีข้อมูลอายุในกลุ่มที่เลือก", "No ages recorded for the selected users.")) : <div className="user-overview-bars">{summary.ageBands.map((band) => <div className="user-overview-bar-row" key={band.label}><span>{band.label} {t("ปี", "years")}</span><div className="user-overview-bar-track"><i style={{ width: `${100 * band.count / maxAgeCount}%` }} /></div><strong>{number(band.count)}</strong></div>)}</div>}
      </div>
    </div>
    <details className="card dashboard-assessment-details">
      <summary><span><Icon name="book" size={19} />{t("การศึกษาและผลประเมิน MMSE", "Education and MMSE assessments")}</span><small>{count(summary.assessed.length)} {t("บัญชีประเมินครบ", "completed assessments")}</small></summary>
      <p className="dashboard-source-note">{t("ผลส่วนนี้ใช้ข้อมูลการศึกษาและคะแนนที่บันทึกในโปรไฟล์ผู้ใช้ ยกเว้นโปรไฟล์ที่ระบุว่าเป็นข้อมูลสมมติ", "These results use education and scores saved in user profiles, excluding profiles marked as simulated.")}</p>
      <div className="user-overview-charts">
      <div className="user-overview-chart"><h3>{t("ระดับการศึกษา", "Education")}</h3><p className="muted">{t("จำนวนบัญชีในแต่ละระดับการศึกษา", "Account counts by education level.")}</p>
        {!summary.count || loading ? empty(t("ไม่พบผู้ใช้ตามตัวกรอง", "No users match these filters.")) : <div className="user-overview-bars">{Object.entries(summary.education).map(([key, value]) => <div className="user-overview-bar-row" key={key}><span>{educationLabels[key]}</span><div className="user-overview-bar-track"><i style={{ width: `${100 * value / maxEducation}%` }} /></div><strong>{number(value)}</strong></div>)}</div>}
      </div>
      <div className="user-overview-chart"><h3>{t("คะแนน MMSE รายผู้ใช้", "MMSE by user")}</h3><p className="muted">{t("ร้อยละของคะแนนเต็มตามระดับการศึกษา · ประเมินครบสูงสุด 8 บัญชี", "Percentage of the education-specific maximum · up to 8 completed assessments")}</p>
        {!summary.assessed.length || loading ? empty(t("ยังไม่มีผล MMSE ที่ประเมินครบ", "No completed MMSE assessments yet.")) : <div className="user-overview-bars">{summary.assessed.slice(0, 8).map((item) => <button type="button" className="user-overview-bar-row user-mmse-row" key={item.user.email} disabled={disabled} onClick={() => onSelect(item.user)} aria-label={`${item.user.name || item.user.email}: MMSE ${item.total}/${item.max}`}><span>{item.user.participantId || item.user.profile.participantId || item.user.name || item.user.email}</span><div className="user-overview-bar-track"><i style={{ width: `${item.percent}%` }} /></div><strong>{item.total}/{item.max}</strong></button>)}</div>}
      </div>
      </div>
      {onShowAll && <button type="button" className="dash-text-link" disabled={disabled} onClick={onShowAll}>{t("กรอกข้อมูลการศึกษาและ MMSE", "Enter education and MMSE scores")} <Icon name="arrow" size={16} /></button>}
    </details>
    <div className="user-overview-table">
      <div className="dashboard-table-heading"><h3>{t("ข้อมูลรายผู้ใช้", "Users at a glance")}</h3>{onShowAll && <button type="button" className="dash-text-link" disabled={disabled} onClick={onShowAll}>{t("ดูผู้ใช้ทั้งหมด", "View all users")} <Icon name="arrow" size={16} /></button>}</div>
      {!summary.count || loading ? empty(t("ไม่พบผู้ใช้ตามตัวกรอง", "No users match these filters.")) : <div className="user-overview-table-scroll"><table><caption className="dashboard-sr-only">{t("ผู้ใช้ตามตัวกรอง", "Users matching the current filters")}</caption><thead><tr><th>{t("ผู้ใช้ / อีเมล", "User / email")}</th><th>{t("รหัสผู้เข้าร่วม", "Participant ID")}</th><th>{t("กลุ่ม", "Group")}</th><th>{t("อายุ", "Age")}</th><th>MMSE</th><th>{t("ภารกิจเฉลี่ย (%)", "Mean task accuracy (%)")}</th><th>{t("ข้อมูล", "Details")}</th></tr></thead><tbody>{users.slice(0, tableLimit).map((user) => {
        const score = assessedByEmail.get(user.email);
        const simulated = hasSimulatedProfile(user.profile);
        const profile = simulated ? {} : user.profile;
        const age = profile?.age;
        return <tr key={user.email}><td><strong>{user.name || "—"}</strong><br /><span>{user.email}</span>{simulated && <small> · {t("โปรไฟล์สมมติ", "Simulated profile")}</small>}</td><td>{user.participantId || user.profile?.participantId || "—"}</td><td>{groupLabels[profile?.studyGroup] || groupLabels.unassigned}</td><td>{Number.isInteger(age) && age >= 10 && age <= 120 ? number(age) : "—"}</td><td>{simulated ? t("ข้อมูลสมมติ", "Simulated data") : score ? `${score.total} / ${score.max}` : t("ยังไม่ครบ", "Incomplete")}</td><td>{number(user.taskPerformance?.accuracyPercent, 1)}<br /><small>{user.taskPerformance?.sessionCount || 0} {t("รอบ", "sessions")}</small></td><td><button type="button" className="secondary" disabled={disabled} onClick={() => onSelect(user)}>{t("ดู / แก้ไข", "View / edit")}</button></td></tr>;
      })}</tbody></table></div>}
      {!loading && summary.count > tableLimit && <p className="muted dashboard-preview-note">{t("แสดง", "Showing")} {tableLimit} / {count(summary.count)} {t("บัญชี", "accounts")}</p>}
    </div>
  </div>;
}
