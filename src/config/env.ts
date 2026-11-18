import "dotenv/config"

/**
 * Centralised, validated environment access.
 *
 * Only variables that are required for the API to boot are enforced here.
 * Stripe and ImgBB are validated lazily by the modules that use them so that
 * local development can run before those keys exist.
 */

const requiredVariables = [
  "MONGODB_URI",
  "DATABASE_NAME",
  "CLIENT_URL",
  "BETTER_AUTH_URL",
] as const

const missingVariables = requiredVariables.filter(
  (key) => !process.env[key]?.trim(),
)

if (missingVariables.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVariables.join(", ")}. ` +
      "Copy .env.example to .env and fill them in.",
  )
}

const toUrl = (key: string, value: string) => {
  try {
    return new URL(value).toString().replace(/\/+$/, "")
  } catch {
    throw new Error(`${key} must be a valid absolute URL, received "${value}"`)
  }
}

const clientUrl = toUrl("CLIENT_URL", process.env.CLIENT_URL!.trim())
const betterAuthUrl = toUrl(
  "BETTER_AUTH_URL",
  process.env.BETTER_AUTH_URL!.trim(),
)

const nodeEnv = process.env.NODE_ENV?.trim() || "development"
const port = Number(process.env.PORT ?? 5000)

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`PORT must be a valid port number, received "${process.env.PORT}"`)
}

const optional = (key: string) => process.env[key]?.trim() || undefined

export const env = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  port,
  clientUrl,
  mongodbUri: process.env.MONGODB_URI!.trim(),
  databaseName: process.env.DATABASE_NAME!.trim(),
  betterAuthUrl,
  betterAuthJwksUrl:
    optional("BETTER_AUTH_JWKS_URL") ??
    `${betterAuthUrl}/api/auth/jwks`,
  stripeSecretKey: optional("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: optional("STRIPE_WEBHOOK_SECRET"),
  imgbbApiKey: optional("IMGBB_API_KEY"),
  premiumPriceCents: Number(process.env.PREMIUM_PRICE_CENTS ?? 1900),
} as const

/**
 * Read a secret that is only needed for a specific feature, with a clear
 * error instead of a confusing downstream failure.
 */
export const requireSecret = (
  value: string | undefined,
  variableName: string,
): string => {
  if (!value) {
    throw new Error(
      `${variableName} is not configured. Add it to the server environment.`,
    )
  }

  return value
}
