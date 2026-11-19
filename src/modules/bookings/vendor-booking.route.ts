import { Router } from "express"

import { requireAuth } from "../../middleware/auth.middleware.js"
import { requireRole } from "../../middleware/role.middleware.js"
import { validate } from "../../middleware/validate.js"
import { vendorBookingController } from "./booking.controller.js"
import {
  bookingIdParamsSchema,
  listBookingsQuerySchema,
  vendorDecisionSchema,
} from "./booking.validation.js"

const router = Router()

// Vendor inbox. The vendor id is always read from the verified session; the
// service layer additionally checks that the request belongs to this vendor.
router.use(requireAuth, requireRole("vendor"))

router.get(
  "/",
  validate({ query: listBookingsQuerySchema }),
  vendorBookingController.list,
)

router.patch(
  "/:id",
  validate({ params: bookingIdParamsSchema, body: vendorDecisionSchema }),
  vendorBookingController.decide,
)

export default router
