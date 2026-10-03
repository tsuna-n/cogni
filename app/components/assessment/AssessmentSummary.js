import {
  allAnswered,
  answerOptions,
  questions,
  respondentOptions,
} from "../../../lib/assessment.mjs";
import styles from "./assessment.module.css";

/** @typedef {import('./AssessmentSteps').Translate} Translate */
/** @typedef {import('./AssessmentSteps').StepProps} StepProps */

/** @param {{ answers: import('../../../lib/assessment.mjs').AssessmentState['answers'], t: Translate, onEdit?: (index: number) => void }} props */
function AnswerList({ answers, t, onEdit }) {
  return (
    <ol className={styles.reviewList}>
      {questions.map((question, index) => {
        const option = answerOptions.find(
          (item) => item.value === answers[index],
        );
        return (
          <li key={question.id} className={styles.reviewItem}>
            <div>
              <h3>
                {t(`ข้อ ${question.id}`, `Question ${question.id}`)}:{" "}
                {t(question.text, question.en)}
              </h3>
              <p>
                {t("คำตอบ", "Answer")}:{" "}
                <strong>
                  {option
                    ? t(option.th, option.en)
                    : t("ยังไม่ได้ตอบ", "Unanswered")}
                </strong>
              </p>
            </div>
            {onEdit && (
              <button
                type="button"
                className="secondary"
                onClick={() => onEdit(index)}
                aria-label={t(
                  `แก้ไขคำตอบข้อ ${question.id}`,
                  `Edit answer to question ${question.id}`,
                )}
              >
                {t("แก้ไข", "Edit")}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** @param {{ respondent: import('../../../lib/assessment.mjs').Respondent | null, t: Translate }} props */
function RespondentSummary({ respondent, t }) {
  const option = respondentOptions.find((item) => item.value === respondent);
  return (
    <p>
      {t("ผู้ตอบแบบประเมิน", "Respondent")}:{" "}
      <strong>
        {option ? t(option.th, option.en) : t("ยังไม่ได้เลือก", "Not selected")}
      </strong>
    </p>
  );
}

/** @param {StepProps & { saving?: boolean }} props */
export function AssessmentReview({ state, dispatch, t, saving = false }) {
  return (
    <>
      <p>
        {t(
          "โปรดตรวจสอบคำตอบทั้ง 8 ข้อก่อนยืนยัน สามารถแก้ไขแต่ละข้อได้",
          "Please review all 8 answers before confirming. You can edit each answer.",
        )}
      </p>
      <RespondentSummary respondent={state.respondent} t={t} />
      <AnswerList
        answers={state.answers}
        t={t}
        onEdit={(index) => dispatch({ type: "edit", index })}
      />
      <div className={styles.actions}>
        <button
          type="button"
          disabled={saving || !state.respondent || !allAnswered(state.answers)}
          onClick={() => dispatch({ type: "confirm" })}
        >
          {t("ยืนยันและดูผล", "Confirm and view results")}
        </button>
      </div>
    </>
  );
}

/** @param {StepProps & { onHome: () => void }} props */
export function AssessmentResult({ state, dispatch, t, onHome }) {
  if (!state.result) return null;
  return (
    <>
      <div className={styles.notice}>
        <p>
          {t(
            "ผลจากแบบประเมินนี้ใช้สำหรับการคัดกรองเบื้องต้นเท่านั้น ไม่สามารถใช้ยืนยันหรือวินิจฉัยโรคอัลไซเมอร์หรือภาวะสมองเสื่อมได้",
            "These results are for preliminary screening only. They cannot confirm or diagnose Alzheimer’s disease or dementia.",
          )}
        </p>
      </div>
      <p>
        {t(
          "สรุปคำตอบที่ยืนยันแล้ว แบบคำถามนี้ยังไม่มีเกณฑ์คะแนนหรือเกณฑ์แปลผลที่กำหนดไว้ในระบบ จึงแสดงเฉพาะคำตอบโดยไม่จัดระดับความเสี่ยง",
          "Your confirmed answers are summarized below. This questionnaire has no scoring or interpretation criteria configured in the system, so only answers are shown without a risk classification.",
        )}
      </p>
      <p>
        {t(
          "หากมีข้อกังวลเกี่ยวกับความจำ ความคิด หรือการดำเนินชีวิตประจำวัน ควรปรึกษาแพทย์หรือบุคลากรทางการแพทย์เพื่อรับการประเมินเพิ่มเติม",
          "If you have concerns about memory, thinking, or daily life, consult a doctor or healthcare professional for further assessment.",
        )}
      </p>
      <RespondentSummary respondent={state.result.respondent} t={t} />
      <AnswerList answers={state.result.answers} t={t} />
      <div className={styles.actions}>
        <button type="button" onClick={() => dispatch({ type: "reset" })}>
          {t("ทำแบบประเมินใหม่", "Start a new assessment")}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            dispatch({ type: "reset" });
            onHome();
          }}
        >
          {t("กลับหน้าหลัก", "Back to home")}
        </button>
      </div>
    </>
  );
}
