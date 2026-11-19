import type { Pagination } from "../services/service.interface.js"

export type BookingStatus = "pending" | "accepted" | "rejected" | "cancelled"

/** What gets written to the `bookings` collection. */
export interface BookingRecord {
  serviceId: string
  /** Copied from the service at creation time — never accepted from the body. */
  vendorId: string
  /** Always the verified caller — never accepted from the body. */
  customerId: string
  /** Canonical UTC midnight of the requested calendar day. */
  eventDate: Date
  eventLocation: string
  message: string
  status: BookingStatus
  createdAt: Date
  updatedAt: Date
}

export interface BookingServiceSummary {
  _id: string
  serviceName: string
  category: string
  price: number
  currency: "USD"
  location: string
  images: string[]
}

export interface BookingVendorSummary {
  _id: string
  name: string
  businessName: string | null
  image: string | null
}

export interface BookingCustomerSummary {
  _id: string
  name: string
  email: string
  image: string | null
}

/** Shape returned by every booking endpoint after the lookup pipeline. */
export interface BookingResponse extends BookingRecord {
  _id: string
  service: BookingServiceSummary | null
  vendor: BookingVendorSummary | null
  customer: BookingCustomerSummary | null
}

export interface PaginatedBookings {
  items: BookingResponse[]
  pagination: Pagination
}
