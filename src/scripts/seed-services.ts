import "dotenv/config"

import { closeDB, connectDB } from "../config/db.js"
import { CATEGORIES } from "../modules/categories/category.constants.js"
import type { ServiceRecord } from "../modules/services/service.interface.js"

const DEMO_VENDOR_ID = "demo-vendor-001"

const samples = CATEGORIES.map((category, index) => ({
  serviceName: [
    "Elegant Wedding Photography",
    "Dream Wedding Venue",
    "Royal Wedding Catering",
    "Luxury Wedding Decoration",
    "Bridal Makeup Studio",
    "Bridal Couture Collection",
  ][index],
  category: category.name,
  description: [
    "Beautiful wedding photography to preserve your most meaningful moments.",
    "An elegant venue for an unforgettable wedding celebration.",
    "Thoughtfully prepared menus for your special celebration.",
    "Beautiful floral arrangements and elegant wedding styling.",
    "Professional bridal makeup for your special day.",
    "Elegant wedding outfits designed for memorable celebrations.",
  ][index],
  price: [1200, 2500, 1800, 1500, 350, 900][index],
  location: index === 2 ? "Chattogram, Bangladesh" : "Dhaka, Bangladesh",
}))

/** Public demo listings. They are not owned by a real auth account. */
const seedServices = async () => {
  try {
    const db = await connectDB()
    const collection = db.collection<ServiceRecord>("services")
    const now = new Date()

    for (const sample of samples) {
      await collection.updateOne(
        { serviceName: sample.serviceName },
        {
          $setOnInsert: {
            vendorId: DEMO_VENDOR_ID,
            serviceName: sample.serviceName,
            category: sample.category,
            description: sample.description,
            price: sample.price,
            currency: "USD",
            location: sample.location,
            images: ["/images/wedding.jpg"],
            status: "approved",
            isActive: true,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      )
    }

    console.log("Service seeding completed!")
    console.log(`Processed services: ${samples.length}`)
  } catch (error) {
    console.error("Service seeding failed:", error)
    process.exitCode = 1
  } finally {
    await closeDB()
  }
}

void seedServices()
