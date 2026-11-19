import { ObjectId, type Document } from "mongodb"
import type Stripe from "stripe"

import { getDB } from "../../config/db.js"
import { env } from "../../config/env.js"
import { AppError } from "../../utils/AppError.js"
import {
  isPremiumUser,
  type AuthUser,
  type SubscriptionPlan,
} from "../auth/auth.types.js"
import type {
  CheckoutSessionResponse,
  SubscriptionStatus,
} from "./subscription.interface.js"
import { getStripe, premiumPriceCents } from "./stripe.service.js"

interface UserDocument extends Document {
  _id: ObjectId
  id?: string
  name?: string
  email?: string
  stripeCustomerId?: string | null
  subscriptionPlan?: string | null
  subscriptionExpiresAt?: Date | null
}

interface TransactionDocument extends Document {
  _id: ObjectId
  stripeSessionId?: string | null
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  vendorId?: string | null
  vendorName?: string | null
  vendorEmail?: string | null
  plan?: string | null
  amount?: number | null
  currency?: string | null
  status?: string | null
  createdAt?: Date | null
}

const HEX_OBJECT_ID = /^[a-f0-9]{24}$/i
const PREMIUM_DURATION_DAYS = 30
const SUCCESS_STATUS = "succeeded"

const users = () => getDB().collection<UserDocument>("users")
const transactions = () =>
  getDB().collection<TransactionDocument>("transactions")

const userFilter = (userId: string): Document =>
  HEX_OBJECT_ID.test(userId)
    ? { $or: [{ _id: new ObjectId(userId) }, { id: userId }] }
    : { id: userId }

const findUserById = (userId: string) => users().findOne(userFilter(userId))

const customerIdOf = (
  customer:
    | string
    | Stripe.Customer
    | Stripe.DeletedCustomer
    | null
    | undefined,
): string | null => {
  if (!customer) return null

  return typeof customer === "string" ? customer : customer.id
}

const subscriptionIdOf = (
  subscription: string | Stripe.Subscription | null | undefined,
): string | null => {
  if (!subscription) return null

  return typeof subscription === "string" ? subscription : subscription.id
}

const addDays = (days: number, from: Date = new Date()): Date =>
  new Date(from.getTime() + days * 24 * 60 * 60 * 1000)

const toPlan = (value: string | null | undefined): SubscriptionPlan =>
  value === "premium" ? "premium" : "free"

const getStatus = (user: AuthUser): SubscriptionStatus => ({
  plan: toPlan(user.subscriptionPlan),
  subscriptionExpiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
  isPremium: isPremiumUser(user),
})

/**
 * Creates a checkout for the authenticated caller only. Vendor, amount and
 * plan are derived from the server session and configuration — the request
 * body is deliberately never read.
 */
const createCheckout = async (
  user: AuthUser,
): Promise<CheckoutSessionResponse> => {
  if (isPremiumUser(user)) {
    throw AppError.conflict(
      "Your Premium subscription is already active. You do not need to upgrade again.",
    )
  }

  const stripe = getStripe()
  const document = await findUserById(user.id)

  if (!document) {
    throw AppError.unauthorized("The authenticated account no longer exists.")
  }

  let customerId = document.stripeCustomerId?.trim() || null

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      name: user.name || undefined,
      metadata: { userId: user.id },
    })
    customerId = customer.id

    await users().updateOne(
      { _id: document._id },
      { $set: { stripeCustomerId: customerId, updatedAt: new Date() } },
    )
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    metadata: { userId: user.id },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: premiumPriceCents(),
          recurring: { interval: "month" },
          product_data: {
            name: "WedPlan Premium",
            description:
              "Unlimited active service listings and a Premium vendor badge.",
          },
        },
      },
    ],
    success_url: `${env.clientUrl}/payment/success`,
    cancel_url: `${env.clientUrl}/payment/cancel`,
  })

  if (!session.url) {
    throw AppError.badRequest(
      "Stripe did not return a checkout URL. Please try again.",
    )
  }

  return { url: session.url, sessionId: session.id }
}

interface TransactionInput {
  sessionId: string
  customerId: string | null
  subscriptionId: string | null
  vendorId: string
  vendorName: string
  vendorEmail: string
  amount: number
  currency: string
  status: string
}

/**
 * Upserting on the Stripe session id is what makes a repeated webhook
 * harmless: a second delivery updates the same document instead of inserting
 * another one.
 */
const upsertTransaction = async (input: TransactionInput): Promise<void> => {
  await transactions().updateOne(
    { stripeSessionId: input.sessionId },
    {
      $set: {
        stripeCustomerId: input.customerId,
        stripeSubscriptionId: input.subscriptionId,
        vendorId: input.vendorId,
        vendorName: input.vendorName,
        vendorEmail: input.vendorEmail,
        plan: "premium",
        amount: input.amount,
        currency: input.currency,
        status: input.status,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  )
}

export interface WebhookResult {
  handled: boolean
  reason?: "user_not_found" | "payment_incomplete" | "no_customer"
}

/** Grants Premium only after Stripe reports a completed, paid checkout. */
const handleCheckoutCompleted = async (
  session: Stripe.Checkout.Session,
): Promise<WebhookResult> => {
  if (session.payment_status !== "paid") {
    return { handled: false, reason: "payment_incomplete" }
  }

  const userId = session.client_reference_id ?? session.metadata?.userId ?? null
  const customerId = customerIdOf(session.customer)
  const subscriptionId = subscriptionIdOf(session.subscription)

  const document =
    (userId ? await findUserById(userId) : null) ??
    (customerId
      ? await users().findOne({ stripeCustomerId: customerId })
      : null)

  if (!document) {
    return { handled: false, reason: "user_not_found" }
  }

  await upsertTransaction({
    sessionId: session.id,
    customerId,
    subscriptionId,
    vendorId: document.id ?? document._id.toString(),
    vendorName: document.name ?? "WedPlan vendor",
    vendorEmail: document.email ?? "",
    amount: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    status: SUCCESS_STATUS,
  })

  await users().updateOne(
    { _id: document._id },
    {
      $set: {
        subscriptionPlan: "premium",
        // A fresh checkout always starts a new 30-day window.
        subscriptionExpiresAt: addDays(PREMIUM_DURATION_DAYS),
        stripeCustomerId: customerId ?? document.stripeCustomerId ?? null,
        updatedAt: new Date(),
      },
    },
  )

  return { handled: true }
}

/**
 * Renewals extend the plan to the invoice's own period end. Replaying the
 * same invoice therefore produces the same expiry instead of drifting forward.
 */
const handleInvoicePaid = async (
  invoice: Stripe.Invoice,
): Promise<WebhookResult> => {
  const customerId = customerIdOf(invoice.customer)

  if (!customerId) {
    return { handled: false, reason: "no_customer" }
  }

  const document = await users().findOne({ stripeCustomerId: customerId })

  if (!document) {
    return { handled: false, reason: "user_not_found" }
  }

  const firstLine = invoice.lines.data[0] as unknown as
    | { period?: { end?: number } }
    | undefined
  const periodEnd = firstLine?.period?.end
  const expiresAt =
    typeof periodEnd === "number" && Number.isFinite(periodEnd)
      ? new Date(periodEnd * 1000)
      : addDays(PREMIUM_DURATION_DAYS)

  await users().updateOne(
    { _id: document._id },
    {
      $set: {
        subscriptionPlan: "premium",
        subscriptionExpiresAt: expiresAt,
        updatedAt: new Date(),
      },
    },
  )

  return { handled: true }
}

const handleSubscriptionDeleted = async (
  subscription: Stripe.Subscription,
): Promise<WebhookResult> => {
  const customerId = customerIdOf(subscription.customer)

  if (!customerId) {
    return { handled: false, reason: "no_customer" }
  }

  const document = await users().findOne({ stripeCustomerId: customerId })

  if (!document) {
    return { handled: false, reason: "user_not_found" }
  }

  await users().updateOne(
    { _id: document._id },
    {
      $set: {
        subscriptionPlan: "free",
        subscriptionExpiresAt: null,
        updatedAt: new Date(),
      },
    },
  )

  return { handled: true }
}

const handleEvent = async (event: Stripe.Event): Promise<WebhookResult> => {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event.data.object)
    case "invoice.paid":
      return handleInvoicePaid(event.data.object)
    case "customer.subscription.deleted":
      return handleSubscriptionDeleted(event.data.object)
    default:
      return { handled: false }
  }
}

export const subscriptionService = {
  getStatus,
  createCheckout,
  handleEvent,
}
