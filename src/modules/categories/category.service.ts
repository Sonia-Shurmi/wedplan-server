
import type { Document } from "mongodb"

import { getDB } from "../../config/db.js"
import type { Category } from "./category.interface.js"

// Get all active categories

const getActiveCategories = async (): Promise<Category[]> => {
  const categoryCollection = getDB().collection<Category & Document>(
    "categories",
  )

  const categories = await categoryCollection
    .find({ isActive: true })
    .sort({ name: 1 })
    .toArray()

  return categories
}


export const categoryService = {
  getActiveCategories,
}
