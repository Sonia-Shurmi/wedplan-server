import cors from "cors"
import express from "express"

// Registers the Express Request augmentation used across controllers.
import "./types/express.js"

import { connectDB } from "./config/db.js"
import { env } from "./config/env.js"
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js"
import {
  adminTransactionsRouter,
  adminUsersRouter,
} from "./modules/admin/admin.route.js"
import adminServiceRouter from "./modules/admin/admin-service.route.js"
import authRouter from "./modules/auth/auth.route.js"
import bookingRouter from "./modules/bookings/booking.route.js"
import vendorBookingRouter from "./modules/bookings/vendor-booking.route.js"
import categoryRouter from "./modules/categories/category.route.js"
import {
  adminStatsRouter,
  dashboardRouter,
} from "./modules/dashboard/dashboard.route.js"
import profileRouter from "./modules/profile/profile.route.js"
import serviceRouter from "./modules/services/service.route.js"
import subscriptionRouter from "./modules/subscriptions/subscription.route.js"
import stripeWebhookRouter from "./modules/subscriptions/webhook.route.js"
import { UPLOAD_BODY_LIMIT } from "./modules/uploads/upload.validation.js"
import uploadRouter from "./modules/uploads/upload.route.js"

const app = express()

app.disable("x-powered-by")

// Behind a hosting proxy (Vercel, Render) the client IP only reaches us
// through X-Forwarded-For, which the rate limiter needs for public uploads.
if (env.isProduction) {
  app.set("trust proxy", 1)
}

// Vercel imports this module directly and never runs `src/server.ts`, so the
// database cannot be connected once at process start. Connect on each request;
// connectDB() reuses a cached client after the first successful call.
app.use(async (_req, _res, next) => {
  try {
    await connectDB()
    next()
  } catch (error) {
    next(error)
  }
})

// CORS must be mounted before the routes it applies to.
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86_400,
  }),
)

// Stripe signs the exact bytes it sends, so this endpoint must be registered
// before any JSON body parser touches the request.
app.use(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhookRouter,
)

// Upload routes accept a larger JSON body, so they get their own parser
// before the default 1 MB parser runs.
app.use(
  "/api/uploads",
  express.json({ limit: UPLOAD_BODY_LIMIT }),
  uploadRouter,
)

app.use(express.json({ limit: "1mb" }))

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    message: "WedPlan API is running successfully!",
    timestamp: new Date().toISOString(),
  })
})

app.use("/api/me", authRouter)
app.use("/api/profile", profileRouter)
app.use("/api/categories", categoryRouter)
app.use("/api/admin/services", adminServiceRouter)
app.use("/api/admin/stats", adminStatsRouter)
app.use("/api/admin/transactions", adminTransactionsRouter)
app.use("/api/admin/users", adminUsersRouter)
app.use("/api/dashboard", dashboardRouter)
app.use("/api/vendor/bookings", vendorBookingRouter)
app.use("/api/services", serviceRouter)
app.use("/api/bookings", bookingRouter)
app.use("/api/subscriptions", subscriptionRouter)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
