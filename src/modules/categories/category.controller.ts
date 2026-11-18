
import type { Request, Response } from "express"

import { categoryService } from "./category.service.js"

const getActiveCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await categoryService.getActiveCategories()

    res.status(200).json({
      success: true,
      message: "Categories retrieved successfully",
      data: categories,
    })
  } catch (error) {
    console.error("Error retrieving categories:", error)

    res.status(500).json({
      success: false,
      message: "Failed to retrieve categories",
    })
  }
}

export const categoryController = {
  getActiveCategories,
}
