import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryRateLimiter } from "../src/http/rate-limiter.mjs";

describe("in-memory rate limiter", () => {
  it("enforces a scoped limit and resets expired buckets", () => {
    let now = 0;
    const limiter = new InMemoryRateLimiter({ windowMs: 1_000, clock: () => now });
    const attempt = () => limiter.consume({ identity: "127.0.0.1", scope: "login", limit: 2 });

    attempt();
    attempt();
    assert.throws(attempt, (error) => error.status === 429 && error.code === "rate_limited");

    now = 1_000;
    assert.doesNotThrow(attempt);
  });

  it("fails closed when active bucket capacity is exhausted", () => {
    const limiter = new InMemoryRateLimiter({ maxBuckets: 1, clock: () => 0 });
    limiter.consume({ identity: "first", scope: "register", limit: 10 });

    assert.throws(
      () => limiter.consume({ identity: "second", scope: "register", limit: 10 }),
      (error) => error.status === 429 && error.code === "rate_limited",
    );
  });
});
