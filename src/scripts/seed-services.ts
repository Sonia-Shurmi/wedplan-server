
import "dotenv/config"
import { MongoClient, ObjectId } from "mongodb"

const uri = process.env.MONGODB_URI

if (!uri) {
  throw new Error("MONGODB_URI is missing")
}

const client = new MongoClient(uri)

const sampleServices = [
  {
    serviceName: "Elegant Wedding Photography",
    categorySlug: "photography",
    description:
      "Beautiful wedding photography to preserve your most meaningful moments.",
    price: 1200,
    location: "Dhaka, Bangladesh",
  },
  {
    serviceName: "Dream Wedding Venue",
    categorySlug: "venues",
    description:
      "An elegant venue for an unforgettable wedding celebration.",
    price: 2500,
    location: "Dhaka, Bangladesh",
  },
  {
    serviceName: "Royal Wedding Catering",
    categorySlug: "catering",
    description:
      "Thoughtfully prepared menus for your special celebration.",
    price: 1800,
    location: "Chattogram, Bangladesh",
  },
  {
    serviceName: "Luxury Wedding Decoration",
    categorySlug: "decoration",
    description:
      "Beautiful floral arrangements and elegant wedding styling.",
    price: 1500,
    location: "Dhaka, Bangladesh",
  },
  {
    serviceName: "Bridal Makeup Studio",
    categorySlug: "makeup-beauty",
    description:
      "Professional bridal makeup for your special day.",
    price: 350,
    location: "Sylhet, Bangladesh",
  },
  {
    serviceName: "Bridal Couture Collection",
    categorySlug: "wedding-attire",
    description:
      "Elegant wedding outfits designed for memorable celebrations.",
    price: 900,
    location: "Dhaka, Bangladesh",
  },
]

const seedServices = async () => {
  try {
    await client.connect()

    const database = client.db(process.env.DATABASE_NAME || "wedplan")

    const categoryCollection = database.collection("categories")
    const serviceCollection = database.collection("services")

    for (const service of sampleServices) {
      const category = await categoryCollection.findOne({
        slug: service.categorySlug,
        isActive: true,
      })

      if (!category) {
        throw new Error(
          `Category not found: ${service.categorySlug}`,
        )
      }

      await serviceCollection.updateOne(
        { serviceName: service.serviceName },
        {
          $setOnInsert: {
            vendorId: "demo-vendor-001",
            serviceName: service.serviceName,
            categoryId: (category._id as ObjectId).toString(),
            categorySlug: service.categorySlug,
            description: service.description,
            price: service.price,
            currency: "USD",
            location: service.location,
            images: [],
            status: "approved",
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      )
    }

    console.log("Service seeding completed!")
    console.log(`Processed services: ${sampleServices.length}`)
  } catch (error) {
    console.error("Service seeding failed:", error)
    process.exitCode = 1
  } finally {
    await client.close()
  }
}

seedServices()
