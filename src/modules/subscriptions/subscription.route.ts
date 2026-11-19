import { Router } from "express"

import { requireAuth } from "../../middleware/auth.middleware.js"
import { requireRole } from "../../middleware/role.middleware.js"
import { subscriptionController } from "./subscription.controller.js"

const router = Router()

router.use(requireAuth)

// Any authenticated user may read their own billing state.
router.get("/me", subscriptionController.getStatus)

// The vendor is taken from the verified token; the body is intentionally
// ignored so no client can choose a plan, amount or target account.
router.post("/checkout", requireRole("vendor"), subscriptionController.createCheckout)

export default router
