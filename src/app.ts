import cors from "cors"
import express from "express"

import { env } from "./config/env.js"
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js"
import authRouter from "./modules/auth/auth.route.js"
import categoryRouter from "./modules/categories/category.route.js"
import serviceRouter from "./routes/service.route.js"

const app = express()

app.disable("x-powered-by")

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
app.use("/api/categories", categoryRouter)
app.use("/api/services", serviceRouter)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
