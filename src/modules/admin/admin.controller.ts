import type { Request, Response } from "express"

import { adminService } from "./admin.service.js"
import type {
  AdminTransactionListQuery,
  AdminUserIdParams,
  AdminUserListQuery,
  BlockUserInput,
} from "./admin.validation.js"

const userQueryOf = (req: Request): AdminUserListQuery =>
  (req.validated?.query ?? {}) as AdminUserListQuery

const transactionQueryOf = (req: Request): AdminTransactionListQuery =>
  (req.validated?.query ?? {}) as AdminTransactionListQuery

const userIdOf = (req: Request): string =>
  ((req.validated?.params ?? {}) as AdminUserIdParams).id

const send = (res: Response, message: string, data: unknown, extra = {}) =>
  res.status(200).json({ success: true, message, data, ...extra })

/** Express 5 forwards rejected async handlers to the central error handler. */
const listUsers = async (req: Request, res: Response) => {
  const result = await adminService.listUsers(userQueryOf(req))

  send(res, "Users retrieved successfully.", result.items, {
    pagination: result.pagination,
  })
}

const getUser = async (req: Request, res: Response) => {
  const user = await adminService.getUser(userIdOf(req))

  send(res, "User retrieved successfully.", user)
}

const blockUser = async (req: Request, res: Response) => {
  const user = await adminService.setBlocked(
    userIdOf(req),
    (req.validated?.body as BlockUserInput).isBlocked,
    req.user!,
  )

  send(
    res,
    user.isBlocked
      ? "User has been blocked."
      : "User has been unblocked.",
    user,
  )
}

const listTransactions = async (req: Request, res: Response) => {
  const result = await adminService.listTransactions(transactionQueryOf(req))

  send(res, "Transactions retrieved successfully.", result.items, {
    pagination: result.pagination,
    summary: result.summary,
  })
}

export const adminController = {
  listUsers,
  getUser,
  blockUser,
  listTransactions,
}
