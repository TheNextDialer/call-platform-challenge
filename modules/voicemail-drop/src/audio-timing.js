// audio-timing.js — Audio timing and signal utilities for voicemail drop

const BEEP_FREQ_MIN = 900;
const BEEP_FREQ_MAX = 1100;
const BEEP_AMPLITUDE_THRESHOLD = -30;
const DEFAULT_LEAD_SILENCE_MS = 500;
const DEFAULT_TRAIL_SILENCE_MS = 300;
const BYTES_PER_MS = 8; // 8 kHz mono, 8-bit

/**
 * Detects a voicemail beep tone from a signal reading.
 *
 * @param {{ frequency: number, amplitude: number }} signal
 *   - frequency in Hz (e.g. 1000)
 *   - amplitude in dB (e.g. -15)
 * @returns {boolean} true if the signal matches a VM beep
 */
function detectBeep(signal) {
  if (!signal || typeof signal.frequency !== "number" || typeof signal.amplitude !== "number") {
    throw new Error("Invalid signal: must have numeric frequency and amplitude");
  }

  // BUG: compares frequency against amplitude threshold instead of frequency range,
  //      and amplitude against frequency range instead of amplitude threshold.
  //      frequency is in Hz (e.g. 1000), amplitude is in dB (e.g. -15).
  const frequencyMatch = signal.frequency > BEEP_AMPLITUDE_THRESHOLD;
  const amplitudeMatch = signal.amplitude > BEEP_AMPLITUDE_THRESHOLD;

  return frequencyMatch && amplitudeMatch;
}

/**
 * Creates a silence buffer of the given duration.
 *
 * @param {number} ms — duration in milliseconds
 * @returns {Buffer}
 */
function createSilence(ms) {
  const bytes = Math.max(0, Math.round(ms * BYTES_PER_MS));
  return Buffer.alloc(bytes, 0);
}

/**
 * Builds a playback buffer with optional lead/trail silence padding.
 *
 * Expected order: [leadSilence, message, trailSilence]
 *
 * @param {Buffer} message — the pre-recorded message bytes
 * @param {{ leadSilenceMs?: number, trailSilenceMs?: number }} options
 * @returns {Buffer}
 */
function buildPlaybackBuffer(message, options = {}) {
  if (!Buffer.isBuffer(message)) {
    throw new Error("Message must be a Buffer");
  }

  const leadMs = options.leadSilenceMs ?? DEFAULT_LEAD_SILENCE_MS;
  const trailMs = options.trailSilenceMs ?? DEFAULT_TRAIL_SILENCE_MS;

  const leadSilence = createSilence(leadMs);
  const trailSilence = createSilence(trailMs);

  // BUG: trail silence is placed BEFORE the message instead of after it.
  // Correct order should be: [leadSilence, message, trailSilence]
  // Actual order produced:   [leadSilence, trailSilence, message]
  return Buffer.concat([leadSilence, trailSilence, message]);
}

/**
 * Calculates the duration of a buffer in milliseconds.
 *
 * @param {Buffer} buf
 * @returns {number}
 */
function bufferDurationMs(buf) {
  return buf.length / BYTES_PER_MS;
}

module.exports = {
  detectBeep,
  buildPlaybackBuffer,
  createSilence,
  bufferDurationMs,
  BEEP_FREQ_MIN,
  BEEP_FREQ_MAX,
  BEEP_AMPLITUDE_THRESHOLD,
  BYTES_PER_MS,
};
