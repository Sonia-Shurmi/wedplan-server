import "dotenv/config"

import { ObjectId, type Document } from "mongodb"

import { closeDB, connectDB } from "../config/db.js"
import {
  CATEGORIES,
  normalizeCategory,
} from "../modules/categories/category.constants.js"
import { serviceService } from "../modules/services/service.service.js"

const LEGACY_FIELDS = ["categorySlug", "categoryId"] as const

/**
 * One-off data migration for the database created by the early seed scripts.
 * Categories now use the six shared display names and services store that
 * name directly; slugs and category ids must never appear in an API response.
 */
const migrate = async () => {
  try {
    const db = await connectDB()
    const categories = db.collection<Document>("categories")
    const services = db.collection<Document>("services")
    const now = new Date()

    const names = CATEGORIES.map((category) => category.name)
    const slugs = CATEGORIES.map((category) => category.slug)

    for (const category of CATEGORIES) {
      await categories.updateOne(
        { slug: category.slug },
        {
          $set: { ...category, isActive: true, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      )
    }

    // Remove duplicates that kept the new name but an old slug.
    await categories.deleteMany({
      name: { $in: names },
      slug: { $nin: slugs },
    })

    // Retire the pre-Step-5 category documents so /api/categories is clean.
    const retired = await categories.updateMany(
      { name: { $nin: names } },
      { $set: { isActive: false, updatedAt: now } },
    )
    console.log(`Retired legacy categories: ${retired.modifiedCount}`)

    const legacyServices = await services
      .find({
        $or: [
          { categorySlug: { $exists: true } },
          { categoryId: { $exists: true } },
          { category: { $nin: names } },
        ],
      })
      .toArray()

    let migrated = 0
    let unresolved = 0

    for (const service of legacyServices) {
      let category = normalizeCategory(service.category)

      if (!category && typeof service.categorySlug === "string") {
        category = normalizeCategory(service.categorySlug)
      }

      if (!category && typeof service.categoryId === "string") {
        // Legacy category ids may be either ObjectIds or plain strings, so
        // build the filter as a loose Document instead of a typed Filter.
        const legacyFilter: Document = {
          _id: ObjectId.isValid(service.categoryId)
            ? new ObjectId(service.categoryId)
            : service.categoryId,
        }
        const legacy = await categories.findOne(legacyFilter)

        category = normalizeCategory(legacy?.slug) ??
          normalizeCategory(legacy?.name)
      }

      const unset = Object.fromEntries(
        LEGACY_FIELDS.filter((field) => field in service).map((field) => [
          field,
          "",
        ]),
      )

      const update: Document = { $set: { updatedAt: now } }

      if (category) {
        update.$set.category = category
      } else {
        unresolved += 1
      }

      if (Object.keys(unset).length > 0) {
        update.$unset = unset
      }

      await services.updateOne({ _id: service._id }, update)
      migrated += 1
    }

    await serviceService.ensureIndexes()

    console.log(`Migrated services: ${migrated}`)
    console.log(`Unresolved categories: ${unresolved}`)
    console.log("Service category migration completed!")
  } catch (error) {
    console.error("Service category migration failed:", error)
    process.exitCode = 1
  } finally {
    await closeDB()
  }
}

void migrate()
