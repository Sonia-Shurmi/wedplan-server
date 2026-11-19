import { ObjectId, type Document, type WithId } from "mongodb"

import { getDB } from "../../config/db.js"
import { AppError } from "../../utils/AppError.js"
import type { AuthUser } from "../auth/auth.types.js"
import type { ServiceRecord } from "../services/service.interface.js"
import type { Pagination } from "../services/service.interface.js"
import type {
  BookingRecord,
  BookingResponse,
  PaginatedBookings,
} from "./booking.interface.js"
import {
  OBJECT_ID_PATTERN,
  type CreateBookingInput,
  type ListBookingsQuery,
  type VendorDecisionInput,
} from "./booking.validation.js"

const collection = () => getDB().collection<BookingRecord>("bookings")
const services = () => getDB().collection<ServiceRecord>("services")

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

const requireObjectId = (id: string): ObjectId => {
  if (!OBJECT_ID_PATTERN.test(id)) {
    throw AppError.badRequest("Invalid booking id.")
  }

  return new ObjectId(id)
}

/**
 * IDs are stored as strings while MongoDB `_id` values are ObjectIds, so a
 * plain localField lookup cannot match. Using `$toString` inside `$expr` keeps
 * the joins consistent with the services module.
 */
const lookupById = (
  from: string,
  localField: string,
  as: string,
  project: Document,
): Document => ({
  $lookup: {
    from,
    let: { id: `$${localField}` },
    pipeline: [
      { $match: { $expr: { $eq: [{ $toString: "$_id" }, "$$id"] } } },
      { $limit: 1 },
      { $project: project },
    ],
    as,
  },
})

const firstOrNull = (field: string, shape: Document): Document => ({
  $cond: [
    { $gt: [{ $size: `$${field}` }, 0] },
    {
      $let: {
        vars: { item: { $arrayElemAt: [`$${field}`, 0] } },
        in: shape,
      },
    },
    null,
  ],
})

/** Adds the service, vendor and customer summaries returned to the client. */
const bookingPipeline = (): Document[] => [
  lookupById("services", "serviceId", "service", {
    serviceName: 1,
    category: 1,
    price: 1,
    currency: 1,
    location: 1,
    images: 1,
  }),
  lookupById("users", "vendorId", "vendor", {
    name: 1,
    businessName: 1,
    image: 1,
  }),
  lookupById("users", "customerId", "consumer", {
    name: 1,
    email: 1,
    image: 1,
  }),
  {
    $addFields: {
      service: firstOrNull("service", {
        _id: { $toString: "$$item._id" },
        serviceName: { $ifNull: ["$$item.serviceName", "WedPlan service"] },
        category: { $ifNull: ["$$item.category", ""] },
        price: { $ifNull: ["$$item.price", 0] },
        currency: { $ifNull: ["$$item.currency", "USD"] },
        location: { $ifNull: ["$$item.location", ""] },
        images: { $ifNull: ["$$item.images", []] },
      }),
      vendor: firstOrNull("vendor", {
        _id: { $toString: "$$item._id" },
        name: { $ifNull: ["$$item.name", "WedPlan vendor"] },
        businessName: { $ifNull: ["$$item.businessName", null] },
        image: { $ifNull: ["$$item.image", null] },
      }),
      // The lookup is aliased `consumer` so it cannot collide with the
      // `customer` summary field produced here.
      customer: firstOrNull("consumer", {
        _id: { $toString: "$$item._id" },
        name: { $ifNull: ["$$item.name", "WedPlan customer"] },
        email: { $ifNull: ["$$item.email", ""] },
        image: { $ifNull: ["$$item.image", null] },
      }),
    },
  },
  {
    $project: {
      _id: { $toString: "$_id" },
      serviceId: 1,
      vendorId: 1,
      customerId: 1,
      eventDate: 1,
      eventLocation: 1,
      message: 1,
      status: 1,
      createdAt: 1,
      updatedAt: 1,
      service: 1,
      vendor: 1,
      customer: 1,
    },
  },
]

const findRawById = async (id: string): Promise<WithId<BookingRecord>> => {
  const booking = await collection().findOne({ _id: requireObjectId(id) })

  if (!booking) {
    throw AppError.notFound("Booking not found.")
  }

  return booking
}

const withDetails = async (id: ObjectId): Promise<BookingResponse> => {
  const [booking] = await collection()
    .aggregate<BookingResponse>([
      { $match: { _id: id } },
      ...bookingPipeline(),
      { $limit: 1 },
    ])
    .toArray()

  if (!booking) {
    throw AppError.notFound("Booking not found.")
  }

  return booking
}

const create = async (
  input: CreateBookingInput,
  customer: AuthUser,
): Promise<BookingResponse> => {
  const service = await services().findOne({
    _id: new ObjectId(input.serviceId),
  })

  if (!service || service.status !== "approved" || !service.isActive) {
    throw AppError.notFound("This service is not available for booking.")
  }

  if (service.vendorId === customer.id) {
    throw AppError.forbidden("You cannot book your own service.")
  }

  const duplicate = await collection().findOne({
    customerId: customer.id,
    serviceId: input.serviceId,
    eventDate: input.eventDate,
    status: { $in: ["pending", "accepted"] },
  })

  if (duplicate) {
    throw AppError.conflict(
      "You already have a pending or accepted request for this service on that date.",
    )
  }

  const now = new Date()
  const result = await collection().insertOne({
    serviceId: input.serviceId,
    // Both identifiers come from the verified service and user, never the body.
    vendorId: service.vendorId,
    customerId: customer.id,
    eventDate: input.eventDate,
    eventLocation: input.eventLocation,
    message: input.message ?? "",
    status: "pending",
    createdAt: now,
    updatedAt: now,
  })

  return withDetails(result.insertedId)
}

const listMine = async (
  customerId: string,
  query: ListBookingsQuery,
): Promise<PaginatedBookings> => {
  const filter: Document = {
    customerId,
    ...(query.status ? { status: query.status } : {}),
  }

  const total = await collection().countDocuments(filter)
  const items = await collection()
    .aggregate<BookingResponse>([
      { $match: filter },
      ...bookingPipeline(),
      { $sort: { createdAt: -1 } },
      { $skip: (query.page - 1) * query.limit },
      { $limit: query.limit },
    ])
    .toArray()

  return {
    items,
    pagination: paginationOf(total, query.page, query.limit),
  }
}

const getById = async (id: string, user: AuthUser): Promise<BookingResponse> => {
  const existing = await findRawById(id)

  if (
    user.role !== "admin" &&
    existing.customerId !== user.id &&
    existing.vendorId !== user.id
  ) {
    throw AppError.forbidden(
      "Forbidden: You can only view bookings connected to your account.",
    )
  }

  return withDetails(existing._id)
}

const cancel = async (
  id: string,
  customer: AuthUser,
): Promise<BookingResponse> => {
  const existing = await findRawById(id)

  if (existing.customerId !== customer.id) {
    throw AppError.forbidden(
      "Forbidden: Only the customer who made this request can cancel it.",
    )
  }

  if (existing.status !== "pending") {
    throw AppError.conflict("Only pending booking requests can be cancelled.")
  }

  await collection().updateOne(
    { _id: existing._id },
    { $set: { status: "cancelled", updatedAt: new Date() } },
  )

  return withDetails(existing._id)
}

const vendorList = async (
  vendorId: string,
  query: ListBookingsQuery,
): Promise<PaginatedBookings> => {
  const filter: Document = {
    vendorId,
    ...(query.status ? { status: query.status } : {}),
  }

  const total = await collection().countDocuments(filter)
  const items = await collection()
    .aggregate<BookingResponse>([
      { $match: filter },
      ...bookingPipeline(),
      { $sort: { createdAt: -1 } },
      { $skip: (query.page - 1) * query.limit },
      { $limit: query.limit },
    ])
    .toArray()

  return {
    items,
    pagination: paginationOf(total, query.page, query.limit),
  }
}

const vendorDecide = async (
  id: string,
  input: VendorDecisionInput,
  vendor: AuthUser,
): Promise<BookingResponse> => {
  const existing = await findRawById(id)

  if (existing.vendorId !== vendor.id) {
    throw AppError.forbidden(
      "Forbidden: You can only respond to requests for your own services.",
    )
  }

  if (existing.status !== "pending") {
    throw AppError.conflict("This booking request has already been answered.")
  }

  await collection().updateOne(
    { _id: existing._id },
    { $set: { status: input.status, updatedAt: new Date() } },
  )

  return withDetails(existing._id)
}

/** Idempotent — safe to call on every boot. */
const ensureIndexes = async (): Promise<void> => {
  const bookings = collection()

  await Promise.all([
    bookings.createIndex(
      { customerId: 1, createdAt: -1 },
      { name: "customer_booking_history" },
    ),
    bookings.createIndex(
      { vendorId: 1, status: 1 },
      { name: "vendor_booking_inbox" },
    ),
    bookings.createIndex(
      { serviceId: 1, eventDate: 1 },
      { name: "service_event_date" },
    ),
    // Database-level backstop for the duplicate check above: only one live
    // request per customer/service/calendar day. Cancelled or rejected rows
    // leave the partial index, so a fresh request can be made.
    bookings.createIndex(
      { customerId: 1, serviceId: 1, eventDate: 1 },
      {
        name: "one_live_request_per_day",
        unique: true,
        partialFilterExpression: { status: { $in: ["pending", "accepted"] } },
      },
    ),
  ])
}

export const bookingService = {
  create,
  listMine,
  getById,
  cancel,
  vendorList,
  vendorDecide,
  ensureIndexes,
}
