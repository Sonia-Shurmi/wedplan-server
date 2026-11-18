import { env, requireSecret } from "../../config/env.js"
import { AppError } from "../../utils/AppError.js"

const IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload"
const REQUEST_TIMEOUT_MS = 20_000

interface ImgBBPayload {
  success?: boolean
  status?: number
  data?: {
    id?: string
    url?: string
    display_url?: string
    width?: string | number
    height?: string | number
    size?: string | number
    time?: string | number
  }
  error?: {
    message?: string
    code?: number
  }
}

export interface UploadedImage {
  id: string
  url: string
  displayUrl: string
  width: number
  height: number
  size: number
}

/**
 * ImgBB only uses the name for the hosted file's label, so keep it short and
 * free of anything that could look like a path.
 */
const sanitizeName = (name?: string): string | undefined => {
  if (!name) {
    return undefined
  }

  const cleaned = name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9 -]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)

  return cleaned || undefined
}

const toNumber = (value: string | number | undefined): number => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Uploads a validated base64 image to ImgBB.
 *
 * The API key and the raw image are never logged: only a short provider
 * status line is written when ImgBB rejects a file.
 */
export const uploadImageToImgBB = async (
  base64: string,
  name?: string,
): Promise<UploadedImage> => {
  if (!env.imgbbApiKey) {
    throw new AppError(
      503,
      "Image uploads are not configured on this server yet. Please try again later.",
    )
  }

  const apiKey = requireSecret(env.imgbbApiKey, "IMGBB_API_KEY")
  const form = new URLSearchParams({ image: base64 })

  const label = sanitizeName(name)

  if (label) {
    form.set("name", label)
  }

  let response: Response

  try {
    response = await fetch(
      `${IMGBB_UPLOAD_URL}?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    )
  } catch (error) {
    console.error(
      "ImgBB request failed:",
      error instanceof Error ? error.name : "unknown error",
    )

    throw new AppError(
      502,
      "Could not reach the image hosting service. Please try again.",
    )
  }

  const payload = (await response.json().catch(() => null)) as
    | ImgBBPayload
    | null

  if (!response.ok || payload?.success !== true || !payload.data?.url) {
    console.error(
      `ImgBB rejected an upload (HTTP ${response.status}): ${
        payload?.error?.message ?? "no provider message"
      }`,
    )

    throw new AppError(
      502,
      "The image hosting service could not process this file. Please try another image.",
    )
  }

  return {
    id: payload.data.id ?? "",
    url: payload.data.url,
    displayUrl: payload.data.display_url ?? payload.data.url,
    width: toNumber(payload.data.width),
    height: toNumber(payload.data.height),
    size: toNumber(payload.data.size),
  }
}
