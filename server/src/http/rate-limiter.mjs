import { HttpError } from "../lib/errors.mjs";

const RATE_LIMIT_MESSAGE = "Too many requests. Try again shortly.";

export class InMemoryRateLimiter {
  #buckets = new Map();
  #clock;
  #maxBuckets;
  #nextSweepAt = 0;
  #windowMs;

  constructor({ windowMs = 60_000, maxBuckets = 10_000, clock = Date.now } = {}) {
    if (!Number.isInteger(windowMs) || windowMs < 1) throw new TypeError("windowMs must be a positive integer");
    if (!Number.isInteger(maxBuckets) || maxBuckets < 1) throw new TypeError("maxBuckets must be a positive integer");
    if (typeof clock !== "function") throw new TypeError("clock must be a function");
    this.#windowMs = windowMs;
    this.#maxBuckets = maxBuckets;
    this.#clock = clock;
  }

  consume({ identity, scope, limit }) {
    if (typeof identity !== "string" || !identity || typeof scope !== "string" || !scope) {
      throw new TypeError("identity and scope are required");
    }
    if (!Number.isInteger(limit) || limit < 1) throw new TypeError("limit must be a positive integer");

    const now = this.#clock();
    if (now >= this.#nextSweepAt || this.#buckets.size >= this.#maxBuckets) this.#sweep(now);

    const key = `${identity}:${scope}`;
    const current = this.#buckets.get(key);
    if (!current || current.resetAt <= now) {
      if (!current && this.#buckets.size >= this.#maxBuckets) this.#reject();
      this.#buckets.set(key, { count: 1, resetAt: now + this.#windowMs });
      return;
    }

    current.count += 1;
    if (current.count > limit) this.#reject();
  }

  #reject() {
    throw new HttpError(429, RATE_LIMIT_MESSAGE, "rate_limited");
  }

  #sweep(now) {
    for (const [key, bucket] of this.#buckets) {
      if (bucket.resetAt <= now) this.#buckets.delete(key);
    }
    this.#nextSweepAt = now + this.#windowMs;
  }
}
