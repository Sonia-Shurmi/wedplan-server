import { z } from "zod"

export const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i

const startOfUtcDay = (date: Date): Date =>
  new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`)

/**
 * The client date input sends `YYYY-MM-DD`. Keeping one canonical UTC-midnight
 * Date makes "today or later" and "same calendar day" checks exact, with no
 * timezone drift between the API and the stored document.
 */
const eventDateField = z
  .string({ error: "Event date is required." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the event date as YYYY-MM-DD.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`)

    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    )
  }, "Enter a valid calendar date.")
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .refine(
    (date) => date.getTime() >= startOfUtcDay(new Date()).getTime(),
    "Choose today or a future date.",
  )

export const createBookingSchema = z.object({
  serviceId: z.string().regex(OBJECT_ID_PATTERN, "Invalid service id."),
  eventDate: eventDateField,
  eventLocation: z
    .string()
    .trim()
    .min(2, "Event location is required.")
    .max(200, "Event location must be 200 characters or fewer."),
  message: z
    .string()
    .trim()
    .max(1000, "Message must be 1000 characters or fewer.")
    .optional(),
})

export type CreateBookingInput = z.infer<typeof createBookingSchema>

export const bookingIdParamsSchema = z.object({
  id: z.string().regex(OBJECT_ID_PATTERN, "Invalid booking id."),
})

export type BookingIdParams = z.infer<typeof bookingIdParamsSchema>

export const listBookingsQuerySchema = z.object({
  status: z
    .enum(["pending", "accepted", "rejected", "cancelled"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>

export const vendorDecisionSchema = z.object({
  status: z.enum(["accepted", "rejected"], {
    error: "Choose either accepted or rejected.",
  }),
})

export type VendorDecisionInput = z.infer<typeof vendorDecisionSchema>
