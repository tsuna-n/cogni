"use client";

import { MMSE_DOMAINS, mmseTotal } from "@/lib/auth/user-profile.mjs";
import Icon from "./DashboardIcon";

export default function DashboardUserEditor({ user, draft, locale, saving, dirty, onChange, onSave, onReset }) {
  const t = (th, en) => locale === "th" ? th : en;
  const total = mmseTotal(draft.profile);
  const date = (value) => value ? new Date(value).toLocaleString(locale === "th" ? "th-TH" : "en-US", { dateStyle: "medium", timeStyle: "short" }) : "—";
  const role = user.role === "admin" ? t("แอดมิน", "Administrator") : user.role === "researcher" ? t("นักวิจัย", "Researcher") : t("ผู้ใช้ทั่วไป", "User");
  return <form onSubmit={onSave} className="dashboard-profile-form">
    <div className="dashboard-profile-heading">
      <span className="dashboard-profile-avatar" aria-hidden="true">{(user.name || user.email).slice(0, 1).toUpperCase()}</span>
      <div><h2>{user.name || t("ข้อมูลผู้ใช้", "User details")}</h2><p>{user.email}</p></div>
      <span className="dashboard-role-badge">{role}</span>
    </div>
    <div className="dashboard-profile-meta"><span>{t("สร้างบัญชี", "Created")} {date(user.createdAt)}</span><span>{t("เข้าใช้งาน", "Sign-ins")}: {user.loginCount}</span><span>{t("ล่าสุด", "Last sign-in")}: {date(user.lastLoginAt)}</span></div>
    <fieldset disabled={saving} className="dashboard-user-fields">
      <legend>{t("ข้อมูลผู้เข้าร่วม", "Participant details")}</legend>
      <label>{t("ชื่อ", "Name")}<input name="name" maxLength={80} value={draft.name} onChange={(event) => onChange("name", event.target.value)} /></label>
      <label>{t("รหัสผู้เข้าร่วม", "Participant ID")}<input name="participantId" maxLength={40} value={draft.profile.participantId} onChange={(event) => onChange("participantId", event.target.value)} /></label>
      <label>{t("อายุ", "Age")}<input name="age" type="number" min={10} max={120} step={1} value={draft.profile.age} onChange={(event) => onChange("age", event.target.value)} /></label>
      <label>{t("มือข้างถนัด", "Dominant hand")}<select name="hand" value={draft.profile.hand} onChange={(event) => onChange("hand", event.target.value)}><option value="">{t("ยังไม่ระบุ", "Not specified")}</option><option value="Right">{t("ขวา", "Right")}</option><option value="Left">{t("ซ้าย", "Left")}</option></select></label>
      <label>{t("รหัสรอบ", "Session ID")}<input name="sessionId" maxLength={40} value={draft.profile.sessionId} onChange={(event) => onChange("sessionId", event.target.value)} /></label>
      <label>{t("กลุ่มทดลอง", "Study group")}<select name="studyGroup" value={draft.profile.studyGroup} onChange={(event) => onChange("studyGroup", event.target.value)}><option value="">{t("ยังไม่ระบุ", "Not specified")}</option><option value="patient">{t("ผู้ป่วย", "Patient")}</option><option value="control">{t("กลุ่มควบคุม", "Control")}</option></select></label>
    </fieldset>
    <details className="dashboard-profile-mmse" open={Boolean(draft.profile.education)}>
      <summary><Icon name="brain" size={19} /><span>{t("แบบประเมิน MMSE", "MMSE assessment")}</span><strong>{total ? `${total.total} / ${total.max}` : t("ยังไม่ครบ", "Incomplete")}</strong><Icon name="chevron" size={16} /></summary>
      <fieldset disabled={saving} className="dashboard-user-fields">
        <legend className="dashboard-sr-only">{t("คะแนน MMSE", "MMSE scores")}</legend>
        <label className="dashboard-user-wide">{t("ระดับการศึกษา", "Education")}<select name="education" value={draft.profile.education} onChange={(event) => onChange("education", event.target.value)}><option value="">{t("ยังไม่ระบุ", "Not specified")}</option><option value="none">{t("ไม่ได้เรียนหนังสือ / อ่านไม่ออกเขียนไม่ได้", "No formal education / illiterate")}</option><option value="primary">{t("ประถมศึกษา", "Primary education")}</option><option value="above">{t("สูงกว่าประถมศึกษา", "Above primary education")}</option></select></label>
        <p className="muted dashboard-user-wide">{t("เว้นว่างด้านที่ยังไม่ได้ประเมิน", "Leave unassessed domains blank.")}</p>
        {MMSE_DOMAINS.map((domain, index) => <label key={domain.en}><span>{locale === "th" ? domain.th : domain.en} <small className="dashboard-field-range">0–{domain.max}</small></span><input name={`mmse-${index}`} type="number" min={0} max={domain.max} step={1} disabled={!draft.profile.education || (draft.profile.education === "none" && domain.literacy)} value={draft.profile.mmseScores[index] ?? ""} onChange={(event) => onChange("mmseScores", draft.profile.mmseScores.map((score, i) => i === index ? event.target.value === "" ? null : Number(event.target.value) : score))} /></label>)}
      </fieldset>
    </details>
    <fieldset disabled={saving} className="dashboard-user-fields dashboard-notes-fields"><legend>{t("หมายเหตุ", "Notes")}</legend><label className="dashboard-user-wide"><span className="dashboard-sr-only">{t("หมายเหตุผู้เข้าร่วม", "Participant notes")}</span><textarea name="notes" maxLength={2000} rows={3} value={draft.profile.notes} onChange={(event) => onChange("notes", event.target.value)} placeholder={t("บันทึกเพิ่มเติมสำหรับการติดตามผล…", "Add follow-up notes…")} /></label></fieldset>
    <p className="dashboard-profile-revision">{user.profileUpdatedAt ? `${t("แก้ไขล่าสุด", "Updated")}: ${date(user.profileUpdatedAt)} · ${user.profileUpdatedBy}` : t("ยังไม่มีข้อมูลที่บันทึก", "No profile saved yet.")}</p>
    <div className="dashboard-profile-actions"><span role="status">{dirty ? t("มีการแก้ไขที่ยังไม่บันทึก", "Unsaved changes") : t("ข้อมูลที่บันทึกไว้", "Saved details")}</span><div><button type="button" className="secondary" disabled={saving || !dirty} onClick={onReset}>{t("ยกเลิกการแก้ไข", "Discard changes")}</button><button type="submit" disabled={saving || !dirty}>{saving ? t("กำลังบันทึก…", "Saving…") : t("บันทึกข้อมูล", "Save details")}</button></div></div>
  </form>;
}
