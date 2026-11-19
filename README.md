# WedPlan — API Server

Express.js 5 + TypeScript + MongoDB API for [WedPlan](https://github.com/Sonia-Shurmi/wedplan-client), a wedding planning marketplace.

The API owns all business data — services, bookings, transactions, users and platform statistics — and enforces authentication, role authorization and resource ownership on every protected route.

> **Client Repository:** https://github.com/Sonia-Shurmi/wedplan-client
> **Live API:** _Add the deployed server URL here after deployment._
> **Client live site:** _Add the deployed client URL here after deployment._

---

## Table of Contents

- [Architecture](#architecture)
- [Features by Role](#features-by-role)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Authentication & Authorization](#authentication--authorization)
- [Stripe Payment Flow](#stripe-payment-flow)
- [Database Collections](#database-collections)
- [Scripts](#scripts)
- [Deployment (Vercel)](#deployment-vercel)
- [Security Checklist](#security-checklist)

---

## Architecture

```
Next.js client (Better Auth)  ──►  MongoDB Atlas (users, sessions, accounts)
        │
        │  Authorization: Bearer <Better Auth JWT>
        ▼
Express API  ──► verifies signature against Better Auth JWKS
             ──► loads the user from MongoDB (fresh role + isBlocked)
             ──► checks role and resource ownership
             ──► reads/writes services, bookings, transactions
        ▲
        │  signed webhook events
   Stripe
```

Better Auth runs in the Next.js client so the session cookie stays first-party. It issues short-lived JWTs through its JWT plugin and publishes the public keys at `/api/auth/jwks`. This server never receives the signing secret — it verifies tokens with the public keys only, then re-reads the user record so that role changes and blocks apply immediately.

---

## Features by Role

### Public

- `GET /api/services` — approved + active services with keyword search, category filter, location filter, price sorting and pagination.
- `GET /api/services/featured` — six newest approved + active services for the homepage.
- `GET /api/categories` — active wedding categories.

### Authenticated (any role)

- `GET /api/services/:id` — full service details. Requires a valid JWT, matching the client rule that service details are private. Non-admins only see approved + active services.

### Customer (JWT + `customer` role)

- Create a booking request for an approved, active service.
- Cannot book their own service (vendors with a customer capability are still blocked by ownership).
- Cannot create a duplicate active request for the same service and event date.
- List their own bookings with populated service and vendor data.
- Cancel a **pending** booking only.
- Read and update their own profile (name, image).

### Vendor (JWT + `vendor` role)

- Create, update and delete their own services; ownership is verified.
- Free plan: maximum 3 active services. Premium: unlimited.
- Toggle service availability.
- See approval status (`pending`, `approved`, `rejected`).
- List booking requests for their own services.
- Accept or reject **pending** requests; already processed requests are immutable.
- Create a Stripe Checkout session for their own subscription.
- Read their own subscription state.

### Admin (JWT + `admin` role)

- Platform statistics: users, vendors, customers, services, pending services, transaction totals.
- List/search users, filter by role, view details, block and unblock.
- Approve, reject, reactivate, deactivate or delete any service.
- Read transaction records. Payments are **never** editable through the API.

### Blocked users

`isBlocked: true` rejects every authenticated request with `403`, even if the JWT is still valid. Read-only browsing endpoints remain public.

---

## Technology Stack

| Concern       | Choice                                                        |
| ------------- | ------------------------------------------------------------- |
| Runtime       | Node.js 20.9+                                                 |
| Language      | TypeScript 5 (ESM, NodeNext)                                  |
| Framework     | Express 5                                                     |
| Database      | MongoDB official Node.js driver 7                             |
| Auth          | Better Auth JWT verified via remote JWKS (`jose`)              |
| Payments      | Stripe Checkout + Webhooks                                    |
| Image Hosting | ImgBB API                                                     |
| Validation    | Zod                                                           |
| Deployment    | Vercel serverless function (`api/index.ts`)                    |

---

## Project Structure

```
wedplan-server/
├── api/
│   └── index.ts                 # Vercel serverless entry (exports the app)
├── src/
│   ├── app.ts                   # Express app, middleware, routers
│   ├── server.ts                # Local listener + graceful shutdown
│   ├── config/
│   │   ├── db.ts                # cached MongoClient + getDB()
│   │   └── env.ts               # validated environment access
│   ├── middleware/
│   │   ├── auth.middleware.ts   # JWT verify + user reload
│   │   ├── role.middleware.ts   # requireRole('admin' | 'vendor' | 'customer')
│   │   ├── error.middleware.ts  # AppError → JSON response
│   │   └── validate.ts          # Zod body/query/params validation
│   ├── modules/
│   │   ├── auth/                # Better Auth user helpers
│   │   ├── categories/
│   │   ├── services/
│   │   ├── bookings/
│   │   ├── users/
│   │   ├── uploads/             # ImgBB proxy
│   │   ├── subscriptions/       # Stripe checkout + webhook
│   │   └── stats/
│   ├── scripts/
│   │   ├── demo.constants.ts       # reproducible demo ids + accounts
│   │   ├── seed-admin.ts           # explicit admin creation (no baked password)
│   │   ├── seed-categories.ts
│   │   ├── seed-demo-users.ts      # role dashboards + sample bookings
│   │   └── seed-services.ts
│   └── utils/
├── vercel.json
├── tsconfig.json
└── .env.example
```

---

## Getting Started

```bash
# 1. install
npm install

# 2. configure
cp .env.example .env
#    fill in MongoDB, Stripe, ImgBB and Better Auth URLs

# 3. seed (all commands are safe to re-run)
npm run seed:categories
npm run seed:services
npm run seed:demo
npm run seed:admin -- admin@wedplan.dev 'ChooseYourOwnPassword1'

# 4. run
npm run dev
# → http://localhost:5000/api/health
```

The Next.js client must be running separately on `http://localhost:3000`.

### Demo data

`npm run seed:demo` creates reproducible accounts for each role plus two sample
bookings, and `npm run seed:services` creates six public listings plus one
pending and one rejected listing so the admin queue has something to review.
Run these **only against a development database** — the demo password is public.

| Role           | Email                 | Password    | What it shows                                  |
| -------------- | --------------------- | ----------- | ---------------------------------------------- |
| Admin          | `admin@wedplan.dev`   | chosen in `seed:admin` | Users, moderation queue, transactions  |
| Premium vendor | `studio@wedplan.dev`  | `Demo1234`  | Premium badge, 3 listings, accepted booking    |
| Free vendor    | `flora@wedplan.dev`   | `Demo1234`  | Free plan, pending booking request              |
| Customer       | `couple@wedplan.dev`  | `Demo1234`  | One accepted and one pending booking           |

The admin password is intentionally **not** part of the demo seed: pass it to
`seed:admin` yourself and never commit it.

### Health check

```http
GET /api/health
```

```json
{
  "success": true,
  "message": "WedPlan API is running successfully!"
}
```

---

## Environment Variables

| Variable                | Required | Description                                                                 |
| ----------------------- | :------: | --------------------------------------------------------------------------- |
| `PORT`                  |    —     | Local port (default `5000`). Ignored on Vercel.                             |
| `NODE_ENV`              |    —     | `development` or `production`.                                              |
| `CLIENT_URL`            |    ✅    | Exact client origin allowed by CORS, e.g. `http://localhost:3000`.          |
| `MONGODB_URI`           |    ✅    | MongoDB Atlas connection string.                                            |
| `DATABASE_NAME`         |    ✅    | Database name. Must match the client app.                                   |
| `BETTER_AUTH_URL`       |    ✅    | Base URL of the Next.js app that issues JWTs (issuer + audience).           |
| `BETTER_AUTH_JWKS_URL`  |    —     | Optional override; defaults to `${BETTER_AUTH_URL}/api/auth/jwks`.          |
| `STRIPE_SECRET_KEY`     |    ✅    | Stripe test secret key (`sk_test_...`).                                     |
| `STRIPE_WEBHOOK_SECRET` |    ✅    | Webhook signing secret (`whsec_...`).                                       |
| `PREMIUM_PRICE_CENTS`   |    —     | Premium price in cents (default `1900`). Server-side only.                  |
| `IMGBB_API_KEY`         |    ✅    | ImgBB API key for image uploads.                                            |

This server deliberately does **not** hold `BETTER_AUTH_SECRET`: it only needs the public JWKS to verify tokens.

Never commit `.env`. Only `.env.example` is tracked.

---

## API Reference

All responses follow:

```json
{ "success": true, "message": "…", "data": {} }
```

Paginated lists add metadata:

```json
{
  "success": true,
  "message": "…",
  "data": [],
  "pagination": {
    "total": 8,
    "page": 1,
    "limit": 9,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

Errors:

```json
{ "success": false, "message": "…" }
```

`401` = missing/invalid/expired token. `403` = authenticated but not allowed (wrong role, blocked, not the owner). `404` = missing record. `400`/`422` = validation failure. `409` = conflict (duplicate booking, plan limit).

### Categories

| Method | Endpoint          | Access | Description            |
| ------ | ----------------- | ------ | ---------------------- |
| GET    | `/api/categories` | Public | List active categories |

### Services

| Method | Endpoint                    | Access | Description                                        |
| ------ | --------------------------- | ------ | -------------------------------------------------- |
| GET    | `/api/services`             | Public | Search / filter / sort approved + active services  |
| GET    | `/api/services/featured`    | Public | Six latest approved + active services              |
| GET    | `/api/services/:id`         | Auth   | Service details (approved + active for non-admins) |
| POST   | `/api/services`             | Vendor | Create a service (status `pending`)                |
| GET    | `/api/services/mine`        | Vendor | All services owned by the caller                   |
| PATCH  | `/api/services/:id`         | Vendor | Update own service                                 |
| DELETE | `/api/services/:id`         | Vendor | Delete own service                                 |
| PATCH  | `/api/services/:id/availability` | Vendor | Toggle `isActive` (plan limit enforced)       |
| GET    | `/api/admin/services`       | Admin  | All services with filters                          |
| PATCH  | `/api/admin/services/:id`   | Admin  | Approve / reject / activate / deactivate           |
| DELETE | `/api/admin/services/:id`   | Admin  | Delete a service                                   |

Query parameters for `GET /api/services`:

| Param      | Example             | Description                          |
| ---------- | ------------------- | ------------------------------------ |
| `search`   | `photography`       | Case-insensitive name search         |
| `category` | `Photography %26 Videography` | Exact display name of a category |
| `location` | `Dhaka`             | Case-insensitive location match      |
| `sort`     | `price_asc`         | `price_asc`, `price_desc`, `newest`  |
| `page`     | `1`                 | Page number                          |
| `limit`    | `12`                | Page size (max 24)                   |

### Bookings

| Method | Endpoint                    | Access   | Description                                  |
| ------ | --------------------------- | -------- | -------------------------------------------- |
| POST   | `/api/bookings`             | Customer | Create a booking request (`pending`)          |
| GET    | `/api/bookings/mine`        | Customer | Caller's booking requests                     |
| GET    | `/api/bookings/:id`         | Customer | Own booking details                           |
| PATCH  | `/api/bookings/:id/cancel`  | Customer | Cancel own pending booking                    |
| GET    | `/api/vendor/bookings`      | Vendor   | Requests for the caller's services            |
| PATCH  | `/api/vendor/bookings/:id`  | Vendor   | Accept or reject a pending request            |

### Subscription & Payments

| Method | Endpoint                          | Access | Description                                  |
| ------ | --------------------------------- | ------ | -------------------------------------------- |
| POST   | `/api/subscriptions/checkout`     | Vendor | Create a Stripe Checkout session for caller  |
| GET    | `/api/subscriptions/me`           | Vendor | Current plan, expiry and premium state       |
| POST   | `/api/webhooks/stripe`            | Stripe | Verified webhook handler (raw body)          |

### Users & Stats

| Method | Endpoint                     | Access   | Description                            |
| ------ | ---------------------------- | -------- | -------------------------------------- |
| GET    | `/api/profile`               | Auth     | Own profile                            |
| PATCH  | `/api/profile`               | Auth     | Update name / image / business name    |
| GET    | `/api/dashboard/customer`    | Customer | Customer statistics                    |
| GET    | `/api/dashboard/vendor`      | Vendor   | Vendor statistics                      |
| GET    | `/api/admin/stats`           | Admin    | Platform statistics                    |
| GET    | `/api/admin/users`           | Admin    | Search + role filter                   |
| GET    | `/api/admin/users/:id`       | Admin    | User details                           |
| PATCH  | `/api/admin/users/:id/block` | Admin    | Block or unblock a user                |
| GET    | `/api/admin/transactions`    | Admin    | Read-only transaction list             |

### Uploads

| Method | Endpoint                | Access   | Description                                        |
| ------ | ----------------------- | -------- | -------------------------------------------------- |
| POST   | `/api/uploads`          | Auth     | Upload a profile or service image via ImgBB        |
| POST   | `/api/uploads/public`   | Public\* | Sign-up avatar upload (size + MIME limited, throttled) |

\* Public because avatars are chosen before an account exists. It accepts images only (JPEG/PNG/WebP, ≤ 5 MB) and is rate limited.

---

## Authentication & Authorization

1. The client signs in through Better Auth and receives a short-lived JWT from the JWT plugin.
2. The client sends `Authorization: Bearer <token>` with every API request.
3. `auth.middleware.ts` verifies:
   - signature against the cached JWKS (`jose.createRemoteJWKSet`),
   - `iss` / `aud` equal `BETTER_AUTH_URL`,
   - expiry.
4. It then loads the user from MongoDB by id and attaches `req.user = { id, role, isBlocked, email }`.
5. `role.middleware.ts` rejects missing roles (`401`) and wrong roles (`403`).
6. Any `isBlocked` user is rejected with `403` on all authenticated routes.
7. Controllers verify ownership before writes, e.g. `service.vendorId === req.user.id`.

Client-supplied ids, roles and prices are never trusted.

---

## Stripe Payment Flow

1. Vendor clicks **Upgrade to Premium**.
2. `POST /api/subscriptions/checkout` creates a Checkout Session (`mode: subscription`) using a server-side price and the vendor's own account. The body cannot specify a different vendor or amount.
3. Stripe redirects the vendor to Checkout.
4. On success the vendor lands on `/payment/success`, which polls `GET /api/subscriptions/me`. Nothing is granted from this page.
5. Stripe calls `POST /api/webhooks/stripe`:
   - raw body is verified with `STRIPE_WEBHOOK_SECRET`,
   - `checkout.session.completed` inserts one `transactions` record (idempotent on `stripeSessionId`) and sets `subscriptionPlan: "premium"` with a 30-day `subscriptionExpiresAt`,
   - `invoice.paid` extends the expiry,
   - `customer.subscription.deleted` downgrades the vendor to `free`.
6. Expired premium plans are treated as free when services are created or reactivated.

---

## Database Collections

Business data lives in four collections; Better Auth manages its own.

### `users` (managed by Better Auth, extended)

| Field                   | Type    | Notes                                       |
| ----------------------- | ------- | ------------------------------------------- |
| `name`, `email`, `image`| string  | Core Better Auth fields                     |
| `emailVerified`         | boolean | Better Auth                                 |
| `role`                  | string  | `customer` \| `vendor` \| `admin`           |
| `isBlocked`             | boolean | Default `false`                             |
| `businessName`          | string  | Vendors only                                |
| `subscriptionPlan`      | string  | `free` \| `premium`                         |
| `subscriptionExpiresAt` | Date    | `null` on free plan                         |

### `services`

| Field         | Type     | Notes                            |
| ------------- | -------- | -------------------------------- |
| `vendorId`    | string   | User id (reference)              |
| `serviceName` | string   |                                  |
| `category`    | string   | Display name, one of the six seed categories |
| `description` | string   |                                  |
| `price`       | number   | Positive, USD                    |
| `location`    | string   |                                  |
| `images`      | string[] | ImgBB URLs                       |
| `status`      | string   | `pending` \| `approved` \| `rejected` |
| `isActive`    | boolean  | Vendor-controlled availability   |
| `createdAt`   | Date     |                                  |

### `bookings`

| Field           | Type   | Notes                                      |
| --------------- | ------ | ------------------------------------------ |
| `serviceId`     | string | Reference                                  |
| `vendorId`      | string | Reference                                  |
| `customerId`    | string | Reference                                  |
| `eventDate`     | Date   | Future date                                |
| `eventLocation` | string |                                            |
| `message`       | string | Optional                                   |
| `status`        | string | `pending` \| `accepted` \| `rejected` \| `cancelled` |
| `createdAt`     | Date   |                                            |

### `transactions`

| Field                  | Type   | Notes                          |
| ---------------------- | ------ | ------------------------------ |
| `vendorId`             | string | Reference                      |
| `plan`                 | string | `premium`                      |
| `amount`               | number | From Stripe, in cents          |
| `currency`             | string | e.g. `usd`                     |
| `stripeSessionId`      | string | Unique — idempotency key       |
| `stripeSubscriptionId` | string |                                |
| `status`               | string | `paid` \| `pending` \| `failed` |
| `createdAt`            | Date   |                                |

---

## Scripts

| Command                   | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `npm run dev`             | Start with `tsx watch`                          |
| `npm run build`           | Compile TypeScript                              |
| `npm run start`           | Run compiled server                             |
| `npm run typecheck`       | Type check only                                 |
| `npm run seed:categories` | Seed six categories                             |
| `npm run seed:services`   | Seed 8 demo listings (6 public, 1 pending, 1 rejected) |
| `npm run seed:demo`       | Seed three role accounts + two sample bookings  |
| `npm run seed:admin`      | Create or promote an admin; password passed as an argument and hashed by Better Auth |
| `npm run migrate:services`| Backfill legacy service categories              |

---

## Deployment (Vercel)

1. Import the repository into Vercel.
2. Framework preset: **Express** (auto-detected from `src/app.ts`, which default-exports the configured app). `vercel.json` pins the build command to `npm run build`.
3. Add every environment variable from `.env.example` to **Production** (and Preview if you use it). Set `CLIENT_URL` to the client origin and `BETTER_AUTH_URL` to the same origin the Next.js app uses for its JWT issuer/JWKS.
4. Deploy, then point the Stripe webhook at:
   `https://<server>.vercel.app/api/webhooks/stripe`
   with events `checkout.session.completed`, `invoice.paid` and `customer.subscription.deleted`.
5. Verify:
   - `GET /api/health` returns 200,
   - a signed-in request with a valid JWT returns data,
   - a request with a tampered token returns 401,
   - a customer calling an admin route returns 403,
   - `POST /api/webhooks/stripe` with a bad signature returns 400 and writes nothing.

MongoDB connections are cached at module scope so warm invocations reuse the pool. Stripe signs the exact request bytes, so the webhook route is registered with `express.raw()` before `express.json()`.

> **Why there is no `api/index.ts`:** current Vercel Express support detects `src/app.ts` automatically. Adding a second entry would create two functions for the same app, so the single default export is the serverless entry.

---

## Security Checklist

- [x] JWT signature, issuer, audience and expiry verified
- [x] Role loaded from the database, not from the token payload
- [x] Blocked users rejected on all protected routes
- [x] Ownership checks on every mutation
- [x] Zod validation on bodies, queries and params
- [x] Centralized error handler with correct status codes
- [x] Stripe secret and webhook secret server-side only
- [x] Webhook signature verification with raw body
- [x] Idempotent transaction creation
- [x] No client-supplied amount, role or vendor id trusted
- [x] `.env` ignored in git

---

## License

Built as a full-stack development assignment. Not affiliated with The Knot or Zola.
