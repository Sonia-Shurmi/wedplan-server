import type { SubscriptionPlan } from "../auth/auth.types.js"

/** Booking totals for the signed-in customer. Every count is their own. */
export interface CustomerDashboardStats {
  total: number
  pending: number
  accepted: number
  rejected: number
  cancelled: number
}

/** Listing and request totals for the signed-in vendor only. */
export interface VendorDashboardStats {
  totalServices: number
  activeServices: number
  pendingServices: number
  totalRequests: number
  pendingRequests: number
  acceptedBookings: number
  plan: SubscriptionPlan
  planExpiresAt: string | null
  isPremium: boolean
}

/** Marketplace-wide totals. Only admins can reach this payload. */
export interface AdminDashboardStats {
  users: number
  vendors: number
  customers: number
  blockedUsers: number
  services: number
  pendingServices: number
  bookings: number
  transactions: number
  /** Stripe amounts are minor units, so revenue stays an integer here. */
  revenueCents: number
}
