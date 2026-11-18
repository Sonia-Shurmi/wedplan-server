import { createRemoteJWKSet, errors as joseErrors, jwtVerify } from "jose"
import { ObjectId, type Document } from "mongodb"
import type { NextFunction, Request, Response } from "express"

import { getDB } from "../config/db.js"
import { env } from "../config/env.js"
import {
  isUserRole,
  type AuthUser,
  type SubscriptionPlan,
} from "../modules/auth/auth.types.js"
import { AppError } from "../utils/AppError.js"

interface UserDocument extends Document {
  name?: string
  email?: string
  image?: string | null
  role?: string
  isBlocked?: boolean
  businessName?: string | null
  subscriptionPlan?: string
  subscriptionExpiresAt?: Date | null
}

// The key set is created once per process. jose caches keys between calls.
const jwks = createRemoteJWKSet(new URL(env.betterAuthJwksUrl))

const HEX_OBJECT_ID = /^[a-f0-9]{24}$/i

const findUser = async (subject: string) => {
  const users = getDB().collection<UserDocument>("users")

  if (HEX_OBJECT_ID.test(subject)) {
    return users.findOne({
      $or: [{ _id: new ObjectId(subject) }, { id: subject }],
    })
  }

  return users.findOne({ id: subject })
}

const toAuthUser = (document: UserDocument): AuthUser => {
  const subscriptionPlan: SubscriptionPlan =
    document.subscriptionPlan === "premium" ? "premium" : "free"

  return {
    id: document._id.toString(),
    name: document.name?.trim() || "WedPlan user",
    email: document.email?.trim() || "",
    image: document.image ?? null,
    role: isUserRole(document.role) ? document.role : null,
    isBlocked: document.isBlocked === true,
    businessName: document.businessName?.trim() || null,
    subscriptionPlan,
    subscriptionExpiresAt:
      document.subscriptionExpiresAt instanceof Date
        ? document.subscriptionExpiresAt
        : null,
  }
}

/**
 * Verifies the Better Auth JWT against the published JWKS, then reloads the
 * user from MongoDB so role changes and blocks take effect immediately.
 */
export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const header = req.headers.authorization
    const match = header?.match(/^Bearer\s+(.+)$/i)

    if (!match?.[1]) {
      throw AppError.unauthorized(
        "Unauthorized: Missing or malformed authentication token.",
      )
    }

    const token = match[1].trim()

    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.betterAuthUrl,
      audience: env.betterAuthUrl,
    })

    if (!payload.sub) {
      throw AppError.unauthorized(
        "Unauthorized: Authentication token is missing a subject.",
      )
    }

    const document = await findUser(payload.sub)

    if (!document) {
      throw AppError.unauthorized(
        "Unauthorized: The authenticated account no longer exists.",
      )
    }

    const user = toAuthUser(document)

    if (user.isBlocked) {
      throw AppError.forbidden(
        "Your account has been blocked. Please contact WedPlan support.",
      )
    }

    req.user = user
    next()
  } catch (error) {
    if (error instanceof AppError) {
      return next(error)
    }

    if (error instanceof joseErrors.JOSEError) {
      return next(
        AppError.unauthorized(
          "Unauthorized: Invalid or expired authentication token.",
        ),
      )
    }

    console.error("Unexpected JWT verification failure:", error)

    return next(
      new AppError(
        503,
        "Authentication service is temporarily unavailable. Please try again.",
      ),
    )
  }
}
