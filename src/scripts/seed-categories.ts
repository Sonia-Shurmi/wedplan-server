import "dotenv/config"

import { closeDB, connectDB } from "../config/db.js"
import { CATEGORIES } from "../modules/categories/category.constants.js"

/** Seeds the six canonical categories used by both apps. */
const seedCategories = async () => {
  try {
    const db = await connectDB()
    const collection = db.collection("categories")
    const now = new Date()

    const result = await collection.bulkWrite(
      CATEGORIES.map((category) => ({
        updateOne: {
          // Name is the stable identity; old slugs are handled by the
          // migration script instead of creating duplicates here.
          filter: { name: category.name },
          update: {
            $set: {
              ...category,
              isActive: true,
              updatedAt: now,
            },
            $setOnInsert: { createdAt: now },
          },
          upsert: true,
        },
      })),
    )

    // Anything left over from the old six-category set must not be browsable.
    await collection.updateMany(
      { name: { $nin: CATEGORIES.map((category) => category.name) } },
      { $set: { isActive: false, updatedAt: now } },
    )

    console.log("Category seeding completed!")
    console.log(`Upserted: ${result.upsertedCount + result.modifiedCount}`)
  } catch (error) {
    console.error("Category seeding failed:", error)
    process.exitCode = 1
  } finally {
    await closeDB()
  }
}

void seedCategories()
