import {
  answerOptions,
  respondentOptions,
  questions,
} from "../../../lib/assessment.mjs";
import styles from "./assessment.module.css";

/** @typedef {(th: string, en: string) => string} Translate */
/** @typedef {import('../../../lib/assessment.mjs').AssessmentState} State */
/** @typedef {import('../../../lib/assessment.mjs').AssessmentAction} Action */
/** @typedef {{ state: State, dispatch: import('react').Dispatch<Action>, t: Translate }} StepProps */

/** @param {StepProps} props */
export function AssessmentIntro({ state, dispatch, t }) {
  return (
    <>
      <p>
        {t(
          "แบบประเมินนี้ใช้สำหรับคัดกรองเบื้องต้นเกี่ยวกับการเปลี่ยนแปลงด้านความจำ ความคิด การตัดสินใจ และการดำเนินชีวิตประจำวัน โดยเปรียบเทียบความสามารถในปัจจุบันกับในอดีต",
          "This assessment provides preliminary screening for changes in memory, thinking, judgment, and daily life by comparing current ability with past ability.",
        )}
      </p>
      <div className={styles.infoGrid}>
        <article className={styles.infoBox}>
          <h3>{t("จุดประสงค์", "Purpose")}</h3>
          <p>
            {t("ใช้สำหรับการคัดกรองเบื้องต้น", "For preliminary screening")}
          </p>
        </article>
        <article className={styles.infoBox}>
          <h3>{t("วิธีตอบ", "How to answer")}</h3>
          <ul>
            <li>
              {t(
                "พิจารณาการเปลี่ยนแปลงจากความสามารถเดิม",
                "Consider changes from previous ability",
              )}
            </li>
            <li>
              {t(
                "เลือกเพียง 1 คำตอบในแต่ละข้อ",
                "Choose one answer for each question",
              )}
            </li>
          </ul>
        </article>
        <article className={styles.infoBox}>
          <h3>{t("ข้อควรทราบ", "Please note")}</h3>
          <ul>
            <li>
              {t(
                "ผลนี้ไม่สามารถใช้ยืนยันหรือวินิจฉัยโรคอัลไซเมอร์หรือภาวะสมองเสื่อมได้",
                "These results cannot confirm or diagnose Alzheimer’s disease or dementia.",
              )}
            </li>
            <li>
              {t(
                "หากพบความเสี่ยงควรรับการประเมินเพิ่มเติมจากแพทย์หรือบุคลากรทางการแพทย์",
                "If a risk is identified, seek further assessment from a doctor or healthcare professional.",
              )}
            </li>
          </ul>
        </article>
      </div>
      <label className={styles.acknowledgement}>
        <input
          type="checkbox"
          checked={state.acknowledged}
          onChange={(event) =>
            dispatch({ type: "acknowledge", value: event.target.checked })
          }
        />
        <span>
          {t(
            "ฉันได้อ่านและเข้าใจคำชี้แจงแล้ว",
            "I have read and understood the instructions",
          )}
        </span>
      </label>
      <div className={styles.actions}>
        <button
          type="button"
          disabled={!state.acknowledged}
          onClick={() => dispatch({ type: "start" })}
        >
          {t("เริ่มทำแบบประเมิน", "Start assessment")}
        </button>
      </div>
    </>
  );
}

/** @param {{ name: string, value: string, checked: boolean, label: string, help?: string, onChange: () => void }} props */
export function AnswerOption({ name, value, checked, label, help, onChange }) {
  const id = `${name}-${value}`;
  return (
    <label
      htmlFor={id}
      className={`${styles.option} ${checked ? styles.selected : ""}`}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        aria-labelledby={`${id}-label`}
        aria-describedby={help ? `${id}-help` : undefined}
      />
      <span>
        <strong id={`${id}-label`}>{label}</strong>
        {help && (
          <span id={`${id}-help`} className={styles.help}>
            {help}
          </span>
        )}
      </span>
    </label>
  );
}

/** @param {StepProps} props */
export function RespondentType({ state, dispatch, t }) {
  return (
    <>
      <p id="respondent-help">
        {t(
          "ข้อมูลนี้ใช้เพื่อประกอบแบบประเมินเท่านั้น",
          "This information is used only to provide context for the assessment.",
        )}
      </p>
      <fieldset
        className={styles.options}
        aria-labelledby="assessment-heading"
        aria-describedby="respondent-help"
      >
        {respondentOptions.map((option) => (
          <AnswerOption
            key={option.value}
            name="respondent"
            value={option.value}
            checked={state.respondent === option.value}
            label={t(option.th, option.en)}
            onChange={() =>
              dispatch({ type: "respondent", value: option.value })
            }
          />
        ))}
      </fieldset>
      <div className={styles.actions}>
        <button
          type="button"
          className="secondary"
          onClick={() => dispatch({ type: "back" })}
        >
          {t("ย้อนกลับ", "Back")}
        </button>
        <button
          type="button"
          disabled={!state.respondent}
          onClick={() => dispatch({ type: "begin" })}
        >
          {t("ถัดไป", "Next")}
        </button>
      </div>
    </>
  );
}

/** @param {{ index: number, t: Translate }} props */
export function ProgressBar({ index, t }) {
  const current = index + 1;
  return (
    <div className={styles.progress}>
      <p>
        {t(
          `ข้อ ${current} จาก ${questions.length}`,
          `Question ${current} of ${questions.length}`,
        )}
      </p>
      <progress
        value={current}
        max={questions.length}
        aria-label={t("ความคืบหน้าของแบบประเมิน", "Assessment progress")}
        aria-valuetext={`${current} / ${questions.length} (${(current / questions.length) * 100}%)`}
      />
    </div>
  );
}

/** @param {StepProps} props */
export function QuestionCard({ state, dispatch, t }) {
  return (
    <>
      <p id="question-help" className={styles.questionHelp}>
        {t(
          "โปรดเปรียบเทียบความสามารถหรือพฤติกรรมในปัจจุบันกับในอดีต",
          "Please compare current ability or behavior with the past",
        )}
      </p>
      <fieldset
        className={styles.options}
        aria-labelledby="assessment-heading"
        aria-describedby="question-help"
      >
        {answerOptions.map((option) => (
          <AnswerOption
            key={option.value}
            name={`question-${questions[state.index].id}`}
            value={option.value}
            checked={state.answers[state.index] === option.value}
            label={t(option.th, option.en)}
            help={t(option.helpTh, option.helpEn)}
            onChange={() => dispatch({ type: "answer", value: option.value })}
          />
        ))}
      </fieldset>
      <div className={styles.actions}>
        {!state.editing && state.index > 0 && (
          <button
            type="button"
            className="secondary"
            onClick={() => dispatch({ type: "back" })}
          >
            {t("ย้อนกลับ", "Back")}
          </button>
        )}
        <button
          type="button"
          disabled={state.answers[state.index] === null}
          onClick={() => dispatch({ type: "next" })}
        >
          {state.editing
            ? t("กลับไปตรวจสอบคำตอบ", "Return to review")
            : state.index === questions.length - 1
              ? t("ตรวจสอบคำตอบ", "Review answers")
              : t("ถัดไป", "Next")}
        </button>
      </div>
    </>
  );
}
