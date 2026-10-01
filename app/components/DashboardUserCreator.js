"use client";

import { useRef, useState } from "react";
import Icon from "./DashboardIcon";

export default function DashboardUserCreator({ locale, adminEmail, saving, onBusyChange, onCreated, onCancel }) {
  const t = (th, en) => locale === "th" ? th : en;
  const [fields, setFields] = useState({ name: "", email: "", password: "", role: "user", adminEmail, adminPassword: "" });
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const change = (key, value) => { setFields((current) => ({ ...current, [key]: value })); setError(""); };
  const errors = {
    unauthorized: t("กรุณาเข้าสู่ระบบอีกครั้ง", "Please sign in again."),
    forbidden: t("เฉพาะแอดมินเท่านั้นที่เพิ่มผู้ใช้ได้", "Only administrators can create users."),
    invalid_admin_credentials: t("อีเมลหรือรหัสผ่านแอดมินไม่ถูกต้อง กรุณาใช้บัญชีแอดมินที่กำลังเข้าสู่ระบบ", "Incorrect administrator email or password. Use the administrator account currently signed in."),
    missing_admin_credentials: t("กรุณากรอกอีเมลและรหัสผ่านแอดมินเพื่อยืนยัน", "Enter your administrator email and password to confirm."),
    invalid_email: t("อีเมลผู้ใช้ใหม่ไม่ถูกต้อง", "Enter a valid email for the new user."),
    invalid_name: t("ชื่อไม่ถูกต้องหรือยาวเกิน 80 ตัวอักษร", "Enter a valid name of up to 80 characters."),
    weak_password: t("รหัสผ่านผู้ใช้ใหม่ต้องมี 8–200 ตัวอักษร", "The new user's password must contain 8–200 characters."),
    invalid_role: t("กรุณาเลือกสิทธิ์ผู้ใช้", "Select a valid account role."),
    invalid_body: t("ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง", "Check the form details and try again."),
    email_taken: t("อีเมลนี้มีบัญชีอยู่แล้ว", "An account with this email already exists."),
    rate_limited: t("ยืนยันหลายครั้งเกินไป กรุณารอหนึ่งนาทีแล้วลองใหม่", "Too many attempts. Wait one minute and try again."),
    storage_unavailable: t("บันทึกข้อมูลไม่ได้ กรุณาลองใหม่", "Storage is unavailable. Please try again."),
  };
  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current || saving) return;
    submitting.current = true;
    onBusyChange(true); setError("");
    try {
      const response = await fetch("/api/dashboard/users", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onCreated(data.user);
    } catch (cause) {
      setError(cause.message);
      setFields((current) => ({ ...current, adminPassword: "" }));
    } finally { submitting.current = false; onBusyChange(false); }
  };
  return <form onSubmit={submit} className="dashboard-profile-form">
    <div className="dashboard-profile-heading"><Icon name="users" size={28} /><div><h2>{t("เพิ่มผู้ใช้", "Add user")}</h2><p>{t("สร้างบัญชีใหม่และกำหนดสิทธิ์การใช้งาน", "Create an account and choose its access role.")}</p></div></div>
    <fieldset disabled={saving} className="dashboard-user-fields">
      <legend>{t("บัญชีผู้ใช้ใหม่", "New user account")}</legend>
      <label>{t("ชื่อ", "Name")}<input name="newUserName" autoComplete="off" autoFocus maxLength={80} value={fields.name} onChange={(event) => change("name", event.target.value)} /></label>
      <label>{t("อีเมลผู้ใช้ใหม่", "New user email")}<input name="newUserEmail" type="email" autoComplete="off" required maxLength={254} value={fields.email} onChange={(event) => change("email", event.target.value)} /></label>
      <label>{t("รหัสผ่านผู้ใช้ใหม่", "New user password")}<input name="newUserPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={fields.password} onChange={(event) => change("password", event.target.value)} /><small className="muted">{t("8–200 ตัวอักษร", "8–200 characters")}</small></label>
      <label>{t("สิทธิ์ผู้ใช้ (Role)", "Account role")}<select name="newUserRole" value={fields.role} onChange={(event) => change("role", event.target.value)}><option value="user">{t("ผู้ใช้ทั่วไป", "User")}</option><option value="researcher">{t("นักวิจัย", "Researcher")}</option><option value="admin">{t("แอดมิน", "Administrator")}</option></select></label>
    </fieldset>
    <fieldset disabled={saving} className="dashboard-user-fields">
      <legend>{t("ยืนยันบัญชีแอดมิน", "Confirm administrator account")}</legend>
      <p className="muted dashboard-user-wide">{t("กรอกอีเมลและรหัสผ่านของแอดมินที่กำลังเข้าสู่ระบบ เพื่อยืนยันการเพิ่มผู้ใช้ครั้งนี้", "Enter the email and password of the administrator currently signed in to confirm this user creation.")}</p>
      <label>{t("อีเมลแอดมิน", "Administrator email")}<input name="adminEmail" type="email" autoComplete="username" required maxLength={254} value={fields.adminEmail} onChange={(event) => change("adminEmail", event.target.value)} /></label>
      <label>{t("รหัสผ่านแอดมิน", "Administrator password")}<input name="adminPassword" type="password" autoComplete="current-password" required maxLength={200} value={fields.adminPassword} onChange={(event) => change("adminPassword", event.target.value)} /></label>
      {error && <p role="alert" className="dashboard-feedback dashboard-feedback-error dashboard-user-wide">{errors[error] || t("เพิ่มผู้ใช้ไม่สำเร็จ กรุณาลองใหม่", "Could not create the user. Please try again.")}</p>}
    </fieldset>
    <div className="dashboard-profile-actions"><span>{t("ยืนยันด้วยบัญชีแอดมินทุกครั้ง", "Administrator confirmation required each time")}</span><div><button type="button" className="secondary" disabled={saving} onClick={onCancel}>{t("ยกเลิก", "Cancel")}</button><button type="submit" disabled={saving}>{saving ? t("กำลังเพิ่มผู้ใช้…", "Creating user…") : t("ยืนยันและเพิ่มผู้ใช้", "Confirm and add user")}</button></div></div>
  </form>;
}
