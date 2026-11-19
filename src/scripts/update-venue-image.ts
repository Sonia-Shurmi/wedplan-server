import "dotenv/config"

import { closeDB, connectDB } from "../config/db.js"
import type { ServiceRecord } from "../modules/services/service.interface.js"

/**
 * The QA-created "Outdoor Venue" listing was uploaded to ImgBB during testing.
 * Replace that external URL with photos from the client's own image library so
 * every demo listing is served from the same local set.
 */
const SERVICE_NAME = "Outdoor Venue"

const VENUE_IMAGES = [
  "/images/pexels-beach-1854072.jpg",
  "/images/jeremy-wong-weddings-K41SGnGKxVk-unsplash.jpg",
  "/images/jennifer-kalenberg-Rkj0ms67lio-unsplash.jpg",
]

const updateVenueImage = async () => {
  try {
    const db = await connectDB()
    const result = await db.collection<ServiceRecord>("services").updateOne(
      { serviceName: SERVICE_NAME },
      { $set: { images: VENUE_IMAGES, updatedAt: new Date() } },
    )

    console.log(
      result.matchedCount
        ? `${SERVICE_NAME} now uses ${VENUE_IMAGES.length} local images.`
        : `${SERVICE_NAME} was not found; nothing changed.`,
    )
  } catch (error) {
    console.error("Venue image update failed:", error)
    process.exitCode = 1
  } finally {
    await closeDB()
  }
}

void updateVenueImage()
