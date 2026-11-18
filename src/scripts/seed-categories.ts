
import "dotenv/config"
import { MongoClient } from "mongodb"

const uri = process.env.MONGODB_URI

if (!uri) {
  throw new Error("MONGODB_URI is missing")
}

const client = new MongoClient(uri)

const categories = [
  {
    name: "Photography",
    slug: "photography",
    description: "Capture every beautiful moment of your wedding.",
    icon: "camera",
    isActive: true,
  },
  {
    name: "Venues",
    slug: "venues",
    description: "Discover the perfect place for your celebration.",
    icon: "building-2",
    isActive: true,
  },
  {
    name: "Catering",
    slug: "catering",
    description: "Make your celebration memorable with delicious food.",
    icon: "utensils",
    isActive: true,
  },
  {
    name: "Decoration",
    slug: "decoration",
    description: "Transform your wedding venue into something beautiful.",
    icon: "flower-2",
    isActive: true,
  },
  {
    name: "Makeup & Beauty",
    slug: "makeup-beauty",
    description: "Find professionals for your perfect wedding look.",
    icon: "sparkles",
    isActive: true,
  },
  {
    name: "Wedding Attire",
    slug: "wedding-attire",
    description: "Find the perfect outfits for your special day.",
    icon: "shirt",
    isActive: true,
  },
]

const seedCategories = async () => {
  try {
    await client.connect()

    const database = client.db(process.env.DATABASE_NAME || "wedplan")
    const collection = database.collection("categories")

    const result = await collection.bulkWrite(
      categories.map((category) => ({
        updateOne: {
          filter: { slug: category.slug },
          update: {
            $setOnInsert: {
              ...category,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      })),
    )

    console.log("Category seeding completed!")
    console.log(`Inserted categories: ${result.upsertedCount}`)
    console.log(`Already existing: ${result.matchedCount}`)
  } catch (error) {
    console.error("Category seeding failed:", error)
    process.exitCode = 1
  } finally {
    await client.close()
  }
}

seedCategories()
