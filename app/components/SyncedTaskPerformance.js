"use client";

import { useEffect, useState } from "react";
import TaskPerformance from "./TaskPerformance";

export default function SyncedTaskPerformance({ locale = "th" }) {
  const [result, setResult] = useState({ loading: true, error: false, performance: null });
  useEffect(() => {
    let active = true;
    let latest = 0;
    const refresh = async () => {
      const request = ++latest;
      try {
        const response = await fetch("/api/research/summaries", { cache: "no-store" });
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json();
        if (active && request === latest) setResult({ loading: false, error: false, performance: data.taskPerformance });
      } catch {
        if (active && request === latest) setResult({ loading: false, error: true, performance: null });
      }
    };
    refresh();
    window.addEventListener("research-dashboard-opened", refresh);
    window.addEventListener("research-session-finished", refresh);
    window.addEventListener("research-summaries-synced", refresh);
    return () => {
      active = false;
      window.removeEventListener("research-dashboard-opened", refresh);
      window.removeEventListener("research-session-finished", refresh);
      window.removeEventListener("research-summaries-synced", refresh);
    };
  }, []);
  return <div className="card">
    {result.loading ? <p role="status">{locale === "th" ? "กำลังโหลดผลภารกิจที่บันทึกในระบบ…" : "Loading saved task performance…"}</p>
      : result.error ? <p role="alert">{locale === "th" ? "โหลดค่าเฉลี่ยภารกิจไม่ได้ กรุณารีเฟรชเพื่อลองอีกครั้ง" : "Could not load task averages. Refresh to try again."}</p>
      : <TaskPerformance performance={result.performance} locale={locale} />}
  </div>;
}
