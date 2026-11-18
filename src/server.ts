import app from "./app.js"
import { closeDB, connectDB } from "./config/db.js"
import { env } from "./config/env.js"

const startServer = async () => {
  try {
    await connectDB()

    const server = app.listen(env.port, () => {
      console.log(`WedPlan server is running on port ${env.port}`)
      console.log(`Client origin allowed by CORS: ${env.clientUrl}`)
    })

    const shutdown = (signal: string) => {
      console.log(`${signal} received. Shutting down gracefully...`)

      server.close(async () => {
        await closeDB()
        process.exit(0)
      })

      // Do not hang forever if a request refuses to finish.
      setTimeout(() => process.exit(1), 10_000).unref()
    }

    process.on("SIGINT", () => shutdown("SIGINT"))
    process.on("SIGTERM", () => shutdown("SIGTERM"))
  } catch (error) {
    console.error("Failed to start WedPlan server:", error)
    process.exit(1)
  }
}

void startServer()
