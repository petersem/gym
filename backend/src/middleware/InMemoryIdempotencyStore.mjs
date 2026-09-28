import { logDanger, logWarning, logInfo } from "../utilities/logger.mjs";


/**
 * InMemoryIdempotencyStore class
 */
export class InMemoryIdempotencyStore {
  records = new Map();
  ttlMs;
  cleanupIntervalM;

  defaultOptions = {
    ttlMs: 24 * 60 * 60 * 1000,
    cleanupIntervalM: 60
  };

  /**
   * @param {Object} options Any [optional] override options 
   */
  constructor(options = {}) {  // 24 hours default
    const config = { ...this.defaultOptions, ...options}
    this.ttlMs = config.ttlMs;
    this.cleanupIntervalM = config.cleanupIntervalM;
    // Clean up expired records periodically (hourly)
    this.cleanupIntervalM = setInterval(() => this.cleanup(), this.cleanupIntervalM * 60 * 1000);
  }

  /**
   * ### Get
   * @param {String} key the key string 
   * @returns {Object} keyObject 
   */
  get(key) {
    return this.records.get(key);
  }

  set(key, record) {
    this.records.set(key, record);
  }

  delete(key) {
    this.records.delete(key);
  }

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

  stop() {
    clearInterval(this.cleanupIntervalM);
  }
}

