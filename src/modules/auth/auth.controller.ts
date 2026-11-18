import type { NextFunction, Request, Response } from "express"

import { AppError } from "../../utils/AppError.js"

const getMe = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(AppError.unauthorized())
  }

  res.status(200).json({
    success: true,
    message: "Authenticated user retrieved successfully",
    data: req.user,
  })
}

export const authController = {
  getMe,
}
