export type UserRole = "admin" | "vendor" | "customer"

export type SubscriptionPlan = "free" | "premium"

export interface AuthUser {
  id: string
  name: string
  email: string
  image: string | null
  role: UserRole | null
  isBlocked: boolean
  businessName: string | null
  subscriptionPlan: SubscriptionPlan
  subscriptionExpiresAt: Date | null
}

export const USER_ROLES: UserRole[] = ["admin", "vendor", "customer"]

export const isUserRole = (value: unknown): value is UserRole =>
  typeof value === "string" && USER_ROLES.includes(value as UserRole)

/** A premium plan counts only while it has not expired. */
export const isPremiumUser = (
  user: AuthUser,
  now: Date = new Date(),
): boolean =>
  user.subscriptionPlan === "premium" &&
  (!user.subscriptionExpiresAt ||
    user.subscriptionExpiresAt.getTime() > now.getTime())
