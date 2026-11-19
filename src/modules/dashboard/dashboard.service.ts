import { getDB } from "../../config/db.js"
import { isPremiumUser, type AuthUser } from "../auth/auth.types.js"
import type {
  AdminDashboardStats,
  CustomerDashboardStats,
  VendorDashboardStats,
} from "./dashboard.interface.js"

const users = () => getDB().collection("users")
const services = () => getDB().collection("services")
const bookings = () => getDB().collection("bookings")

/**
 * Every customer/vendor figure is filtered by the id attached to the verified
 * JWT by `requireAuth`. No owner id is ever accepted from the request.
 */
const customerStats = async (
  customer: AuthUser,
): Promise<CustomerDashboardStats> => {
  const [total, pending, accepted, rejected, cancelled] = await Promise.all([
    bookings().countDocuments({ customerId: customer.id }),
    bookings().countDocuments({
      customerId: customer.id,
      status: "pending",
    }),
    bookings().countDocuments({
      customerId: customer.id,
      status: "accepted",
    }),
    bookings().countDocuments({
      customerId: customer.id,
      status: "rejected",
    }),
    bookings().countDocuments({
      customerId: customer.id,
      status: "cancelled",
    }),
  ])

  return { total, pending, accepted, rejected, cancelled }
}

const vendorStats = async (vendor: AuthUser): Promise<VendorDashboardStats> => {
  const [totalServices, activeServices, pendingServices, totalRequests, pendingRequests, acceptedBookings] =
    await Promise.all([
      services().countDocuments({ vendorId: vendor.id }),
      services().countDocuments({
        vendorId: vendor.id,
        status: "approved",
        isActive: true,
      }),
      services().countDocuments({
        vendorId: vendor.id,
        status: "pending",
      }),
      bookings().countDocuments({ vendorId: vendor.id }),
      bookings().countDocuments({
        vendorId: vendor.id,
        status: "pending",
      }),
      bookings().countDocuments({
        vendorId: vendor.id,
        status: "accepted",
      }),
    ])

  return {
    totalServices,
    activeServices,
    pendingServices,
    totalRequests,
    pendingRequests,
    acceptedBookings,
    plan: vendor.subscriptionPlan,
    planExpiresAt: vendor.subscriptionExpiresAt?.toISOString() ?? null,
    isPremium: isPremiumUser(vendor),
  }
}

/** Only webhook-created, successful payments contribute to revenue. */
const adminStats = async (): Promise<AdminDashboardStats> => {
  const [usersTotal, vendors, customers, blockedUsers, servicesTotal, pendingServices, bookingsTotal, transactionSummary] =
    await Promise.all([
      users().countDocuments({}),
      users().countDocuments({ role: "vendor" }),
      users().countDocuments({ role: "customer" }),
      users().countDocuments({ isBlocked: true }),
      services().countDocuments({}),
      services().countDocuments({ status: "pending" }),
      bookings().countDocuments({}),
      // The collection is created by the Stripe webhook in a later step. An
      // empty or missing collection simply produces zero totals.
      getDB()
        .collection("transactions")
        .aggregate<{
          _id: null
          total: number
          revenueCents: number
        }>([
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              revenueCents: {
                $sum: {
                  $cond: [
                    { $in: ["$status", ["succeeded", "paid", "completed"]] },
                    { $ifNull: ["$amount", 0] },
                    0,
                  ],
                },
              },
            },
          },
        ])
        .toArray(),
    ])

  const summary = transactionSummary[0]

  return {
    users: usersTotal,
    vendors,
    customers,
    blockedUsers,
    services: servicesTotal,
    pendingServices,
    bookings: bookingsTotal,
    transactions: summary?.total ?? 0,
    revenueCents: summary?.revenueCents ?? 0,
  }
}

export const dashboardService = {
  customerStats,
  vendorStats,
  adminStats,
}
