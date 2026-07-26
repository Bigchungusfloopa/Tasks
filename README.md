# Tasks

A full-stack todo app with a glassmorphism React UI, an Express API, and PostgreSQL persistence.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+

## Setup

```bash
npm install
cp server/.env.example server/.env
createdb tasks
psql tasks < db/schema.sql
npm run dev
```

The React app runs at `http://localhost:5173` and the API runs at `http://localhost:4000`.

Set `DATABASE_URL` in `server/.env` if your Postgres connection differs from the default.
