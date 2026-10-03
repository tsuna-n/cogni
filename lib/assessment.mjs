/** @typedef {'changed' | 'unchanged' | 'unknown'} Answer */
/** @typedef {'self' | 'spouse' | 'child' | 'relative' | 'caregiver' | 'other'} Respondent */
/** @typedef {{ respondent: Respondent, answers: Answer[] }} AnswerSummary */
/** @typedef {{ stage: 'intro' | 'respondent' | 'questions' | 'review' | 'result', index: number, acknowledged: boolean, respondent: Respondent | null, answers: (Answer | null)[], editing: boolean, result: AnswerSummary | null }} AssessmentState */
/** @typedef {{ type: 'acknowledge', value: boolean } | { type: 'respondent', value: Respondent } | { type: 'answer', value: Answer } | { type: 'edit', index: number } | { type: 'start' | 'begin' | 'next' | 'back' | 'confirm' | 'reset' }} AssessmentAction */

export const questions = [
  {
    id: 1,
    text: "มีการตัดสินใจหรือแก้ปัญหาในชีวิตประจำวันแย่ลงจากเดิมหรือไม่",
    en: "Has judgment or everyday problem solving become worse than before?",
  },
  {
    id: 2,
    text: "มีความสนใจในกิจกรรมหรืองานอดิเรกต่าง ๆ ลดลงหรือไม่",
    en: "Has interest in activities or hobbies decreased?",
  },
  {
    id: 3,
    text: "มีการพูดหรือถามเรื่องเดิมซ้ำ ๆ บ่อยขึ้นหรือไม่",
    en: "Has repeating the same statements or questions become more frequent?",
  },
  {
    id: 4,
    text: "มีความยากลำบากในการเรียนรู้วิธีใช้อุปกรณ์หรือเครื่องมือใหม่ ๆ หรือไม่",
    en: "Is there difficulty learning to use new devices or tools?",
  },
  {
    id: 5,
    text: "มีปัญหาในการจำหรือรับรู้วัน เดือน ปี มากขึ้นหรือไม่",
    en: "Have problems remembering or recognizing the day, month, or year increased?",
  },
  {
    id: 6,
    text: "มีความยากลำบากในการจัดการเรื่องการเงินที่เคยทำได้หรือไม่",
    en: "Is there difficulty managing financial matters that could previously be managed?",
  },
  {
    id: 7,
    text: "มีปัญหาในการจดจำการนัดหมายมากขึ้นหรือไม่",
    en: "Have problems remembering appointments increased?",
  },
  {
    id: 8,
    text: "มีปัญหาด้านความคิดหรือความจำที่รบกวนการดำเนินชีวิตประจำวันหรือไม่",
    en: "Are problems with thinking or memory interfering with daily life?",
  },
];

/** @type {{ value: Answer, th: string, en: string, helpTh: string, helpEn: string }[]} */
export const answerOptions = [
  {
    value: "changed",
    th: "มีการเปลี่ยนแปลง",
    en: "There is a change",
    helpTh: "ความสามารถลดลงหรือมีปัญหาเพิ่มขึ้นจากเดิม",
    helpEn:
      "Ability has declined or problems have increased compared with before",
  },
  {
    value: "unchanged",
    th: "ไม่มีการเปลี่ยนแปลง",
    en: "No change",
    helpTh: "ไม่พบความสามารถลดลงหรือปัญหาเพิ่มขึ้นจากเดิม",
    helpEn:
      "No decline in ability or increase in problems compared with before",
  },
  {
    value: "unknown",
    th: "ไม่ทราบ",
    en: "Unknown",
    helpTh: "ไม่มีข้อมูลเพียงพอที่จะประเมิน",
    helpEn: "There is not enough information to assess this",
  },
];

/** @type {{ value: Respondent, th: string, en: string }[]} */
export const respondentOptions = [
  { value: "self", th: "ผู้รับการประเมินเอง", en: "The person being assessed" },
  { value: "spouse", th: "คู่สมรส", en: "Spouse" },
  { value: "child", th: "บุตร", en: "Child" },
  { value: "relative", th: "ญาติ", en: "Relative" },
  { value: "caregiver", th: "ผู้ดูแล", en: "Caregiver" },
  { value: "other", th: "อื่น ๆ", en: "Other" },
];

/** @returns {AssessmentState} */
export function createAssessmentState() {
  return {
    stage: "intro",
    index: 0,
    acknowledged: false,
    respondent: null,
    answers: questions.map(() => null),
    editing: false,
    result: null,
  };
}

/** @param {(Answer | null)[]} answers @returns {answers is Answer[]} */
export function allAnswered(answers) {
  return (
    answers.length === questions.length &&
    answers.every((answer) =>
      answerOptions.some((option) => option.value === answer),
    )
  );
}

/** Navigation guards are workflow rules only. No scoring or medical interpretation. */
/** @param {AssessmentState} state @param {AssessmentAction} action @returns {AssessmentState} */
export function assessmentReducer(state, action) {
  switch (action.type) {
    case "acknowledge":
      return state.stage === "intro"
        ? { ...state, acknowledged: action.value }
        : state;
    case "start":
      return state.stage === "intro" && state.acknowledged
        ? { ...state, stage: "respondent" }
        : state;
    case "respondent":
      return state.stage === "respondent" &&
        respondentOptions.some((option) => option.value === action.value)
        ? { ...state, respondent: action.value }
        : state;
    case "begin":
      return state.stage === "respondent" && state.respondent
        ? { ...state, stage: "questions" }
        : state;
    case "answer": {
      if (
        state.stage !== "questions" ||
        !answerOptions.some((option) => option.value === action.value)
      )
        return state;
      const answers = [...state.answers];
      answers[state.index] = action.value;
      return { ...state, answers };
    }
    case "next":
      if (state.stage !== "questions" || state.answers[state.index] === null)
        return state;
      if (state.editing || state.index === questions.length - 1)
        return allAnswered(state.answers)
          ? { ...state, stage: "review", editing: false }
          : state;
      return { ...state, index: state.index + 1 };
    case "back":
      if (state.stage === "respondent") return { ...state, stage: "intro" };
      return state.stage === "questions" && !state.editing && state.index > 0
        ? { ...state, index: state.index - 1 }
        : state;
    case "edit":
      return state.stage === "review" &&
        Number.isInteger(action.index) &&
        action.index >= 0 &&
        action.index < questions.length
        ? { ...state, stage: "questions", index: action.index, editing: true }
        : state;
    case "confirm":
      return state.stage === "review" &&
        state.respondent &&
        allAnswered(state.answers)
        ? {
            ...state,
            stage: "result",
            result: {
              respondent: state.respondent,
              answers: [...state.answers],
            },
          }
        : state;
    case "reset":
      return createAssessmentState();
    default:
      return state;
  }
}
