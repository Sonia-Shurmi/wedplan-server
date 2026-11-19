import type { SubscriptionPlan } from "../auth/auth.types.js"

/** What an authenticated vendor may read about their own billing state. */
export interface SubscriptionStatus {
  plan: SubscriptionPlan
  subscriptionExpiresAt: string | null
  isPremium: boolean
}

export interface CheckoutSessionResponse {
  url: string
  sessionId: string
}
