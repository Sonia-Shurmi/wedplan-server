
import express from "express"
import cors from "cors"
import "dotenv/config"
import categoryRouter from "./modules/categories/category.route.js"
import serviceRouter from "./routes/service.route.js"

import { connectDB } from "./config/db.js"

const app = express()

// API routes
// API routes
app.use("/api/categories", categoryRouter)
app.use("/api/services", serviceRouter)

const PORT = Number(process.env.PORT) || 5000

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
)

app.use(express.json())

// Health check route
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "WedPlan API is running successfully!",
  })
})

// Start server after database connection
const startServer = async () => {
  try {
    await connectDB()

    app.listen(PORT, () => {
      console.log(`WedPlan server is running on port ${PORT}`)
    })
  } catch (error) {
    console.error("Failed to start WedPlan server:", error)
    process.exit(1)
  }
}

startServer()
