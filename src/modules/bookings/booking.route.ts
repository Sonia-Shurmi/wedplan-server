import { Router } from "express"

import { requireAuth } from "../../middleware/auth.middleware.js"
import { requireRole } from "../../middleware/role.middleware.js"
import { validate } from "../../middleware/validate.js"
import { bookingController } from "./booking.controller.js"
import {
  bookingIdParamsSchema,
  createBookingSchema,
  listBookingsQuerySchema,
} from "./booking.validation.js"

const router = Router()

// A verified session is required for every booking route. Roles are applied
// per endpoint because vendors and admins may also read a single booking they
// are connected to.
router.use(requireAuth)

router.post(
  "/",
  requireRole("customer"),
  validate({ body: createBookingSchema }),
  bookingController.create,
)

router.get(
  "/mine",
  requireRole("customer"),
  validate({ query: listBookingsQuerySchema }),
  bookingController.listMine,
)

router.patch(
  "/:id/cancel",
  requireRole("customer"),
  validate({ params: bookingIdParamsSchema }),
  bookingController.cancel,
)

// Ownership (customer, vendor or admin) is verified again in the service.
router.get(
  "/:id",
  validate({ params: bookingIdParamsSchema }),
  bookingController.getById,
)

export default router
