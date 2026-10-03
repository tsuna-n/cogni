export const MMSE_DOMAINS = [
  { th: "การรับรู้เวลา", en: "Orientation for time", max: 5 },
  { th: "การรับรู้สถานที่", en: "Orientation for place", max: 5 },
  { th: "การบันทึกความจำ", en: "Registration", max: 3 },
  { th: "สมาธิและการคำนวณ", en: "Attention / calculation", max: 5, literacy: true },
  { th: "การระลึกได้", en: "Recall", max: 3 },
  { th: "การใช้ภาษา", en: "Language tasks", max: 6 },
  { th: "การอ่านและเขียน", en: "Reading / writing", max: 2, literacy: true },
  { th: "การสร้างภาพ", en: "Visuoconstruction", max: 1 },
];

export const PROFILE_KEYS = ["participantId", "age", "hand", "sessionId", "studyGroup", "education", "mmseScores", "notes"];

export class UserProfileError extends Error {}
const fail = (message) => { throw new UserProfileError(message); };
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
function text(value, field, length, multiline = false) {
  if (typeof value !== "string" || value.length > length || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(value)) fail(`Invalid ${field}`);
  return value.trim();
}
function choice(value, field, choices) {
  if (!choices.includes(value)) fail(`Invalid ${field}`);
  return value;
}

export function normalizeUserProfile(body) {
  if (!object(body) || Object.keys(body).some((key) => !["name", "profile", "expectedUpdatedAt"].includes(key))) fail("Invalid profile fields");
  const source = body.profile;
  if (!object(source) || Object.keys(source).some((key) => !PROFILE_KEYS.includes(key))) fail("Invalid profile fields");
  const age = source.age ?? null;
  if (age !== null && (!Number.isInteger(age) || age < 10 || age > 120)) fail("Age must be an integer from 10 to 120");
  const education = choice(source.education ?? "", "education", ["", "none", "primary", "above"]);
  const scores = source.mmseScores ?? MMSE_DOMAINS.map(() => null);
  if (!Array.isArray(scores) || scores.length !== MMSE_DOMAINS.length) fail("Invalid MMSE scores");
  const mmseScores = scores.map((score, index) => {
    const domain = MMSE_DOMAINS[index];
    if (score !== null && (!Number.isInteger(score) || score < 0 || score > domain.max)) fail(`Invalid MMSE score: ${domain.en}`);
    if (education === "none" && domain.literacy && score !== null && score !== 0) fail("Literacy scores must be zero for no formal education");
    return score;
  });
  if (!education && scores.some((score) => score !== null)) fail("Choose education before entering MMSE scores");
  const expectedUpdatedAt = body.expectedUpdatedAt ?? null;
  if (expectedUpdatedAt !== null && (typeof expectedUpdatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expectedUpdatedAt))) fail("Invalid profile revision");
  return {
    name: text(body.name ?? "", "name", 80) || null,
    profile: {
      participantId: text(source.participantId ?? "", "participant ID", 40),
      age,
      hand: choice(source.hand ?? "", "dominant hand", ["", "Right", "Left"]),
      sessionId: text(source.sessionId ?? "", "session ID", 40),
      studyGroup: choice(source.studyGroup ?? "", "study group", ["", "patient", "control"]),
      education, mmseScores,
      notes: text(source.notes ?? "", "notes", 2000, true),
    },
    expectedUpdatedAt,
  };
}

export function mmseTotal(profile) {
  if (!profile?.education || !Array.isArray(profile.mmseScores)) return null;
  const scores = MMSE_DOMAINS.map((domain, index) => profile.education === "none" && domain.literacy ? 0 : profile.mmseScores[index]);
  if (scores.some((score) => !Number.isInteger(score))) return null;
  return { total: scores.reduce((sum, score) => sum + score, 0), max: profile.education === "none" ? 23 : 30 };
}

export function hasSimulatedProfile(profile) {
  return /^\s*MOCK DATA\b/i.test(profile?.notes || "") || (profile?.notes || "").includes("ข้อมูลสมมติสำหรับทดสอบระบบ");
}
