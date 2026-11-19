import { Router } from "express"

import { requireAuth } from "../../middleware/auth.middleware.js"
import { requireRole } from "../../middleware/role.middleware.js"
import { dashboardController } from "./dashboard.controller.js"

/** Customer and vendor dashboards live under `/api/dashboard`. */
export const dashboardRouter = Router()

dashboardRouter.use(requireAuth)

dashboardRouter.get(
  "/customer",
  requireRole("customer"),
  dashboardController.customer,
)

dashboardRouter.get(
  "/vendor",
  requireRole("vendor"),
  dashboardController.vendor,
)

/** Marketplace-wide statistics live under `/api/admin/stats`. */
export const adminStatsRouter = Router()

adminStatsRouter.use(requireAuth, requireRole("admin"))
adminStatsRouter.get("/", dashboardController.admin)
