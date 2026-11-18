import type { NextFunction, Request, Response } from "express"

import type { UserRole } from "../modules/auth/auth.types.js"
import { AppError } from "../utils/AppError.js"

/**
 * Server-side role gate. Must run after requireAuth.
 * Never rely on a role sent by the client.
 */
export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        AppError.unauthorized(
          "Unauthorized: Authentication is required for this resource.",
        ),
      )
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          "Forbidden: You do not have permission to access this resource.",
        ),
      )
    }

    next()
  }
