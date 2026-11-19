import type { SubscriptionPlan, UserRole } from "../auth/auth.types.js"

/** Fields a signed-in user may read back from their own profile. */
export interface Profile {
  id: string
  name: string
  email: string
  image: string | null
  role: UserRole | null
  isBlocked: boolean
  businessName: string | null
  subscriptionPlan: SubscriptionPlan
  subscriptionExpiresAt: string | null
}
