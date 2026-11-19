import { Router } from "express"

import { requireAuth } from "../../middleware/auth.middleware.js"
import { requireRole } from "../../middleware/role.middleware.js"
import { validate } from "../../middleware/validate.js"
import { adminServiceController } from "../services/service.controller.js"
import {
  adminListServicesQuerySchema,
  adminUpdateServiceSchema,
  serviceIdParamsSchema,
} from "../services/service.validation.js"

const router = Router()

// Admin-only moderation. The role is read from the database by requireAuth,
// never from the request body or the JWT's stale claims.
router.use(requireAuth, requireRole("admin"))

router.get(
  "/",
  validate({ query: adminListServicesQuerySchema }),
  adminServiceController.list,
)

router.patch(
  "/:id",
  validate({ params: serviceIdParamsSchema, body: adminUpdateServiceSchema }),
  adminServiceController.update,
)

router.delete(
  "/:id",
  validate({ params: serviceIdParamsSchema }),
  adminServiceController.remove,
)

export default router
