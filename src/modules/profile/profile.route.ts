import { Router } from "express"

import { requireAuth } from "../../middleware/auth.middleware.js"
import { validate } from "../../middleware/validate.js"
import { profileController } from "./profile.controller.js"
import { profileUpdateSchema } from "./profile.validation.js"

const router = Router()

router.use(requireAuth)

router.get("/", profileController.getProfile)

router.patch(
  "/",
  validate({ body: profileUpdateSchema }),
  profileController.updateProfile,
)

export default router
