# Rhyme Training Institute LMS

A full-stack, role-based LMS for learners, lecturers, and administrators, built as a Vite + Express + PostgreSQL/Prisma monorepo.

## Important catalogue note

The supplied public deployment could not be fetched or reliably indexed during implementation. Seed programmes and courses are therefore explicitly marked **DEMO DATA**. Import the approved catalogue through the academic-structure administrator interface / Prisma database before production use; do not present these names as Rhyme’s official catalogue.

## Stack and architecture

- `client`: React, Vite, TypeScript, Tailwind, React Router, TanStack Query, React Hook Form, Zod, Recharts.
- `server`: Express, TypeScript, Prisma/PostgreSQL, JWT, bcrypt, Zod, Helmet, CORS, rate limiting and Multer.
- The `StorageProvider` interface in `server/src/services/storage.service.ts` uses local uploads today and is the seam for Cloudinary, Supabase Storage, or S3.

## Setup

1. Copy `server/.env.example` to `server/.env` and set unique JWT secrets. The template points to the local PostgreSQL port 5434. Copy `client/.env.example` to `client/.env` if you need a custom API URL.
2. Install all workspace dependencies from the repository root with `pnpm install`.
3. Start PostgreSQL with `docker compose up -d postgres`.
4. Run `pnpm db:generate`, `pnpm db:deploy`, and `pnpm db:seed` from the repository root to generate Prisma Client, apply committed migrations, and seed the database.
5. Run `pnpm dev` to start the API at port 4000 and the Vite client at port 5173 together.

Build both packages with `pnpm build`.

### Demonstration accounts

The idempotent seed creates these ten accounts on a clean database, all with password `Rhyme@2026`:

- Administrator: `admin@rhyme.demo`
- Lecturers: `jane.kimani@rhyme.demo`, `lecturer2@rhyme.demo`, `lecturer3@rhyme.demo`, `lecturer4@rhyme.demo`
- Learners: `student1@rhyme.demo` through `student5@rhyme.demo`; they can also sign in with `RHY/2026/001` through `RHY/2026/005`.

The seed preserves existing records and does not reset passwords or overwrite account edits when rerun. On a database that already contains additional accounts, it preserves them; it does not delete institutional data to force a ten-user total.

## Security and deployment

Use a long, unique production `JWT_SECRET`, PostgreSQL/Supabase for `DATABASE_URL`, a HTTPS frontend URL for `CLIENT_URL`, and an object-storage adapter before production deployment. Sessions use an eight-hour HTTP-only cookie; production requires HTTPS. The API uses role and course ownership checks, validated inputs, password hashes, secure headers, rate limits, MIME/size-restricted uploads, Prisma queries, and soft course deactivation. Deploy `client` to Vercel and `server` to Render; configure `CLIENT_URL`, `VITE_API_URL`, `DATABASE_URL`, and `JWT_SECRET` on their respective platforms.

## Profiles, messaging and themes

- Authenticated members can edit their name, phone number, short biography, profile photo, and theme preference. Public profile views omit email, phone, admission number, and account status.
- Profile and group images accept JPG, PNG, and WebP up to 5 MB and are served through authenticated endpoints. The development storage adapter writes to `server/uploads`; configure a durable object-storage adapter before deployment.
- Chat includes the shared **Rhyme Community** and private groups. Group reads, messages, member management, and group images are checked against membership on the API.
- Message history is paginated through REST; authenticated Server-Sent Events deliver new messages, room changes, and membership changes. The existing Express server hosts the event stream, so no separate realtime service is needed.
- The dark/light toggle respects the system theme until the user makes a choice. The chosen preference is saved on the profile and cached locally for fast restoration.

Apply the additive profile/chat migration to an existing database with `cd server && npx prisma migrate deploy`. For local development, `npx prisma migrate dev` applies the same migration and creates a development migration if needed. Neither command resets the database.

## API overview

`POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `GET/PATCH /api/profile`, authenticated profile image and public member profile routes under `/api/profile`, admin directory endpoints under `/api/profile/admin/users`, chat routes under `/api/chat` including `GET /api/chat/stream` (SSE), `GET /api/dashboard`, course/material/assignment/submission/grade endpoints under `/api`, and admin academic structure under `GET /api/admin/structure`.
