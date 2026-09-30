import { getUserRole } from "../auth/roles.mjs";
import { MMSE_DOMAINS, mmseTotal } from "../auth/user-profile.mjs";

export function filterOverviewUsers(users, { search = "", role = "all", group = "all" } = {}) {
  const words = search.trim().toLowerCase().split(/\s+/);
  return users.filter((user) => {
    const profile = user.profile || {};
    const text = `${user.email} ${user.name || ""} ${profile.participantId || ""}`.toLowerCase();
    return words.every((word) => text.includes(word)) &&
      (role === "all" || getUserRole(user) === role) &&
      (group === "all" || (["patient", "control"].includes(profile.studyGroup) ? profile.studyGroup : "unassigned") === group);
  });
}

export function userOverview(users) {
  const groups = { patient: 0, control: 0, unassigned: 0 };
  const education = { none: 0, primary: 0, above: 0, unassigned: 0 };
  const ageBands = [
    { label: "10–39", min: 10, max: 39, count: 0 },
    { label: "40–59", min: 40, max: 59, count: 0 },
    { label: "60–79", min: 60, max: 79, count: 0 },
    { label: "80–120", min: 80, max: 120, count: 0 },
  ];
  const ages = [];
  const assessed = [];
  let participants = 0;
  for (const user of users) {
    const profile = user.profile || {};
    groups[Object.hasOwn(groups, profile.studyGroup) ? profile.studyGroup : "unassigned"]++;
    education[Object.hasOwn(education, profile.education) ? profile.education : "unassigned"]++;
    if (typeof profile.participantId === "string" && profile.participantId.trim()) participants++;
    if (Number.isInteger(profile.age) && profile.age >= 10 && profile.age <= 120) {
      ages.push(profile.age);
      ageBands.find((band) => profile.age >= band.min && profile.age <= band.max).count++;
    }
    const validScores = ["none", "primary", "above"].includes(profile.education) &&
      Array.isArray(profile.mmseScores) && profile.mmseScores.length === MMSE_DOMAINS.length &&
      MMSE_DOMAINS.every((domain, index) => (profile.education === "none" && domain.literacy) ||
        (Number.isInteger(profile.mmseScores[index]) && profile.mmseScores[index] >= 0 && profile.mmseScores[index] <= domain.max));
    const score = validScores ? mmseTotal(profile) : null;
    if (score) assessed.push({ user, ...score, percent: 100 * score.total / score.max });
  }
  return {
    count: users.length, participants, groups, education, ageBands, assessed,
    averageAge: ages.length ? ages.reduce((sum, age) => sum + age, 0) / ages.length : null,
    agesKnown: ages.length, agesMissing: users.length - ages.length,
    assessmentsMissing: users.length - assessed.length,
  };
}
