import type { Request, Response } from "express"

import { serviceService } from "./service.service.js"
import type {
  AdminListServicesQuery,
  AdminUpdateServiceInput,
  AvailabilityInput,
  CreateServiceInput,
  ListServicesQuery,
  ServiceIdParams,
  UpdateServiceInput,
} from "./service.validation.js"

const paramsOf = (req: Request): ServiceIdParams =>
  (req.validated?.params ?? {}) as ServiceIdParams

/** Express 5 forwards rejected async handlers to the central error handler. */
const list = async (req: Request, res: Response) => {
  const query = (req.validated?.query ?? {}) as ListServicesQuery
  const result = await serviceService.list(query)

  res.status(200).json({
    success: true,
    message: "Services retrieved successfully",
    data: result.items,
    pagination: result.pagination,
  })
}

const getFeatured = async (_req: Request, res: Response) => {
  const services = await serviceService.getFeatured()

  res.status(200).json({
    success: true,
    message: "Featured services retrieved successfully",
    data: services,
  })
}

const getById = async (req: Request, res: Response) => {
  const service = await serviceService.getById(paramsOf(req).id, {
    // Admins may preview any service; other roles only see public ones.
    includeUnpublished: req.user?.role === "admin",
  })

  res.status(200).json({
    success: true,
    message: "Service retrieved successfully",
    data: service,
  })
}

const create = async (req: Request, res: Response) => {
  const service = await serviceService.create(
    req.validated?.body as CreateServiceInput,
    req.user!,
  )

  res.status(201).json({
    success: true,
    message:
      "Service created successfully. It will be visible once an admin approves it.",
    data: service,
  })
}

const getMine = async (req: Request, res: Response) => {
  const services = await serviceService.getMine(req.user!.id)

  res.status(200).json({
    success: true,
    message: "Your services retrieved successfully",
    data: services,
  })
}

const update = async (req: Request, res: Response) => {
  const service = await serviceService.update(
    paramsOf(req).id,
    req.validated?.body as UpdateServiceInput,
    req.user!,
  )

  res.status(200).json({
    success: true,
    message: "Service updated successfully",
    data: service,
  })
}

const remove = async (req: Request, res: Response) => {
  await serviceService.remove(paramsOf(req).id, req.user!)

  res.status(200).json({
    success: true,
    message: "Service deleted successfully",
    data: null,
  })
}

const setAvailability = async (req: Request, res: Response) => {
  const service = await serviceService.setAvailability(
    paramsOf(req).id,
    req.validated?.body as AvailabilityInput,
    req.user!,
  )

  res.status(200).json({
    success: true,
    message: service.isActive
      ? "Service is now active"
      : "Service is now inactive",
    data: service,
  })
}

const adminList = async (req: Request, res: Response) => {
  const query = (req.validated?.query ?? {}) as AdminListServicesQuery
  const result = await serviceService.adminList(query)

  res.status(200).json({
    success: true,
    message: "Services retrieved successfully",
    data: result.items,
    pagination: result.pagination,
  })
}

const adminUpdate = async (req: Request, res: Response) => {
  const service = await serviceService.adminUpdate(
    paramsOf(req).id,
    req.validated?.body as AdminUpdateServiceInput,
  )

  res.status(200).json({
    success: true,
    message: "Service moderation updated successfully",
    data: service,
  })
}

const adminRemove = async (req: Request, res: Response) => {
  await serviceService.adminRemove(paramsOf(req).id)

  res.status(200).json({
    success: true,
    message: "Service deleted successfully",
    data: null,
  })
}

export const serviceController = {
  list,
  getFeatured,
  getById,
  create,
  getMine,
  update,
  remove,
  setAvailability,
}

export const adminServiceController = {
  list: adminList,
  update: adminUpdate,
  remove: adminRemove,
}
