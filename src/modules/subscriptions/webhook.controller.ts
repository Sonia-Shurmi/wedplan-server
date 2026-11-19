import type { Request, Response } from "express"
import type Stripe from "stripe"

import { AppError } from "../../utils/AppError.js"
import { getStripe, stripeWebhookSecret } from "./stripe.service.js"
import { subscriptionService } from "./subscription.service.js"

/**
 * Stripe signatures are checked against the untouched raw body. Nothing is
 * written to MongoDB unless constructEvent succeeds.
 */
export const handleStripeWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const signature = req.headers["stripe-signature"]

  if (typeof signature !== "string" || !signature.trim()) {
    throw AppError.badRequest("Missing Stripe signature header.")
  }

  const secret = stripeWebhookSecret()
  const payload = req.body as Buffer

  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret)
  } catch {
    throw AppError.badRequest("Invalid Stripe webhook signature or payload.")
  }

  const result = await subscriptionService.handleEvent(event)

  res.status(200).json({
    received: true,
    type: event.type,
    handled: result.handled,
    ...(result.reason ? { reason: result.reason } : {}),
  })
}
