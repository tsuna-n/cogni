export function researchOverview(records) {
  const ordered = [...records].sort((a, b) => (b.summary?.startedMs || 0) - (a.summary?.startedMs || 0));
  const study = ordered.filter((record) => !record.summary?.testMode && record.summary?.studyGroup !== "device_test");
  const groups = { patient: 0, control: 0, unassigned: 0 };
  for (const record of study) {
    const group = record.summary?.studyGroup;
    groups[Object.hasOwn(groups, group) ? group : "unassigned"]++;
  }
  return {
    total: records.length,
    studyCount: study.length,
    deviceTests: records.length - study.length,
    participants: new Set(study.map((record) => record.participantId).filter(Boolean)).size,
    complete: study.filter((record) => record.summary?.status === "complete").length,
    interrupted: study.filter((record) => record.summary?.status !== "complete").length,
    groups,
    recent: ordered.slice(0, 5),
  };
}
