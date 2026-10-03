import { allAnswered, respondentOptions } from "../assessment.mjs";

export class FormValidationError extends Error {}
const fail = () => { throw new FormValidationError("Invalid form data"); };
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const text = (value, max) => typeof value === "string" && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);

export function validateForm(key, value) {
  if (!object(value)) fail();
  if (key === "screeningDraft") {
    if (!['intro', 'respondent', 'questions', 'review', 'result'].includes(value.stage) ||
      !Number.isInteger(value.index) || value.index < 0 || value.index > 7 ||
      typeof value.acknowledged !== "boolean" || typeof value.editing !== "boolean" ||
      (value.respondent !== null && !respondentOptions.some((option) => option.value === value.respondent)) ||
      !Array.isArray(value.answers) || value.answers.length !== 8 ||
      value.answers.some((answer) => answer !== null && !['changed', 'unchanged', 'unknown'].includes(answer))) fail();
    return { stage: value.stage, index: value.index, acknowledged: value.acknowledged, editing: value.editing, respondent: value.respondent, answers: value.answers, result: null };
  }
  if (key === "setup") {
    if (Object.keys(value).some((field) => !['participant', 'sessionId', 'studyGroup', 'condition', 'taskSeconds', 'consent', 'markerText', 'baselineSeconds', 'postTaskSeconds', 'protocolVersion'].includes(field)) ||
      !text(value.participant, 40) || !text(value.sessionId, 37) || !['', 'patient', 'control'].includes(value.studyGroup) ||
      !text(value.condition, 80) || typeof value.consent !== "boolean" || !text(value.markerText ?? '', 200) ||
      !['number', 'string'].includes(typeof value.taskSeconds) || !text(String(value.taskSeconds), 8) ||
      (value.taskSeconds !== '' && (!Number.isInteger(Number(value.taskSeconds)) || Number(value.taskSeconds) < 0 || Number(value.taskSeconds) > 600)) ||
      !Number.isInteger(value.baselineSeconds) || value.baselineSeconds < 1 || value.baselineSeconds > 300 ||
      !Number.isInteger(value.postTaskSeconds) || value.postTaskSeconds < 1 || value.postTaskSeconds > 300 ||
      !text(value.protocolVersion, 64) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value.protocolVersion)) fail();
    return value;
  }
  if (key === "workspace") {
    if (Object.keys(value).some((field) => !['fields', 'journey', 'history', 'markers'].includes(field))) fail();
    if (value.fields && (!object(value.fields) || Object.keys(value.fields).length > 200 || Object.entries(value.fields).some(([field, answer]) => !text(field, 150) || !(typeof answer === 'boolean' || text(answer, 4000))))) fail();
    if (value.journey && !object(value.journey)) fail();
    if (value.history && (!Array.isArray(value.history) || value.history.length > 500)) fail();
    if (value.markers && (!Array.isArray(value.markers) || value.markers.length > 5000 || value.markers.some((marker) =>
      !object(marker) || !text(marker.label, 80) || !Number.isSafeInteger(marker.timestamp) || marker.timestamp < 0 ||
      !text(marker.recordId, 80) || !text(marker.participant, 40) || !text(marker.sessionId, 40)))) fail();
    return value;
  }
  fail();
}

export function validateScreening(value) {
  if (!object(value) || !text(value.id, 80) || !/^[a-zA-Z0-9-]{1,80}$/.test(value.id) || value.acknowledged !== true ||
    !respondentOptions.some((option) => option.value === value.respondent) || !Array.isArray(value.answers) || !allAnswered(value.answers) ||
    Object.keys(value).some((key) => !['id', 'acknowledged', 'respondent', 'answers'].includes(key))) fail();
  return { id: value.id, acknowledged: true, respondent: value.respondent, answers: [...value.answers], version: 'preliminary-v1' };
}
