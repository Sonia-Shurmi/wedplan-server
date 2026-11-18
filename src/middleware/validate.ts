import type { ZodType } from "zod"
import type { NextFunction, Request, Response } from "express"

import { AppError } from "../utils/AppError.js"

export interface ValidationSchemas {
  body?: ZodType
  query?: ZodType
  params?: ZodType
}

export interface ValidatedRequest {
  body?: unknown
  query?: unknown
  params?: unknown
}

/**
 * Validates request input with Zod and stores the parsed result on
 * `req.validated`. Controllers always read parsed data, never raw input.
 */
export const validate =
  (schemas: ValidationSchemas) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const validated: ValidatedRequest = {}

    for (const key of ["body", "query", "params"] as const) {
      const schema = schemas[key]

      if (!schema) {
        continue
      }

      const result = schema.safeParse(req[key])

      if (!result.success) {
        return next(
          AppError.badRequest(
            "Validation failed",
            result.error.issues.map((issue) => ({
              field: issue.path.join("."),
              message: issue.message,
            })),
          ),
        )
      }

      validated[key] = result.data
    }

    req.validated = validated
    next()
  }
