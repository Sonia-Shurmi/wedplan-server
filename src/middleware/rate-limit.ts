import type { NextFunction, Request, Response } from "express"

import { AppError } from "../utils/AppError.js"

interface RateLimitOptions {
  /** Length of the counting window in milliseconds. */
  windowMs: number
  /** Maximum number of requests allowed per key inside the window. */
  max: number
  /** Extra hint appended to the 429 message. */
  message?: string
  /** Defaults to the caller's IP address. */
  keyGenerator?: (req: Request) => string
}

interface Bucket {
  count: number
  resetAt: number
}

/**
 * Upper bound on tracked keys, so a flood of unique IPs cannot grow the map
 * without limit. When it is reached the oldest entries are dropped.
 */
const MAX_TRACKED_KEYS = 20_000

/**
 * Small in-memory fixed-window limiter.
 *
 * This is intentionally dependency-free and per-instance: on serverless
 * hosting each warm function keeps its own counters, which blunts bursts but
 * is not a global quota. That is enough for an image proxy; anything stricter
 * should move to a shared store.
 */
export const rateLimit = ({
  windowMs,
  max,
  message = "Too many requests. Please wait a moment and try again.",
  keyGenerator,
}: RateLimitOptions) => {
  const buckets = new Map<string, Bucket>()
  let lastSweep = Date.now()

  const sweep = (now: number) => {
    if (now - lastSweep < windowMs) {
      return
    }

    lastSweep = now

    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(key)
      }
    }
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now()

    sweep(now)

    const key = keyGenerator?.(req) ?? req.ip ?? "unknown"
    const bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      if (buckets.size >= MAX_TRACKED_KEYS) {
        buckets.clear()
      }

      buckets.set(key, { count: 1, resetAt: now + windowMs })

      return next()
    }

    bucket.count += 1

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))

      res.setHeader("Retry-After", String(retryAfter))

      return next(AppError.tooManyRequests(`${message} Retry in ${retryAfter}s.`))
    }

    next()
  }
}
