import type { SubscriptionPlan } from "../auth/auth.types.js"

export type ServiceStatus = "pending" | "approved" | "rejected"

/** What gets written to the `services` collection. */
export interface ServiceRecord {
  vendorId: string
  serviceName: string
  /** Display name from CATEGORIES — never a slug or an id. */
  category: string
  description: string
  price: number
  currency: "USD"
  location: string
  images: string[]
  status: ServiceStatus
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ServiceVendorSummary {
  _id: string
  name: string
  businessName: string | null
  image: string | null
  subscriptionPlan: SubscriptionPlan
}

/** Shape returned by every service endpoint after the vendor lookup. */
export interface ServiceResponse extends ServiceRecord {
  vendor: ServiceVendorSummary | null
  isPremiumVendor: boolean
}

export interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface PaginatedServices {
  items: ServiceResponse[]
  pagination: Pagination
}
