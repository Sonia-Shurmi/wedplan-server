import { existsSync, readdirSync } from "node:fs"
import { extname, resolve } from "node:path"

const IMAGE_EXTENSIONS = new Set([".avif", ".jpeg", ".jpg", ".png", ".webp"])

/** Kept as the hero/fallback image; service photos live beside it. */
export const FALLBACK_SERVICE_IMAGE = "/images/wedding.jpg"

export const getServiceImagesDir = (): string =>
  process.env.CLIENT_IMAGES_DIR
    ? resolve(process.env.CLIENT_IMAGES_DIR)
    : resolve(process.cwd(), "..", "wedplan-client", "public", "images")

/**
 * Reads the client's public/images folder and returns browser-safe URLs.
 * `wedding.jpg` is used by the hero and as a fallback, so it is excluded when
 * dedicated service photos are available.
 */
export const readServiceImagePaths = (): string[] => {
  const directory = getServiceImagesDir()

  if (!existsSync(directory)) {
    return [FALLBACK_SERVICE_IMAGE]
  }

  const files = readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()),
    )
    .map((entry) => entry.name)
    .sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    )

  const serviceFiles =
    files.length > 1
      ? files.filter((name) => name.toLowerCase() !== "wedding.jpg")
      : files

  const pool = serviceFiles.length > 0 ? serviceFiles : files

  return pool.length > 0
    ? pool.map((name) => `/images/${encodeURIComponent(name)}`)
    : [FALLBACK_SERVICE_IMAGE]
}

/** Spreads every available photo across the services as evenly as possible. */
export const assignServiceImages = (
  serviceNames: string[],
): Record<string, string[]> => {
  const pool = readServiceImagePaths()

  if (pool.length <= serviceNames.length) {
    return Object.fromEntries(
      serviceNames.map((name, index) => [
        name,
        [pool[index % pool.length]],
      ]),
    )
  }

  const baseCount = Math.floor(pool.length / serviceNames.length)
  const extraCount = pool.length % serviceNames.length
  let cursor = 0

  return Object.fromEntries(
    serviceNames.map((name, index) => {
      const count = baseCount + (index < extraCount ? 1 : 0)
      const images = pool.slice(cursor, cursor + count)
      cursor += count
      return [name, images]
    }),
  )
}
