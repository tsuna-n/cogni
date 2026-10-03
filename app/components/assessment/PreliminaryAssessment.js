"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { flushForms, queueFormSave } from "../formPersistence";
import {
  assessmentReducer,
  createAssessmentState,
  questions,
} from "../../../lib/assessment.mjs";
import {
  AssessmentIntro,
  RespondentType,
  QuestionCard,
  ProgressBar,
} from "./AssessmentSteps";
import { AssessmentReview, AssessmentResult } from "./AssessmentSummary";
import styles from "./assessment.module.css";

/** @param {{ locale: string, enabled: boolean, onHome: () => void, accountEmail: string, initialState?: import('../../../lib/assessment.mjs').AssessmentState, onComplete: () => void }} props */
export default function PreliminaryAssessment({ locale, enabled, onHome, accountEmail, initialState, onComplete }) {
  const [state, dispatch] = useReducer(
    assessmentReducer,
    initialState,
    (saved) => saved ? { ...saved, stage: saved.stage === 'result' ? 'review' : saved.stage, result: null } : createAssessmentState(),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const submissionId = useRef('');
  useEffect(() => {
    if (accountEmail) queueFormSave(accountEmail, 'screeningDraft', state);
  }, [accountEmail, state]);

  /** @param {import('../../../lib/assessment.mjs').AssessmentAction} action */
  function persistDispatch(action) {
    if (saving) return;
    if (action.type !== 'confirm') {
      submissionId.current = '';
      dispatch(action);
      return;
    }
    setSaving(true);
    setSaveError(false);
    submissionId.current ||= crypto.randomUUID();
    flushForms().then(async () => {
      const response = await fetch('/api/forms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: submissionId.current, acknowledged: state.acknowledged, respondent: state.respondent, answers: state.answers }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      dispatch(action);
      onComplete();
      window.dispatchEvent(new Event('screening-saved'));
    }).catch(() => setSaveError(true)).finally(() => setSaving(false));
  }
  const headingRef = useRef(/** @type {HTMLHeadingElement | null} */ (null));
  /** @type {import('./AssessmentSteps').Translate} */
  const t = (th, en) => (locale === "th" ? th : en);
  const titles = {
    intro: t("แบบคัดกรองเบื้องต้น", "Preliminary screening"),
    respondent: t(
      "ผู้ตอบแบบประเมินคือใคร?",
      "Who is answering the assessment?",
    ),
    questions: t(questions[state.index].text, questions[state.index].en),
    review: t("ตรวจสอบคำตอบ", "Review answers"),
    result: t("ผลการคัดกรองเบื้องต้น", "Preliminary screening results"),
  };

  useEffect(() => {
    if (!enabled) return;
    headingRef.current?.focus({ preventScroll: true });
    // Keep the question counter visible below the workspace's sticky header.
    headingRef.current?.parentElement?.scrollIntoView({
      block: "start",
      behavior: "instant",
    });
  }, [enabled, state.stage, state.index]);

  const props = { state, dispatch: persistDispatch, t };
  return (
    <div
      className={styles.assessment}
      data-persist-own
      data-no-translate
      lang={locale === "th" ? "th" : "en"}
    >
      {state.stage === "questions" && <ProgressBar index={state.index} t={t} />}
      <h2
        id="assessment-heading"
        ref={headingRef}
        tabIndex={-1}
        className={
          state.stage === "questions" ? styles.questionTitle : undefined
        }
      >
        {titles[state.stage]}
      </h2>
      {state.stage === "intro" && <AssessmentIntro {...props} />}
      {state.stage === "respondent" && <RespondentType {...props} />}
      {state.stage === "questions" && <QuestionCard {...props} />}
      {state.stage === "review" && <AssessmentReview {...props} saving={saving} />}
      {saving && <p role="status">{t('กำลังบันทึกคำตอบ…', 'Saving answers…')}</p>}
      {saveError && <p role="alert">{t('บันทึกคำตอบไม่สำเร็จ กรุณากดยืนยันอีกครั้ง', 'Could not save answers. Please confirm again.')}</p>}
      {state.stage === "result" && (
        <AssessmentResult {...props} onHome={onHome} />
      )}
    </div>
  );
}
