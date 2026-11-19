import { Router } from "express"

import { requireAuth } from "../../middleware/auth.middleware.js"
import { requireRole } from "../../middleware/role.middleware.js"
import { validate } from "../../middleware/validate.js"
import { adminController } from "./admin.controller.js"
import {
  adminTransactionListQuerySchema,
  adminUserIdParamsSchema,
  adminUserListQuerySchema,
  blockUserSchema,
} from "./admin.validation.js"

/** Mounted at `/api/admin/users`. */
export const adminUsersRouter = Router()

adminUsersRouter.use(requireAuth, requireRole("admin"))

adminUsersRouter.get(
  "/",
  validate({ query: adminUserListQuerySchema }),
  adminController.listUsers,
)

adminUsersRouter.get(
  "/:id",
  validate({ params: adminUserIdParamsSchema }),
  adminController.getUser,
)

adminUsersRouter.patch(
  "/:id/block",
  validate({ params: adminUserIdParamsSchema, body: blockUserSchema }),
  adminController.blockUser,
)

/** Mounted at `/api/admin/transactions`. Read-only by design. */
export const adminTransactionsRouter = Router()

adminTransactionsRouter.use(requireAuth, requireRole("admin"))

adminTransactionsRouter.get(
  "/",
  validate({ query: adminTransactionListQuerySchema }),
  adminController.listTransactions,
)
