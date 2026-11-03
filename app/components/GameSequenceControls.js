import Icon from "./DashboardIcon";
import { RESEARCH_GAMES } from "@/lib/research/game-sequence.mjs";
import { localizeText } from "@/lib/localization";

export default function GameSequenceControls({
  locale,
  gameId,
  complete,
  status,
  phase,
  remaining,
  action,
  busy,
  message,
  onNext,
  onRetry,
  onEndTask,
  onExport,
  onResults,
  onReset,
  onStop,
}) {
  const t = (th, en) => (locale === "th" ? th : en);
  const recording = status === "recording";
  return (
    <div
      className="game-sequence-controls card"
      data-no-translate
      aria-label={t(
        "ลำดับเกมและการบันทึกข้อมูล",
        "Game sequence & data recording",
      )}
    >
      <div className="game-sequence-heading">
        <span className="study-kicker">
          {t("ชุดการทดลอง · 3 เกมตามลำดับ", "RECORDING SEQUENCE · 3 GAMES")}
        </span>
        <span className="pill">
          {t("ข้อมูลแยกแต่ละเกม", "Separate data per game")}
        </span>
      </div>
      <ol className="game-sequence-steps">
        {RESEARCH_GAMES.map((game) => (
          <li
            key={game.id}
            className={
              complete.has(game.id)
                ? "complete"
                : game.id === gameId
                  ? "current"
                  : "pending"
            }
            aria-current={game.id === gameId ? "step" : undefined}
          >
            <span>
              {complete.has(game.id) ? (
                <Icon name="check" size={16} />
              ) : (
                game.id
              )}
            </span>
            <div>
              <strong>{localizeText(game.name, locale)}</strong>
              <small>
                {complete.has(game.id)
                  ? t("บันทึกข้อมูลครบแล้ว", "Recording saved")
                  : game.id === gameId
                    ? t("เกมปัจจุบัน", "Current game")
                    : t("รอเกมก่อนหน้า", "After previous game")}
              </small>
            </div>
          </li>
        ))}
      </ol>
      <div className="game-sequence-status" role="status">
        {recording
          ? `${t("กำลังบันทึกข้อมูล", "Recording data")} · ${phase} · ${remaining} ${t("วินาที", "seconds")}`
          : action?.type === "finished"
            ? t(
                "บันทึกข้อมูลครบทั้ง 3 เกมแล้ว ส่งออกแต่ละเกมได้จากรายการรอบทดลอง",
                "All 3 data recordings are saved. Export each game from your recordings.",
              )
            : action?.type === "next"
              ? t(
                  "บันทึกเกมนี้ครบแล้ว กด Next เพื่อเริ่ม Baseline ของเกมถัดไป",
                  "Recording saved. Select Next to start the next game’s baseline.",
                )
              : action?.type === "retry"
                ? t(
                    "เกมนี้หยุดก่อนจบ เก็บข้อมูลบางส่วนแล้ว ให้ลองเกมเดิมก่อนเดินหน้าต่อ",
                    "This game stopped early. Partial data is saved. Retry this game to continue.",
                  )
                : t(
                    "กำลังตรวจการบันทึกข้อมูล กรุณารอสักครู่",
                    "Checking saved data. Please wait.",
                  )}
      </div>
      <div className="controls">
        {recording && (
          <button
            type="button"
            onClick={onEndTask}
            disabled={phase !== "Task" || busy}
          >
            {phase === "Task"
              ? t(
                  "Next · จบเกมและบันทึกช่วงพัก",
                  "Next · Finish game & record rest",
                )
              : t("รอบันทึกข้อมูลให้ครบช่วง", "Waiting for data phase to finish")}
            <Icon name="arrow" size={15} />
          </button>
        )}
        {action?.type === "next" && (
          <button type="button" onClick={onNext} disabled={busy}>
            {t(
              `Next · เริ่มเกม ${action.gameId}`,
              `Next · Start game ${action.gameId}`,
            )}
            <Icon name="arrow" size={15} />
          </button>
        )}
        {action?.type === "retry" && (
          <button type="button" onClick={onRetry} disabled={busy}>
            <Icon name="refresh" size={15} />
            {t(`ลองเกม ${gameId} อีกครั้ง`, `Retry game ${gameId}`)}
          </button>
        )}
        {action?.type === "finished" && (
          <>
            <button type="button" onClick={onResults}>
              <Icon name="grid" size={15} />
              {t("ดูผลทั้ง 3 เกม", "View all 3 results")}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={onReset}
              disabled={busy}
            >
              {t("เริ่มชุดทดลองใหม่", "New game sequence")}
            </button>
          </>
        )}
        {!recording && (
          <button
            type="button"
            className="secondary"
            onClick={onExport}
            disabled={busy}
          >
            <Icon name="download" size={15} />
            {t(`ส่งออกข้อมูลเกม ${gameId}`, `Export game ${gameId} data`)}
          </button>
        )}
        {recording && (
          <button
            type="button"
            className="secondary"
            onClick={onStop}
            disabled={busy}
          >
            {t("หยุดและเก็บข้อมูล", "Stop & save partial data")}
          </button>
        )}
      </div>
      {message && (
        <p className="study-message">{localizeText(message, locale)}</p>
      )}
    </div>
  );
}
