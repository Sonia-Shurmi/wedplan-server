
export type ServiceStatus = "pending" | "approved" | "rejected"

export interface Service {
  vendorId: string
  serviceName: string
  categoryId: string
  categorySlug: string
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
