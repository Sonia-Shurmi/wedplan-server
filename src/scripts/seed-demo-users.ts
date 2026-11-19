import "dotenv/config"

import { hashPassword } from "better-auth/crypto"
import { ObjectId } from "mongodb"

import { closeDB, connectDB } from "../config/db.js"
import { DEMO_ACCOUNTS, DEMO_IDS, DEMO_PASSWORD } from "./demo.constants.js"

const BOOKING_IDS = {
  accepted: "6afd00000000000000000011",
  pending: "6afd00000000000000000012",
} as const

const utcMidnightIn = (days: number) => {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + days)

  return date
}

/**
 * Creates reproducible demo accounts and two sample bookings so every role
 * dashboard has something meaningful to show. Safe to re-run.
 */
const seedDemoUsers = async () => {
  const db = await connectDB()
  const users = db.collection("users")
  const accounts = db.collection("accounts")
  const services = db.collection("services")
  const bookings = db.collection("bookings")

  const passwordHash = await hashPassword(DEMO_PASSWORD)
  const now = new Date()
  const ids: Record<string, string> = {}

  const definitions = [
    {
      key: "premiumVendor",
      ...DEMO_ACCOUNTS.premiumVendor,
      role: "vendor",
      subscriptionPlan: "premium",
      subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      fixedId: DEMO_IDS.premiumVendor,
    },
    {
      key: "freeVendor",
      ...DEMO_ACCOUNTS.freeVendor,
      role: "vendor",
      subscriptionPlan: "free",
      subscriptionExpiresAt: null,
      fixedId: DEMO_IDS.freeVendor,
    },
    {
      key: "customer",
      ...DEMO_ACCOUNTS.customer,
      role: "customer",
      subscriptionPlan: "free",
      subscriptionExpiresAt: null,
      fixedId: DEMO_IDS.customer,
    },
  ] as const

  for (const definition of definitions) {
    const existing = await users.findOne({ email: definition.email })
    const id = existing ? String(existing._id) : definition.fixedId
    const objectId = existing?._id ?? new ObjectId(id)

    ids[definition.key] = id

    await users.updateOne(
      { _id: objectId },
      {
        $set: {
          name: definition.name,
          email: definition.email,
          emailVerified: false,
          role: definition.role,
          isBlocked: false,
          businessName:
            "businessName" in definition ? definition.businessName : null,
          subscriptionPlan: definition.subscriptionPlan,
          subscriptionExpiresAt: definition.subscriptionExpiresAt,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    )

    // Match Better Auth's shape: `userId` is an ObjectId reference while
    // `accountId` is the plain hex string used by credential sign-in.
    await accounts.updateOne(
      { userId: objectId, providerId: "credential" },
      {
        $set: {
          accountId: id,
          password: passwordHash,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    )
  }

  const photoService = await services.findOne({
    serviceName: "Elegant Wedding Photography",
  })
  const makeupService = await services.findOne({
    serviceName: "Bridal Makeup Studio",
  })

  if (photoService && makeupService) {
    const sampleBookings = [
      {
        id: BOOKING_IDS.accepted,
        service: photoService,
        vendorId: ids.premiumVendor,
        status: "accepted",
        location: "Dhaka, Bangladesh",
        message: "We would love you to capture our February ceremony.",
        daysAhead: 30,
      },
      {
        id: BOOKING_IDS.pending,
        service: makeupService,
        vendorId: ids.freeVendor,
        status: "pending",
        location: "Sylhet, Bangladesh",
        message: "Please share availability for a soft morning bridal look.",
        daysAhead: 45,
      },
    ] as const

    for (const booking of sampleBookings) {
      await bookings.updateOne(
        { _id: new ObjectId(booking.id) },
        {
          $set: {
            serviceId: String(booking.service._id),
            vendorId: booking.vendorId,
            customerId: ids.customer,
            eventDate: utcMidnightIn(booking.daysAhead),
            eventLocation: booking.location,
            message: booking.message,
            status: booking.status,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      )
    }
  }

  console.log("Demo users and bookings are ready. Password was not logged.")
}

try {
  await seedDemoUsers()
} catch (error) {
  console.error(
    "Demo seeding failed:",
    error instanceof Error ? error.message : "Unknown error",
  )
  process.exitCode = 1
} finally {
  await closeDB()
}
