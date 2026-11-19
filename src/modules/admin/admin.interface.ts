import type { SubscriptionPlan, UserRole } from "../auth/auth.types.js"
import type { Pagination } from "../services/service.interface.js"

/** Public admin view of a user. Sensitive auth fields are never included. */
export interface AdminUserListItem {
  _id: string
  name: string
  email: string
  image: string | null
  role: UserRole | null
  isBlocked: boolean
  businessName: string | null
  subscriptionPlan: SubscriptionPlan
  subscriptionExpiresAt: string | null
  createdAt: string
}

export interface AdminUserDetail extends AdminUserListItem {
  services: number
  pendingServices: number
  bookings: number
  acceptedBookings: number
}

export interface AdminTransaction {
  _id: string
  stripeSessionId: string
  vendorId: string
  vendorName: string
  vendorEmail: string
  plan: SubscriptionPlan
  amount: number
  currency: string
  status: string
  createdAt: string
}

export interface AdminTransactionSummary {
  count: number
  successfulCount: number
  revenueCents: number
}

export interface PaginatedResult<T> {
  items: T[]
  pagination: Pagination
}

export interface TransactionListResult extends PaginatedResult<AdminTransaction> {
  summary: AdminTransactionSummary
}
