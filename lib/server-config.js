import path from "node:path";

export class StudyConfigError extends Error {}

function boundedInteger(value, name, min, max) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new StudyConfigError(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function integerSetting(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

export function registrationEnabled() {
  const raw = process.env.REGISTRATION_ENABLED;
  if (raw == null || raw === "") return process.env.NODE_ENV !== "production";
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error("REGISTRATION_ENABLED must be true or false");
}

export function getStudyConfig() {
  const baselineSeconds = integerSetting("STUDY_BASELINE_SECONDS", 30, 1, 300);
  const postTaskSeconds = integerSetting("STUDY_POST_TASK_SECONDS", 30, 1, 300);
  const availableTaskSeconds = 600 - baselineSeconds - postTaskSeconds;
  if (availableTaskSeconds < 5) throw new Error("Study phases must leave at least 5 seconds for the task");
  const maxTaskSeconds = integerSetting("STUDY_MAX_TASK_SECONDS", Math.min(540, availableTaskSeconds), 5, availableTaskSeconds);
  const defaultTaskSeconds = integerSetting("STUDY_DEFAULT_TASK_SECONDS", Math.min(60, maxTaskSeconds), 5, maxTaskSeconds);
  return validateStudyConfig({
    baselineSeconds,
    postTaskSeconds,
    maxTaskSeconds,
    defaultTaskSeconds,
    protocolVersion: process.env.STUDY_PROTOCOL_VERSION || "alz_web_games_v1",
  });
}

export function validateStudyConfig(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new StudyConfigError("Study settings must be an object");
  const baselineSeconds = boundedInteger(input.baselineSeconds, "baselineSeconds", 1, 300);
  const postTaskSeconds = boundedInteger(input.postTaskSeconds, "postTaskSeconds", 1, 300);
  const availableTaskSeconds = 600 - baselineSeconds - postTaskSeconds;
  if (availableTaskSeconds < 5) throw new StudyConfigError("Study phases must leave at least 5 seconds for the task");
  const maxTaskSeconds = boundedInteger(input.maxTaskSeconds, "maxTaskSeconds", 5, availableTaskSeconds);
  const defaultTaskSeconds = boundedInteger(input.defaultTaskSeconds, "defaultTaskSeconds", 5, maxTaskSeconds);
  const protocolVersion = input.protocolVersion;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(protocolVersion)) {
    throw new StudyConfigError("protocolVersion must be 1–64 letters, digits, dots, underscores or hyphens");
  }
  return { baselineSeconds, postTaskSeconds, maxTaskSeconds, defaultTaskSeconds, protocolVersion };
}

export function getDataDirectory() {
  return path.resolve(/* turbopackIgnore: true */ process.env.COGNILOAD_DATA_DIR || path.join(process.cwd(), "data"));
}

export function getResearchDataDirectory() {
  return path.resolve(/* turbopackIgnore: true */ process.env.COGNILOAD_DATA_DIR || process.env.RESEARCH_DATA_DIR || path.join(process.cwd(), "data"));
}
