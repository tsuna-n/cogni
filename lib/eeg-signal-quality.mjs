export const EEG_SAMPLE_RATE = 256;
export const LINE_WINDOW_SAMPLES = EEG_SAMPLE_RATE * 2;

// A two-second Muse window contains exactly 100 cycles at 50 Hz. This is a
// display/quality estimate only; the recorded EEG is never filtered here.
export function summarizeEegWindow(samples) {
  if (samples.length !== LINE_WINDOW_SAMPLES || samples.some((value) => !Number.isFinite(value))) return null;
  const count = samples.length;
  const meanUv = samples.reduce((sum, value) => sum + value, 0) / count;
  let variance = 0;
  let real = 0;
  let imaginary = 0;
  for (let index = 0; index < count; index++) {
    const centered = samples[index] - meanUv;
    const angle = 2 * Math.PI * 50 * index / EEG_SAMPLE_RATE;
    variance += centered * centered;
    real += centered * Math.cos(angle);
    imaginary += centered * Math.sin(angle);
  }
  variance /= count;
  const standardDeviationUv = Math.sqrt(variance);
  const line50AmplitudeUv = 2 * Math.hypot(real, imaginary) / count;
  const line50VariancePercent = variance ? Math.min(100, 50 * line50AmplitudeUv ** 2 / variance) : 0;
  // A visible, sustained 50 Hz component is flagged as a possible mains
  // artifact. This heuristic is not a clinical EEG quality criterion.
  const line50Dominant = line50AmplitudeUv >= 15 && line50VariancePercent >= 25;
  return { meanUv, standardDeviationUv, line50AmplitudeUv, line50VariancePercent, line50Dominant };
}
