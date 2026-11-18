
import express from "express"
import cors from "cors"
import "dotenv/config"

const app = express()

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

// Start server
app.listen(PORT, () => {
  console.log(`WedPlan server is running on port ${PORT}`)
})
