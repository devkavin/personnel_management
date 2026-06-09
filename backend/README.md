# Personnel Management Backend

Node.js, Express, MySQL backend for a multi-tenant personnel management system.

## Local Docker Start

From the repository root:

```bash
docker compose up --build
```

The API will be available at `http://localhost:4000`.

Default seeded super admin:

- Email: `admin@example.com`
- Password: `ChangeMe123!`

Change these with `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` before deploying anywhere real.

## Local Development Without Docker

```bash
cd backend
npm install
cp .env.example .env
npm run db:setup
npm run dev
```

## Main API Areas

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `GET/POST/PATCH /api/clients`
- `GET/PUT /api/clients/:id/features`
- `GET/POST/PATCH/DELETE /api/people`
- `GET/POST /api/attendance`
- `GET /api/dashboard`

Client-level data access is scoped by `client_id`. Client admins cannot choose another tenant; their tenant comes from the authenticated JWT user.
