import { ObjectId, type Document } from "mongodb"

import { getDB } from "../../config/db.js"
import { AppError } from "../../utils/AppError.js"
import {
  isUserRole,
  type AuthUser,
  type SubscriptionPlan,
} from "../auth/auth.types.js"
import type { Profile } from "./profile.interface.js"
import type { ProfileUpdateInput } from "./profile.validation.js"

interface UserDocument extends Document {
  _id: ObjectId
  id?: string
  name?: string
  email?: string
  image?: string | null
  role?: string | null
  isBlocked?: boolean
  businessName?: string | null
  subscriptionPlan?: string | null
  subscriptionExpiresAt?: Date | null
}

const HEX_OBJECT_ID = /^[a-f0-9]{24}$/i

const users = () => getDB().collection<UserDocument>("users")

const selectorFor = (id: string) =>
  HEX_OBJECT_ID.test(id)
    ? { $or: [{ _id: new ObjectId(id) }, { id }] }
    : { id }

const planOf = (value: string | null | undefined): SubscriptionPlan =>
  value === "premium" ? "premium" : "free"

const fromDocument = (document: UserDocument): Profile => ({
  id: document._id.toString(),
  name: document.name?.trim() || "WedPlan user",
  email: document.email?.trim() || "",
  image: document.image ?? null,
  role: isUserRole(document.role) ? document.role : null,
  isBlocked: document.isBlocked === true,
  businessName: document.businessName?.trim() || null,
  subscriptionPlan: planOf(document.subscriptionPlan),
  subscriptionExpiresAt:
    document.subscriptionExpiresAt instanceof Date
      ? document.subscriptionExpiresAt.toISOString()
      : null,
})

const fromAuthUser = (user: AuthUser): Profile => ({
  id: user.id,
  name: user.name?.trim() || "WedPlan user",
  email: user.email?.trim() || "",
  image: user.image ?? null,
  role: user.role,
  isBlocked: user.isBlocked,
  businessName: user.businessName?.trim() || null,
  subscriptionPlan: user.subscriptionPlan,
  subscriptionExpiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
})

const get = (user: AuthUser): Profile => fromAuthUser(user)

const update = async (
  user: AuthUser,
  input: ProfileUpdateInput,
): Promise<Profile> => {
  const changes: Record<string, unknown> = { updatedAt: new Date() }

  // The validated object contains only allowlisted keys. Protected fields such
  // as role, email and subscriptionPlan are never read from the request body.
  if (input.name !== undefined) {
    changes.name = input.name
  }

  if (input.image !== undefined) {
    changes.image = input.image
  }

  if (input.businessName !== undefined) {
    changes.businessName = input.businessName?.trim() || null
  }

  const document = await users().findOneAndUpdate(
    selectorFor(user.id),
    { $set: changes },
    { returnDocument: "after" },
  )

  if (!document) {
    throw AppError.notFound("User not found.")
  }

  return fromDocument(document)
}

export const profileService = { get, update }
