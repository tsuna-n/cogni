"use client";

import { useEffect, useReducer, useRef } from "react";
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

/** @param {{ locale: string, enabled: boolean, onHome: () => void }} props */
export default function PreliminaryAssessment({ locale, enabled, onHome }) {
  const [state, dispatch] = useReducer(
    assessmentReducer,
    undefined,
    createAssessmentState,
  );
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

  const props = { state, dispatch, t };
  return (
    <div
      className={styles.assessment}
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
      {state.stage === "review" && <AssessmentReview {...props} />}
      {state.stage === "result" && (
        <AssessmentResult {...props} onHome={onHome} />
      )}
    </div>
  );
}
