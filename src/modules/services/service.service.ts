
import type { Document } from "mongodb"

import { getDB } from "../../config/db.js"
import type { Service } from "./service.interface.js"

const getFeaturedServices = async (): Promise<Service[]> => {
  const serviceCollection = getDB().collection<Service & Document>(
    "services",
  )

  const services = await serviceCollection
    .find({
      status: "approved",
      isActive: true,
    })
    .sort({ createdAt: -1 })
    .limit(6)
    .toArray()

  return services
}

export const serviceService = {
  getFeaturedServices,
}
