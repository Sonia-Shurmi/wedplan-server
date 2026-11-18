
import "dotenv/config"
import { MongoClient, type Db } from "mongodb"

const uri = process.env.MONGODB_URI

if (!uri) {
  throw new Error("MONGODB_URI is missing from environment variables")
}

const client = new MongoClient(uri)

let database: Db

export const connectDB = async (): Promise<Db> => {
  try {
    await client.connect()

    database = client.db(process.env.DATABASE_NAME || "wedplan")

    console.log("MongoDB connected successfully!")

    return database
  } catch (error) {
    console.error("MongoDB connection failed:", error)
    throw error
  }
}

export const getDB = (): Db => {
  if (!database) {
    throw new Error("Database is not connected yet")
  }

  return database
}
