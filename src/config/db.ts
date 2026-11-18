import { MongoClient, type Db } from "mongodb"

import { env } from "./env.js"

interface MongoState {
  client: MongoClient
  db: Db
}

interface MongoGlobal {
  __wedplanMongo?: MongoState
  __wedplanMongoPromise?: Promise<Db>
}

const globalForMongo = globalThis as typeof globalThis & MongoGlobal

/**
 * Reuses a single MongoClient across hot reloads and serverless invocations.
 * Creating a client per request exhausts Atlas connections under load.
 */
export const connectDB = async (): Promise<Db> => {
  if (globalForMongo.__wedplanMongo) {
    return globalForMongo.__wedplanMongo.db
  }

  if (globalForMongo.__wedplanMongoPromise) {
    return globalForMongo.__wedplanMongoPromise
  }

  const connection = (async () => {
    const client = new MongoClient(env.mongodbUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
    })

    await client.connect()

    const db = client.db(env.databaseName)

    globalForMongo.__wedplanMongo = { client, db }

    console.log(`MongoDB connected successfully (database: ${env.databaseName})`)

    return db
  })()

  globalForMongo.__wedplanMongoPromise = connection

  try {
    return await connection
  } catch (error) {
    globalForMongo.__wedplanMongoPromise = undefined
    console.error("MongoDB connection failed:", error)
    throw error
  }
}

export const getDB = (): Db => {
  const state = globalForMongo.__wedplanMongo

  if (!state) {
    throw new Error("Database is not connected yet. Call connectDB() first.")
  }

  return state.db
}

export const closeDB = async (): Promise<void> => {
  const state = globalForMongo.__wedplanMongo

  if (!state) {
    return
  }

  await state.client.close()
  globalForMongo.__wedplanMongo = undefined
  globalForMongo.__wedplanMongoPromise = undefined
}
