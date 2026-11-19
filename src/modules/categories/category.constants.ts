/**
 * The marketplace's six categories. `name` is the value stored on every
 * service document and is shared with the Next.js client (lib/constants.ts).
 */
export interface CategoryDefinition {
  name: string
  slug: string
  description: string
  icon: string
}

export const CATEGORIES: readonly CategoryDefinition[] = [
  {
    name: "Photography & Videography",
    slug: "photography-videography",
    description:
      "Photographers and filmmakers who capture the day exactly as it felt.",
    icon: "camera",
  },
  {
    name: "Wedding Venues",
    slug: "wedding-venues",
    description:
      "Gardens, ballrooms and heritage halls for ceremonies of every size.",
    icon: "building-2",
  },
  {
    name: "Decoration & Florist",
    slug: "decoration-florist",
    description:
      "Styling, florals and lighting that turn an empty room into your story.",
    icon: "flower-2",
  },
  {
    name: "Catering Services",
    slug: "catering-services",
    description:
      "Menus, tastings and service teams planned around every guest list.",
    icon: "utensils",
  },
  {
    name: "Makeup & Styling",
    slug: "makeup-styling",
    description:
      "Bridal looks and hair styling that hold from first look to last dance.",
    icon: "sparkles",
  },
  {
    name: "Wedding Fashion",
    slug: "wedding-fashion",
    description:
      "Bridal wear, groomswear and tailoring for the whole wedding party.",
    icon: "shirt",
  },
] as const

export const CATEGORY_NAMES: readonly string[] = CATEGORIES.map(
  (category) => category.name,
)

/** Legacy seed slugs/names that existed before services stored display names. */
const LEGACY_ALIASES: Record<string, string> = {
  photography: "Photography & Videography",
  "photography-videography": "Photography & Videography",
  photo: "Photography & Videography",
  venues: "Wedding Venues",
  venue: "Wedding Venues",
  "wedding-venues": "Wedding Venues",
  decoration: "Decoration & Florist",
  florist: "Decoration & Florist",
  "decoration-florist": "Decoration & Florist",
  catering: "Catering Services",
  "catering-services": "Catering Services",
  makeup: "Makeup & Styling",
  "makeup-beauty": "Makeup & Styling",
  "makeup-styling": "Makeup & Styling",
  beauty: "Makeup & Styling",
  attire: "Wedding Fashion",
  "wedding-attire": "Wedding Fashion",
  "wedding-fashion": "Wedding Fashion",
  fashion: "Wedding Fashion",
}

/**
 * Accepts a display name, a slug, or an old seed value and returns the
 * canonical display name. Unknown values return null so validation can reject
 * them instead of leaking slugs into the database.
 */
export const normalizeCategory = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  const key = trimmed.toLowerCase().replace(/\s+/g, " ")

  const exact = CATEGORIES.find(
    (category) => category.name.toLowerCase() === key,
  )

  if (exact) {
    return exact.name
  }

  const slugMatch = CATEGORIES.find((category) => category.slug === key)

  if (slugMatch) {
    return slugMatch.name
  }

  return LEGACY_ALIASES[key] ?? null
}
