import "dotenv/config"

import { closeDB, connectDB } from "../config/db.js"
import { CATEGORIES } from "../modules/categories/category.constants.js"
import type { ServiceRecord } from "../modules/services/service.interface.js"
import { DEMO_ACCOUNTS, DEMO_IDS } from "./demo.constants.js"
import {
  assignServiceImages,
  FALLBACK_SERVICE_IMAGE,
  getServiceImagesDir,
} from "./service-images.js"

interface SeedService {
  serviceName: string
  category: string
  description: string
  price: number
  location: string
  owner: "premiumVendor" | "freeVendor"
  status: ServiceRecord["status"]
  isActive: boolean
  rejectionReason?: string
}

const [photography, venues, decoration, catering, makeup, fashion] = CATEGORIES

const samples: SeedService[] = [
  {
    serviceName: "Elegant Wedding Photography",
    category: photography.name,
    description:
      "Story-led wedding photography that preserves the quiet moments as beautifully as the grand ones.",
    price: 1200,
    location: "Dhaka, Bangladesh",
    owner: "premiumVendor",
    status: "approved",
    isActive: true,
  },
  {
    serviceName: "Dream Wedding Venue",
    category: venues.name,
    description:
      "A light-filled garden venue with generous terraces for ceremonies and receptions of every size.",
    price: 2500,
    location: "Dhaka, Bangladesh",
    owner: "premiumVendor",
    status: "approved",
    isActive: true,
  },
  {
    serviceName: "Royal Wedding Catering",
    category: catering.name,
    description:
      "Seasonal menus, tasting sessions and a warm service team for a celebration your guests will remember.",
    price: 1800,
    location: "Chattogram, Bangladesh",
    owner: "freeVendor",
    status: "approved",
    isActive: true,
  },
  {
    serviceName: "Luxury Wedding Decoration",
    category: decoration.name,
    description:
      "Florals, candlelight and thoughtful styling that turn a blank room into your own celebration.",
    price: 1500,
    location: "Dhaka, Bangladesh",
    owner: "premiumVendor",
    status: "approved",
    isActive: true,
  },
  {
    serviceName: "Bridal Makeup Studio",
    category: makeup.name,
    description:
      "Soft, long-lasting bridal makeup and hair styling from first look through the last dance.",
    price: 350,
    location: "Sylhet, Bangladesh",
    owner: "freeVendor",
    status: "approved",
    isActive: true,
  },
  {
    serviceName: "Bridal Couture Collection",
    category: fashion.name,
    description:
      "Hand-finished bridal wear and tailoring for the whole wedding party, fitted around your day.",
    price: 900,
    location: "Dhaka, Bangladesh",
    owner: "freeVendor",
    status: "approved",
    isActive: true,
  },
  {
    serviceName: "Intimate Garden Ceremony",
    category: venues.name,
    description:
      "An intimate garden package for smaller guest lists, complete with ceremony styling and rain cover.",
    price: 2100,
    location: "Chattogram, Bangladesh",
    owner: "premiumVendor",
    status: "pending",
    isActive: true,
  },
  {
    serviceName: "Vintage Film Photography",
    category: photography.name,
    description:
      "A film-inspired documentary package with a limited gallery and hand-delivered prints.",
    price: 950,
    location: "Dhaka, Bangladesh",
    owner: "freeVendor",
    status: "rejected",
    isActive: false,
    rejectionReason: "Please add a full sample gallery before resubmitting.",
  },
]

/** Public demo listings owned by the seeded demo vendors. Safe to re-run. */
const seedServices = async () => {
  try {
    const db = await connectDB()
    const collection = db.collection<ServiceRecord>("services")
    const users = db.collection("users")
    const now = new Date()
    const serviceImages = assignServiceImages(samples.map((s) => s.serviceName))

    console.log(`Using service images from ${getServiceImagesDir()}`)

    const ownerIds: Record<SeedService["owner"], string> = {
      premiumVendor: DEMO_IDS.premiumVendor,
      freeVendor: DEMO_IDS.freeVendor,
    }

    for (const owner of Object.keys(ownerIds) as SeedService["owner"][]) {
      const email =
        owner === "premiumVendor"
          ? DEMO_ACCOUNTS.premiumVendor.email
          : DEMO_ACCOUNTS.freeVendor.email
      const user = await users.findOne({ email })

      if (user) {
        ownerIds[owner] = String(user._id)
      }
    }

    for (const sample of samples) {
      await collection.updateOne(
        { serviceName: sample.serviceName },
        {
          $set: {
            vendorId: ownerIds[sample.owner],
            serviceName: sample.serviceName,
            category: sample.category,
            description: sample.description,
            price: sample.price,
            currency: "USD",
            location: sample.location,
            images: serviceImages[sample.serviceName] ?? [FALLBACK_SERVICE_IMAGE],
            status: sample.status,
            isActive: sample.isActive,
            rejectionReason: sample.rejectionReason ?? null,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      )
    }

    const approved = samples.filter(
      (sample) => sample.status === "approved" && sample.isActive,
    ).length

    console.log("Service seeding completed!")
    console.log(
      `Processed ${samples.length} services (${approved} public listings).`,
    )
  } catch (error) {
    console.error("Service seeding failed:", error)
    process.exitCode = 1
  } finally {
    await closeDB()
  }
}

void seedServices()
