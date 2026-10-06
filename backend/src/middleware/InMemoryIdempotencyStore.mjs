import { logInfo } from "../utilities/logger.mjs";

/**
 * InMemoryIdempotencyStore class
 */
export class InMemoryIdempotencyStore {
  records = new Map();
  ttlMs;
  cleanupIntervalM;

  defaultOptions = {
    ttlMs: 24 * 60 * 60 * 1000,
    cleanupIntervalM: 60,
  };

  /**
   * @param {Object} options Any [optional] override options
   */
  constructor(options = {}) {
    // 24 hours default
    const config = { ...this.defaultOptions, ...options };
    this.ttlMs = config.ttlMs;
    this.cleanupIntervalM = config.cleanupIntervalM;
    // Clean up expired records periodically (hourly)
    this.cleanupIntervalM = setInterval(
      () => this.cleanup(),
      this.cleanupIntervalM * 60 * 1000,
    );
  }

  /**
   * ### Get
   * @param {String} key the key string
   * @returns {Object} keyObject
   */
  get(key) {
    return this.records.get(key);
  }

  /**
   * Store or replace an idempotency record.
   * @param {string} key Record key.
   * @param {Object} record Request record containing a createdAt date.
   * @returns {void}
   */
  set(key, record) {
    this.records.set(key, record);
  }

  /**
   * Remove an idempotency record by its key.
   * @param {string} key Record key.
   * @returns {void}
   */
  delete(key) {
    this.records.delete(key);
  }

  /**
   * Remove records older than the configured time to live.
   * @returns {void}
   */
  cleanup() {
    const cutoff = Date.now() - this.ttlMs;

    for (const [key, record] of this.records.entries()) {
      if (record.createdAt.getTime() < cutoff) {
        if (process.env?.NODE_ENV === "development") {
          console.log(logInfo, `Idempotency Middleware: Key expired - ${key}`);
        }
        this.records.delete(key);
      }
    }
  }

  /**
   * Stop the periodic cleanup timer.
   * @returns {void}
   */
  stop() {
    clearInterval(this.cleanupIntervalM);
  }
}
