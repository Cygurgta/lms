# Rhyme Training Institute LMS

A full-stack, role-based LMS for learners, lecturers, and administrators. The workspace was empty when this project was created, so this is a new Vite + Express + PostgreSQL/Prisma monorepo.

## Important catalogue note

The supplied public deployment could not be fetched or reliably indexed during implementation. Seed programmes and courses are therefore explicitly marked **DEMO DATA**. Import the approved catalogue through the academic-structure administrator interface / Prisma database before production use; do not present these names as Rhyme’s official catalogue.

## Stack and architecture

- `client`: React, Vite, TypeScript, Tailwind, React Router, TanStack Query, React Hook Form, Zod, Recharts.
- `server`: Express, TypeScript, Prisma/PostgreSQL, JWT, bcrypt, Zod, Helmet, CORS, rate limiting and Multer.
- The `StorageProvider` interface in `server/src/services/storage.service.ts` uses local uploads today and is the seam for Cloudinary, Supabase Storage, or S3.

## Setup

1. Copy `server/.env.example` to `server/.env`, and `client/.env.example` to `client/.env`.
2. `npm install`
3. Start PostgreSQL with `docker compose up -d postgres`, then run `cd server && npx prisma generate && npx prisma migrate dev && npm run db:seed`.
4. `npm run dev`

Build both packages with `npm run build`.

Seed password for every account: `Rhyme@2026`

- Admin: `admin@rhyme.demo`
- Lecturer: `jane.kimani@rhyme.demo`
- Learner: `RHY/2026/001` or `student1@rhyme.demo`

## Security and deployment

Use long, unique production JWT secrets, PostgreSQL/Supabase for `DATABASE_URL`, a HTTPS frontend URL for `CLIENT_URL`, and an object-storage adapter before production deployment. The API uses role and course ownership checks, validated inputs, password hashes, secure headers, rate limits, MIME/size-restricted uploads, Prisma queries, and soft course deactivation. Deploy `client` to Vercel and `server` to Render; configure `CLIENT_URL`, `VITE_API_URL`, `DATABASE_URL`, and both JWT secrets on their respective platforms.

## API overview

`POST /api/auth/login`, `GET /api/auth/me`, `GET /api/dashboard`, course/material/assignment/submission/grade endpoints under `/api`, and admin academic structure under `GET /api/admin/structure`.
