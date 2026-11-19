import { Router } from "express"

import { handleStripeWebhook } from "./webhook.controller.js"

/**
 * Mounted with `express.raw({ type: "application/json" })` before the global
 * JSON parser in app.ts, so the signature check sees the exact bytes Stripe
 * signed.
 */
const router = Router()

router.post("/", handleStripeWebhook)

export default router
