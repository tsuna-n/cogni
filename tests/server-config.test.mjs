import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { getDataDirectory, getResearchDataDirectory, getStudyConfig, registrationEnabled } from "../lib/server-config.js";

const names = ["STUDY_BASELINE_SECONDS", "STUDY_POST_TASK_SECONDS", "STUDY_MAX_TASK_SECONDS", "STUDY_DEFAULT_TASK_SECONDS", "STUDY_PROTOCOL_VERSION", "REGISTRATION_ENABLED", "COGNILOAD_DATA_DIR", "RESEARCH_DATA_DIR", "NODE_ENV"];

function withEnv(values, run) {
  const before = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    Object.assign(process.env, values);
    run();
  } finally {
    for (const name of names) {
      if (before[name] === undefined) delete process.env[name];
      else process.env[name] = before[name];
    }
  }
}

test("study settings use documented defaults and respect the 600-second ceiling", () => {
  withEnv({}, () => {
    assert.deepEqual(getStudyConfig(), { baselineSeconds: 30, postTaskSeconds: 30, maxTaskSeconds: 540, defaultTaskSeconds: 60, protocolVersion: "alz_web_games_v1" });
  });
  withEnv({ STUDY_BASELINE_SECONDS: "200", STUDY_POST_TASK_SECONDS: "200", STUDY_MAX_TASK_SECONDS: "180", STUDY_DEFAULT_TASK_SECONDS: "45", STUDY_PROTOCOL_VERSION: "pilot_2" }, () => {
    assert.deepEqual(getStudyConfig(), { baselineSeconds: 200, postTaskSeconds: 200, maxTaskSeconds: 180, defaultTaskSeconds: 45, protocolVersion: "pilot_2" });
  });
  withEnv({ STUDY_BASELINE_SECONDS: "300", STUDY_POST_TASK_SECONDS: "300" }, () => assert.throws(getStudyConfig, /leave at least 5 seconds/));
  withEnv({ STUDY_BASELINE_SECONDS: "200", STUDY_POST_TASK_SECONDS: "200", STUDY_MAX_TASK_SECONDS: "540" }, () => assert.throws(getStudyConfig, /STUDY_MAX_TASK_SECONDS/));
  withEnv({ STUDY_DEFAULT_TASK_SECONDS: "0" }, () => assert.throws(getStudyConfig, /STUDY_DEFAULT_TASK_SECONDS/));
  withEnv({ STUDY_PROTOCOL_VERSION: "bad,version" }, () => assert.throws(getStudyConfig, /protocolVersion/));
});

test("registration defaults closed in production and data paths share one setting", () => {
  withEnv({ NODE_ENV: "production" }, () => assert.equal(registrationEnabled(), false));
  withEnv({ NODE_ENV: "development" }, () => assert.equal(registrationEnabled(), true));
  withEnv({ NODE_ENV: "production", REGISTRATION_ENABLED: "true" }, () => assert.equal(registrationEnabled(), true));
  withEnv({ REGISTRATION_ENABLED: "yes" }, () => assert.throws(registrationEnabled, /REGISTRATION_ENABLED/));
  withEnv({ COGNILOAD_DATA_DIR: "/tmp/cogni-primary", RESEARCH_DATA_DIR: "/tmp/cogni-legacy" }, () => {
    assert.equal(getDataDirectory(), path.resolve("/tmp/cogni-primary"));
    assert.equal(getResearchDataDirectory(), path.resolve("/tmp/cogni-primary"));
  });
  withEnv({ RESEARCH_DATA_DIR: "/tmp/cogni-legacy" }, () => {
    assert.equal(getDataDirectory(), path.resolve("data"));
    assert.equal(getResearchDataDirectory(), path.resolve("/tmp/cogni-legacy"));
  });
});
