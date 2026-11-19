import Stripe from "stripe"

import { env, requireSecret } from "../../config/env.js"

/**
 * Lazily constructed so the API can boot before billing keys exist. A missing
 * key fails loudly only when a billing endpoint is actually called.
 */
let client: Stripe | null = null

export const getStripe = (): Stripe => {
  if (!client) {
    client = new Stripe(
      requireSecret(env.stripeSecretKey, "STRIPE_SECRET_KEY"),
      { typescript: true },
    )
  }

  return client
}

/** The Premium price is always set here, never accepted from the client. */
export const premiumPriceCents = (): number => {
  const amount = env.premiumPriceCents

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("PREMIUM_PRICE_CENTS must be a positive integer.")
  }

  return amount
}

export const stripeWebhookSecret = (): string =>
  requireSecret(env.stripeWebhookSecret, "STRIPE_WEBHOOK_SECRET")
