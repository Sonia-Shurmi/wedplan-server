import "dotenv/config"

import { hashPassword } from "better-auth/crypto"
import { ObjectId } from "mongodb"

import { closeDB, connectDB } from "../config/db.js"

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z]).{6,}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Creates or updates a Better Auth credential admin without ever printing the
 * supplied password. Usage: npm run seed:admin -- admin@example.com 'Pass1word'
 */
const seedAdmin = async () => {
  const email = process.argv[2]?.trim().toLowerCase()
  const password = process.argv[3]

  if (!email || !password) {
    throw new Error(
      'Usage: npm run seed:admin -- <email> <password> (quote the password)',
    )
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("A valid admin email address is required.")
  }

  if (!PASSWORD_PATTERN.test(password)) {
    throw new Error(
      "Password must be at least 6 characters and contain one uppercase and one lowercase letter.",
    )
  }

  const db = await connectDB()
  const users = db.collection("users")
  const accounts = db.collection("accounts")

  // Hash before any database work or logging so the raw password is never
  // echoed, even if a later write fails.
  const passwordHash = await hashPassword(password)
  const existing = await users.findOne({ email })

  const userObjectId = existing?._id ?? new ObjectId()
  const userId = userObjectId.toString()
  const now = new Date()

  if (existing) {
    await users.updateOne(
      { _id: userObjectId },
      {
        $set: {
          role: "admin",
          isBlocked: false,
          subscriptionPlan: "free",
          subscriptionExpiresAt: null,
          updatedAt: now,
        },
      },
    )
  } else {
    await users.insertOne({
      _id: userObjectId,
      name: "WedPlan Admin",
      email,
      emailVerified: false,
      role: "admin",
      isBlocked: false,
      businessName: null,
      subscriptionPlan: "free",
      subscriptionExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  // Better Auth stores `userId` as an ObjectId reference and `accountId` as the
  // plain hex string of the user id. Match that shape so credential sign-in
  // resolves the account exactly as it does for a normal sign-up.
  await accounts.updateOne(
    { userId: userObjectId, providerId: "credential" },
    {
      $set: {
        accountId: userId,
        password: passwordHash,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  )

  console.log(`Admin account ready for ${email}. Password was not logged.`)
}

try {
  await seedAdmin()
} catch (error) {
  console.error(
    "Admin seeding failed:",
    error instanceof Error ? error.message : "Unknown error",
  )
  process.exitCode = 1
} finally {
  await closeDB()
}
