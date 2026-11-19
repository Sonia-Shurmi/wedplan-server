import type { Request, Response } from "express"

import { bookingService } from "./booking.service.js"
import type {
  BookingIdParams,
  CreateBookingInput,
  ListBookingsQuery,
  VendorDecisionInput,
} from "./booking.validation.js"

const paramsOf = (req: Request): BookingIdParams =>
  (req.validated?.params ?? {}) as BookingIdParams

const listQueryOf = (req: Request): ListBookingsQuery =>
  (req.validated?.query ?? {}) as ListBookingsQuery

/** Express 5 forwards rejected async handlers to the central error handler. */
const create = async (req: Request, res: Response) => {
  const booking = await bookingService.create(
    req.validated?.body as CreateBookingInput,
    req.user!,
  )

  res.status(201).json({
    success: true,
    message: "Booking request sent successfully.",
    data: booking,
  })
}

const listMine = async (req: Request, res: Response) => {
  const result = await bookingService.listMine(req.user!.id, listQueryOf(req))

  res.status(200).json({
    success: true,
    message: "Your booking requests retrieved successfully",
    data: result.items,
    pagination: result.pagination,
  })
}

const getById = async (req: Request, res: Response) => {
  const booking = await bookingService.getById(paramsOf(req).id, req.user!)

  res.status(200).json({
    success: true,
    message: "Booking retrieved successfully",
    data: booking,
  })
}

const cancel = async (req: Request, res: Response) => {
  const booking = await bookingService.cancel(paramsOf(req).id, req.user!)

  res.status(200).json({
    success: true,
    message: "Booking request cancelled successfully",
    data: booking,
  })
}

const vendorList = async (req: Request, res: Response) => {
  const result = await bookingService.vendorList(req.user!.id, listQueryOf(req))

  res.status(200).json({
    success: true,
    message: "Booking requests retrieved successfully",
    data: result.items,
    pagination: result.pagination,
  })
}

const vendorDecide = async (req: Request, res: Response) => {
  const booking = await bookingService.vendorDecide(
    paramsOf(req).id,
    req.validated?.body as VendorDecisionInput,
    req.user!,
  )

  res.status(200).json({
    success: true,
    message:
      booking.status === "accepted"
        ? "Booking request accepted."
        : "Booking request rejected.",
    data: booking,
  })
}

export const bookingController = {
  create,
  listMine,
  getById,
  cancel,
}

export const vendorBookingController = {
  list: vendorList,
  decide: vendorDecide,
}
