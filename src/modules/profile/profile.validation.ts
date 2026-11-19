import { z } from "zod"

/** Avatar hosts the app already trusts and can render with next/image. */
const ALLOWED_IMAGE_HOSTNAMES = new Set([
  "i.ibb.co",
  "lh3.googleusercontent.com",
])

const MAX_IMAGE_URL_LENGTH = 1000

export const isAllowedProfileImageUrl = (value: string): boolean => {
  try {
    const url = new URL(value)

    if (url.protocol !== "https:" || url.username || url.password) {
      return false
    }

    return ALLOWED_IMAGE_HOSTNAMES.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

/**
 * Only these three fields are writable through the profile endpoint. `.strict()`
 * rejects role, email, blocked state and subscription changes instead of
 * silently forwarding them to the database.
 */
export const profileUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(80, "Name must be 80 characters or fewer.")
      .optional(),
    image: z
      .union([
        z
          .string()
          .trim()
          .min(1, "Use null to remove your profile photo.")
          .max(
            MAX_IMAGE_URL_LENGTH,
            "Image URL must be 1000 characters or fewer.",
          )
          .refine(
            isAllowedProfileImageUrl,
            "Profile photos must be hosted by WedPlan or Google.",
          ),
        z.literal(null),
      ])
      .optional(),
    businessName: z
      .string()
      .trim()
      .max(80, "Business name must be 80 characters or fewer.")
      .nullable()
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "No profile changes were supplied.",
    path: [],
  })

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
