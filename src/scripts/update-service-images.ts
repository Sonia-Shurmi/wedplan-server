import "dotenv/config"

import { closeDB, connectDB } from "../config/db.js"
import type { ServiceRecord } from "../modules/services/service.interface.js"
import {
  assignServiceImages,
  FALLBACK_SERVICE_IMAGE,
  getServiceImagesDir,
} from "./service-images.js"

/**
 * Replaces only placeholder/empty service galleries with photos from the
 * client's public/images folder. Custom vendor uploads are left untouched.
 */
const updateServiceImages = async () => {
  try {
    const db = await connectDB()
    const collection = db.collection<ServiceRecord>("services")

    const services = await collection
      .find({}, { projection: { serviceName: 1, images: 1 } })
      .toArray()

    const targets = services.filter(
      (service) =>
        !service.images?.length ||
        service.images.every((image) => image === FALLBACK_SERVICE_IMAGE),
    )

    const assignments = assignServiceImages(targets.map((s) => s.serviceName))
    const now = new Date()

    console.log(`Service image source: ${getServiceImagesDir()}`)
    console.log(`Updating ${targets.length} placeholder service gallery/galleries.`)

    for (const service of targets) {
      const images = assignments[service.serviceName] ?? [FALLBACK_SERVICE_IMAGE]

      await collection.updateOne(
        { _id: service._id },
        { $set: { images, updatedAt: now } },
      )

      console.log(`${service.serviceName}: ${images.join(", ")}`)
    }
  } catch (error) {
    console.error("Service image update failed:", error)
    process.exitCode = 1
  } finally {
    await closeDB()
  }
}

void updateServiceImages()
