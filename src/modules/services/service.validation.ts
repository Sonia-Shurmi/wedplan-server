import { z } from "zod"

import { normalizeCategory } from "../categories/category.constants.js"

export const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i

const categoryField = z
  .string({ error: "A category is required." })
  .refine((value) => normalizeCategory(value) !== null, {
    message:
      "Choose one of the six WedPlan categories (e.g. 'Wedding Venues').",
  })
  .transform((value) => normalizeCategory(value)!)

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(24).default(12),
}

export const listServicesQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: categoryField.optional(),
  location: z.string().trim().max(120).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
  ...paginationQuery,
})

export type ListServicesQuery = z.infer<typeof listServicesQuerySchema>

export const serviceIdParamsSchema = z.object({
  id: z
    .string()
    .regex(OBJECT_ID_PATTERN, "Invalid service id."),
})

export type ServiceIdParams = z.infer<typeof serviceIdParamsSchema>

export const createServiceSchema = z.object({
  serviceName: z
    .string()
    .trim()
    .min(3, "Service name must be at least 3 characters.")
    .max(120, "Service name must be 120 characters or fewer."),
  category: categoryField,
  description: z
    .string()
    .trim()
    .min(20, "Description must be at least 20 characters.")
    .max(2000, "Description must be 2000 characters or fewer."),
  price: z.coerce
    .number()
    .positive("Price must be greater than zero.")
    .max(1_000_000, "Price must be 1,000,000 or less."),
  location: z
    .string()
    .trim()
    .min(2, "Location is required.")
    .max(120, "Location must be 120 characters or fewer."),
  images: z
    .array(z.url("Each image must be a valid URL."))
    .min(1, "Add at least one image.")
    .max(5, "You can add up to five images."),
})

export type CreateServiceInput = z.infer<typeof createServiceSchema>

export const updateServiceSchema = createServiceSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "Provide at least one field to update." },
)

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>

export const availabilitySchema = z.object({
  isActive: z.boolean({ error: "isActive must be a boolean." }),
})

export type AvailabilityInput = z.infer<typeof availabilitySchema>

export const adminListServicesQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type AdminListServicesQuery = z.infer<
  typeof adminListServicesQuerySchema
>

export const adminUpdateServiceSchema = z
  .object({
    status: z.enum(["pending", "approved", "rejected"]).optional(),
    isActive: z.boolean().optional(),
    rejectionReason: z
      .string()
      .trim()
      .max(300, "The reason must be 300 characters or fewer.")
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  })

export type AdminUpdateServiceInput = z.infer<
  typeof adminUpdateServiceSchema
>
