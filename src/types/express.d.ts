import type { AuthUser } from "../modules/auth/auth.types.js"
import type { ValidatedRequest } from "../middleware/validate.js"

declare global {
  namespace Express {
    interface Request {
      /** Populated by authMiddleware after a verified JWT + database lookup. */
      user?: AuthUser
      /** Populated by the validate() middleware. */
      validated?: ValidatedRequest
    }
  }
}

export {}
