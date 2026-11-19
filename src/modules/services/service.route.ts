import { Router } from "express"

import { requireAuth } from "../../middleware/auth.middleware.js"
import { requireRole } from "../../middleware/role.middleware.js"
import { validate } from "../../middleware/validate.js"
import { serviceController } from "./service.controller.js"
import {
  availabilitySchema,
  createServiceSchema,
  listServicesQuerySchema,
  serviceIdParamsSchema,
  updateServiceSchema,
} from "./service.validation.js"

const router = Router()

// Public — static paths must be declared before the `/:id` catch-all.
router.get("/featured", serviceController.getFeatured)
router.get("/", validate({ query: listServicesQuerySchema }), serviceController.list)

// Vendor-owned resources. Every mutation verifies ownership again in the
// service layer, so a forged vendorId in the body cannot help.
router.post(
  "/",
  requireAuth,
  requireRole("vendor"),
  validate({ body: createServiceSchema }),
  serviceController.create,
)

router.get("/mine", requireAuth, requireRole("vendor"), serviceController.getMine)

router.patch(
  "/:id/availability",
  requireAuth,
  requireRole("vendor"),
  validate({ params: serviceIdParamsSchema, body: availabilitySchema }),
  serviceController.setAvailability,
)

// The detail endpoint deliberately requires a session, as in the reference
// marketplace. requireAuth also rejects blocked accounts.
router.get(
  "/:id",
  requireAuth,
  validate({ params: serviceIdParamsSchema }),
  serviceController.getById,
)

router.patch(
  "/:id",
  requireAuth,
  requireRole("vendor"),
  validate({ params: serviceIdParamsSchema, body: updateServiceSchema }),
  serviceController.update,
)

router.delete(
  "/:id",
  requireAuth,
  requireRole("vendor"),
  validate({ params: serviceIdParamsSchema }),
  serviceController.remove,
)

export default router
