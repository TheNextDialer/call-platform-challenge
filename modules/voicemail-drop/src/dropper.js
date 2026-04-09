// dropper.js — Voicemail drop orchestrator

const { detectBeep, buildPlaybackBuffer, bufferDurationMs } = require("./audio-timing");

const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BEEP_TIMEOUT_MS = 10000;
const DEFAULT_CONFIRM_TIMEOUT_MS = 5000;
const MESSAGE_LENGTH_LIMIT = 45; // seconds — legacy threshold (incorrectly used)

/**
 * Simulates sending audio over a call channel.
 *
 * @param {string} callId
 * @param {Buffer} buffer
 * @returns {Promise<{ sent: boolean, timestamp: number }>}
 */
async function sendAudio(callId, buffer) {
  return { sent: true, timestamp: Date.now() };
}

/**
 * Simulates waiting for a confirmation callback from the VM system.
 *
 * @param {string} callId
 * @param {number} timeoutMs
 * @returns {Promise<{ confirmed: boolean }>}
 */
async function waitForConfirmation(callId, timeoutMs) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ confirmed: true }), 50);
  });
}

/**
 * Simulates listening on a call for a beep signal.
 *
 * @param {string} callId
 * @param {number} timeoutMs
 * @returns {Promise<{ frequency: number, amplitude: number } | null>}
 */
async function listenForSignal(callId, timeoutMs) {
  return { frequency: 1000, amplitude: -15 };
}

class VoicemailDropper {
  /**
   * @param {{ baseDelayMs?: number, maxRetries?: number, beepTimeoutMs?: number, confirmTimeoutMs?: number }} config
   */
  constructor(config = {}) {
    this.baseDelayMs = config.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.beepTimeoutMs = config.beepTimeoutMs ?? DEFAULT_BEEP_TIMEOUT_MS;
    this.confirmTimeoutMs = config.confirmTimeoutMs ?? DEFAULT_CONFIRM_TIMEOUT_MS;
    this.drops = new Map();
  }

  /**
   * Orchestrates a voicemail drop: detect beep, play message, confirm delivery.
   *
   * @param {string} callId — unique call identifier
   * @param {Buffer} message — pre-recorded audio message
   * @param {{ leadSilenceMs?: number, trailSilenceMs?: number, vmSystemMaxSeconds?: number }} options
   * @returns {Promise<{ status: string, callId: string, attempts: number, error?: string }>}
   */
  async drop(callId, message, options = {}) {
    const result = {
      status: "pending",
      callId,
      attempts: 0,
      error: null,
    };

    // BUG 2: Checks message.length (byte count of the pre-recorded message) against
    // a hard-coded threshold instead of comparing message duration against
    // options.vmSystemMaxSeconds. A 30-second message should be fine on a
    // 60-second VM system, but this checks raw byte length.
    const messageDurationSec = bufferDurationMs(message) / 1000;
    if (message.length > MESSAGE_LENGTH_LIMIT) {
      result.status = "rejected";
      result.error = `Message too long: ${message.length} exceeds limit ${MESSAGE_LENGTH_LIMIT}`;
      return result;
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      result.attempts = attempt + 1;

      // BUG 1: Retry delay is attempt * baseDelay. On the first retry (attempt=0),
      // this produces 0ms delay — no backoff at all.
      if (attempt > 0) {
        const delay = attempt * this.baseDelayMs;
        await this._sleep(delay);
      }

      try {
        // Step 1: Listen for beep
        const signal = await listenForSignal(callId, this.beepTimeoutMs);
        if (!signal) {
          result.error = "No signal detected within timeout";
          continue;
        }

        const isBeep = detectBeep(signal);
        if (!isBeep) {
          result.error = "Signal did not match beep pattern";
          continue;
        }

        // Step 2: Build and send the playback buffer
        const buffer = buildPlaybackBuffer(message, {
          leadSilenceMs: options.leadSilenceMs,
          trailSilenceMs: options.trailSilenceMs,
        });

        const sendResult = await sendAudio(callId, buffer);
        if (!sendResult.sent) {
          result.error = "Failed to send audio";
          continue;
        }

        // BUG 3: Status is set to "delivered" immediately after sending,
        // before waiting for confirmation. Should stay "pending" until
        // confirmation is received.
        result.status = "delivered";
        this.drops.set(callId, { ...result });

        // Step 3: Wait for confirmation
        const confirmation = await waitForConfirmation(callId, this.confirmTimeoutMs);

        if (confirmation.confirmed) {
          result.error = null;
          this.drops.set(callId, { ...result });
          return result;
        } else {
          result.status = "unconfirmed";
          result.error = "Delivery confirmation not received";
        }
      } catch (err) {
        result.error = err.message;
      }
    }

    if (result.status !== "delivered") {
      result.status = "failed";
    }
    this.drops.set(callId, { ...result });
    return result;
  }

  /**
   * Returns the current status of a drop.
   *
   * @param {string} callId
   * @returns {{ status: string, callId: string, attempts: number, error?: string } | null}
   */
  getStatus(callId) {
    return this.drops.get(callId) || null;
  }

  /**
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = {
  VoicemailDropper,
  MESSAGE_LENGTH_LIMIT,
};
