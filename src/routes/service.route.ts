
import { Router } from "express"

import { serviceController } from "../modules/services/service.controller.js"

const router = Router()

router.get("/featured", serviceController.getFeaturedServices)

export default router
