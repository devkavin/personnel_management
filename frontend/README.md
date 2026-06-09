# Personnel Management Frontend

React + Vite frontend for the personnel management system.

## Local Development

```bash
cd frontend
npm install
npm run dev -- --port 5173
```

The app expects the backend at `http://localhost:4000/api` by default.

Override it with:

```bash
VITE_API_BASE_URL=http://localhost:4000/api
```

## Current Screens

- Login
- Role-aware dashboard shell
- Super admin dashboard summary
- Client admin dashboard summary
- Regular member dashboard placeholder

Attendance management screens will be added in the next frontend slice.
