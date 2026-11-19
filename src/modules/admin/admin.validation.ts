import { z } from "zod"

import { OBJECT_ID_PATTERN } from "../services/service.validation.js"

export const adminUserListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(["admin", "vendor", "customer"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>

export const adminUserIdParamsSchema = z.object({
  id: z.string().regex(OBJECT_ID_PATTERN, "Invalid user id."),
})

export type AdminUserIdParams = z.infer<typeof adminUserIdParamsSchema>

export const blockUserSchema = z.object({
  isBlocked: z.boolean({ error: "isBlocked must be a boolean." }),
})

export type BlockUserInput = z.infer<typeof blockUserSchema>

export const ADMIN_TRANSACTION_STATUSES = [
  "succeeded",
  "paid",
  "completed",
  "pending",
  "failed",
] as const

export const adminTransactionListQuerySchema = z.object({
  status: z.enum(ADMIN_TRANSACTION_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type AdminTransactionListQuery = z.infer<
  typeof adminTransactionListQuerySchema
>
