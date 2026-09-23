import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { LINE_WINDOW_SAMPLES, summarizeEegWindow } from "../lib/eeg-signal-quality.mjs";

const file = process.argv[2];
if (!file) {
  process.stderr.write("Usage: node scripts/validate-muse-csv.mjs <muse-file.csv>\n");
  process.exit(2);
}

const channelNames = ["TP9", "AF7", "AF8", "TP10"];
const required = [
  "participant_id", "session_id", "study_group", "game_id", "protocol_version",
  "test_mode", "consent_confirmed", "sample_rate_hz", "record_type",
  "timestamp_ms", "received_at_ms", "phase", "channel", "electrode", "packet_index",
  "sample_index", "value_uv", "marker",
];

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (quoted && char === '"' && line[index + 1] === '"') {
      cell += '"';
      index++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("unclosed quoted field");
  cells.push(cell);
  return cells;
}

async function main() {
  const errors = [];
  const warnings = [];
  const samples = [0, 0, 0, 0];
  const missingPackets = [0, 0, 0, 0];
  const duplicatePackets = [0, 0, 0, 0];
  const lastPacketIndices = [null, null, null, null];
  const firstReceivedAt = [null, null, null, null];
  const lastReceivedAt = [null, null, null, null];
  const phaseSamples = Object.fromEntries(["baseline", "task", "rest"].map((phase) => [phase, [0, 0, 0, 0]]));
  const phaseRailSamples = Object.fromEntries(["baseline", "task", "rest"].map((phase) => [phase, [0, 0, 0, 0]]));
  const signal = channelNames.map(() => ({ count: 0, mean: 0, m2: 0, min: Infinity, max: -Infinity, rail: 0, nearRail: 0 }));
  const lineWindows = channelNames.map(() => []);
  const lineQuality = channelNames.map(() => []);
  const markers = new Map();
  const markerAt = new Map();
  const trialStimuli = new Set();
  const trialResponses = new Map();
  let header;
  let column;
  let metadata;
  let lineNumber = 0;
  let eegRows = 0;
  let eventRows = 0;

  const input = createInterface({ input: createReadStream(file, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const rawLine of input) {
    lineNumber++;
    if (!rawLine) continue;
    let row;
    try {
      row = parseCsvLine(lineNumber === 1 ? rawLine.replace(/^\uFEFF/, "") : rawLine);
    } catch (error) {
      errors.push(`line ${lineNumber}: ${error.message}`);
      continue;
    }
    if (!header) {
      header = row;
      column = Object.fromEntries(header.map((name, index) => [name, index]));
      const missing = required.filter((name) => column[name] === undefined);
      if (missing.length) throw new Error(`Missing CSV columns: ${missing.join(", ")}`);
      continue;
    }
    if (row.length !== header.length) {
      errors.push(`line ${lineNumber}: expected ${header.length} cells, got ${row.length}`);
      if (errors.length > 20) break;
      continue;
    }
    const get = (name) => row[column[name]];
    const rowMetadata = ["participant_id", "session_id", "study_group", "game_id", "protocol_version", "test_mode", "consent_confirmed"].map(get);
    if (!metadata) metadata = rowMetadata;
    else if (rowMetadata.some((value, index) => value !== metadata[index])) {
      errors.push(`line ${lineNumber}: session metadata changes within file`);
      if (errors.length > 20) break;
    }
    const type = get("record_type");
    const timestamp = Number(get("timestamp_ms"));
    if (!Number.isFinite(timestamp)) errors.push(`line ${lineNumber}: invalid timestamp`);
    if (type === "eeg") {
      eegRows++;
      const channel = Number(get("electrode"));
      const packetIndex = Number(get("packet_index"));
      const sampleIndex = Number(get("sample_index"));
      const receivedAt = Number(get("received_at_ms"));
      const value = Number(get("value_uv"));
      if (!Number.isInteger(channel) || channel < 0 || channel > 3 || get("channel") !== channelNames[channel]) {
        errors.push(`line ${lineNumber}: invalid EEG channel/electrode`);
        continue;
      }
      if (!Number.isFinite(value) || !Number.isInteger(sampleIndex) || sampleIndex < 0 || sampleIndex > 11 || !Number.isFinite(receivedAt)) {
        errors.push(`line ${lineNumber}: invalid EEG value or sample index`);
      }
      samples[channel]++;
      if (phaseSamples[get("phase")]) phaseSamples[get("phase")][channel]++;
      else errors.push(`line ${lineNumber}: invalid phase`);
      if (Number.isFinite(value)) {
        const stats = signal[channel];
        stats.count++;
        const delta = value - stats.mean;
        stats.mean += delta / stats.count;
        stats.m2 += delta * (value - stats.mean);
        stats.min = Math.min(stats.min, value);
        stats.max = Math.max(stats.max, value);
        if (value <= -999.5 || value >= 999.5) {
          stats.rail++;
          if (phaseRailSamples[get("phase")]) phaseRailSamples[get("phase")][channel]++;
        }
        if (Math.abs(value) >= 950) stats.nearRail++;
        lineWindows[channel].push(value);
        if (lineWindows[channel].length === LINE_WINDOW_SAMPLES) {
          lineQuality[channel].push(summarizeEegWindow(lineWindows[channel]));
          lineWindows[channel] = [];
        }
      }
      if (sampleIndex === 0 && Number.isFinite(receivedAt)) {
        firstReceivedAt[channel] ??= receivedAt;
        lastReceivedAt[channel] = receivedAt;
      }
      if (Number.isInteger(packetIndex) && packetIndex >= 0 && packetIndex <= 65535 && sampleIndex === 0) {
        const previous = lastPacketIndices[channel];
        if (previous !== null) {
          const gap = (packetIndex - previous + 65536) % 65536;
          if (gap === 0) duplicatePackets[channel]++;
          else if (gap > 1 && gap < 1024) missingPackets[channel] += gap - 1;
        }
        lastPacketIndices[channel] = packetIndex;
      }
    } else if (type === "event") {
      eventRows++;
      const marker = get("marker");
      if (!marker) errors.push(`line ${lineNumber}: event without marker`);
      markers.set(marker, (markers.get(marker) || 0) + 1);
      if (!markerAt.has(marker) && Number.isFinite(timestamp)) markerAt.set(marker, timestamp);
      const stimulus = marker.match(/^game_(\d+)_trial_(\d+)_stimulus_/);
      const response = marker.match(/^game_(\d+)_trial_(\d+)_response_(?!prompt)/);
      if (stimulus) trialStimuli.add(`${stimulus[1]}:${stimulus[2]}`);
      if (response) {
        const key = `${response[1]}:${response[2]}`;
        trialResponses.set(key, (trialResponses.get(key) || 0) + 1);
      }
    } else {
      errors.push(`line ${lineNumber}: unknown record_type ${type}`);
    }
    if (errors.length > 20) break;
  }

  if (!header || !metadata) errors.push("file contains no data rows");
  for (let channel = 0; channel < 4; channel++) {
    if (!samples[channel]) errors.push(`missing EEG channel ${channelNames[channel]}`);
    if (missingPackets[channel]) warnings.push(`${channelNames[channel]}: ${missingPackets[channel]} missing packets`);
    if (duplicatePackets[channel]) warnings.push(`${channelNames[channel]}: ${duplicatePackets[channel]} duplicate packets`);
    if (samples[channel] > 1 && signal[channel].m2 === 0) warnings.push(`${channelNames[channel]}: flat signal values`);
    if (samples[channel] && signal[channel].rail / samples[channel] >= 0.01) warnings.push(`${channelNames[channel]}: ${(100 * signal[channel].rail / samples[channel]).toFixed(1)}% samples at ADC limit; check electrode contact`);
    const dominant = lineQuality[channel].filter((window) => window.line50Dominant).length;
    if (dominant >= 2) warnings.push(`${channelNames[channel]}: possible 50 Hz interference in ${dominant}/${lineQuality[channel].length} two-second windows; inspect contact and environment`);
  }
  for (const [trial, count] of trialResponses) {
    if (!trialStimuli.has(trial)) errors.push(`response without stimulus in trial ${trial}`);
    if (count > 1) errors.push(`trial ${trial} has ${count} responses`);
  }
  const unansweredTrials = [...trialStimuli].filter((trial) => !trialResponses.has(trial));

  const isTest = metadata?.[5] === "true";
  const isComplete = markers.has("session_complete");
  const sessionStart = markerAt.get("session_start");
  if (!isTest && metadata?.[2] !== "patient" && metadata?.[2] !== "control") errors.push("research session has no valid study_group");
  if (!isTest && metadata?.[6] !== "true") errors.push("research session has no consent confirmation");
  if (!isTest && !markers.has(`game_${metadata?.[3]}_start`)) errors.push("selected game did not start");
  if (isComplete) {
    for (const marker of ["baseline_start", "baseline_end", "task_start", "task_end", "rest_start", "rest_end"]) {
      if (!markers.has(marker)) errors.push(`complete session missing ${marker}`);
    }
  } else warnings.push("session is incomplete; inspect its stop marker");

  const summary = {
    file,
    participantId: metadata?.[0] || null,
    sessionId: metadata?.[1] || null,
    studyGroup: metadata?.[2] || null,
    gameId: metadata?.[3] || null,
    protocolVersion: metadata?.[4] || null,
    status: isComplete ? "complete" : "incomplete",
    eegRows,
    eventRows,
    channels: Object.fromEntries(channelNames.map((name, index) => [name, {
      samples: samples[index],
      arrivalHz: firstReceivedAt[index] !== null && lastReceivedAt[index] > firstReceivedAt[index]
        ? Number(((samples[index] - 12) * 1000 / (lastReceivedAt[index] - firstReceivedAt[index])).toFixed(1))
        : null,
      missingPackets: missingPackets[index],
      duplicatePackets: duplicatePackets[index],
      minUv: Number.isFinite(signal[index].min) ? Number(signal[index].min.toFixed(2)) : null,
      maxUv: Number.isFinite(signal[index].max) ? Number(signal[index].max.toFixed(2)) : null,
      standardDeviationUv: signal[index].count > 1 ? Number(Math.sqrt(signal[index].m2 / (signal[index].count - 1)).toFixed(2)) : null,
      railSamples: signal[index].rail,
      railPercent: samples[index] ? Number((100 * signal[index].rail / samples[index]).toFixed(1)) : null,
      nearRailPercent: samples[index] ? Number((100 * signal[index].nearRail / samples[index]).toFixed(1)) : null,
      line50Windows: lineQuality[index].length,
      line50DominantWindows: lineQuality[index].filter((window) => window.line50Dominant).length,
      line50MedianAmplitudeUv: lineQuality[index].length ? Number([...lineQuality[index]].map((window) => window.line50AmplitudeUv).sort((a, b) => a - b)[Math.floor(lineQuality[index].length / 2)].toFixed(2)) : null,
      line50MaxAmplitudeUv: lineQuality[index].length ? Number(Math.max(...lineQuality[index].map((window) => window.line50AmplitudeUv)).toFixed(2)) : null,
    }])),
    phaseSamples: Object.fromEntries(Object.entries(phaseSamples).map(([phase, counts]) => [phase, Object.fromEntries(channelNames.map((name, index) => [name, counts[index]]))])),
    phaseRailPercent: Object.fromEntries(Object.entries(phaseRailSamples).map(([phase, counts]) => [phase, Object.fromEntries(channelNames.map((name, index) => [name, phaseSamples[phase][index] ? Number((100 * counts[index] / phaseSamples[phase][index]).toFixed(1)) : null]))])),
    markerTimingMs: Object.fromEntries(["baseline_start", "baseline_end", "task_start", "task_end", "rest_start", "rest_end", "session_complete"].filter((marker) => markerAt.has(marker)).map((marker) => [marker, sessionStart === undefined ? null : markerAt.get(marker) - sessionStart])),
    trialStimuli: trialStimuli.size,
    trialResponses: trialResponses.size,
    unansweredTrials,
    markers: [...markers.keys()].filter((marker) => !marker.includes("_trial_")),
    errors,
    warnings,
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  if (errors.length) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
