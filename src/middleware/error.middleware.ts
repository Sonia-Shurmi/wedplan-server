import { MongoServerError } from "mongodb"
import { ZodError } from "zod"
import type { ErrorRequestHandler, RequestHandler } from "express"

import { env } from "../config/env.js"
import { AppError } from "../utils/AppError.js"

/** JSON 404 for unknown routes (including non-API paths). */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  })
}

const sendError = (
  res: Parameters<ErrorRequestHandler>[2],
  statusCode: number,
  message: string,
  errors?: unknown,
) => {
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  })
}

/**
 * Central error handler. Keeps responses consistent and never leaks a stack
 * trace or database internals to the client.
 */
export const errorHandler: ErrorRequestHandler = (
  error,
  req,
  res,
  _next,
) => {
  if (res.headersSent) {
    return
  }

  if (error instanceof AppError) {
    return sendError(res, error.statusCode, error.message, error.details)
  }

  if (error instanceof ZodError) {
    return sendError(
      res,
      400,
      "Validation failed",
      error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    )
  }

  if (error instanceof MongoServerError && error.code === 11000) {
    return sendError(
      res,
      409,
      "A record with these details already exists.",
    )
  }

  if (error instanceof SyntaxError && "body" in error) {
    return sendError(res, 400, "Request body contains invalid JSON.")
  }

  // body-parser rejects oversized payloads with a typed error.
  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: unknown }).type === "entity.too.large"
  ) {
    return sendError(res, 413, "Request body is too large.")
  }

  console.error(
    `Unhandled error on ${req.method} ${req.originalUrl}:`,
    error,
  )

  const message = env.isProduction
    ? "Internal server error. Please try again later."
    : error instanceof Error
      ? error.message
      : "Internal server error"

  return sendError(res, 500, message)
}
