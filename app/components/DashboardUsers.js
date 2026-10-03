"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MMSE_DOMAINS } from "@/lib/auth/user-profile.mjs";
import ResearchHistory from "./ResearchHistory";
import DashboardUserOverview from "./DashboardUserOverview";
import DashboardResearchOverview from "./DashboardResearchOverview";
import { filterOverviewUsers } from "@/lib/dashboard/user-overview.mjs";
import DashboardUserEditor from "./DashboardUserEditor";
import DashboardUserCreator from "./DashboardUserCreator";
import Icon from "./DashboardIcon";

function userDraft(user) {
  const p = user.profile;
  return {
    name: user.name || "",
    expectedUpdatedAt: user.profileUpdatedAt,
    profile: {
      participantId: p.participantId || "", age: p.age ?? "", hand: p.hand || "",
      sessionId: p.sessionId || "", studyGroup: p.studyGroup || "",
      education: p.education || "", notes: p.notes || "",
      mmseScores: MMSE_DOMAINS.map((_, index) => p.mmseScores?.[index] ?? null),
    },
  };
}

export default function DashboardUsers({ locale = "th", enabled = false, accountRole = "user", accountEmail = "", search = "", view = "overview", onViewChange, onClearSearch, studyConfig, configError, onOpenSettings, onOpenExperiment }) {
  const t = (th, en) => locale === "th" ? th : en;
  const [users, setUsers] = useState([]);
  const [records, setRecords] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [draft, setDraft] = useState(null);
  const [query, setQuery] = useState("");
  const [overviewRole, setOverviewRole] = useState("all");
  const [overviewGroup, setOverviewGroup] = useState("all");
  const [page, setPage] = useState(0);
  const [recordScope, setRecordScope] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const results = await Promise.all(["/api/dashboard/users", "/api/research/summaries"].map(async (url) => {
        const response = await fetch(url, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        return data;
      }));
      if (id !== requestId.current) return;
      setUsers(results[0].users);
      setRecords(results[1].records);
      setUpdatedAt(new Date());
      setError("");
      return results[0].users;
    } catch (cause) {
      if (id !== requestId.current) return;
      if (["unauthorized", "forbidden"].includes(cause.message)) {
        setUsers([]); setRecords([]); setDraft(null); setSelectedEmail(""); setDirty(false);
        setCreating(false);
      }
      setError(cause.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();
    window.addEventListener("research-dashboard-opened", load);
    window.addEventListener("research-session-finished", load);
    window.addEventListener("focus", load);
    return () => {
      ++requestId.current;
      window.removeEventListener("research-dashboard-opened", load);
      window.removeEventListener("research-session-finished", load);
      window.removeEventListener("focus", load);
    };
  }, [enabled, load]);

  useEffect(() => { setPage(0); }, [search, query, overviewRole, overviewGroup]);
  useEffect(() => {
    if (!enabled || !dirty) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [enabled, dirty]);

  const select = (user) => {
    if (dirty && !window.confirm(t("มีข้อมูลที่ยังไม่บันทึก ต้องการเปลี่ยนผู้ใช้หรือไม่?", "Discard unsaved changes and switch users?"))) return false;
    setSelectedEmail(user?.email || "");
    setCreating(false);
    setDraft(user ? userDraft(user) : null);
    setDirty(false); setError(""); setMessage("");
    return true;
  };
  const openProfile = (user) => {
    if (!select(user)) return;
    onViewChange("users");
    window.requestAnimationFrame(() => {
      const input = document.querySelector(".dashboard-user-details [name=name]");
      input?.focus({ preventScroll: true });
      if (window.innerWidth < 950) document.querySelector(".dashboard-user-details")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const change = (key, value) => {
    setDraft((current) => {
      if (key === "name") return { ...current, name: value };
      const profile = { ...current.profile, [key]: value };
      if (key === "education") profile.mmseScores = MMSE_DOMAINS.map((domain, index) => value === "" ? null : value === "none" && domain.literacy ? 0 : profile.mmseScores[index]);
      return { ...current, profile };
    });
    setDirty(true); setMessage("");
  };
  const reload = async () => {
    if (dirty && !window.confirm(t("โหลดข้อมูลล่าสุดและยกเลิกข้อมูลที่ยังไม่บันทึกหรือไม่?", "Reload the latest data and discard unsaved changes?"))) return;
    const latest = await load();
    if (latest) {
      const user = latest.find((item) => item.email === selectedEmail);
      setDraft(user ? userDraft(user) : null);
      setSelectedEmail(user?.email || "");
      setDirty(false); setMessage("");
    }
  };
  const save = async (event) => {
    event.preventDefault();
    if (!draft || saving) return;
    ++requestId.current;
    setLoading(false);
    setSaving(true); setError(""); setMessage("");
    try {
      const body = { ...draft, profile: { ...draft.profile, age: draft.profile.age === "" ? null : Number(draft.profile.age) } };
      const response = await fetch(`/api/dashboard/users/${encodeURIComponent(selectedEmail)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setUsers((current) => current.map((user) => user.email === data.user.email ? data.user : user));
      setDraft(userDraft(data.user)); setDirty(false);
      setUpdatedAt(new Date());
      setMessage(t("บันทึกข้อมูลผู้ใช้แล้ว", "User details saved."));
    } catch (cause) {
      setError(cause.message);
    } finally { setSaving(false); }
  };

  if (!enabled) return null;
  const selected = users.find((user) => user.email === selectedEmail);
  const term = `${search} ${query}`.trim().toLowerCase();
  const filtered = filterOverviewUsers(users, { search: term, role: overviewRole, group: overviewGroup });
  const scopeAccount = users.find((user) => user.email === recordScope);
  const shownRecords = recordScope ? records.filter((record) => record.uploadedBy === recordScope || (scopeAccount?.profile.participantId && record.participantId === scopeAccount.profile.participantId)) : records;
  const sessions = shownRecords.map((record) => ({ ...record.summary, id: record.recordId, summary: record.summary, uploadedBy: record.uploadedBy }));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount - 1);
  const listed = filtered.slice(currentPage * 10, currentPage * 10 + 10);
  const tabs = [
    { id: "overview", icon: "grid", label: t("ภาพรวม", "Overview"), description: t("ติดตามข้อมูลผู้เข้าร่วม กลุ่มทดลอง และผลประเมิน", "Track participant profiles, study groups, and assessments.") },
    { id: "users", icon: "users", label: t("ผู้ใช้", "Users"), description: t("ค้นหาและจัดการข้อมูลผู้เข้าร่วมทีละบัญชี", "Find an account and manage its participant details.") },
    { id: "summaries", icon: "file", label: t("ผลการทดลอง", "Study results"), description: t("ทบทวน เปรียบเทียบ และส่งออกผลสรุปที่ซิงก์แล้ว", "Review, compare, and export synced session summaries.") },
    { id: "personal", icon: "pulse", label: t("ข้อมูลในเครื่อง", "Local recordings"), description: t("รอบ EEG และผลประเมินของคุณที่เก็บในเบราว์เซอร์นี้", "Your EEG recordings and assessments stored in this browser.") },
  ];
  const currentTab = tabs.find((tab) => tab.id === view) || tabs[0];
  const roleLabel = (role) => role === "admin" ? t("แอดมิน", "Administrator") : role === "researcher" ? t("นักวิจัย", "Researcher") : t("ผู้ใช้ทั่วไป", "User");
  const errors = {
    forbidden: t("ไม่มีสิทธิ์จัดการข้อมูลผู้ใช้", "You no longer have permission to manage users."),
    unauthorized: t("กรุณาเข้าสู่ระบบอีกครั้ง", "Please sign in again."),
    profile_conflict: t("ข้อมูลถูกแก้ไขโดยผู้อื่นแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกใหม่", "Someone else updated this user. Reload the latest data before saving again."),
    not_found: t("ไม่พบบัญชีนี้ กรุณาโหลดข้อมูลล่าสุด", "This account no longer exists. Reload the user list."),
    invalid_body: t("ข้อมูลไม่ถูกต้อง กรุณาตรวจชื่อ อายุ และคะแนน MMSE", "Check the name, age, and MMSE scores."),
    storage_unavailable: t("โหลดหรือบันทึกข้อมูลไม่ได้ กรุณาลองใหม่", "Storage is unavailable. Please try again."),
  };
  const resetFilters = () => { setQuery(""); setOverviewRole("all"); setOverviewGroup("all"); onClearSearch?.(); };
  const resetDraft = () => {
    if (dirty && !window.confirm(t("ยกเลิกการแก้ไขที่ยังไม่บันทึกหรือไม่?", "Discard unsaved changes?"))) return;
    setDraft(userDraft(selected)); setDirty(false); setError(""); setMessage("");
  };
  const navigateTab = (event, index) => {
    const positions = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 };
    if (!(event.key in positions)) return;
    event.preventDefault();
    const tab = tabs[positions[event.key]];
    onViewChange(tab.id);
    document.getElementById(`dashboard-tab-${tab.id}`)?.focus();
  };
  const startCreating = () => {
    if (!select(null)) return;
    setCreating(true);
    onViewChange("users");
  };
  const created = (user) => {
    ++requestId.current;
    setLoading(false);
    setUsers((current) => [...current.filter((item) => item.email !== user.email), user].sort((a, b) => a.email.localeCompare(b.email)));
    select(user);
    resetFilters();
    setUpdatedAt(new Date());
    setMessage(t("เพิ่มผู้ใช้แล้ว", "User created."));
  };
  return <div className="dashboard-users dashboard-production" data-no-translate aria-labelledby="dashboard-users-title">
    <div className="dashboard-workspace-heading">
      <div><div className="dash-breadcrumb">{t("พื้นที่วิจัย", "Research workspace")} <span>/</span> {t("แดชบอร์ด", "Dashboard")}</div><h1 id="dashboard-users-title">{t("แดชบอร์ด", "Dashboard")}</h1><p>{currentTab.description}</p></div>
      <div className="dashboard-workspace-actions"><small>{loading ? t("กำลังอัปเดต…", "Updating…") : updatedAt ? `${t("ล่าสุด", "Updated")} ${updatedAt.toLocaleTimeString(locale === "th" ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit" })}` : ""}</small>{accountRole === "admin" && <button type="button" className="dash-button" onClick={startCreating} disabled={saving || creating}>{t("เพิ่มผู้ใช้", "Add user")}</button>}<button type="button" className="dash-button dash-outline" onClick={reload} disabled={loading || saving}><Icon name="refresh" size={16} />{t("รีเฟรช", "Refresh")}</button></div>
    </div>
    <div className="dashboard-view-tabs" role="tablist" aria-label={t("มุมมองแดชบอร์ด", "Dashboard views")}>{tabs.map((tab, index) => <button key={tab.id} type="button" role="tab" id={`dashboard-tab-${tab.id}`} aria-selected={view === tab.id} aria-controls={`dashboard-panel-${tab.id}`} tabIndex={view === tab.id ? 0 : -1} onKeyDown={(event) => navigateTab(event, index)} onClick={() => onViewChange(tab.id)}><Icon name={tab.icon} size={18} /><span>{tab.label}</span>{tab.id === "users" && <small>{users.length}</small>}</button>)}</div>
    {error && <div role="alert" className="dashboard-feedback dashboard-feedback-error"><Icon name="info" size={18} /><span>{errors[error] || t("โหลดหรือบันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่", "Could not load or save details. Please try again.")}</span><button type="button" className="dash-text-link" onClick={reload} disabled={loading || saving}>{t("ลองใหม่", "Retry")}</button></div>}
    {message && <p role="status" className="dashboard-feedback dashboard-feedback-success"><Icon name="check" size={18} />{message}</p>}
    {(view === "overview" || view === "users") && <div className="dashboard-filter-bar user-overview-filters">
      {view === "users" && <label className="dashboard-users-search"><span className="dashboard-sr-only">{t("ค้นหาผู้ใช้", "Search users")}</span><Icon name="search" size={17} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("ชื่อ อีเมล หรือรหัสผู้เข้าร่วม", "Name, email, or participant ID")} /></label>}
      <label><span>{t("ประเภทบัญชี", "Account role")}</span><select aria-label={t("กรองประเภทบัญชี", "Filter account role")} value={overviewRole} onChange={(event) => setOverviewRole(event.target.value)} disabled={saving}><option value="all">{t("ทุกประเภท", "All roles")}</option><option value="user">{t("ผู้ใช้ทั่วไป", "User")}</option><option value="researcher">{t("นักวิจัย", "Researcher")}</option><option value="admin">{t("แอดมิน", "Administrator")}</option></select></label>
      <label><span>{t("กลุ่มทดลอง", "Study group")}</span><select aria-label={t("กรองกลุ่มทดลอง", "Filter study group")} value={overviewGroup} onChange={(event) => setOverviewGroup(event.target.value)} disabled={saving}><option value="all">{t("ทุกกลุ่ม", "All groups")}</option><option value="patient">{t("ผู้ป่วย", "Patient")}</option><option value="control">{t("กลุ่มควบคุม", "Control")}</option><option value="unassigned">{t("ยังไม่ระบุ", "Not specified")}</option></select></label>
      {(term || overviewRole !== "all" || overviewGroup !== "all") && <button type="button" className="dash-text-link" onClick={resetFilters}>{t("ล้างตัวกรอง", "Clear filters")}</button>}
      <span className="dashboard-filter-count" role="status">{loading ? "…" : filtered.length} {t("บัญชี", "accounts")}</span>
    </div>}
    <div role="tabpanel" id="dashboard-panel-overview" aria-labelledby="dashboard-tab-overview" hidden={view !== "overview"}>
      {error && !users.length && !loading ? <div className="card dashboard-panel-empty"><Icon name="info" size={32} /><h2>{t("ยังโหลดภาพรวมไม่ได้", "Overview unavailable")}</h2><p>{t("กดรีเฟรชเพื่อลองอีกครั้ง", "Refresh to try again.")}</p></div> : <>
        <DashboardResearchOverview users={users} records={records} loading={loading} locale={locale} studyConfig={studyConfig} configError={configError} onShowSummaries={() => { setRecordScope(""); onViewChange("summaries"); }} onOpenSettings={accountRole === "admin" ? onOpenSettings : undefined} onOpenExperiment={onOpenExperiment} onSelectUser={openProfile} onShowUsers={() => { resetFilters(); onViewChange("users"); }} />
        <div className="dashboard-profile-section-heading"><h2>{t("ข้อมูลจากโปรไฟล์ผู้ใช้", "Saved user profiles")}</h2><p>{t("ตัวกรองด้านบนใช้กับโปรไฟล์ในส่วนนี้", "The filters above apply to the profiles below.")}</p></div>
        <DashboardUserOverview users={filtered} totalUsers={users.length} loading={loading} locale={locale} role={overviewRole} group={overviewGroup} onRoleChange={setOverviewRole} onGroupChange={setOverviewGroup} onSelect={openProfile} onShowAll={() => onViewChange("users")} showHeader={false} showStats={false} disabled={saving} />
      </>}
    </div>
    <div role="tabpanel" id="dashboard-panel-users" aria-labelledby="dashboard-tab-users" className="dashboard-users-grid" hidden={view !== "users"}>
      <aside className="card dashboard-user-list" aria-label={t("รายชื่อผู้ใช้", "User list")}>
        <div className="dashboard-list-heading"><h2>{t("รายชื่อผู้ใช้", "User directory")}</h2><span>{filtered.length}</span></div>
        <ul>{listed.map((user) => <li key={user.email}><button type="button" className={`dashboard-user-row${selectedEmail === user.email ? " selected" : ""}`} aria-pressed={selectedEmail === user.email} disabled={saving} onClick={() => openProfile(user)}><strong>{user.name || user.email}</strong><span>{user.email}</span><small>{roleLabel(user.role)}{user.profile.participantId ? ` · ${user.profile.participantId}` : ""}</small></button></li>)}</ul>
        {!loading && !filtered.length && <div className="dashboard-directory-empty"><Icon name="users" size={25} /><p>{t("ไม่พบผู้ใช้ตามตัวกรอง", "No matching users")}</p><button type="button" className="dash-text-link" onClick={resetFilters}>{t("ล้างตัวกรอง", "Clear filters")}</button></div>}
        <div className="dashboard-list-pagination"><button type="button" className="secondary" aria-label={t("หน้าก่อนหน้า", "Previous page")} disabled={currentPage === 0 || saving} onClick={() => setPage(currentPage - 1)}><Icon name="chevron" size={14} /></button><span>{currentPage + 1} / {pageCount}</span><button type="button" className="secondary" aria-label={t("หน้าถัดไป", "Next page")} disabled={currentPage + 1 === pageCount || saving} onClick={() => setPage(currentPage + 1)}><Icon name="chevron" size={14} /></button></div>
      </aside>
      <div className="card dashboard-user-details">{creating && accountRole === "admin" ? <DashboardUserCreator locale={locale} adminEmail={accountEmail} saving={saving} onBusyChange={setSaving} onCreated={created} onCancel={() => setCreating(false)} /> : draft && selected ? <DashboardUserEditor key={selected.email} user={selected} draft={draft} locale={locale} saving={saving} dirty={dirty} onChange={change} onSave={save} onReset={resetDraft} /> : <div className="dashboard-panel-empty"><span className="dashboard-empty-icon"><Icon name="users" size={32} /></span><h2>{t("เลือกผู้ใช้เพื่อเริ่มจัดการ", "Select a user to get started")}</h2><p>{t("ดูข้อมูลผู้เข้าร่วม กรอกคะแนน MMSE และบันทึกหมายเหตุจากแผงนี้", "Review participant details, enter MMSE scores, and save notes here.")}</p></div>}</div>
    </div>
    <div role="tabpanel" id="dashboard-panel-summaries" aria-labelledby="dashboard-tab-summaries" hidden={view !== "summaries"}>
      <div className="dashboard-results-toolbar"><div><h2>{t("ผลสรุปการทดลอง", "Session summaries")}</h2><p className="muted">{sessions.length} {t("รอบที่ซิงก์แล้ว", "synced sessions")}</p></div><label>{t("บัญชี / ผู้เข้าร่วม", "Account / participant")}<select value={recordScope} onChange={(event) => setRecordScope(event.target.value)}><option value="">{t("ทุกบัญชี", "All accounts")}</option>{users.map((user) => <option key={user.email} value={user.email}>{user.name || user.email}{user.profile.participantId ? ` · ${user.profile.participantId}` : ""}</option>)}</select></label></div>
      <ResearchHistory sessions={sessions} locale={locale} loading={loading} source="server" />
    </div>
  </div>;
}
