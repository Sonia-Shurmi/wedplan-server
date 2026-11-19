import { ObjectId, type Document } from "mongodb"

import { getDB } from "../../config/db.js"
import { AppError } from "../../utils/AppError.js"
import {
  isUserRole,
  type AuthUser,
  type SubscriptionPlan,
} from "../auth/auth.types.js"
import type { Pagination } from "../services/service.interface.js"
import { OBJECT_ID_PATTERN } from "../services/service.validation.js"
import type {
  AdminTransaction,
  AdminTransactionSummary,
  AdminUserDetail,
  AdminUserListItem,
  PaginatedResult,
  TransactionListResult,
} from "./admin.interface.js"
import type {
  AdminTransactionListQuery,
  AdminUserListQuery,
} from "./admin.validation.js"

interface UserDocument extends Document {
  _id: ObjectId
  id?: string
  name?: string
  email?: string
  image?: string | null
  role?: string | null
  isBlocked?: boolean
  businessName?: string | null
  subscriptionPlan?: string | null
  subscriptionExpiresAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

interface TransactionDocument extends Document {
  _id: ObjectId
  stripeSessionId?: string | null
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  vendorId?: string | null
  vendorName?: string | null
  vendorEmail?: string | null
  plan?: string | null
  amount?: number | null
  currency?: string | null
  status?: string | null
  createdAt?: Date | null
}

const users = () => getDB().collection<UserDocument>("users")
const services = () => getDB().collection("services")
const bookings = () => getDB().collection("bookings")
const transactions = () => getDB().collection<TransactionDocument>("transactions")

const SUCCESS_STATUSES = ["succeeded", "paid", "completed"]

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const paginationOf = (
  total: number,
  page: number,
  limit: number,
): Pagination => {
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  }
}

const isoDate = (value: Date | null | undefined, fallback: ObjectId): string =>
  (value instanceof Date ? value : fallback.getTimestamp()).toISOString()

const toPlan = (value: string | null | undefined): SubscriptionPlan =>
  value === "premium" ? "premium" : "free"

const toListItem = (document: UserDocument): AdminUserListItem => ({
  _id: document._id.toString(),
  name: document.name?.trim() || "WedPlan user",
  email: document.email?.trim() || "",
  image: document.image ?? null,
  role: isUserRole(document.role) ? document.role : null,
  isBlocked: document.isBlocked === true,
  businessName: document.businessName?.trim() || null,
  subscriptionPlan: toPlan(document.subscriptionPlan),
  subscriptionExpiresAt:
    document.subscriptionExpiresAt instanceof Date
      ? document.subscriptionExpiresAt.toISOString()
      : null,
  createdAt: isoDate(document.createdAt, document._id),
})

const findUserById = async (id: string): Promise<UserDocument> => {
  if (!OBJECT_ID_PATTERN.test(id)) {
    throw AppError.badRequest("Invalid user id.")
  }

  const document = await users().findOne({
    $or: [{ _id: new ObjectId(id) }, { id }],
  })

  if (!document) {
    throw AppError.notFound("User not found.")
  }

  return document
}

const listUsers = async (
  query: AdminUserListQuery,
): Promise<PaginatedResult<AdminUserListItem>> => {
  const filter: Document = query.role ? { role: query.role } : {}

  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), "i")
    filter.$or = [{ name: pattern }, { email: pattern }]
  }

  const [total, documents] = await Promise.all([
    users().countDocuments(filter),
    users()
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .toArray(),
  ])

  return {
    items: documents.map(toListItem),
    pagination: paginationOf(total, query.page, query.limit),
  }
}

const getUser = async (id: string): Promise<AdminUserDetail> => {
  const document = await findUserById(id)
  const userId = document._id.toString()

  const [servicesTotal, pendingServices, bookingsTotal, acceptedBookings] =
    await Promise.all([
      services().countDocuments({ vendorId: userId }),
      services().countDocuments({ vendorId: userId, status: "pending" }),
      bookings().countDocuments({
        $or: [{ customerId: userId }, { vendorId: userId }],
      }),
      bookings().countDocuments({
        vendorId: userId,
        status: "accepted",
      }),
    ])

  return {
    ...toListItem(document),
    services: servicesTotal,
    pendingServices,
    bookings: bookingsTotal,
    acceptedBookings,
  }
}

/** Blocks/unblocks a user. The acting admin can never block themselves. */
const setBlocked = async (
  id: string,
  isBlocked: boolean,
  admin: AuthUser,
): Promise<AdminUserDetail> => {
  const document = await findUserById(id)

  if (document._id.toString() === admin.id && isBlocked) {
    throw AppError.badRequest("You cannot block your own admin account.")
  }

  await users().updateOne(
    { _id: document._id },
    { $set: { isBlocked, updatedAt: new Date() } },
  )

  return getUser(id)
}

const listTransactions = async (
  query: AdminTransactionListQuery,
): Promise<TransactionListResult> => {
  // Only records written by the verified Stripe webhook belong here.
  const filter: Document = {
    stripeSessionId: { $exists: true, $ne: null },
  }
  if (query.status) {
    filter.status = query.status
  }

  const [total, documents, summaryRows] = await Promise.all([
    transactions().countDocuments(filter),
    transactions()
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .toArray(),
    transactions()
      .aggregate<AdminTransactionSummary>([
        { $match: filter },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            successfulCount: {
              $sum: {
                $cond: [{ $in: ["$status", SUCCESS_STATUSES] }, 1, 0],
              },
            },
            revenueCents: {
              $sum: {
                $cond: [
                  { $in: ["$status", SUCCESS_STATUSES] },
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

  const vendorIds = Array.from(
    new Set(documents.map((item) => item.vendorId).filter(Boolean) as string[]),
  )
  const objectIds = vendorIds
    .filter((value) => OBJECT_ID_PATTERN.test(value))
    .map((value) => new ObjectId(value))
  const vendorDocuments =
    vendorIds.length || objectIds.length
      ? await users()
          .find({
            $or: [
              { _id: { $in: objectIds } },
              { id: { $in: vendorIds } },
            ],
          })
          .toArray()
      : []
  const vendorById = new Map(
    vendorDocuments.map((document) => [document._id.toString(), document]),
  )

  const items: AdminTransaction[] = documents.map((document) => {
    const vendorId = document.vendorId ?? ""
    const vendor = vendorById.get(vendorId)

    return {
      _id: document._id.toString(),
      stripeSessionId: document.stripeSessionId ?? "",
      vendorId,
      vendorName:
        vendor?.name?.trim() || document.vendorName?.trim() || "WedPlan vendor",
      vendorEmail:
        vendor?.email?.trim() || document.vendorEmail?.trim() || "",
      plan: toPlan(vendor?.subscriptionPlan ?? document.plan),
      amount: typeof document.amount === "number" ? document.amount : 0,
      currency: document.currency?.trim() || "USD",
      status: document.status?.trim() || "pending",
      createdAt: isoDate(document.createdAt, document._id),
    }
  })

  const summary = summaryRows[0]

  return {
    items,
    pagination: paginationOf(total, query.page, query.limit),
    summary: {
      count: summary?.count ?? 0,
      successfulCount: summary?.successfulCount ?? 0,
      revenueCents: summary?.revenueCents ?? 0,
    },
  }
}

export const adminService = {
  listUsers,
  getUser,
  setBlocked,
  listTransactions,
}
