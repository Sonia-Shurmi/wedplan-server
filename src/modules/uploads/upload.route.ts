import { Router } from "express"

import { requireAuth } from "../../middleware/auth.middleware.js"
import { rateLimit } from "../../middleware/rate-limit.js"
import { validate } from "../../middleware/validate.js"
import { uploadController } from "./upload.controller.js"
import { uploadBodySchema } from "./upload.validation.js"

const router = Router()

/**
 * Sign-up avatars are uploaded before an account exists, so this route is
 * public. Keep the limit tight: 10 uploads per minute per IP.
 */
router.post(
  "/public",
  rateLimit({ windowMs: 60_000, max: 10 }),
  validate({ body: uploadBodySchema }),
  uploadController.uploadPublic,
)

/**
 * Vendor and profile images: 30 uploads per minute per signed-in account.
 * requireAuth runs first so the limiter can key on the verified user id
 * instead of a spoofable header.
 */
router.post(
  "/",
  requireAuth,
  rateLimit({
    windowMs: 60_000,
    max: 30,
    keyGenerator: (req) => req.user?.id ?? req.ip ?? "unknown",
  }),
  validate({ body: uploadBodySchema }),
  uploadController.uploadAuthenticated,
)

export default router
