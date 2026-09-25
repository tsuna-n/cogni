import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getEffectiveStudyConfig, resetStudyConfig, saveStudyConfig } from "../lib/research/study-settings-store.js";

test("admin study settings persist, validate total duration, and restore defaults", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cogni-study-settings-"));
  const previous = process.env.COGNILOAD_DATA_DIR;
  process.env.COGNILOAD_DATA_DIR = directory;
  try {
    const defaults = await getEffectiveStudyConfig();
    assert.equal(defaults.source, "environment");
    const study = { baselineSeconds: 40, postTaskSeconds: 20, maxTaskSeconds: 300, defaultTaskSeconds: 90, protocolVersion: "pilot_2" };
    assert.deepEqual(await saveStudyConfig(study), { study, source: "saved" });
    assert.deepEqual(await getEffectiveStudyConfig(), { study, source: "saved" });
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, "study-settings.json"), "utf8")), { version: 1, study });
    assert.throws(() => saveStudyConfig({ ...study, maxTaskSeconds: 600 }), /maxTaskSeconds/);
    assert.deepEqual(await getEffectiveStudyConfig(), { study, source: "saved" });
    assert.deepEqual(await resetStudyConfig(), defaults);
    assert.deepEqual(await getEffectiveStudyConfig(), defaults);
  } finally {
    if (previous === undefined) delete process.env.COGNILOAD_DATA_DIR;
    else process.env.COGNILOAD_DATA_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
