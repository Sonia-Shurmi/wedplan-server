import { Router } from "express"

import { requireAuth } from "../../middleware/auth.middleware.js"
import { authController } from "./auth.controller.js"

const router = Router()

router.get("/", requireAuth, authController.getMe)

export default router
