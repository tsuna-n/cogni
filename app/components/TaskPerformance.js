export default function TaskPerformance({ performance, locale = "th" }) {
  const t = (th, en) => locale === "th" ? th : en;
  const percent = (value) => value == null ? "—" : `${value.toLocaleString(locale === "th" ? "th-TH" : "en-US", { maximumFractionDigits: 1 })}%`;
  return <section className="dashboard-task-performance" aria-label={t("ผลภารกิจประกอบการติดตาม", "Task performance for follow-up")}>
    <h3>{t("ค่าเฉลี่ยความแม่นยำภารกิจ", "Mean task accuracy")} <strong>{percent(performance?.accuracyPercent)}</strong></h3>
    <p className="muted">{performance?.sessionCount
      ? t(`จาก ${performance.sessionCount} รอบที่ทำครบ · ${performance.trials} คำตอบ`, `From ${performance.sessionCount} completed sessions · ${performance.trials} responses`)
      : t("ยังไม่มีรอบที่ทำครบและมีคำตอบบันทึกในระบบ", "No completed sessions with recorded responses yet.")}</p>
    {Boolean(performance?.sessionCount) && <ul>{performance.games.map((game) => <li key={game.gameId}>{t("เกม", "Game")} {game.gameId}: {percent(game.accuracyPercent)} · {game.sessionCount} {t("รอบ", "sessions")}</li>)}</ul>}
    <p className="muted">{t("เฉลี่ยเปอร์เซ็นต์ความแม่นยำของแต่ละรอบ โดยให้น้ำหนักทุกรอบเท่ากัน ยกเว้นรอบทดสอบอุปกรณ์ รอบสมมติ และรอบที่ไม่มีคำตอบ คะแนนนี้แยกจาก MMSE และใช้แทนผลประเมิน MMSE ไม่ได้", "Each session's accuracy percentage has equal weight. Device tests, simulated sessions and sessions without responses are excluded. This score is separate from MMSE and cannot replace an MMSE assessment.")}</p>
  </section>;
}
