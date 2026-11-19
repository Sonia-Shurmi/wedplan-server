import { ObjectId, type Document } from "mongodb"

import { getDB } from "../../config/db.js"
import { isPremiumUser, type AuthUser } from "../auth/auth.types.js"
import { AppError } from "../../utils/AppError.js"
import type {
  PaginatedServices,
  Pagination,
  ServiceRecord,
  ServiceResponse,
} from "./service.interface.js"
import {
  OBJECT_ID_PATTERN,
  type AdminListServicesQuery,
  type AdminUpdateServiceInput,
  type AvailabilityInput,
  type CreateServiceInput,
  type ListServicesQuery,
  type UpdateServiceInput,
} from "./service.validation.js"

/** Free accounts may keep three services; rejected drafts do not count. */
export const FREE_SERVICE_LIMIT = 3
export const FEATURED_LIMIT = 6

const collection = () => getDB().collection<ServiceRecord>("services")

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

const requireObjectId = (id: string): ObjectId => {
  if (!OBJECT_ID_PATTERN.test(id)) {
    throw AppError.badRequest("Invalid service id.")
  }

  return new ObjectId(id)
}

/**
 * Adds the vendor summary and the derived `isPremiumVendor` flag to a
 * service document. The user collection is authoritative for both fields, so
 * an expired Stripe subscription stops being premium immediately.
 */
const vendorPipeline = (): Document[] => [
  {
    $lookup: {
      from: "users",
      let: { vendorId: "$vendorId" },
      pipeline: [
        {
          $match: {
            $expr: { $eq: [{ $toString: "$_id" }, "$$vendorId"] },
          },
        },
        { $limit: 1 },
        {
          $project: {
            name: 1,
            businessName: 1,
            image: 1,
            subscriptionPlan: 1,
            subscriptionExpiresAt: 1,
          },
        },
      ],
      as: "vendor",
    },
  },
  {
    $addFields: {
      vendor: {
        $cond: [
          { $gt: [{ $size: "$vendor" }, 0] },
          {
            $let: {
              vars: { summary: { $arrayElemAt: ["$vendor", 0] } },
              in: {
                _id: { $toString: "$$summary._id" },
                name: { $ifNull: ["$$summary.name", "WedPlan vendor"] },
                businessName: { $ifNull: ["$$summary.businessName", null] },
                image: { $ifNull: ["$$summary.image", null] },
                subscriptionPlan: {
                  $ifNull: ["$$summary.subscriptionPlan", "free"],
                },
              },
            },
          },
          null,
        ],
      },
      isPremiumVendor: {
        $let: {
          vars: {
            plan: { $arrayElemAt: ["$vendor.subscriptionPlan", 0] },
            expiresAt: { $arrayElemAt: ["$vendor.subscriptionExpiresAt", 0] },
          },
          in: {
            $and: [
              { $eq: ["$$plan", "premium"] },
              {
                $or: [
                  { $eq: ["$$expiresAt", null] },
                  { $gt: ["$$expiresAt", "$$NOW"] },
                ],
              },
            ],
          },
        },
      },
    },
  },
  {
    $project: {
      _id: 1,
      vendorId: 1,
      serviceName: 1,
      category: 1,
      description: 1,
      price: 1,
      currency: 1,
      location: 1,
      images: 1,
      status: 1,
      isActive: 1,
      rejectionReason: 1,
      isPremiumVendor: 1,
      vendor: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  },
]

const searchFilter = (search?: string): Document[] => {
  if (!search) {
    return []
  }

  const pattern = escapeRegex(search)

  return [
    {
      $or: [
        { serviceName: { $regex: pattern, $options: "i" } },
        { description: { $regex: pattern, $options: "i" } },
        { category: { $regex: pattern, $options: "i" } },
        { location: { $regex: pattern, $options: "i" } },
      ],
    },
  ]
}

const sortFor = (sort: ListServicesQuery["sort"]): Document => {
  switch (sort) {
    case "price_asc":
      return { price: 1 }
    case "price_desc":
      return { price: -1 }
    default:
      return { createdAt: -1 }
  }
}

const findRawById = async (id: string) => {
  const service = await collection().findOne({ _id: requireObjectId(id) })

  if (!service) {
    throw AppError.notFound("Service not found.")
  }

  return service
}

const assertOwnership = (service: ServiceRecord, user: AuthUser) => {
  if (service.vendorId !== user.id) {
    throw AppError.forbidden(
      "Forbidden: You can only manage services that belong to your business.",
    )
  }
}

const getService = async (
  id: string,
  options: { includeUnpublished?: boolean } = {},
): Promise<ServiceResponse> => {
  const filter: Document = { _id: requireObjectId(id) }

  if (!options.includeUnpublished) {
    filter.status = "approved"
    filter.isActive = true
  }

  const [service] = await collection()
    .aggregate<ServiceResponse>([
      { $match: filter },
      ...vendorPipeline(),
      { $limit: 1 },
    ])
    .toArray()

  if (!service) {
    throw AppError.notFound("Service not found.")
  }

  return service
}

const list = async (
  query: ListServicesQuery,
): Promise<PaginatedServices> => {
  const filter: Document = {
    status: "approved",
    isActive: true,
    ...(query.category ? { category: query.category } : {}),
    ...(query.location
      ? { location: { $regex: escapeRegex(query.location), $options: "i" } }
      : {}),
  }

  const searchStages = searchFilter(query.search)
  const matchStage = searchStages.length
    ? { $match: { $and: [filter, ...searchStages] } }
    : { $match: filter }

  const total = await collection().countDocuments(matchStage.$match)
  const items = await collection()
    .aggregate<ServiceResponse>([
      matchStage,
      ...vendorPipeline(),
      { $sort: sortFor(query.sort) },
      { $skip: (query.page - 1) * query.limit },
      { $limit: query.limit },
    ])
    .toArray()

  return {
    items,
    pagination: paginationOf(total, query.page, query.limit),
  }
}

const getFeatured = async (): Promise<ServiceResponse[]> =>
  collection()
    .aggregate<ServiceResponse>([
      { $match: { status: "approved", isActive: true } },
      ...vendorPipeline(),
      { $sort: { createdAt: -1 } },
      { $limit: FEATURED_LIMIT },
    ])
    .toArray()

const create = async (
  input: CreateServiceInput,
  vendor: AuthUser,
): Promise<ServiceResponse> => {
  if (!isPremiumUser(vendor)) {
    const existing = await collection().countDocuments({
      vendorId: vendor.id,
      status: { $ne: "rejected" },
    })

    if (existing >= FREE_SERVICE_LIMIT) {
      throw AppError.conflict(
        `Free plans include up to ${FREE_SERVICE_LIMIT} services. Upgrade to Premium to publish more.`,
      )
    }
  }

  const now = new Date()
  const record: ServiceRecord = {
    vendorId: vendor.id,
    serviceName: input.serviceName,
    category: input.category,
    description: input.description,
    price: input.price,
    currency: "USD",
    location: input.location,
    images: input.images,
    status: "pending",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }

  const result = await collection().insertOne(record)

  return getService(result.insertedId.toString(), {
    includeUnpublished: true,
  })
}

const getMine = async (vendorId: string): Promise<ServiceResponse[]> =>
  collection()
    .aggregate<ServiceResponse>([
      { $match: { vendorId } },
      ...vendorPipeline(),
      { $sort: { createdAt: -1 } },
    ])
    .toArray()

const update = async (
  id: string,
  input: UpdateServiceInput,
  vendor: AuthUser,
): Promise<ServiceResponse> => {
  const existing = await findRawById(id)
  assertOwnership(existing, vendor)

  const set: Partial<ServiceRecord> = { updatedAt: new Date() }

  if (input.serviceName !== undefined) set.serviceName = input.serviceName
  if (input.category !== undefined) set.category = input.category
  if (input.description !== undefined) set.description = input.description
  if (input.price !== undefined) set.price = input.price
  if (input.location !== undefined) set.location = input.location
  if (input.images !== undefined) set.images = input.images

  // A rejected listing must be reviewed again before it can go public.
  if (existing.status === "rejected") {
    set.status = "pending"
  }

  await collection().updateOne({ _id: existing._id }, { $set: set })

  return getService(id, { includeUnpublished: true })
}

const remove = async (id: string, vendor: AuthUser): Promise<void> => {
  const existing = await findRawById(id)
  assertOwnership(existing, vendor)

  await collection().deleteOne({ _id: existing._id })
}

const setAvailability = async (
  id: string,
  input: AvailabilityInput,
  vendor: AuthUser,
): Promise<ServiceResponse> => {
  const existing = await findRawById(id)
  assertOwnership(existing, vendor)

  if (input.isActive && !isPremiumUser(vendor)) {
    const active = await collection().countDocuments({
      vendorId: vendor.id,
      status: "approved",
      isActive: true,
      _id: { $ne: existing._id },
    })

    if (active >= FREE_SERVICE_LIMIT) {
      throw AppError.conflict(
        `Free plans allow up to ${FREE_SERVICE_LIMIT} active services. Upgrade to Premium to publish more.`,
      )
    }
  }

  await collection().updateOne(
    { _id: existing._id },
    { $set: { isActive: input.isActive, updatedAt: new Date() } },
  )

  return getService(id, { includeUnpublished: true })
}

const adminList = async (
  query: AdminListServicesQuery,
): Promise<PaginatedServices> => {
  const filter: Document = {
    ...(query.status ? { status: query.status } : {}),
  }
  const searchStages = searchFilter(query.search)
  const matchStage = searchStages.length
    ? { $match: { $and: [filter, ...searchStages] } }
    : { $match: filter }

  const total = await collection().countDocuments(matchStage.$match)
  const items = await collection()
    .aggregate<ServiceResponse>([
      matchStage,
      ...vendorPipeline(),
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

const adminUpdate = async (
  id: string,
  input: AdminUpdateServiceInput,
): Promise<ServiceResponse> => {
  const existing = await findRawById(id)
  const set: Partial<ServiceRecord> = { updatedAt: new Date() }

  if (input.status !== undefined) set.status = input.status
  if (input.isActive !== undefined) set.isActive = input.isActive

  if (input.rejectionReason !== undefined) {
    set.rejectionReason =
      input.status === "rejected" && input.rejectionReason
        ? input.rejectionReason
        : null
  } else if (input.status === "approved") {
    set.rejectionReason = null
  }

  await collection().updateOne({ _id: existing._id }, { $set: set })

  return getService(id, { includeUnpublished: true })
}

const adminRemove = async (id: string): Promise<void> => {
  const existing = await findRawById(id)
  await collection().deleteOne({ _id: existing._id })
}

/** Idempotent — safe to call on every boot and from the migration script. */
const ensureIndexes = async (): Promise<void> => {
  const services = collection()

  await Promise.all([
    services.createIndex(
      { status: 1, isActive: 1, createdAt: -1 },
      { name: "public_listing" },
    ),
    services.createIndex({ vendorId: 1 }, { name: "vendor_lookup" }),
    services.createIndex(
      {
        serviceName: "text",
        category: "text",
        location: "text",
        description: "text",
      },
      {
        name: "service_search",
        weights: { serviceName: 10, category: 5, location: 3, description: 1 },
      },
    ),
  ])
}

export const serviceService = {
  list,
  getFeatured,
  getById: getService,
  create,
  getMine,
  update,
  remove,
  setAvailability,
  adminList,
  adminUpdate,
  adminRemove,
  ensureIndexes,
}
