/**
 * Application error with an HTTP status code and optional safe details.
 * Anything thrown that is not an AppError becomes a generic 500 response.
 */
export class AppError extends Error {
  readonly statusCode: number
  readonly details?: unknown
  readonly isOperational: boolean

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message)

    this.name = "AppError"
    this.statusCode = statusCode
    this.details = details
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, message, details)
  }

  static unauthorized(message = "Unauthorized") {
    return new AppError(401, message)
  }

  static forbidden(message = "Forbidden") {
    return new AppError(403, message)
  }

  static notFound(message = "Resource not found") {
    return new AppError(404, message)
  }

  static conflict(message: string) {
    return new AppError(409, message)
  }

  static tooManyRequests(message = "Too many requests") {
    return new AppError(429, message)
  }
}
