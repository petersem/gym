import { useEffect, useRef } from "react";

export const RETRY_INTERVAL_MS = 5000;

/**
 * Call `retry` repeatedly while `active` is true, so a view that failed to
 * load (for example because the service or database was unavailable) recovers
 * by itself. Polling stops as soon as `active` becomes false.
 *
 * @param {boolean} active Whether retries should run.
 * @param {() => void} retry Function that attempts the load again.
 * @param {number} [intervalMs] Delay between attempts.
 */
export function useRetryWhile(active, retry, intervalMs = RETRY_INTERVAL_MS) {
  const latest = useRef(retry);
  useEffect(() => {
    latest.current = retry;
  });
  useEffect(() => {
    if (!active) {
      return;
    }
    const id = setInterval(() => latest.current(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
}
