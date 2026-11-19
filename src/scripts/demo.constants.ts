/**
 * Shared identifiers for the reproducible local/demo dataset.
 * The admin is created separately with `npm run seed:admin` so its password is
 * chosen explicitly instead of being baked into the demo seed.
 */
export const DEMO_ACCOUNTS = {
  admin: { email: "admin@wedplan.dev", name: "WedPlan Admin" },
  premiumVendor: {
    email: "studio@wedplan.dev",
    name: "Ayesha Khan",
    businessName: "Golden Hour Studio",
  },
  freeVendor: {
    email: "flora@wedplan.dev",
    name: "Tanvir Ahmed",
    businessName: "Garden & Grain",
  },
  customer: {
    email: "couple@wedplan.dev",
    name: "Riya Rahman",
  },
} as const

export const DEMO_PASSWORD = "Demo1234"

export const DEMO_IDS = {
  premiumVendor: "6afd00000000000000000001",
  freeVendor: "6afd00000000000000000002",
  customer: "6afd00000000000000000003",
} as const
