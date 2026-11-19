import type { AuthUser } from "../modules/auth/auth.types.js"
import type { ValidatedRequest } from "../middleware/validate.js"

/**
 * Imported for its side effects by `src/app.ts`. Keeping the augmentation in a
 * regular module (rather than a standalone `.d.ts`) guarantees it is part of
 * Vercel's entry-graph compilation as well as the local `tsc` program.
 */
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
