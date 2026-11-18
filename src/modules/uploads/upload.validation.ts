import { z } from "zod"

import { AppError } from "../../utils/AppError.js"

/** Image formats ImgBB accepts that we are willing to proxy. */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number]

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_IMAGE_MEGABYTES = MAX_IMAGE_BYTES / (1024 * 1024)

/**
 * Body-parser limit for upload routes only. Base64 inflates a file by ~33%,
 * so this must stay comfortably above MAX_IMAGE_BYTES. The size check below
 * is the real gate; this only stops absurd payloads from being buffered.
 */
export const UPLOAD_BODY_LIMIT = "16mb"

const DATA_URL_PATTERN =
  /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/

const EXTENSIONS: Record<AllowedImageMimeType, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export const uploadBodySchema = z.object({
  image: z
    .string({ error: "An image is required." })
    .min(1, "An image is required."),
  name: z.string().trim().max(80, "File name is too long.").optional(),
})

export type UploadBody = z.infer<typeof uploadBodySchema>

/** Shape returned by both upload endpoints. */
export interface UploadedImageResponse {
  id: string
  url: string
  displayUrl?: string
  width: number
  height: number
  size: number
  mimeType: AllowedImageMimeType
  bytes: number
}

export interface ParsedImage {
  /** Base64 payload without the data-URL prefix. */
  base64: string
  mimeType: AllowedImageMimeType
  bytes: number
  extension: "jpg" | "png" | "webp"
}

/** Length of the decoded bytes without allocating a Buffer. */
const decodedLength = (base64: string): number => {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0

  return Math.floor((base64.length * 3) / 4) - padding
}

/**
 * Validates a base64 data URL and strips its prefix.
 * Only the three whitelisted image types and files up to 5 MB are accepted.
 */
export const parseImagePayload = (input: string): ParsedImage => {
  const value = input.replace(/\s+/g, "")
  const match = DATA_URL_PATTERN.exec(value)

  if (!match) {
    if (value.startsWith("data:")) {
      throw AppError.badRequest(
        "Only JPEG, PNG and WebP images are supported.",
      )
    }

    throw AppError.badRequest(
      "Send the image as a base64 data URL, for example data:image/jpeg;base64,...",
    )
  }

  const [, mimeType, base64] = match
  const bytes = decodedLength(base64)

  if (bytes === 0) {
    throw AppError.badRequest("The uploaded image is empty.")
  }

  if (bytes > MAX_IMAGE_BYTES) {
    throw AppError.badRequest(
      `Image is too large. Maximum size is ${MAX_IMAGE_MEGABYTES} MB.`,
    )
  }

  return {
    base64,
    mimeType: mimeType as AllowedImageMimeType,
    bytes,
    extension: EXTENSIONS[mimeType as AllowedImageMimeType],
  }
}
