
import type { Request, Response } from "express"

import { serviceService } from "./service.service.js"

const getFeaturedServices = async (_req: Request, res: Response) => {
  try {
    const services = await serviceService.getFeaturedServices()

    res.status(200).json({
      success: true,
      message: "Featured services retrieved successfully",
      data: services,
    })
  } catch (error) {
    console.error("Error retrieving featured services:", error)

    res.status(500).json({
      success: false,
      message: "Failed to retrieve featured services",
    })
  }
}

export const serviceController = {
  getFeaturedServices,
}
