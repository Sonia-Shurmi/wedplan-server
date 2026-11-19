import type { Request, Response } from "express"

import { dashboardService } from "./dashboard.service.js"

/** Express 5 forwards rejected async handlers to the central error handler. */
const customer = async (req: Request, res: Response) => {
  const data = await dashboardService.customerStats(req.user!)

  res.status(200).json({
    success: true,
    message: "Customer dashboard statistics retrieved successfully.",
    data,
  })
}

const vendor = async (req: Request, res: Response) => {
  const data = await dashboardService.vendorStats(req.user!)

  res.status(200).json({
    success: true,
    message: "Vendor dashboard statistics retrieved successfully.",
    data,
  })
}

const admin = async (_req: Request, res: Response) => {
  const data = await dashboardService.adminStats()

  res.status(200).json({
    success: true,
    message: "Admin dashboard statistics retrieved successfully.",
    data,
  })
}

export const dashboardController = {
  customer,
  vendor,
  admin,
}
